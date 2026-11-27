/**
 * Document's own embedded font inspection, extraction, and eligibility checks for Plan B vector
 * text export (own-solutions idea 5, ADR 0021 amendment).
 *
 * When a Plan B edit replaces a Hindi run drawn with an embedded TrueType/OpenType font
 * (`Type0` / `CIDFontType2` / `Identity-H`, `FontFile2`), this module verifies that the embedded
 * font can genuinely shape and render every glyph of the new text before reusing its program:
 *   1. Valid TrueType sfnt with `head`, `hhea`, `maxp`, `hmtx`, `loca`, `glyf`, and `GSUB`.
 *   2. `OS/2` `fsType` does not forbid embedding (bit 1, `0x0002`, restricted licence);
 *      installable (`0`), preview & print (`0x0004`), and editable (`0x0008`) are allowed.
 *   3. `GSUB` contains a `deva` or `dev2` script with at least one active feature/lookup.
 *   4. HarfBuzz loads the font and shapes every line with no `.notdef` (GID 0), and every visible
 *      output glyph (including composite glyph components) has a real outline in `glyf`/`loca`.
 *
 * Any failure fails closed and returns a structured reason so Plan B falls back to the bundled
 * Noto font path unchanged.
 */
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFPage,
  PDFRawStream,
  PDFRef,
  PDFStream,
} from '@cantoo/pdf-lib';

import {
  type HarfBuzzEngine,
  HarfBuzzShaperFont,
  type ShapedCluster,
} from './harfbuzzWasm';
import { parseTtfMetrics, type TtfMetrics } from './ttfMetrics';

export type EmbeddedFontCandidate = {
  /** BaseFont name from the original PDF font dictionary (6-letter subset prefix stripped). */
  baseFontName: string;
  /** Indirect PDF reference to the original `FontFile2` stream, reused without mutating it. */
  fontFileRef: PDFRef;
  /** Decoded TrueType/OpenType program bytes from the original `FontFile2` stream. */
  fontBytes: Uint8Array;
};

export type OwnFontRejectReason =
  | 'invalid-sfnt'
  | 'restricted-license'
  | 'no-devanagari-gsub'
  | 'harfbuzz-load-failed'
  | 'empty-shaping'
  | 'notdef-glyph'
  | 'missing-outline';

export type OwnFontProgramInfo =
  | {
      ok: true;
      metrics: TtfMetrics;
      fsType: number;
      devanagariScripts: readonly ('deva' | 'dev2')[];
      hasGlyphOutline(gid: number): boolean;
    }
  | {
      ok: false;
      reason: Extract<OwnFontRejectReason, 'invalid-sfnt' | 'restricted-license' | 'no-devanagari-gsub'>;
    };

export type OwnFontDecision =
  | {
      useOwnFont: true;
      metrics: TtfMetrics;
      lines: { xPt: number; baselinePt: number; clusters: ShapedCluster[] }[];
    }
  | {
      useOwnFont: false;
      reason: OwnFontRejectReason;
    };

type TableRecord = { offset: number; length: number };

/** Bit 1 of OS/2 `fsType`: Restricted License embedding (forbids embedding/reuse). */
const OS2_FSTYPE_RESTRICTED_LICENSE = 0x0002;

/** TrueType composite glyph flags (ISO/IEC 14496-22 §glyf). */
const GLYF_ARG_1_AND_2_ARE_WORDS = 0x0001;
const GLYF_WE_HAVE_A_SCALE = 0x0008;
const GLYF_MORE_COMPONENTS = 0x0020;
const GLYF_WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
const GLYF_WE_HAVE_A_TWO_BY_TWO = 0x0080;

const MAX_COMPOSITE_DEPTH = 16;

const DEFAULT_IGNORABLE_CODEPOINTS = [0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0x00ad, 0xfeff];

