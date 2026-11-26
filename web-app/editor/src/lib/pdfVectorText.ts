/**
 * Plan B vector text exporter (web-only trial, off by default).
 *
 * Shapes edited and newly added text with HarfBuzz (WASM) using the bundled TrueType font file,
 * subsets and instances variable fonts into compact static TrueType binaries with
 * `harfbuzz-subset.wasm`, embeds each `(font, weight)` as a PDF Type0 / CIDFontType2 / Identity-H
 * font with a `ToUnicode` CMap, writes 2-byte glyph IDs (never string-based `drawText()`), and
 * wraps multi-glyph / multi-codepoint Devanagari clusters in `/Span << /ActualText <FEFF...> >>`
 * so Poppler (`pdftotext`), Acrobat, Preview, and our own editor extract exact logical Unicode.
 */
import {
  beginText,
  endText,
  LineJoinStyle,
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  PDFPage,
  PDFRef,
  PDFString,
  popGraphicsState,
  pushGraphicsState,
  setFillingRgbColor,
  setFontAndSize,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  setTextMatrix,
  setTextRenderingMode,
  setTextRise,
  TextRenderingMode,
} from '@cantoo/pdf-lib';

import type { Matrix } from './contentStreamText';
import { cssWeight } from './fontWeight';
import {
  type HarfBuzzEngine,
  HarfBuzzShaperFont,
  loadHarfBuzzEngine,
  type ShapedCluster,
  subsetAndInstanceFont,
} from './harfbuzzWasm';
import { parseTtfMetrics, type TtfMetrics } from './ttfMetrics';

/** Positioned single line of text in editor space (PDF points, top-left origin). */
export type PositionedLine = {
  text: string;
  xPt: number;
  baselinePt: number;
};

/** One text edit laid out into positioned lines, ready for Plan B vector drawing. */
export type VectorTextItem = {
  id: string;
  fontFamily: string;
  fontWeight?: number | 'normal' | 'bold';
  fontStyle?: 'italic';
  fontSizePt: number;
  color: string;
  scaleX?: number;
  strokeEm?: number;
  lines: PositionedLine[];
};

export type VectorTextPageInput = {
  page: PDFPage;
  editorToUser: Matrix;
  items: VectorTextItem[];
};

export type VectorTextDeps = {
  engine?: HarfBuzzEngine;
  loadFontBytes?: (family: string) => Promise<Uint8Array | null>;
};

const BUNDLED_TTF_URLS: Record<string, string> = {
  NotoSansDevanagari: '/edit/fonts/NotoSansDevanagari-Variable.ttf',
  NotoSerifDevanagari: '/edit/fonts/NotoSerifDevanagari-Variable.ttf',
};

const SYNTHETIC_ITALIC_SHEAR = 0.25;
const MAX_BFCHAR_BLOCK = 100;

const fontBytesCache = new Map<string, Promise<Uint8Array>>();

/** Returns whether a font family has a bundled raw TrueType binary supported by Plan B. */
export function hasBundledTrueTypeFont(family: string): boolean {
  return family in BUNDLED_TTF_URLS;
}

