
import { OPS, Util } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { fontHintFromPdfFont } from './fontMatch';
import { krutiDevToUnicode } from './krutiDev';
import { isLegacyDevanagariFontName, looksLikeLegacyDevanagariText } from './legacyFontDetector';
import { sharedPdfDocument } from './sharedPdfDocument';
import { glyphPlaceholder, hasGlyphPlaceholder, isGlyphPlaceholder, repairText, type GlyphReading } from './glyphRepair';
import { imageRectsFromOperators, textImageRows, type PtBox } from './pdfImageRects';
import { strokeEmPerItem, strokeRunsFromOperators } from './textStroke';
import type { FontHint, OcrLine } from '../state/editStore';

export type EmbeddedTextRun = {
  text: string;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  hasEol: boolean;
  leadingSpace: boolean;
  trailingSpace: boolean;
  /** Baseline, in PDF points from the page top. */
  baselineYPt?: number;
  font?: FontHint;
};

const LINE_Y_TOLERANCE_RATIO = 0.55;
const WORD_GAP_RATIO = 0.12;
const COLUMN_GAP_RATIO = 0.75;

function isPrivateUseCodePoint(codePoint: number | undefined): boolean {
  return (
    codePoint !== undefined &&
    ((codePoint >= 0xe000 && codePoint <= 0xf8ff) ||
      (codePoint >= 0xf0000 && codePoint <= 0xffffd) ||
      (codePoint >= 0x100000 && codePoint <= 0x10fffd))
  );
}

function isUnsafeExtractedCodePoint(codePoint: number | undefined): boolean {
  return (
    codePoint === undefined ||
    codePoint === 0x7f ||
    codePoint === 0xfffd ||
    (codePoint >= 0 && codePoint <= 0x08) ||
    (codePoint >= 0x0b && codePoint <= 0x0c) ||
    (codePoint >= 0x0e && codePoint <= 0x1f)
  );
}

export type SanitizedEmbeddedText = {
  text: string;
  removedCodePoints: number;
  removedPrivateUseCodePoints: number;
};

/**
 * Removes invalid text-map bytes and font-specific private-use glyphs from embedded PDF text.
 * Glyph placeholders (see glyphRepair.ts) are kept.
 */
export function sanitizeEmbeddedText(text: string): SanitizedEmbeddedText {
  let sanitized = '';
  let removedCodePoints = 0;
  let removedPrivateUseCodePoints = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (isGlyphPlaceholder(character)) {
      // Stands in for an unmapped glyph until it is repaired (see glyphRepair.ts).
      sanitized += character;
    } else if (isUnsafeExtractedCodePoint(codePoint)) {
      removedCodePoints += 1;
    } else if (isPrivateUseCodePoint(codePoint)) {
      removedCodePoints += 1;
      removedPrivateUseCodePoints += 1;
    } else {
      sanitized += character;
    }
  }
  return { text: sanitized, removedCodePoints, removedPrivateUseCodePoints };
}

/** Returns whether embedded PDF text is safe to use as Unicode source text. */
export function isSafeEmbeddedText(text: string): boolean {
  return sanitizeEmbeddedText(text).removedCodePoints === 0;
}

/**
 * Whether a text transform `[a, b, c, d, e, f]` is horizontal on screen. Only `b` signals rotation:
 * synthetic italics set `c` alone (a horizontal shear), and their geometry is the same as upright
 * text, so they must not discard the page's text. Pass the transform combined with the page
 * viewport, so a page's `/Rotate` is taken into account.
 *
 * @param transform Text transform in viewport space (pt at scale 1).
 */
export function isHorizontalTextTransform(transform: readonly number[]): boolean {
  return Math.abs(transform[1] ?? 0) <= 0.001;
}

/**
 * Converts PDF.js `TextItem.width` to a line-box width at the scale-1 viewport used here.
 * PDF.js already reports this width in device space, so font-transform scale is intentionally
 * not applied a second time.
 */
export function textItemWidthPt(widthInDeviceSpace: number, fontHeightPt: number): number {
  return Math.max(fontHeightPt * 0.2, widthInDeviceSpace);
}

function ascentRatio(style: { ascent?: number; descent?: number }): number {
  if (typeof style.ascent === 'number' && Number.isFinite(style.ascent)) {
    return style.ascent;
  }
  if (typeof style.descent === 'number' && Number.isFinite(style.descent)) {
    return 1 + style.descent;
  }
  return 0.8;
}

