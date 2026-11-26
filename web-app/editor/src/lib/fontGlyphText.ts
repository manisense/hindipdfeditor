/**
 * What each glyph of a TrueType/OpenType font stands for, read from the font program itself:
 * its cmap gives single letters, and its GSUB rules (single and ligature substitutions, also
 * behind extension lookups) give the letters of half forms, conjuncts, reph and matra
 * combinations, composed until nothing new is learned. A PDF's ToUnicode map can be wrong while
 * the embedded font is intact (Word + iLovePDF files map the pre-base ि glyph to "व"), so this is
 * a second, independent reading of the same glyphs.
 *
 * Glyphs whose Devanagari letters are drawn out of reading order get markers instead of letters:
 * {@link PRE_BASE_MARK} for ि (drawn before the consonant it follows) and {@link REPH_MARK} for a
 * reph (र् drawn after the syllable it starts); see `reorderDevanagariMarks`.
 */

/** Stands for a pre-base ि glyph: drawn before the consonant cluster it follows. */
export const PRE_BASE_MARK = '';
/** Stands for the र् of a reph glyph: drawn after the syllable it starts. */
export const REPH_MARK = '';

export type FontGlyphReading = {
  /** Glyph id → letters (with marks for reordered glyphs). */
  text: Map<number, string>;
};

const REPH = 'र्';
const I_MATRA = 'ि';

/** Reads `bytes` as an sfnt font; a font it cannot read gives an empty map (fails closed). */
export function fontGlyphText(bytes: Uint8Array): FontGlyphReading {
  try {
    return readFont(bytes);
  } catch {
    return { text: new Map() };
  }
}

type Edge = { output: number; components: number[]; reph: boolean };

function readFont(bytes: Uint8Array): FontGlyphReading {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables = tableDirectory(view);
  const text = new Map<number, string>();
  const cmap = tables.get('cmap');
  if (cmap === undefined) return { text };
  for (const [codePoint, gid] of readCmap(view, cmap)) {
    const known = text.get(gid);
    // A glyph shared by several code points (e.g. a dotted circle) keeps the lowest one.
    if (known === undefined || codePoint < (known.codePointAt(0) ?? 0)) text.set(gid, String.fromCodePoint(codePoint));
  }
  const gsub = tables.get('GSUB');
  const edges = gsub === undefined ? [] : gsubEdges(view, gsub);
  const reph = new Set<number>();
  // Ligatures first in every pass: a glyph reached both by a single substitution (an ं variant)
  // and by a ligature (े + ं) takes the ligature's fuller reading. Each glyph is read once, so
  // cycles in GSUB cannot loop.
  edges.sort((x, y) => y.components.length - x.components.length);
  for (let changed = true; changed; ) {
    changed = false;
    for (const edge of edges) {
      if (text.has(edge.output) || !edge.components.every((c) => text.has(c))) continue;
      text.set(edge.output, edge.components.map((c) => text.get(c)).join(''));
      if (edge.reph || edge.components.some((c) => reph.has(c))) reph.add(edge.output);
      changed = true;
    }
  }
  for (const [gid, letters] of text) {
    if (reph.has(gid) && letters.includes(REPH)) text.set(gid, REPH_MARK + letters.replace(REPH, ''));
    else if (letters === I_MATRA) text.set(gid, PRE_BASE_MARK);
  }
  return { text };
}

function tableDirectory(view: DataView): Map<string, number> {
  const count = view.getUint16(4);
  const tables = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const record = 12 + i * 16;
    const tag = String.fromCharCode(...[0, 1, 2, 3].map((k) => view.getUint8(record + k)));
    tables.set(tag, view.getUint32(record + 8));
  }
  return tables;
}

/** Unicode code point → glyph id pairs from the best Unicode subtable (format 12, else 4). */
function readCmap(view: DataView, cmap: number): [number, number][] {
  const count = view.getUint16(cmap + 2);
  let format4: number | undefined;
  for (let i = 0; i < count; i++) {
    const record = cmap + 4 + i * 8;
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    const offset = cmap + view.getUint32(record + 4);
    const format = view.getUint16(offset);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    if (format === 12) return cmapFormat12(view, offset);
    if (format === 4) format4 ??= offset;
  }
  return format4 === undefined ? [] : cmapFormat4(view, format4);
}

