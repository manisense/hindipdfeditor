/**
 * Minimal OpenType/TrueType sfnt table reader for static font subsets embedded as PDF CIDFontType2.
 * Reads only the tables needed for a valid PDF FontDescriptor and CIDFont /W width array:
 * `head`, `hhea`, `maxp`, `hmtx`, `OS/2`, and `post`.
 */

export type TtfMetrics = {
  unitsPerEm: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  ascender: number;
  descender: number;
  capHeight: number;
  xHeight: number;
  italicAngle: number;
  numGlyphs: number;
  /** Advance width in font design units indexed by GID (0..numGlyphs-1). */
  advanceWidths: Uint16Array;
  /** True if the font contains a `fvar` table (variable font). */
  isVariable: boolean;
  /** Four-character OpenType variation axis tags present in `fvar` (e.g. `['wght', 'wdth']`). */
  variationAxes: string[];
};

type TableRecord = { offset: number; length: number };

function readTag(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function parseTableDirectory(bytes: Uint8Array): Map<string, TableRecord> {
  if (bytes.byteLength < 12) throw new Error('ttfMetrics: font binary too short');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = view.getUint16(4, false);
  if (bytes.byteLength < 12 + numTables * 16) {
    throw new Error('ttfMetrics: truncated table directory');
  }
  const tables = new Map<string, TableRecord>();
  for (let i = 0; i < numTables; i++) {
    const base = 12 + i * 16;
    const tag = readTag(view, base);
    const offset = view.getUint32(base + 8, false);
    const length = view.getUint32(base + 12, false);
    if (offset + length <= bytes.byteLength) {
      tables.set(tag, { offset, length });
    }
  }
  return tables;
}

function requireTable(tables: Map<string, TableRecord>, tag: string): TableRecord {
  const rec = tables.get(tag);
  if (!rec) throw new Error(`ttfMetrics: missing required TrueType table '${tag}'`);
  return rec;
}

/** Parses core PDF font metrics and per-GID horizontal advance widths from a TrueType binary. */
export function parseTtfMetrics(bytes: Uint8Array): TtfMetrics {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables = parseTableDirectory(bytes);

  const head = requireTable(tables, 'head');
  if (head.length < 54) throw new Error('ttfMetrics: truncated head table');
  const unitsPerEm = view.getUint16(head.offset + 18, false);
  const xMin = view.getInt16(head.offset + 36, false);
  const yMin = view.getInt16(head.offset + 38, false);
  const xMax = view.getInt16(head.offset + 40, false);
  const yMax = view.getInt16(head.offset + 42, false);

  const hhea = requireTable(tables, 'hhea');
  if (hhea.length < 36) throw new Error('ttfMetrics: truncated hhea table');
  const ascender = view.getInt16(hhea.offset + 4, false);
  const descender = view.getInt16(hhea.offset + 6, false);
  const numberOfHMetrics = view.getUint16(hhea.offset + 34, false);

  const maxp = requireTable(tables, 'maxp');
  if (maxp.length < 6) throw new Error('ttfMetrics: truncated maxp table');
  const numGlyphs = view.getUint16(maxp.offset + 4, false);

  const hmtx = requireTable(tables, 'hmtx');
  const advanceWidths = new Uint16Array(numGlyphs);
  const fullMetrics = Math.min(numberOfHMetrics, numGlyphs);
  let lastAdvance = 0;
  for (let gid = 0; gid < fullMetrics; gid++) {
    const pos = hmtx.offset + gid * 4;
    if (pos + 2 > bytes.byteLength) break;
    lastAdvance = view.getUint16(pos, false);
    advanceWidths[gid] = lastAdvance;
  }
  for (let gid = fullMetrics; gid < numGlyphs; gid++) {
    advanceWidths[gid] = lastAdvance;
  }

  let capHeight = Math.round(ascender * 0.7);
  let xHeight = Math.round(ascender * 0.5);
  const os2 = tables.get('OS/2');
  if (os2 && os2.length >= 90) {
    const version = view.getUint16(os2.offset, false);
    if (version >= 2) {
      const parsedX = view.getInt16(os2.offset + 86, false);
      const parsedCap = view.getInt16(os2.offset + 88, false);
      if (parsedX > 0) xHeight = parsedX;
      if (parsedCap > 0) capHeight = parsedCap;
    }
  }

  let italicAngle = 0;
  const post = tables.get('post');
  if (post && post.length >= 8) {
    italicAngle = view.getInt32(post.offset + 4, false) / 65536;
  }

  const variationAxes: string[] = [];
  const fvar = tables.get('fvar');
  if (fvar && fvar.length >= 16) {
    const axisArrayOffset = view.getUint16(fvar.offset + 4, false);
    const axisCount = view.getUint16(fvar.offset + 8, false);
    const axisSize = view.getUint16(fvar.offset + 10, false);
    for (let i = 0; i < axisCount; i++) {
      const pos = fvar.offset + axisArrayOffset + i * axisSize;
      if (pos + 4 <= fvar.offset + fvar.length) {
        variationAxes.push(readTag(view, pos));
      }
    }
  }

  return {
    unitsPerEm,
    xMin,
    yMin,
    xMax,
    yMax,
    ascender,
    descender,
    capHeight,
    xHeight,
    italicAngle,
    numGlyphs,
    advanceWidths,
    isVariable: variationAxes.length > 0 || tables.has('fvar'),
    variationAxes,
  };
}
