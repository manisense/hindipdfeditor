import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { fontGlyphText, PRE_BASE_MARK, REPH_MARK } from './fontGlyphText';

const noto = new Uint8Array(readFileSync(path.join(__dirname, '../../public/fonts/NotoSansDevanagari-Variable.ttf')));

describe('fontGlyphText', () => {
  const reading = fontGlyphText(noto);
  const textOf = (text: string) => [...reading.text.entries()].filter(([, t]) => t === text).map(([gid]) => gid);

  it('reads single letters from the cmap', () => {
    expect(textOf('क').length).toBeGreaterThan(0);
    expect(textOf('ष').length).toBeGreaterThan(0);
  });

  it('reads conjunct ligatures from GSUB as their letters', () => {
    expect(textOf('क्ष').length).toBeGreaterThan(0);
    expect(textOf('ज्ञ').length).toBeGreaterThan(0);
  });

  it('marks reph glyphs and pre-base i-matra glyphs', () => {
    expect(textOf(REPH_MARK).length).toBeGreaterThan(0);
    expect(textOf(PRE_BASE_MARK).length).toBeGreaterThan(0);
    expect(textOf('ि')).toEqual([]);
  });

  it('reads below-base rakar (blwf) as ्र rather than र्, including in deva v1 vatu conjuncts', () => {
    // Noto's blwf rakar glyph (gid 508) is defined by both [र, ्] (deva) and [्, र] (dev2).
    expect(textOf('्र').length).toBeGreaterThan(0);
    expect(textOf('छ्र्').length).toBeGreaterThan(0);
    expect(textOf('्रु').length).toBeGreaterThan(0);

    // Minimal sfnt with deva v1 GSUB: rphf([र, ्] -> 10), blwf([र, ्] -> 11), half([प, ्] -> 12),
    // vatu([प, 11] -> 13, [12, 11] -> 14).
    const synthetic = buildDevaV1Font();
    const read = fontGlyphText(synthetic).text;
    expect(read.get(10)).toBe(REPH_MARK);
    expect(read.get(11)).toBe('्र');
    expect(read.get(12)).toBe('प्');
    expect(read.get(13)).toBe('प्र');
    expect(read.get(14)).toBe('प्र्');
  });

  it('returns an empty reading for bytes that are not a font', () => {
    expect(fontGlyphText(new Uint8Array([1, 2, 3, 4])).text.size).toBe(0);
  });
});

