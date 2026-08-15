import * as pdfjs from 'pdfjs-dist';

import type { OcrLine } from '../state/editStore';

export type EmbeddedTextRun = {
  text: string;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  hasEol: boolean;
  leadingSpace: boolean;
  trailingSpace: boolean;
};

const LINE_Y_TOLERANCE_RATIO = 0.55;
const WORD_GAP_RATIO = 0.12;
const COLUMN_GAP_RATIO = 4;

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
};

/** Removes invalid PDF text-map code points while retaining all valid Unicode content. */
export function sanitizeEmbeddedText(text: string): SanitizedEmbeddedText {
  let sanitized = '';
  let removedCodePoints = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (isUnsafeExtractedCodePoint(codePoint)) {
      removedCodePoints += 1;
    } else {
      sanitized += character;
    }
  }
  return { text: sanitized, removedCodePoints };
}

/** Returns whether embedded PDF text is safe to use as Unicode source text. */
export function isSafeEmbeddedText(text: string): boolean {
  return sanitizeEmbeddedText(text).removedCodePoints === 0;
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
 * Vertical or rotated text still returns no lines because its geometry is unsupported.
 *
 * @param pdfBytes Full PDF file bytes.
 * @param pageIndex Zero-based page index.
 */
export async function extractEmbeddedTextLines(
  pdfBytes: Uint8Array,
  pageIndex: number,
): Promise<OcrLine[]> {
  const doc = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
  try {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const runs: EmbeddedTextRun[] = [];
    let degraded = false;

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const sanitized = sanitizeEmbeddedText(item.str);
      if (sanitized.removedCodePoints > 0) degraded = true;

      const normalized = sanitized.text.normalize('NFC').replace(/\s+/gu, ' ');
      const text = normalized.trim();
      if (text.length === 0) continue;

      const style = textContent.styles[item.fontName];
      const [, rotateY, rotateX, , pdfX, pdfY] = item.transform;
      if (style?.vertical || Math.abs(rotateX) > 0.001 || Math.abs(rotateY) > 0.001) {
        return [];
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
      });
    }

    return clusterRunsIntoLines(runs).map((line) => ({
      id: crypto.randomUUID(),
      text: line.text,
      xPt: line.xPt,
      yPt: line.yPt,
      wPt: line.wPt,
      hPt: line.hPt,
      source: degraded ? 'embedded-degraded' : 'embedded',
    }));
  } finally {
    await doc.destroy();
  }
}

function shouldInsertSpace(previous: EmbeddedTextRun, current: EmbeddedTextRun): boolean {
  if (previous.trailingSpace || current.leadingSpace) return true;
  const gap = current.xPt - (previous.xPt + previous.wPt);
  return gap > Math.min(previous.hPt, current.hPt) * WORD_GAP_RATIO;
}

/** Groups adjacent PDF.js text runs into trustworthy line-level boxes. */
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

    if (sameBaseline && !previous.hasEol && !isSeparateColumn) last.push(run);
    else groups.push([run]);
  }

  return groups.map((group) => {
    const ordered = group.slice().sort((a, b) => a.xPt - b.xPt);
    const xPt = Math.min(...ordered.map((run) => run.xPt));
    const yPt = Math.min(...ordered.map((run) => run.yPt));
    const right = Math.max(...ordered.map((run) => run.xPt + run.wPt));
    const bottom = Math.max(...ordered.map((run) => run.yPt + run.hPt));
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
    };
  });
}