function readTag(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function parseTableDirectory(bytes: Uint8Array): Map<string, TableRecord> | null {
  if (bytes.byteLength < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sfntVersion = view.getUint32(0, false);
  // TrueType outlines use 0x00010000 or 'true' (0x74727565); reject CFF ('OTTO') and garbage.
  if (sfntVersion !== 0x00010000 && sfntVersion !== 0x74727565) return null;
  const numTables = view.getUint16(4, false);
  if (numTables === 0 || bytes.byteLength < 12 + numTables * 16) return null;
  const tables = new Map<string, TableRecord>();
  for (let i = 0; i < numTables; i++) {
    const base = 12 + i * 16;
    const tag = readTag(view, base);
    const offset = view.getUint32(base + 8, false);
    const length = view.getUint32(base + 12, false);
    if (offset + length > bytes.byteLength) return null;
    tables.set(tag, { offset, length });
  }
  return tables;
}

/**
 * Inspects an OpenType `GSUB` table and returns the Devanagari script tags (`'deva'` / `'dev2'`)
 * that actually reference at least one feature with a valid non-empty lookup list.
 */
function findActiveDevanagariGsubScripts(
  view: DataView,
  gsub: TableRecord,
): ('deva' | 'dev2')[] {
  const base = gsub.offset;
  const end = base + gsub.length;
  if (gsub.length < 10) return [];

  const majorVersion = view.getUint16(base, false);
  if (majorVersion !== 1) return [];

  const scriptListOff = view.getUint16(base + 4, false);
  const featureListOff = view.getUint16(base + 6, false);
  const lookupListOff = view.getUint16(base + 8, false);

  const scriptListPos = base + scriptListOff;
  const featureListPos = base + featureListOff;
  const lookupListPos = base + lookupListOff;
  if (
    scriptListPos + 2 > end ||
    featureListPos + 2 > end ||
    lookupListPos + 2 > end
  ) {
    return [];
  }

  const lookupCount = view.getUint16(lookupListPos, false);
  if (lookupCount === 0) return [];

  const featureCount = view.getUint16(featureListPos, false);
  if (featureListPos + 2 + featureCount * 6 > end) return [];

  const featureHasActiveLookup = (featureIdx: number): boolean => {
    if (featureIdx >= featureCount) return false;
    const featRelOff = view.getUint16(featureListPos + 2 + featureIdx * 6 + 4, false);
    const featPos = featureListPos + featRelOff;
    if (featPos + 4 > end) return false;
    const lookupIndexCount = view.getUint16(featPos + 2, false);
    if (lookupIndexCount === 0 || featPos + 4 + lookupIndexCount * 2 > end) return false;
    for (let i = 0; i < lookupIndexCount; i++) {
      const lookupIdx = view.getUint16(featPos + 4 + i * 2, false);
      if (lookupIdx < lookupCount) return true;
    }
    return false;
  };

  const langSysHasActiveFeature = (langSysPos: number): boolean => {
    if (langSysPos + 6 > end) return false;
    const reqFeatureIndex = view.getUint16(langSysPos + 2, false);
    if (reqFeatureIndex !== 0xffff && featureHasActiveLookup(reqFeatureIndex)) return true;
    const featureIndexCount = view.getUint16(langSysPos + 4, false);
    if (langSysPos + 6 + featureIndexCount * 2 > end) return false;
    for (let i = 0; i < featureIndexCount; i++) {
      const featureIdx = view.getUint16(langSysPos + 6 + i * 2, false);
      if (featureHasActiveLookup(featureIdx)) return true;
    }
    return false;
  };

  const scriptCount = view.getUint16(scriptListPos, false);
  if (scriptListPos + 2 + scriptCount * 6 > end) return [];

  const active: ('deva' | 'dev2')[] = [];
  for (let i = 0; i < scriptCount; i++) {
    const recPos = scriptListPos + 2 + i * 6;
    const tag = readTag(view, recPos);
    if (tag !== 'deva' && tag !== 'dev2') continue;
    const scriptRelOff = view.getUint16(recPos + 4, false);
    const scriptPos = scriptListPos + scriptRelOff;
    if (scriptPos + 4 > end) continue;

    const defaultLangSysOff = view.getUint16(scriptPos, false);
    const langSysCount = view.getUint16(scriptPos + 2, false);
    if (scriptPos + 4 + langSysCount * 6 > end) continue;

    let hasFeature = false;
    if (defaultLangSysOff !== 0 && langSysHasActiveFeature(scriptPos + defaultLangSysOff)) {
      hasFeature = true;
    }
    for (let k = 0; !hasFeature && k < langSysCount; k++) {
      const langRelOff = view.getUint16(scriptPos + 4 + k * 6 + 4, false);
      if (langRelOff !== 0 && langSysHasActiveFeature(scriptPos + langRelOff)) {
        hasFeature = true;
      }
    }
    if (hasFeature && !active.includes(tag)) active.push(tag);
  }
  return active;
}

/**
 * Builds a `glyf`/`loca` outline verifier that returns `true` iff `gid` has a non-empty glyph
 * outline in `glyf` (and for composite glyphs, every referenced component glyph also has a real
 * outline).
 */
function buildOutlineChecker(
  view: DataView,
  glyf: TableRecord,
  loca: TableRecord,
  indexToLocFormat: number,
  numGlyphs: number,
): ((gid: number) => boolean) | null {
  const entryBytes = indexToLocFormat === 0 ? 2 : indexToLocFormat === 1 ? 4 : 0;
  if (entryBytes === 0) return null;
  if (loca.length < (numGlyphs + 1) * entryBytes) return null;

  const glyphRange = (gid: number): [number, number] | null => {
    if (gid < 0 || gid >= numGlyphs) return null;
    const start =
      indexToLocFormat === 0
        ? view.getUint16(loca.offset + gid * 2, false) * 2
        : view.getUint32(loca.offset + gid * 4, false);
    const end =
      indexToLocFormat === 0
        ? view.getUint16(loca.offset + (gid + 1) * 2, false) * 2
        : view.getUint32(loca.offset + (gid + 1) * 4, false);
    if (end < start || end > glyf.length) return null;
    return [start, end];
  };

  const cache = new Map<number, boolean>();

  const check = (gid: number, visited: Set<number>, depth: number): boolean => {
    const cached = cache.get(gid);
    if (cached !== undefined) return cached;
    if (depth > MAX_COMPOSITE_DEPTH || visited.has(gid)) return false;

    const range = glyphRange(gid);
    if (!range) return false;
    const [start, end] = range;
    // A TrueType glyph header is 10 bytes (numberOfContours + bbox).
    if (end - start < 10) {
      cache.set(gid, false);
      return false;
    }

    const absStart = glyf.offset + start;
    const absEnd = glyf.offset + end;
    const numberOfContours = view.getInt16(absStart, false);
    if (numberOfContours > 0) {
      cache.set(gid, true);
      return true;
    }
    if (numberOfContours === 0) {
      cache.set(gid, false);
      return false;
    }

    // Composite glyph: verify every referenced component glyph also has a real outline.
    visited.add(gid);
    let pos = absStart + 10;
    let componentCount = 0;
    let allValid = true;
    while (pos + 4 <= absEnd) {
      const flags = view.getUint16(pos, false);
      const compGid = view.getUint16(pos + 2, false);
      pos += 4;
      componentCount++;
      if (compGid === 0 || !check(compGid, visited, depth + 1)) {
        allValid = false;
        break;
      }
      pos += flags & GLYF_ARG_1_AND_2_ARE_WORDS ? 4 : 2;
      if (flags & GLYF_WE_HAVE_A_SCALE) pos += 2;
      else if (flags & GLYF_WE_HAVE_AN_X_AND_Y_SCALE) pos += 4;
      else if (flags & GLYF_WE_HAVE_A_TWO_BY_TWO) pos += 8;
      if ((flags & GLYF_MORE_COMPONENTS) === 0) break;
    }
    visited.delete(gid);
    const result = allValid && componentCount > 0 && pos <= absEnd;
    cache.set(gid, result);
    return result;
  };

  return (gid: number) => check(gid, new Set<number>(), 0);
}

/**
 * Inspects a TrueType font program binary for own-font eligibility (valid sfnt tables, allowed
 * OS/2 `fsType`, active `GSUB` Devanagari script features, and `glyf`/`loca` outline reader).
 */
export function inspectOwnFontProgram(fontBytes: Uint8Array): OwnFontProgramInfo {
  const tables = parseTableDirectory(fontBytes);
  if (!tables) return { ok: false, reason: 'invalid-sfnt' };

  const head = tables.get('head');
  const glyf = tables.get('glyf');
  const loca = tables.get('loca');
  if (!head || head.length < 54 || !glyf || !loca) {
    return { ok: false, reason: 'invalid-sfnt' };
  }

  const view = new DataView(fontBytes.buffer, fontBytes.byteOffset, fontBytes.byteLength);

  // Check OS/2 fsType permission bits (bit 1 = restricted licence forbids reuse/embedding).
  let fsType = 0;
  const os2 = tables.get('OS/2');
  if (os2) {
    if (os2.length < 10) return { ok: false, reason: 'invalid-sfnt' };
    fsType = view.getUint16(os2.offset + 8, false);
    if ((fsType & OS2_FSTYPE_RESTRICTED_LICENSE) !== 0) {
      return { ok: false, reason: 'restricted-license' };
    }
  }

  // Check GSUB table for active Devanagari features (deva / dev2).
  const gsub = tables.get('GSUB');
  if (!gsub) return { ok: false, reason: 'no-devanagari-gsub' };
  const devanagariScripts = findActiveDevanagariGsubScripts(view, gsub);
  if (devanagariScripts.length === 0) return { ok: false, reason: 'no-devanagari-gsub' };

  let metrics: TtfMetrics;
  try {
    metrics = parseTtfMetrics(fontBytes);
  } catch {
    return { ok: false, reason: 'invalid-sfnt' };
  }

  const indexToLocFormat = view.getInt16(head.offset + 50, false);
  const hasGlyphOutline = buildOutlineChecker(view, glyf, loca, indexToLocFormat, metrics.numGlyphs);
  if (!hasGlyphOutline) return { ok: false, reason: 'invalid-sfnt' };

  return {
    ok: true,
    metrics,
    fsType,
    devanagariScripts,
    hasGlyphOutline,
  };
}

/**
 * Evaluates whether an already-inspected embedded font + HarfBuzz shaper can cleanly typeset
 * `lines` (every glyph non-zero and every visible glyph backed by a real outline in `glyf`/`loca`).
 */
export function evaluateOwnFontWithShaper(
  info: Extract<OwnFontProgramInfo, { ok: true }>,
  shaper: HarfBuzzShaperFont,
  lines: readonly { xPt: number; baselinePt: number; text: string }[],
): OwnFontDecision {
  if (lines.length === 0) return { useOwnFont: false, reason: 'empty-shaping' };

  // Precompute nominal GIDs of default-ignorable codepoints (ZWJ, ZWNJ, soft hyphen, etc.)
  // so an invisible zero-advance glyph emitted for them inside a cluster isn't misread as missing.
  const ignorableGids = new Set<number>();
  for (const cp of DEFAULT_IGNORABLE_CODEPOINTS) {
    const gid = shaper.nominalGlyph(cp);
    if (gid > 0) ignorableGids.add(gid);
  }

  const shapedLines: { xPt: number; baselinePt: number; clusters: ShapedCluster[] }[] = [];

  for (const line of lines) {
    let clusters: ShapedCluster[];
    try {
      clusters = shaper.shapeLine(line.text);
    } catch {
      return { useOwnFont: false, reason: 'harfbuzz-load-failed' };
    }
    if (line.text.length > 0 && clusters.every((c) => c.glyphs.length === 0)) {
      return { useOwnFont: false, reason: 'empty-shaping' };
    }

    for (const cluster of clusters) {
      const isWhitespace = /^\s+$/u.test(cluster.text);
      const isPureIgnorable = /^[\u200B-\u200F\u2060\u00AD\uFEFF]+$/u.test(cluster.text);
      const containsIgnorable = /[\u200B-\u200F\u2060\u00AD\uFEFF]/u.test(cluster.text);

      for (const glyph of cluster.glyphs) {
        if (glyph.gid <= 0 || glyph.gid >= info.metrics.numGlyphs) {
          return { useOwnFont: false, reason: 'notdef-glyph' };
        }
        if (isWhitespace) {
          const adv = info.metrics.advanceWidths[glyph.gid] ?? 0;
          if (adv === 0 && glyph.xAdvance === 0) {
            return { useOwnFont: false, reason: 'missing-outline' };
          }
          continue;
        }
        if (isPureIgnorable) continue;
        if (containsIgnorable && glyph.xAdvance === 0 && ignorableGids.has(glyph.gid)) {
          continue;
        }
        if (!info.hasGlyphOutline(glyph.gid)) {
          return { useOwnFont: false, reason: 'missing-outline' };
        }
      }
    }

    shapedLines.push({ xPt: line.xPt, baselinePt: line.baselinePt, clusters });
  }

  return { useOwnFont: true, metrics: info.metrics, lines: shapedLines };
}

/**
 * Full decision check for one embedded font binary and a set of text lines: inspects the sfnt
 * tables (`OS/2` `fsType`, `GSUB` `deva`/`dev2`, `glyf`/`loca`), loads it into HarfBuzz, and
 * verifies every shaped glyph has a real outline.
 */
export function evaluateOwnFontForLines(
  engine: HarfBuzzEngine,
  fontBytes: Uint8Array,
  lines: readonly { xPt: number; baselinePt: number; text: string }[],
): OwnFontDecision {
  const info = inspectOwnFontProgram(fontBytes);
  if (!info.ok) return { useOwnFont: false, reason: info.reason };

  let shaper: HarfBuzzShaperFont;
  try {
    // Shape at the embedded font's native design coordinates (no variation override) so advances
    // match the reused FontFile2 stream's outlines and hmtx widths.
    shaper = new HarfBuzzShaperFont(engine, fontBytes);
  } catch {
    return { useOwnFont: false, reason: 'harfbuzz-load-failed' };
  }

  try {
    return evaluateOwnFontWithShaper(info, shaper, lines);
  } finally {
    shaper.destroy();
  }
}

function stripSubsetTag(baseFont: string): string {
  return baseFont.replace(/^\//, '').replace(/^[A-Z]{6}\+/, '');
}

/**
 * Extracts an embedded `Type0` / `CIDFontType2` / `Identity-H` / `FontFile2` font program from
 * `page`'s font resources without modifying the page or its font dictionaries. Returns `null` for
 * any other font type (Type3, simple TrueType, CFF, non-Identity-H, unembedded, or unreadable).
 */
export function extractEmbeddedFontCandidate(
  pdfDoc: PDFDocument,
  page: PDFPage,
  fontResourceName: string,
): EmbeddedFontCandidate | null {
  try {
    const resources = page.node.Resources();
    if (!resources) return null;
    const fontsObj = pdfDoc.context.lookup(resources.get(PDFName.of('Font')));
    if (!(fontsObj instanceof PDFDict)) return null;

    const fontObj = pdfDoc.context.lookup(fontsObj.get(PDFName.of(fontResourceName)));
    if (!(fontObj instanceof PDFDict)) return null;

    const subtype = pdfDoc.context.lookup(fontObj.get(PDFName.of('Subtype')));
    if (!(subtype instanceof PDFName) || subtype.decodeText() !== 'Type0') return null;

    const encoding = pdfDoc.context.lookup(fontObj.get(PDFName.of('Encoding')));
    if (!(encoding instanceof PDFName) || encoding.decodeText() !== 'Identity-H') return null;

    const descArr = pdfDoc.context.lookup(fontObj.get(PDFName.of('DescendantFonts')));
    if (!(descArr instanceof PDFArray) || descArr.size() === 0) return null;

    const cidFont = pdfDoc.context.lookup(descArr.get(0));
    if (!(cidFont instanceof PDFDict)) return null;

    const cidSubtype = pdfDoc.context.lookup(cidFont.get(PDFName.of('Subtype')));
    if (!(cidSubtype instanceof PDFName) || cidSubtype.decodeText() !== 'CIDFontType2') return null;

    const descriptor = pdfDoc.context.lookup(cidFont.get(PDFName.of('FontDescriptor')));
    if (!(descriptor instanceof PDFDict)) return null;

    const fontFileRaw = descriptor.get(PDFName.of('FontFile2'));
    if (!(fontFileRaw instanceof PDFRef)) return null;

    const fontFileObj = pdfDoc.context.lookup(fontFileRaw);
    let fontBytes: Uint8Array;
    if (fontFileObj instanceof PDFRawStream) {
      fontBytes = decodePDFRawStream(fontFileObj).decode();
    } else if (fontFileObj instanceof PDFStream) {
      fontBytes = fontFileObj.getContents();
    } else {
      return null;
    }
    if (fontBytes.byteLength < 12) return null;

    const baseObj =
      pdfDoc.context.lookup(fontObj.get(PDFName.of('BaseFont'))) ??
      pdfDoc.context.lookup(cidFont.get(PDFName.of('BaseFont')));
    const rawName = baseObj instanceof PDFName ? baseObj.decodeText() : 'EmbeddedDevanagari';
    const baseFontName = stripSubsetTag(rawName) || 'EmbeddedDevanagari';

    return {
      baseFontName,
      fontFileRef: fontFileRaw,
      fontBytes,
    };
  } catch {
    return null;
  }
}