async function defaultLoadFontBytes(family: string): Promise<Uint8Array | null> {
  const url = BUNDLED_TTF_URLS[family];
  if (!url) return null;
  let pending = fontBytesCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch font ${url} (${res.status})`);
        return res.arrayBuffer();
      })
      .then((buf) => new Uint8Array(buf))
      .catch((err) => {
        fontBytesCache.delete(url);
        throw err;
      });
    fontBytesCache.set(url, pending);
  }
  return pending;
}

/** Parses a hex or rgb() CSS color string into normalized PDF RGB components [0..1]. */
export function parseCssColorRgb(color: string): [number, number, number] {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const raw = hex[1];
    if (raw.length === 3) {
      return [
        parseInt(raw[0] + raw[0], 16) / 255,
        parseInt(raw[1] + raw[1], 16) / 255,
        parseInt(raw[2] + raw[2], 16) / 255,
      ];
    }
    return [
      parseInt(raw.slice(0, 2), 16) / 255,
      parseInt(raw.slice(2, 4), 16) / 255,
      parseInt(raw.slice(4, 6), 16) / 255,
    ];
  }
  const rgbMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(color.trim());
  if (rgbMatch) {
    return [
      Math.min(255, Number(rgbMatch[1])) / 255,
      Math.min(255, Number(rgbMatch[2])) / 255,
      Math.min(255, Number(rgbMatch[3])) / 255,
    ];
  }
  return [0.067, 0.067, 0.067];
}

function multiplyMatrices(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function toHex4(n: number): string {
  return (n & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/** Encodes a JavaScript string as UTF-16BE hex with BOM (`FEFF`), safe for PDF `/ActualText`. */
export function encodeActualTextHex(text: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < text.length; i++) {
    hex += toHex4(text.charCodeAt(i));
  }
  return hex;
}

function encodeUtf16BeHex(text: string): string {
  let hex = '';
  for (let i = 0; i < text.length; i++) {
    hex += toHex4(text.charCodeAt(i));
  }
  return hex;
}

/** Builds a PDF 1.7 `ToUnicode` CMap stream mapping 2-byte GIDs to UTF-16BE Unicode sequences. */
export function buildToUnicodeCMap(toUnicode: ReadonlyMap<number, string>): string {
  const entries = [...toUnicode.entries()]
    .filter(([gid, text]) => gid > 0 && gid <= 0xffff && text.length > 0)
    .sort((a, b) => a[0] - b[0]);

  const lines: string[] = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
  ];

  for (let i = 0; i < entries.length; i += MAX_BFCHAR_BLOCK) {
    const chunk = entries.slice(i, i + MAX_BFCHAR_BLOCK);
    lines.push(`${chunk.length} beginbfchar`);
    for (const [gid, text] of chunk) {
      lines.push(`<${toHex4(gid)}> <${encodeUtf16BeHex(text)}>`);
    }
    lines.push('endbfchar');
  }

  lines.push(
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  );
  return lines.join('\n');
}

/** Builds a compact PDF CIDFont `/W` width array for the used GIDs in 1000-unit glyph space. */
function buildWidthsArray(
  pdfDoc: PDFDocument,
  usedGids: ReadonlySet<number>,
  metrics: TtfMetrics,
): PDFArray {
  const scale = 1000 / metrics.unitsPerEm;
  const sorted = [...usedGids].filter((g) => g >= 0 && g < metrics.numGlyphs).sort((a, b) => a - b);
  const wArray = PDFArray.withContext(pdfDoc.context);

  let i = 0;
  while (i < sorted.length) {
    const startGid = sorted[i];
    const runWidths = PDFArray.withContext(pdfDoc.context);
    let prev = startGid - 1;
    while (i < sorted.length && sorted[i] === prev + 1) {
      const gid = sorted[i];
      runWidths.push(PDFNumber.of(Math.round(metrics.advanceWidths[gid] * scale)));
      prev = gid;
      i++;
    }
    wArray.push(PDFNumber.of(startGid));
    wArray.push(runWidths);
  }
  return wArray;
}

/** Deterministic 6-letter uppercase PDF subset tag derived from font key and used GIDs. */
function makeSubsetTag(seed: string, usedGids: ReadonlySet<number>): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (const gid of [...usedGids].sort((a, b) => a - b)) {
    hash ^= gid;
    hash = Math.imul(hash, 16777619);
  }
  let tag = '';
  for (let i = 0; i < 6; i++) {
    tag += String.fromCharCode(65 + ((hash >>> (i * 5)) % 26));
  }
  return tag;
}

function embedCidFontSubset(
  pdfDoc: PDFDocument,
  family: string,
  weight: number,
  subsetBytes: Uint8Array,
  subsetMetrics: TtfMetrics,
  usedGids: ReadonlySet<number>,
  toUnicode: ReadonlyMap<number, string>,
): PDFRef {
  const context = pdfDoc.context;
  const scale = 1000 / subsetMetrics.unitsPerEm;
  const cleanFamily = family.replace(/[^A-Za-z0-9_-]/g, '') || 'Devanagari';
  const tag = makeSubsetTag(`${cleanFamily}-${weight}`, usedGids);
  const baseFontName = `${tag}+${cleanFamily}-W${weight}`;

  const fontFileStream = context.flateStream(subsetBytes, {
    Length1: subsetBytes.byteLength,
  });
  const fontFileRef = context.register(fontFileStream);

  const fontDescriptor = context.obj({
    Type: 'FontDescriptor',
    FontName: PDFName.of(baseFontName),
    Flags: 4,
    FontBBox: [
      Math.round(subsetMetrics.xMin * scale),
      Math.round(subsetMetrics.yMin * scale),
      Math.round(subsetMetrics.xMax * scale),
      Math.round(subsetMetrics.yMax * scale),
    ],
    ItalicAngle: subsetMetrics.italicAngle,
    Ascent: Math.round(subsetMetrics.ascender * scale),
    Descent: Math.round(subsetMetrics.descender * scale),
    CapHeight: Math.round(subsetMetrics.capHeight * scale),
    XHeight: Math.round(subsetMetrics.xHeight * scale),
    StemV: weight >= 600 ? 120 : 80,
    FontFile2: fontFileRef,
  });
  const fontDescriptorRef = context.register(fontDescriptor);

  const cidFontDict = context.obj({
    Type: 'Font',
    Subtype: 'CIDFontType2',
    BaseFont: PDFName.of(baseFontName),
    CIDSystemInfo: {
      Registry: PDFString.of('Adobe'),
      Ordering: PDFString.of('Identity'),
      Supplement: 0,
    },
    FontDescriptor: fontDescriptorRef,
    W: buildWidthsArray(pdfDoc, usedGids, subsetMetrics),
    CIDToGIDMap: 'Identity',
  });
  const cidFontRef = context.register(cidFontDict);

  const cmapText = buildToUnicodeCMap(toUnicode);
  const toUnicodeStream = context.flateStream(cmapText);
  const toUnicodeRef = context.register(toUnicodeStream);

  const type0Dict = context.obj({
    Type: 'Font',
    Subtype: 'Type0',
    BaseFont: PDFName.of(baseFontName),
    Encoding: 'Identity-H',
    DescendantFonts: [cidFontRef],
    ToUnicode: toUnicodeRef,
  });
  return context.register(type0Dict);
}

function roundPdfNum(n: number): number {
  const rounded = Math.round(n * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

type ShapedWord = {
  text: string;
  clusters: ShapedCluster[];
  isWhitespace: boolean;
};

function groupClustersIntoWords(clusters: readonly ShapedCluster[]): ShapedWord[] {
  const words: ShapedWord[] = [];
  for (const cluster of clusters) {
    const isWs = /^\s+$/u.test(cluster.text);
    const last = words[words.length - 1];
    if (last && last.isWhitespace === isWs) {
      last.text += cluster.text;
      last.clusters.push(cluster);
    } else {
      words.push({ text: cluster.text, clusters: [cluster], isWhitespace: isWs });
    }
  }
  return words;
}

function emitWordOperators(
  pdfDoc: PDFDocument,
  word: ShapedWord,
  metrics: TtfMetrics,
  fontSizePt: number,
  state: { risePt: number },
  ops: PDFOperator[],
): void {
  const context = pdfDoc.context;
  const scale = 1000 / metrics.unitsPerEm;
  const needsActualText =
    !word.isWhitespace &&
    word.clusters.some((c) => c.glyphs.length > 1 || c.text.length > 1);

  if (needsActualText) {
    ops.push(
      PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
        PDFName.of('Span'),
        `<< /ActualText <${encodeActualTextHex(word.text)}> >>`,
      ]),
    );
  }

  let tjEntries: (PDFHexString | PDFNumber)[] = [];
  const flushTj = () => {
    if (tjEntries.length === 0) return;
    const arr = PDFArray.withContext(context);
    for (const entry of tjEntries) arr.push(entry);
    ops.push(PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [arr]));
    tjEntries = [];
  };

  for (const cluster of word.clusters) {
    for (const glyph of cluster.glyphs) {
      const targetRise = roundPdfNum((glyph.yOffset / metrics.unitsPerEm) * fontSizePt);
      if (targetRise !== state.risePt) {
        flushTj();
        ops.push(setTextRise(targetRise));
        state.risePt = targetRise;
      }

      const declaredWidth = Math.round((metrics.advanceWidths[glyph.gid] ?? 0) * scale);
      const xo = roundPdfNum(glyph.xOffset * scale);
      const xa = roundPdfNum(glyph.xAdvance * scale);

      if (xo !== 0) {
        tjEntries.push(PDFNumber.of(roundPdfNum(-xo)));
      }
      tjEntries.push(PDFHexString.of(toHex4(glyph.gid)));
      const postAdj = roundPdfNum(declaredWidth + xo - xa);
      if (postAdj !== 0) {
        tjEntries.push(PDFNumber.of(postAdj));
      }
    }
  }
  flushTj();

  if (needsActualText) {
    ops.push(PDFOperator.of(PDFOperatorNames.EndMarkedContent));
  }
}

type FontBucket = {
  family: string;
  weight: number;
  fontBytes: Uint8Array;
  sourceMetrics: TtfMetrics;
  shaper: HarfBuzzShaperFont;
  nominalGlyphToChar: Map<number, string>;
  usedGids: Set<number>;
  toUnicode: Map<number, string>;
};

/**
 * Builds a reverse `GID -> Unicode` lookup from the font's nominal `cmap` for canonical NFC
 * ASCII and Devanagari characters so base glyphs never inherit a heuristic multi-char slice.
 */
function buildNominalGlyphToChar(shaper: HarfBuzzShaperFont): Map<number, string> {
  const map = new Map<number, string>();
  const registerRange = (from: number, to: number) => {
    for (let cp = from; cp <= to; cp++) {
      const ch = String.fromCodePoint(cp);
      if (ch.normalize('NFC') !== ch) continue;
      const gid = shaper.nominalGlyph(cp);
      if (gid > 0 && !map.has(gid)) map.set(gid, ch);
    }
  };
  registerRange(0x0020, 0x007e);
  registerRange(0x0900, 0x097f);
  return map;
}

/**
 * Maps every non-zero glyph GID in a shaped cluster into `toUnicode` so no drawn GID ever falls
 * through to Identity in viewers that ignore `/ActualText` (such as pdf.js).
 */
export function assignClusterToUnicode(
  cluster: ShapedCluster,
  nominalGlyphToChar: ReadonlyMap<number, string>,
  toUnicode: Map<number, string>,
): void {
  if (cluster.glyphs.length === 0) return;

  if (cluster.glyphs.length === 1) {
    const gid = cluster.glyphs[0].gid;
    if (gid > 0 && cluster.text.length > 0 && !toUnicode.has(gid)) {
      toUnicode.set(gid, nominalGlyphToChar.get(gid) ?? cluster.text);
    }
    return;
  }

  // 1. Nominal cmap glyphs always keep their exact single-character Unicode value.
  const nonNominal: ShapedCluster['glyphs'] = [];
  for (const glyph of cluster.glyphs) {
    if (glyph.gid <= 0) continue;
    const nominal = nominalGlyphToChar.get(glyph.gid);
    if (nominal !== undefined) {
      toUnicode.set(glyph.gid, nominal);
    } else {
      nonNominal.push(glyph);
    }
  }
  if (nonNominal.length === 0) return;

  // 2. Split remaining contextual/ligature glyphs using HarfBuzz Level 2 character clusters.
  const uniqueStarts = [...new Set(cluster.glyphs.map((g) => g.charCluster))].sort((a, b) => a - b);
  const sliceByStart = new Map<number, string>();
  for (let i = 0; i < uniqueStarts.length; i++) {
    const start = uniqueStarts[i];
    const end = i + 1 < uniqueStarts.length ? uniqueStarts[i + 1] : cluster.text.length;
    sliceByStart.set(start, cluster.text.slice(start, Math.max(start, end)));
  }
  // When a leading reph (र्) ligates onto a later matra (e.g. र्मी -> म + ीर्), preserve it on
  // the sole ligated non-nominal glyph.
  const leadingOrphan = uniqueStarts.length > 0 && uniqueStarts[0] > 0 ? cluster.text.slice(0, uniqueStarts[0]) : '';

  const nonNominalByStart = new Map<number, ShapedCluster['glyphs']>();
  for (const glyph of nonNominal) {
    const group = nonNominalByStart.get(glyph.charCluster);
    if (group) group.push(glyph);
    else nonNominalByStart.set(glyph.charCluster, [glyph]);
  }

  for (const [start, group] of nonNominalByStart.entries()) {
    const baseSlice = sliceByStart.get(start) || cluster.text;
    const slice = leadingOrphan && nonNominal.length === 1 ? baseSlice + leadingOrphan : baseSlice;
    if (group.length === 1) {
      const gid = group[0].gid;
      if (!toUnicode.has(gid) && slice.length > 0) toUnicode.set(gid, slice);
      continue;
    }

    // Multiple non-nominal glyphs share one Level 2 cluster: split characters if possible,
    // otherwise map the first to the slice and the rest to U+FEFF (stripped by pdf.js & Poppler).
    const chars = Array.from(slice);
    if (chars.length >= group.length) {
      for (let k = 0; k < group.length; k++) {
        const gid = group[k].gid;
        const piece = k === group.length - 1 ? chars.slice(k).join('') : chars[k];
        if (!toUnicode.has(gid) && piece.length > 0) toUnicode.set(gid, piece);
      }
    } else {
      if (!toUnicode.has(group[0].gid) && slice.length > 0) toUnicode.set(group[0].gid, slice);
      for (let k = 1; k < group.length; k++) {
        if (!toUnicode.has(group[k].gid)) toUnicode.set(group[k].gid, '\uFEFF');
      }
    }
  }
}

type PreparedEdit = {
  item: VectorTextItem;
  bucketKey: string;
  lines: { xPt: number; baselinePt: number; clusters: ShapedCluster[] }[];
};

export type VectorTextPlan = {
  /** IDs of text edits shaped and embedded for Plan B vector drawing. */
  handledIds: ReadonlySet<string>;
  /** Emits the vector text operators for a single handled edit on `page` at its exact z-order slot. */
  drawEditOnPage(page: PDFPage, editorToUser: Matrix, editId: string): void;
};

/**
 * Shapes supported text edits, embeds one static CID/Identity-H subset font per `(fontFamily, weight)`,
 * and returns a plan that draws each handled edit on its page at its exact z-order position.
 *
 * Any edit whose font family lacks a bundled TrueType binary or produces a `.notdef` (GID 0) glyph
 * is omitted from `handledIds` so the caller cleanly falls back to the Plan A raster path.
 */
export async function prepareVectorTextPlan(
  pdfDoc: PDFDocument,
  items: readonly VectorTextItem[],
  deps: VectorTextDeps = {},
): Promise<VectorTextPlan> {
  const handledIds = new Set<string>();
  const emptyPlan: VectorTextPlan = {
    handledIds,
    drawEditOnPage() {
      /* no-op */
    },
  };
  if (items.length === 0) return emptyPlan;

  const loadFont = deps.loadFontBytes ?? defaultLoadFontBytes;
  const candidateFamilies = new Set(
    items.map((item) => item.fontFamily).filter((fam) => (deps.loadFontBytes ? true : hasBundledTrueTypeFont(fam))),
  );
  if (candidateFamilies.size === 0) return emptyPlan;

  const fontDataByFamily = new Map<string, Uint8Array>();
  await Promise.all(
    [...candidateFamilies].map(async (family) => {
      const bytes = await loadFont(family);
      if (bytes && bytes.byteLength > 0) fontDataByFamily.set(family, bytes);
    }),
  );
  if (fontDataByFamily.size === 0) return emptyPlan;

  const engine = deps.engine ?? (await loadHarfBuzzEngine());
  const buckets = new Map<string, FontBucket>();
  const preparedById = new Map<string, PreparedEdit>();

  try {
    for (const item of items) {
      const fontBytes = fontDataByFamily.get(item.fontFamily);
      if (!fontBytes || item.lines.length === 0) continue;

      const weight = cssWeight(item.fontWeight);
      const bucketKey = `${item.fontFamily}@${weight}`;
      let bucket = buckets.get(bucketKey);
      if (!bucket) {
        const shaper = new HarfBuzzShaperFont(engine, fontBytes, weight);
        bucket = {
          family: item.fontFamily,
          weight,
          fontBytes,
          sourceMetrics: parseTtfMetrics(fontBytes),
          shaper,
          nominalGlyphToChar: buildNominalGlyphToChar(shaper),
          usedGids: new Set<number>([0]),
          toUnicode: new Map<number, string>(),
        };
        buckets.set(bucketKey, bucket);
      }

      const shapedLines: { xPt: number; baselinePt: number; clusters: ShapedCluster[] }[] = [];
      let hasNotdef = false;
      for (const line of item.lines) {
        const clusters = bucket.shaper.shapeLine(line.text);
        for (const cluster of clusters) {
          if (cluster.glyphs.some((g) => g.gid === 0)) {
            hasNotdef = true;
            break;
          }
        }
        if (hasNotdef) break;
        shapedLines.push({ xPt: line.xPt, baselinePt: line.baselinePt, clusters });
      }
      if (hasNotdef) continue;

      // Commit used GIDs and complete ToUnicode entries only once the entire edit shaped cleanly.
      for (const line of shapedLines) {
        for (const cluster of line.clusters) {
          for (const g of cluster.glyphs) bucket.usedGids.add(g.gid);
          // Register nominal glyphs for any non-ASCII/non-Devanagari characters in this cluster.
          for (const ch of cluster.text) {
            if (ch.normalize('NFC') !== ch) continue;
            const cp = ch.codePointAt(0);
            if (cp === undefined) continue;
            const nominal = bucket.shaper.nominalGlyph(cp);
            if (nominal > 0 && !bucket.nominalGlyphToChar.has(nominal)) {
              bucket.nominalGlyphToChar.set(nominal, ch);
            }
          }
          assignClusterToUnicode(cluster, bucket.nominalGlyphToChar, bucket.toUnicode);
        }
      }

      preparedById.set(item.id, { item, bucketKey, lines: shapedLines });
      handledIds.add(item.id);
    }

    if (preparedById.size === 0) return emptyPlan;

    // Guarantee every drawn non-zero GID has a ToUnicode entry (never fall through to Identity).
    for (const bucket of buckets.values()) {
      for (const gid of bucket.usedGids) {
        if (gid > 0 && !bucket.toUnicode.has(gid)) {
          bucket.toUnicode.set(gid, bucket.nominalGlyphToChar.get(gid) ?? '\uFEFF');
        }
      }
    }

    // Subset + instance each used (fontFamily, weight) once per document and embed it.
    const embeddedFonts = new Map<string, { ref: PDFRef; metrics: TtfMetrics }>();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.usedGids.size <= 1) continue;
      const subsetBytes = subsetAndInstanceFont(
        engine,
        bucket.fontBytes,
        bucket.usedGids,
        bucket.weight,
        bucket.sourceMetrics.variationAxes,
      );
      const subsetMetrics = parseTtfMetrics(subsetBytes);
      const ref = embedCidFontSubset(
        pdfDoc,
        bucket.family,
        bucket.weight,
        subsetBytes,
        subsetMetrics,
        bucket.usedGids,
        bucket.toUnicode,
      );
      embeddedFonts.set(key, { ref, metrics: subsetMetrics });
    }

    const fontNamesPerPage = new WeakMap<PDFPage, Map<string, PDFName>>();

    const drawEditOnPage = (page: PDFPage, editorToUser: Matrix, editId: string) => {
      const edit = preparedById.get(editId);
      if (!edit) return;
      const embedded = embeddedFonts.get(edit.bucketKey);
      if (!embedded) return;

      let pageFonts = fontNamesPerPage.get(page);
      if (!pageFonts) {
        pageFonts = new Map<string, PDFName>();
        fontNamesPerPage.set(page, pageFonts);
      }
      let fontName = pageFonts.get(edit.bucketKey);
      if (!fontName) {
        fontName = page.node.newFontDictionary('HpeVec', embedded.ref);
        pageFonts.set(edit.bucketKey, fontName);
      }

      const [r, g, b] = parseCssColorRgb(edit.item.color);
      const scaleX = edit.item.scaleX ?? 1;
      const shear = edit.item.fontStyle === 'italic' ? SYNTHETIC_ITALIC_SHEAR : 0;
      const strokeEm = edit.item.strokeEm ?? 0;

      const ops: PDFOperator[] = [];
      ops.push(pushGraphicsState());
      ops.push(setFillingRgbColor(r, g, b));
      if (strokeEm > 0) {
        ops.push(setStrokingRgbColor(r, g, b));
        ops.push(setLineWidth(roundPdfNum(strokeEm * edit.item.fontSizePt)));
        ops.push(setLineJoin(LineJoinStyle.Round));
      }
      ops.push(beginText());
      ops.push(setFontAndSize(fontName, edit.item.fontSizePt));
      if (strokeEm > 0) {
        ops.push(setTextRenderingMode(TextRenderingMode.FillAndOutline));
      }

      const riseState = { risePt: 0 };
      for (const line of edit.lines) {
        if (line.clusters.length === 0) continue;
        // Editor space has +y down; PDF glyph space has +y up, so flip Y and apply italic shear.
        const textMatrix = multiplyMatrices(editorToUser, [
          scaleX,
          0,
          shear,
          -1,
          line.xPt,
          line.baselinePt,
        ]);
        ops.push(
          setTextMatrix(
            roundPdfNum(textMatrix[0]),
            roundPdfNum(textMatrix[1]),
            roundPdfNum(textMatrix[2]),
            roundPdfNum(textMatrix[3]),
            roundPdfNum(textMatrix[4]),
            roundPdfNum(textMatrix[5]),
          ),
        );
        for (const word of groupClustersIntoWords(line.clusters)) {
          emitWordOperators(
            pdfDoc,
            word,
            embedded.metrics,
            edit.item.fontSizePt,
            riseState,
            ops,
          );
        }
        if (riseState.risePt !== 0) {
          ops.push(setTextRise(0));
          riseState.risePt = 0;
        }
      }

      ops.push(endText());
      ops.push(popGraphicsState());
      page.pushOperators(...ops);
    };

    return { handledIds, drawEditOnPage };
  } finally {
    for (const bucket of buckets.values()) {
      bucket.shaper.destroy();
    }
  }
}

/**
 * Convenience wrapper that shapes, embeds, and draws all supported edits across `pages` and
 * returns the set of handled edit IDs.
 */
export async function drawVectorTextEdits(
  pdfDoc: PDFDocument,
  pages: readonly VectorTextPageInput[],
  deps: VectorTextDeps = {},
): Promise<Set<string>> {
  const plan = await prepareVectorTextPlan(
    pdfDoc,
    pages.flatMap((p) => p.items),
    deps,
  );
  for (const pageInput of pages) {
    for (const item of pageInput.items) {
      if (plan.handledIds.has(item.id)) {
        plan.drawEditOnPage(pageInput.page, pageInput.editorToUser, item.id);
      }
    }
  }
  return new Set(plan.handledIds);
}