/**
 * Extracts selectable text runs from an embedded (non-scanned) PDF page via PDF.js, converted
 * into reading-order line boxes in PDF points (top-left origin, same space as `OcrLine`).
 *
 * NUL/control/replacement characters from an incomplete PDF text map are stripped and the page
 * is marked `embedded-degraded`. This keeps its accurate boxes available for manual editing while
 * allowing cloud-assisted translation to replace the unreliable strings with image OCR first.
 * Font-specific private-use glyphs are omitted without degrading the page so icons remain in the
 * immutable raster background instead of turning into missing-glyph boxes when adjacent text is
 * edited.
 * Vertical or rotated runs are skipped because their geometry is unsupported; the rest of the
 * page is still returned. Italic (sheared) text is horizontal and is kept.
 *
 * With `convertLegacy`, runs set in a KrutiDev-family font (found by name, or by that font's text
 * reading as KrutiDev keystrokes) are converted to Unicode; runs in other fonts (URLs, numbers in
 * Arial) are left as they are.
 *
 * @param pdfBytes Full PDF file bytes.
 * @param pageIndex Zero-based page index.
 * @param options.convertLegacy Convert KrutiDev-family runs to Unicode.
 */
export async function extractEmbeddedTextLines(
  pdfBytes: Uint8Array,
  pageIndex: number,
  options: {
    convertLegacy?: boolean;
    /** Keep glyph placeholders in the text (for learning them) instead of dropping them. */
    keepGlyphPlaceholders?: boolean;
    /** Learned readings of unmapped glyphs, applied to each line. */
    glyphReadings?: ReadonlyMap<string, GlyphReading>;
    /** Filled with the page's Devanagari text by font (pdf.js loaded name), for font trust. */
    devanagariTextByFont?: Map<string, string>;
    /**
     * Reads text drawn as images (see pdfImageRects.ts): called once with the image rows the text
     * layer does not cover, in pt, and returns each row's text (null for none). The rows are added
     * as runs, so a word drawn as an image lands in its sentence.
     */
    readTextImages?: (rows: PtBox[]) => Promise<(string | null)[]>;
  } = {},
): Promise<OcrLine[]> {
  const doc = await sharedPdfDocument(pdfBytes);
  const page = await doc.getPage(pageIndex + 1);
  try {
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    // Font names (Times-Bold, Cambria,BoldItalic, Hind…) are only available once the page's
    // operators have been parsed.
    const operators = await page.getOperatorList();
    const fontNameOf = (fontName: string): string | undefined => {
      try {
        return (page.commonObjs.get(fontName) as { name?: string } | undefined)?.name;
      } catch {
        return undefined;
      }
    };
    // Unmapped glyphs come out as U+0000; each becomes a placeholder for its font and glyph, so it
    // can be learned and repaired. Only when they line up one to one with the drawn glyphs.
    const unmapped = unmappedGlyphs(operators.fnArray, operators.argsArray, (name) => fontNameOf(name) ?? name);
    const itemTexts = textContent.items.map((item) => ('str' in item ? item.str : ''));
    const NUL = String.fromCharCode(0);
    const nulls = itemTexts.reduce((count, text) => count + text.split(NUL).length - 1, 0);
    if (nulls > 0 && nulls === unmapped.length) {
      let next = 0;
      for (const [i, text] of itemTexts.entries()) {
        itemTexts[i] = text.split(NUL).reduce((out, part, k) => {
          if (k === 0) return part;
          const glyph = unmapped[next++];
          return out + glyphPlaceholder(pdfBytes, glyph.key, glyph.signature) + part;
        }, '');
      }
    }
    const itemStrokes = strokeEmPerItem(
      textContent.items.map((item) => ('str' in item ? item.str : '')),
      strokeRunsFromOperators(operators.fnArray, operators.argsArray, OPS),
    );
    const runs: EmbeddedTextRun[] = [];
    let degraded = false;

    const legacyFonts = new Set<string>();
    if (options.convertLegacy) {
      const textByFont = new Map<string, string>();
      for (const item of textContent.items) {
        if ('str' in item) textByFont.set(item.fontName, `${textByFont.get(item.fontName) ?? ''} ${item.str}`);
      }
      for (const [fontName, text] of textByFont) {
        const name = fontNameOf(fontName) ?? '';
        if ((isLegacyDevanagariFontName(name) && /kruti|devlys/i.test(name)) || looksLikeLegacyDevanagariText(text)) {
          legacyFonts.add(fontName);
        }
      }
    }

    for (const [itemIndex, item] of textContent.items.entries()) {
      if (!('str' in item)) continue;
      const str = itemTexts[itemIndex];
      const sanitized = sanitizeEmbeddedText(
        legacyFonts.has(item.fontName) ? krutiDevToUnicode(str) : str,
      );
      if (sanitized.removedCodePoints > sanitized.removedPrivateUseCodePoints) degraded = true;

      const normalized = sanitized.text.normalize('NFC').replace(/\s+/gu, ' ');
      const text = normalized.trim();
      if (text.length === 0) continue;
      if (options.devanagariTextByFont && /[\u0900-\u097F]/u.test(text)) {
        const byFont = options.devanagariTextByFont;
        byFont.set(item.fontName, `${byFont.get(item.fontName) ?? ''} ${text}`);
      }

      const style = textContent.styles[item.fontName];
      const [, , , , pdfX, pdfY] = item.transform;
      // Rotated or vertical runs (diagonal watermarks, sideways labels) are skipped on their own;
      // they must not discard the rest of the page's text layer.
      if (style?.vertical || !isHorizontalTextTransform(Util.transform(viewport.transform, item.transform))) {
        continue;
      }

      // PDF.js documents TextItem.width/height as device-space values. At a scale-1
      // viewport they are already PDF-point sizes; multiplying by the font transform again
      // creates the 10–15x-wide boxes this editor previously displayed.
      const fontHeightPt = Math.max(4, item.height * viewport.scale);
      const wPt = textItemWidthPt(item.width * viewport.scale, fontHeightPt);
      const [xPt, baselineY] = viewport.convertToViewportPoint(pdfX, pdfY);
      const yPt = baselineY - fontHeightPt * ascentRatio(style ?? {});

      if (![xPt, yPt, wPt, fontHeightPt].every(Number.isFinite)) return [];

      runs.push({
        text,
        xPt,
        yPt: Math.max(0, yPt),
        wPt,
        hPt: fontHeightPt,
        hasEol: item.hasEOL,
        leadingSpace: /^\s/u.test(normalized),
        trailingSpace: /\s$/u.test(normalized),
        baselineYPt: baselineY,
        // Converted KrutiDev runs carry no usable style information (pdf.js guesses "serif");
        // Noto Sans is the closer look for them.
        font: legacyFonts.has(item.fontName)
          ? { serif: false, bold: false, italic: Math.abs(item.transform[2]) > 0.001 }
          : withStroke(
              fontHintFromPdfFont(fontNameOf(item.fontName), style?.fontFamily, Math.abs(item.transform[2]) > 0.001),
              itemStrokes[itemIndex],
            ),
      });
    }

    if (options.readTextImages) {
      const images = imageRectsFromOperators(operators.fnArray, operators.argsArray, OPS).map((rect) => {
        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);
        return { xPt: Math.min(x1, x2), yPt: Math.min(y1, y2), wPt: Math.abs(x2 - x1), hPt: Math.abs(y2 - y1) };
      });
      const rows = textImageRows(images, runs);
      const texts = rows.length > 0 ? await options.readTextImages(rows) : [];
      rows.forEach((row, i) => {
        const text = texts[i]?.trim();
        if (!text) return;
        runs.push({
          ...row,
          text,
          hasEol: false,
          leadingSpace: true,
          trailingSpace: true,
          // Images carry no baseline; most of a text line's height sits above it.
          baselineYPt: row.yPt + row.hPt * 0.8,
        });
      });
    }

    const lines = clusterRunsIntoLines(withoutRepeatedRuns(runs)).map((line) => {
      const repaired = options.glyphReadings ? repairText(line.text, options.glyphReadings, isGlyphPlaceholder) : line.text;
      if (options.keepGlyphPlaceholders || !hasGlyphPlaceholder(repaired)) return { ...line, text: repaired };
      degraded = true;
      return { ...line, text: [...repaired].filter((c) => !isGlyphPlaceholder(c)).join('').replace(/\s+/gu, ' ').trim() };
    });
    return lines.map((line) => ({
      id: crypto.randomUUID(),
      text: line.text,
      xPt: line.xPt,
      yPt: line.yPt,
      wPt: line.wPt,
      hPt: line.hPt,
      source: degraded ? 'embedded-degraded' : 'embedded',
      ...(line.baselineYPt !== undefined ? { baselineYPt: line.baselineYPt } : {}),
      ...(line.font ? { font: line.font } : {}),
    }));
  } finally {
    page.cleanup();
  }
}