function cmapFormat4(view: DataView, at: number): [number, number][] {
  const segments = view.getUint16(at + 6) / 2;
  const ends = at + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const rangeOffsets = deltas + segments * 2;
  const pairs: [number, number][] = [];
  for (let s = 0; s < segments; s++) {
    const end = view.getUint16(ends + s * 2);
    const start = view.getUint16(starts + s * 2);
    const delta = view.getInt16(deltas + s * 2);
    const rangeOffset = view.getUint16(rangeOffsets + s * 2);
    for (let code = start; code <= end && code !== 0xffff; code++) {
      let gid: number;
      if (rangeOffset === 0) gid = (code + delta) & 0xffff;
      else {
        const glyphAt = rangeOffsets + s * 2 + rangeOffset + (code - start) * 2;
        gid = view.getUint16(glyphAt);
        if (gid !== 0) gid = (gid + delta) & 0xffff;
      }
      if (gid !== 0) pairs.push([code, gid]);
    }
  }
  return pairs;
}

function cmapFormat12(view: DataView, at: number): [number, number][] {
  const groups = view.getUint32(at + 12);
  const pairs: [number, number][] = [];
  for (let g = 0; g < groups; g++) {
    const record = at + 16 + g * 12;
    const start = view.getUint32(record);
    const end = view.getUint32(record + 4);
    const startGid = view.getUint32(record + 8);
    for (let code = start; code <= end; code++) pairs.push([code, startGid + code - start]);
  }
  return pairs;
}

function coverage(view: DataView, at: number): number[] {
  const format = view.getUint16(at);
  const count = view.getUint16(at + 2);
  const glyphs: number[] = [];
  if (format === 1) {
    for (let i = 0; i < count; i++) glyphs.push(view.getUint16(at + 4 + i * 2));
  } else if (format === 2) {
    for (let i = 0; i < count; i++) {
      const record = at + 4 + i * 6;
      for (let g = view.getUint16(record); g <= view.getUint16(record + 2); g++) glyphs.push(g);
    }
  }
  return glyphs;
}

/** Lookup indices used by `tag` in any script and language. */
function featureLookups(view: DataView, gsub: number, tag: string): Set<number> {
  const list = gsub + view.getUint16(gsub + 6);
  const lookups = new Set<number>();
  for (let i = 0; i < view.getUint16(list); i++) {
    const record = list + 2 + i * 6;
    const recordTag = String.fromCharCode(...[0, 1, 2, 3].map((k) => view.getUint8(record + k)));
    if (recordTag !== tag) continue;
    const feature = list + view.getUint16(record + 4);
    for (let k = 0; k < view.getUint16(feature + 2); k++) lookups.add(view.getUint16(feature + 4 + k * 2));
  }
  return lookups;
}

/** Every single (type 1) and ligature (type 4) substitution, as output ← components. */
function gsubEdges(view: DataView, gsub: number): Edge[] {
  const rephLookups = featureLookups(view, gsub, 'rphf');
  const lookupList = gsub + view.getUint16(gsub + 8);
  const edges: Edge[] = [];
  for (let l = 0; l < view.getUint16(lookupList); l++) {
    const lookup = lookupList + view.getUint16(lookupList + 2 + l * 2);
    const reph = rephLookups.has(l);
    const lookupType = view.getUint16(lookup);
    for (let s = 0; s < view.getUint16(lookup + 4); s++) {
      let sub = lookup + view.getUint16(lookup + 6 + s * 2);
      let type = lookupType;
      if (type === 7) {
        type = view.getUint16(sub + 2);
        sub += view.getUint32(sub + 4);
      }
      if (type === 1) singleEdges(view, sub, reph, edges);
      if (type === 4) ligatureEdges(view, sub, reph, edges);
    }
  }
  return edges;
}

function singleEdges(view: DataView, sub: number, reph: boolean, edges: Edge[]): void {
  const format = view.getUint16(sub);
  const covered = coverage(view, sub + view.getUint16(sub + 2));
  covered.forEach((glyph, i) => {
    const output = format === 1 ? (glyph + view.getInt16(sub + 4)) & 0xffff : view.getUint16(sub + 6 + i * 2);
    edges.push({ output, components: [glyph], reph });
  });
}

function ligatureEdges(view: DataView, sub: number, reph: boolean, edges: Edge[]): void {
  const covered = coverage(view, sub + view.getUint16(sub + 2));
  covered.forEach((first, i) => {
    const set = sub + view.getUint16(sub + 6 + i * 2);
    for (let k = 0; k < view.getUint16(set); k++) {
      const ligature = set + view.getUint16(set + 2 + k * 2);
      const components = [first];
      for (let c = 1; c < view.getUint16(ligature + 2); c++) components.push(view.getUint16(ligature + 4 + (c - 1) * 2));
      edges.push({ output: view.getUint16(ligature), components, reph });
    }
  });
}