/** Builds a minimal valid sfnt (cmap format 12 + GSUB) exercising deva v1 rphf, blwf, half and vatu. */
function buildDevaV1Font(): Uint8Array {
  const pushU16 = (out: number[], v: number) => out.push((v >>> 8) & 0xff, v & 0xff);
  const pushU32 = (out: number[], v: number) => out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
  const tagBytes = (tag: string) => [...tag].map((c) => c.charCodeAt(0));

  // cmap: format 12 with 3 groups: प (0x092A -> gid 1), र (0x0930 -> gid 2), ् (0x094D -> gid 3).
  const cmap: number[] = [];
  pushU16(cmap, 0); // version
  pushU16(cmap, 1); // numTables
  pushU16(cmap, 3); // platformID = Windows
  pushU16(cmap, 10); // encodingID = UCS-4
  pushU32(cmap, 12); // subtable offset
  pushU16(cmap, 12); // format 12
  pushU16(cmap, 0); // reserved
  pushU32(cmap, 16 + 3 * 12); // length
  pushU32(cmap, 0); // language
  pushU32(cmap, 3); // numGroups
  for (const [cp, gid] of [[0x092a, 1], [0x0930, 2], [0x094d, 3]]) {
    pushU32(cmap, cp);
    pushU32(cmap, cp);
    pushU32(cmap, gid);
  }

  // Helper to build a type-4 ligature lookup (one subtable with one or more ligatures).
  const buildLigLookup = (ligs: { first: number; rest: number[]; out: number }[]) => {
    const byFirst = new Map<number, { rest: number[]; out: number }[]>();
    for (const l of ligs) {
      const list = byFirst.get(l.first) ?? [];
      list.push({ rest: l.rest, out: l.out });
      byFirst.set(l.first, list);
    }
    const firsts = [...byFirst.keys()].sort((a, b) => a - b);
    // Subtable layout: format(2) covOff(2) ligSetCount(2) ligSetOffs(2*N) cov ligSets...
    const covBytes: number[] = [];
    pushU16(covBytes, 1); // format 1
    pushU16(covBytes, firsts.length);
    for (const g of firsts) pushU16(covBytes, g);

    const setBytes: number[][] = firsts.map((f) => {
      const list = byFirst.get(f)!;
      const ligBlobs = list.map((l) => {
        const b: number[] = [];
        pushU16(b, l.out);
        pushU16(b, l.rest.length + 1);
        for (const c of l.rest) pushU16(b, c);
        return b;
      });
      const set: number[] = [];
      pushU16(set, ligBlobs.length);
      let off = 2 + ligBlobs.length * 2;
      for (const b of ligBlobs) {
        pushU16(set, off);
        off += b.length;
      }
      for (const b of ligBlobs) set.push(...b);
      return set;
    });

    const sub: number[] = [];
    const covOff = 6 + firsts.length * 2;
    pushU16(sub, 1); // format 1
    pushU16(sub, covOff);
    pushU16(sub, firsts.length);
    let setOff = covOff + covBytes.length;
    for (const s of setBytes) {
      pushU16(sub, setOff);
      setOff += s.length;
    }
    sub.push(...covBytes);
    for (const s of setBytes) sub.push(...s);

    const lookup: number[] = [];
    pushU16(lookup, 4); // LookupType 4 (ligature)
    pushU16(lookup, 0); // LookupFlag
    pushU16(lookup, 1); // SubTableCount
    pushU16(lookup, 8); // Subtable offset
    lookup.push(...sub);
    return lookup;
  };

  const lookups = [
    buildLigLookup([{ first: 2, rest: [3], out: 10 }]), // 0: rphf [र, ्] -> 10
    buildLigLookup([{ first: 2, rest: [3], out: 11 }]), // 1: blwf [र, ्] -> 11
    buildLigLookup([{ first: 1, rest: [3], out: 12 }]), // 2: half [प, ्] -> 12
    buildLigLookup([
      { first: 1, rest: [11], out: 13 }, // vatu [प, rakar] -> प्र
      { first: 12, rest: [11], out: 14 }, // vatu [प्, rakar] -> प्र्
    ]), // 3: vatu
  ];
  const featureTags = ['rphf', 'blwf', 'half', 'vatu'];

  // FeatureList: count(2) + records(6*4=24) + 4 feature tables (6 bytes each)
  const featureList: number[] = [];
  pushU16(featureList, featureTags.length);
  let fOff = 2 + featureTags.length * 6;
  for (const tag of featureTags) {
    featureList.push(...tagBytes(tag));
    pushU16(featureList, fOff);
    fOff += 6;
  }
  for (let i = 0; i < featureTags.length; i++) {
    pushU16(featureList, 0); // featureParams
    pushU16(featureList, 1); // lookupIndexCount
    pushU16(featureList, i); // lookupListIndex
  }

  // LookupList: count(2) + offsets(2*4) + lookup bodies
  const lookupList: number[] = [];
  pushU16(lookupList, lookups.length);
  let lOff = 2 + lookups.length * 2;
  for (const l of lookups) {
    pushU16(lookupList, lOff);
    lOff += l.length;
  }
  for (const l of lookups) lookupList.push(...l);

  const gsub: number[] = [];
  pushU32(gsub, 0x00010000); // version 1.0
  pushU16(gsub, 10); // scriptListOffset (minimal empty)
  const featureListOff = 12;
  const lookupListOff = featureListOff + featureList.length;
  pushU16(gsub, featureListOff);
  pushU16(gsub, lookupListOff);
  pushU16(gsub, 0); // empty ScriptList
  gsub.push(...featureList, ...lookupList);

  // Assemble sfnt with 2 tables: GSUB, cmap
  const tables = [
    { tag: 'GSUB', data: gsub },
    { tag: 'cmap', data: cmap },
  ];
  const out: number[] = [];
  pushU32(out, 0x00010000); // sfntVersion
  pushU16(out, tables.length);
  pushU16(out, 32);
  pushU16(out, 1);
  pushU16(out, 0);
  let dataOff = 12 + tables.length * 16;
  for (const t of tables) {
    out.push(...tagBytes(t.tag));
    pushU32(out, 0); // checksum
    pushU32(out, dataOff);
    pushU32(out, t.data.length);
    dataOff += t.data.length;
  }
  for (const t of tables) out.push(...t.data);
  return new Uint8Array(out);
}