/**
 * Every glyph drawn without a Unicode value, in drawing order: its key (pdf.js's loaded font
 * name, unique per PDF font, and the glyph's code) and its signature (the font's real name and the
 * glyph's advance width), see glyphPlaceholder.
 *
 * @param fontName The font's real name, from pdf.js's loaded name.
 */
function unmappedGlyphs(
  fnArray: number[],
  argsArray: unknown[],
  fontName: (loadedName: string) => string,
): { key: string; signature: string }[] {
  const glyphs: { key: string; signature: string }[] = [];
  let loaded = '';
  fnArray.forEach((fn, i) => {
    const args = argsArray[i] as unknown[] | null;
    if (fn === OPS.setFont) loaded = String(args?.[0]);
    if (fn !== OPS.showText) return;
    for (const glyph of (args?.[0] as ({ unicode?: string; originalCharCode?: number; width?: number } | number | null)[]) ?? []) {
      if (glyph && typeof glyph === 'object' && glyph.unicode === '\u0000') {
        glyphs.push({
          key: `${loaded}:${glyph.originalCharCode}`,
          signature: `${fontName(loaded)}|${Math.round(glyph.width ?? 0)}`,
        });
      }
    }
  });
  return glyphs;
}

/** Adds a faux-bold stroke to a font hint when the run was painted with one. */
function withStroke(font: FontHint, strokeEm: number): FontHint {
  return strokeEm > 0 ? { ...font, strokeEm } : font;
}

function shouldInsertSpace(previous: EmbeddedTextRun, current: EmbeddedTextRun): boolean {
  if (previous.trailingSpace || current.leadingSpace) return true;
  const gap = current.xPt - (previous.xPt + previous.wPt);
  return gap > Math.min(previous.hPt, current.hPt) * WORD_GAP_RATIO;
}

/** Groups adjacent PDF.js text runs into trustworthy line-level boxes. */
/** Positions closer than this, in PDF points, count as the same place. */
const SAME_PLACE_PT = 0.75;

/**
 * Drops runs painted again with the same text at the same place. Chrome prints stroked text
 * (`-webkit-text-stroke`) as a fill pass and a stroke pass, and some producers fake bold by
 * printing text twice; either way the text layer holds every line twice.
 */
export function withoutRepeatedRuns(runs: readonly EmbeddedTextRun[]): EmbeddedTextRun[] {
  const kept: EmbeddedTextRun[] = [];
  for (const run of runs) {
    const repeat = kept.some(
      (other) =>
        other.text === run.text &&
        Math.abs(other.xPt - run.xPt) < SAME_PLACE_PT &&
        Math.abs(other.yPt - run.yPt) < SAME_PLACE_PT &&
        Math.abs(other.wPt - run.wPt) < SAME_PLACE_PT * 2,
    );
    if (!repeat) kept.push(run);
  }
  return kept;
}

export function clusterRunsIntoLines(runs: readonly EmbeddedTextRun[]): EmbeddedTextRun[] {
  if (runs.length === 0) return [];

  const sorted = runs.slice().sort((a, b) => a.yPt - b.yPt || a.xPt - b.xPt);
  const groups: EmbeddedTextRun[][] = [];

  for (const run of sorted) {
    const last = groups[groups.length - 1];
    if (!last) {
      groups.push([run]);
      continue;
    }
    const sample = last[0];
    const previous = last[last.length - 1];
    const yTolerance = Math.max(3, sample.hPt * LINE_Y_TOLERANCE_RATIO);
    const sameBaseline =
      Math.abs(run.yPt + run.hPt / 2 - (sample.yPt + sample.hPt / 2)) <=
      yTolerance;
    const horizontalGap = run.xPt - (previous.xPt + previous.wPt);
    const isSeparateColumn =
      horizontalGap > Math.max(previous.hPt, run.hPt) * COLUMN_GAP_RATIO;
    const isHorizontalBacktrack =
      run.xPt < previous.xPt - Math.min(previous.hPt, run.hPt) * 0.25;

    if (sameBaseline && !previous.hasEol && !isSeparateColumn && !isHorizontalBacktrack) {
      last.push(run);
    } else {
      groups.push([run]);
    }
  }

  return groups.map((group) => {
    const ordered = group.slice().sort((a, b) => a.xPt - b.xPt);
    const xPt = Math.min(...ordered.map((run) => run.xPt));
    const yPt = Math.min(...ordered.map((run) => run.yPt));
    const right = Math.max(...ordered.map((run) => run.xPt + run.wPt));
    const bottom = Math.max(...ordered.map((run) => run.yPt + run.hPt));
    const widest = ordered.reduce((a, b) => (b.wPt > a.wPt ? b : a));
    let text = ordered[0]?.text ?? '';
    for (let index = 1; index < ordered.length; index += 1) {
      text += `${shouldInsertSpace(ordered[index - 1], ordered[index]) ? ' ' : ''}${ordered[index].text}`;
    }
    return {
      text: text.normalize('NFC').replace(/\s+/gu, ' ').trim(),
      xPt,
      yPt,
      wPt: Math.max(4, right - xPt),
      hPt: Math.max(4, bottom - yPt),
      hasEol: ordered[ordered.length - 1]?.hasEol ?? false,
      leadingSpace: false,
      trailingSpace: false,
      baselineYPt: widest.baselineYPt,
      font: widest.font,
    };
  }).sort((a, b) => {
    const centerDelta = a.yPt + a.hPt / 2 - (b.yPt + b.hPt / 2);
    const sameVisualLine =
      Math.abs(centerDelta) <= Math.max(3, Math.min(a.hPt, b.hPt) * LINE_Y_TOLERANCE_RATIO);
    return sameVisualLine ? a.xPt - b.xPt : a.yPt - b.yPt;
  });
}
