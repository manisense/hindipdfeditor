import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef } from '@cantoo/pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';

import { instantiateHarfBuzz, type HarfBuzzEngine } from './harfbuzzWasm';
import {
  evaluateOwnFontForLines,
  extractEmbeddedFontCandidate,
  inspectOwnFontProgram,
  ownFontMatchesStyle,
} from './ownFont';
import { extractEmbeddedTextLines } from './pdfTextExtract';
import { drawVectorTextEdits } from './pdfVectorText';

const HB_DIR = path.resolve(__dirname, '../../node_modules/harfbuzzjs/dist');
const NOTO_SANS_PATH = path.resolve(__dirname, '../../public/fonts/NotoSansDevanagari-Variable.ttf');
const MISMAPPED_FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../../mobile-app/fixtures/mismapped-tounicode-fixture.pdf',
);

let cachedEngine: Promise<HarfBuzzEngine> | null = null;
function getEngine(): Promise<HarfBuzzEngine> {
  if (!cachedEngine) {
    cachedEngine = instantiateHarfBuzz({
      shapeWasm: readFileSync(path.join(HB_DIR, 'harfbuzz.wasm')),
      subsetWasm: readFileSync(path.join(HB_DIR, 'harfbuzz-subset.wasm')),
    });
  }
  return cachedEngine;
}

function hasPoppler(): boolean {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

type SfntTable = { tag: string; bytes: Uint8Array };

function unpackSfnt(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = view.getUint16(4, false);
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < numTables; i++) {
    const base = 12 + i * 16;
    const tag = String.fromCharCode(
      view.getUint8(base),
      view.getUint8(base + 1),
      view.getUint8(base + 2),
      view.getUint8(base + 3),
    );
    const offset = view.getUint32(base + 8, false);
    const length = view.getUint32(base + 12, false);
    out.set(tag, bytes.slice(offset, offset + length));
  }
  return out;
}

function packSfnt(tablesMap: Map<string, Uint8Array>): Uint8Array {
  const entries: SfntTable[] = [...tablesMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([tag, bytes]) => ({ tag, bytes }));
  const numTables = entries.length;
  const headerSize = 12 + numTables * 16;
  let totalSize = headerSize;
  for (const e of entries) totalSize += (e.bytes.byteLength + 3) & ~3;

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x00010000, false);
  view.setUint16(4, numTables, false);
  const searchRange = 1 << (Math.floor(Math.log2(numTables)) + 4);
  view.setUint16(6, searchRange, false);
  view.setUint16(8, Math.floor(Math.log2(numTables)), false);
  view.setUint16(10, numTables * 16 - searchRange, false);

  let dataOffset = headerSize;
  for (let i = 0; i < numTables; i++) {
    const { tag, bytes } = entries[i];
    const dirBase = 12 + i * 16;
    for (let k = 0; k < 4; k++) out[dirBase + k] = tag.charCodeAt(k);
    view.setUint32(dirBase + 4, 0, false);
    view.setUint32(dirBase + 8, dataOffset, false);
    view.setUint32(dirBase + 12, bytes.byteLength, false);
    out.set(bytes, dataOffset);
    dataOffset += (bytes.byteLength + 3) & ~3;
  }
  return out;
}

function withFsType(fontBytes: Uint8Array, fsType: number): Uint8Array {
  const tables = unpackSfnt(fontBytes);
  const os2 = tables.get('OS/2')!.slice();
  new DataView(os2.buffer).setUint16(8, fsType, false);
  tables.set('OS/2', os2);
  return packSfnt(tables);
}

/** Sets OS/2 usWeightClass and PANOSE bSerifStyle. */
function withStyle(fontBytes: Uint8Array, weightClass: number, serifStyle: number): Uint8Array {
  const tables = unpackSfnt(fontBytes);
  const os2 = tables.get('OS/2')!.slice();
  new DataView(os2.buffer).setUint16(4, weightClass, false);
  os2[33] = serifStyle;
  tables.set('OS/2', os2);
  return packSfnt(tables);
}

function withoutTable(fontBytes: Uint8Array, tag: string): Uint8Array {
  const tables = unpackSfnt(fontBytes);
  tables.delete(tag);
  return packSfnt(tables);
}

function withMinimalGsub(fontBytes: Uint8Array, scriptTag: string, includeLookup: boolean): Uint8Array {
  const tables = unpackSfnt(fontBytes);
  // Build a minimal valid GSUB v1.0 table with one script, one default LangSys, optionally one feature + lookup.
  const buf = new Uint8Array(64);
  const v = new DataView(buf.buffer);
  // Header: major=1, minor=0, scriptList=10, featureList=34, lookupList=48
  v.setUint16(0, 1, false);
  v.setUint16(2, 0, false);
  v.setUint16(4, 10, false);
  v.setUint16(6, 34, false);
  v.setUint16(8, 48, false);

  // ScriptList at 10: scriptCount=1, tag=scriptTag, scriptOffset=8 (absolute 18)
  v.setUint16(10, 1, false);
  for (let i = 0; i < 4; i++) buf[12 + i] = scriptTag.charCodeAt(i);
  v.setUint16(16, 8, false);

  // ScriptTable at 18: defaultLangSysOffset=4 (absolute 22), langSysCount=0
  v.setUint16(18, 4, false);
  v.setUint16(20, 0, false);

  // LangSysTable at 22: lookupOrder=0, reqFeatureIndex=0xFFFF, featureIndexCount=0 or 1, featureIndices=[0]
  v.setUint16(22, 0, false);
  v.setUint16(24, 0xffff, false);
  v.setUint16(26, includeLookup ? 1 : 0, false);
  v.setUint16(28, 0, false);

  // FeatureList at 34: featureCount=1, tag='rphf', featureOffset=8 (absolute 42)
  v.setUint16(34, 1, false);
  buf.set([0x72, 0x70, 0x68, 0x66], 36);
  v.setUint16(40, 8, false);

  // FeatureTable at 42: featureParams=0, lookupIndexCount=1 or 0, lookupListIndices=[0]
  v.setUint16(42, 0, false);
  v.setUint16(44, includeLookup ? 1 : 0, false);
  v.setUint16(46, 0, false);

  // LookupList at 48: lookupCount=1, lookupOffset=4 (absolute 52)
  v.setUint16(48, includeLookup ? 1 : 0, false);
  v.setUint16(50, 4, false);

  tables.set('GSUB', buf);
  return packSfnt(tables);
}

/**
 * Rebuilds `glyf` and `loca` keeping outlines ONLY for `keepGids`, setting all other GIDs to
 * zero-length outlines while keeping `cmap` and `GSUB` intact (just like retained-GID PDF subsets).
 */
function subsetOutlinesOnly(fontBytes: Uint8Array, keepGids: ReadonlySet<number>): Uint8Array {
  const tables = unpackSfnt(fontBytes);
  const head = tables.get('head')!.slice();
  const headView = new DataView(head.buffer);
  const indexToLocFormat = headView.getInt16(50, false);
  const maxp = tables.get('maxp')!;
  const numGlyphs = new DataView(maxp.buffer).getUint16(4, false);
  const oldLoca = tables.get('loca')!;
  const oldLocaView = new DataView(oldLoca.buffer);
  const oldGlyf = tables.get('glyf')!;

  const getOffset = (gid: number) =>
    indexToLocFormat === 0
      ? oldLocaView.getUint16(gid * 2, false) * 2
      : oldLocaView.getUint32(gid * 4, false);

  const chunks: Uint8Array[] = [];
  const newOffsets = new Uint32Array(numGlyphs + 1);
  let cursor = 0;
  for (let gid = 0; gid < numGlyphs; gid++) {
    newOffsets[gid] = cursor;
    if (keepGids.has(gid)) {
      const start = getOffset(gid);
      const end = getOffset(gid + 1);
      if (end > start) {
        const slice = oldGlyf.slice(start, end);
        chunks.push(slice);
        cursor += slice.byteLength;
        const pad = (4 - (cursor % 4)) % 4;
        if (pad > 0) {
          chunks.push(new Uint8Array(pad));
          cursor += pad;
        }
      }
    }
  }
  newOffsets[numGlyphs] = cursor;

  const newGlyf = new Uint8Array(cursor);
  let pos = 0;
  for (const c of chunks) {
    newGlyf.set(c, pos);
    pos += c.byteLength;
  }

  // Always write long loca (indexToLocFormat = 1) for simplicity and safety.
  headView.setInt16(50, 1, false);
  const newLoca = new Uint8Array((numGlyphs + 1) * 4);
  const newLocaView = new DataView(newLoca.buffer);
  for (let i = 0; i <= numGlyphs; i++) newLocaView.setUint32(i * 4, newOffsets[i], false);

  tables.set('head', head);
  tables.set('loca', newLoca);
  tables.set('glyf', newGlyf);
  return packSfnt(tables);
}

describe('ownFont eligibility checks', () => {
  const notoBytes = new Uint8Array(readFileSync(NOTO_SANS_PATH));
  const sampleLine = [{ text: 'सूर्य, धर्म और क्षेत्र में विद्यालय', xPt: 40, baselinePt: 100 }];

  it('accepts a full Devanagari TrueType font with GSUB deva/dev2 and allowed fsType', async () => {
    const engine = await getEngine();
    const info = inspectOwnFontProgram(notoBytes);
    expect(info.ok).toBe(true);
    if (info.ok) {
      expect(info.devanagariScripts.length).toBeGreaterThan(0);
    }

    const decision = evaluateOwnFontForLines(engine, notoBytes, sampleLine);
    expect(decision.useOwnFont).toBe(true);
  });

  it('allows OS/2 fsType installable (0), preview/print (4), and editable (8), but rejects restricted (2)', async () => {
    const engine = await getEngine();
    for (const allowed of [0x0000, 0x0004, 0x0008]) {
      const dec = evaluateOwnFontForLines(engine, withFsType(notoBytes, allowed), sampleLine);
      expect(dec.useOwnFont).toBe(true);
    }
    const restricted = evaluateOwnFontForLines(engine, withFsType(notoBytes, 0x0002), sampleLine);
    expect(restricted).toEqual({ useOwnFont: false, reason: 'restricted-license' });
  });

  it("is used only when the edit keeps the original's weight and serif style", () => {
    const info = (weightClass: number, serifStyle: number) => {
      const inspected = inspectOwnFontProgram(withStyle(notoBytes, weightClass, serifStyle));
      if (!inspected.ok) throw new Error('font rejected');
      return inspected;
    };
    // A regular sans font (PANOSE serif style 11: normal sans).
    expect(ownFontMatchesStyle(info(400, 11), { weight: 400, serif: false })).toBe(true);
    expect(ownFontMatchesStyle(info(400, 11), { weight: 700, serif: false })).toBe(false);
    expect(ownFontMatchesStyle(info(400, 11), { weight: 400, serif: true })).toBe(false);
    // A bold serif font (style 2: cove serif).
    expect(ownFontMatchesStyle(info(700, 2), { weight: 700, serif: true })).toBe(true);
    expect(ownFontMatchesStyle(info(700, 2), { weight: 400, serif: true })).toBe(false);
    // PANOSE not given: only a sans edit, the editor's default for Devanagari, may use it.
    expect(ownFontMatchesStyle(info(400, 0), { weight: 400, serif: false })).toBe(true);
    expect(ownFontMatchesStyle(info(400, 0), { weight: 400, serif: true })).toBe(false);
  });

  it('rejects fonts without GSUB, without deva/dev2 scripts, or with empty Devanagari features', async () => {
    const engine = await getEngine();
    expect(evaluateOwnFontForLines(engine, withoutTable(notoBytes, 'GSUB'), sampleLine)).toEqual({
      useOwnFont: false,
      reason: 'no-devanagari-gsub',
    });
    expect(evaluateOwnFontForLines(engine, withMinimalGsub(notoBytes, 'latn', true), sampleLine)).toEqual({
      useOwnFont: false,
      reason: 'no-devanagari-gsub',
    });
    expect(evaluateOwnFontForLines(engine, withMinimalGsub(notoBytes, 'deva', false), sampleLine)).toEqual({
      useOwnFont: false,
      reason: 'no-devanagari-gsub',
    });
  });

  it('rejects when HarfBuzz outputs .notdef (GID 0) for a missing character', async () => {
    const engine = await getEngine();
    const dec = evaluateOwnFontForLines(engine, notoBytes, [
      { text: 'सूर्य 中文', xPt: 40, baselinePt: 100 },
    ]);
    expect(dec).toEqual({ useOwnFont: false, reason: 'notdef-glyph' });
  });

  it('rejects a retained-GID subset font whose glyf/loca lacks an outline for a needed glyph', async () => {
    const engine = await getEngine();
    // Shape a small word to keep only its GIDs, then try to edit to a line with other glyphs.
    const small = evaluateOwnFontForLines(engine, notoBytes, [
      { text: 'नमस्ते', xPt: 40, baselinePt: 100 },
    ]);
    expect(small.useOwnFont).toBe(true);
    if (!small.useOwnFont) return;

    const kept = new Set<number>([0]);
    for (const line of small.lines) {
      for (const c of line.clusters) {
        for (const g of c.glyphs) kept.add(g.gid);
      }
    }
    const subsetBytes = subsetOutlinesOnly(notoBytes, kept);

    // Editing to the already-present word succeeds, while editing to text needing missing glyphs falls back.
    const sameWord = evaluateOwnFontForLines(engine, subsetBytes, [
      { text: 'नमस्ते', xPt: 40, baselinePt: 100 },
    ]);
    expect(sameWord.useOwnFont).toBe(true);

    const missingGlyphs = evaluateOwnFontForLines(engine, subsetBytes, sampleLine);
    expect(missingGlyphs).toEqual({ useOwnFont: false, reason: 'missing-outline' });
  });

  it('rejects a composite glyph when one of its component glyphs lacks an outline', () => {
    // In Noto Sans Devanagari, GID 6 is a composite glyph referencing components GID 5 and GID 31.
    const missingSecondComponent = inspectOwnFontProgram(
      subsetOutlinesOnly(notoBytes, new Set([0, 5, 6])),
    );
    expect(missingSecondComponent.ok).toBe(true);
    if (missingSecondComponent.ok) expect(missingSecondComponent.hasGlyphOutline(6)).toBe(false);

    const withAllComponents = inspectOwnFontProgram(
      subsetOutlinesOnly(notoBytes, new Set([0, 5, 31, 6])),
    );
    expect(withAllComponents.ok).toBe(true);
    if (withAllComponents.ok) expect(withAllComponents.hasGlyphOutline(6)).toBe(true);
  });

  it('rejects corrupt or truncated font binaries cleanly without throwing', async () => {
    const engine = await getEngine();
    expect(evaluateOwnFontForLines(engine, new Uint8Array([0, 1, 2, 3]), sampleLine)).toEqual({
      useOwnFont: false,
      reason: 'invalid-sfnt',
    });
  });
});

describe('ownFont PDF extraction and Plan B embedding', () => {
  const fixtureBytes = new Uint8Array(readFileSync(MISMAPPED_FIXTURE_PATH));
  const notoBytes = new Uint8Array(readFileSync(NOTO_SANS_PATH));

  it('extracts Type0/CIDFontType2/Identity-H/FontFile2 candidate and ignores Type3 fonts', async () => {
    const doc = await PDFDocument.load(fixtureBytes);
    const page = doc.getPage(0);
    expect(extractEmbeddedFontCandidate(doc, page, 'F4')).toBeNull();
    const candidate = extractEmbeddedFontCandidate(doc, page, 'HpeVec-7098480789');
    expect(candidate).not.toBeNull();
    expect(candidate!.baseFontName).toBe('NotoSansDevanagari-W400');
    expect(candidate!.fontBytes.byteLength).toBeGreaterThan(100_000);
  });

  it('typesets edits in the document own font reusing FontFile2 ref without fetching Noto or mutating original font', async () => {
    const engine = await getEngine();
    const doc = await PDFDocument.load(fixtureBytes);
    const page = doc.getPage(0);
    const candidate = extractEmbeddedFontCandidate(doc, page, 'HpeVec-7098480789')!;
    expect(candidate).not.toBeNull();

    const origFontsDict = page.node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
    const origFontObj = doc.context.lookup(origFontsDict.get(PDFName.of('HpeVec-7098480789'))) as PDFDict;
    const origToUnicodeRef = origFontObj.get(PDFName.of('ToUnicode'))?.toString();

    let bundledFontFetches = 0;
    const editedLine = 'सूर्य, धर्म और क्षेत्र में विद्यालय';
    const handled = await drawVectorTextEdits(
      doc,
      [
        {
          page,
          editorToUser: [1, 0, 0, -1, 0, page.getHeight()],
          items: [
            {
              id: 'own-edit-1',
              fontFamily: 'NotoSansDevanagari',
              fontWeight: 400,
              fontSizePt: 14,
              color: '#111111',
              ownFontCandidates: [candidate],
              lines: [{ text: editedLine, xPt: 40, baselinePt: 300 }],
            },
          ],
        },
      ],
      {
        engine,
        loadFontBytes: async () => {
          bundledFontFetches++;
          return notoBytes;
        },
      },
    );

    expect(handled.has('own-edit-1')).toBe(true);
    expect(bundledFontFetches).toBe(0);
    // Original font dict must remain untouched.
    expect(origFontObj.get(PDFName.of('ToUnicode'))?.toString()).toBe(origToUnicodeRef);

    // The newly added font object must reuse the original FontFile2 PDFRef.
    const fontKeys = [...origFontsDict.keys()].map((k) => k.decodeText());
    const ownKeys = fontKeys.filter((k) => k.startsWith('HpeOwn'));
    expect(ownKeys.length).toBe(1);
    const ownFont = doc.context.lookup(origFontsDict.get(PDFName.of(ownKeys[0]))) as PDFDict;
    const descArr = doc.context.lookup(ownFont.get(PDFName.of('DescendantFonts'))) as PDFArray;
    const cid = doc.context.lookup(descArr.get(0)) as PDFDict;
    const fd = doc.context.lookup(cid.get(PDFName.of('FontDescriptor'))) as PDFDict;
    const reusedRef = fd.get(PDFName.of('FontFile2'));
    expect(reusedRef).toBeInstanceOf(PDFRef);
    expect(reusedRef!.toString()).toBe(candidate.fontFileRef.toString());

    const outBytes = await doc.save();

    // Verify pdf.js getTextContent has zero CID fallback garbage and maps the edited words.
    const pdfjsDoc = await pdfjs.getDocument({ data: outBytes.slice(), verbosity: 0 }).promise;
    const pdfjsPage = await pdfjsDoc.getPage(1);
    const tc = await pdfjsPage.getTextContent();
    await pdfjsDoc.destroy();
    const rawText = tc.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    expect(rawText.match(/[\u0100-\u02FF]/g)).toBeNull();
    const compact = rawText.replace(/\s+/g, '');
    for (const token of ['सूयर्', 'धमर्', 'और', 'क्षेत्र', 'में', 'िवद्यालय']) {
      expect(compact).toContain(token);
    }

    // Verify editor's ActualText extraction reads the exact logical line.
    const extracted = (await extractEmbeddedTextLines(outBytes, 0)).map((l) => l.text);
    expect(extracted.some((l) => l.replace(/\s+/g, ' ').trim() === editedLine)).toBe(true);

    if (hasPoppler()) {
      const dir = mkdtempSync(path.join(os.tmpdir(), 'own-font-unit-'));
      try {
        const pdfPath = path.join(dir, 'out.pdf');
        writeFileSync(pdfPath, outBytes);
        const popplerText = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
        expect(popplerText.replace(/\s+/g, ' ')).toContain(editedLine);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('falls back to bundled Noto Plan B when the embedded subset font lacks a needed glyph outline', async () => {
    const engine = await getEngine();
    const doc = await PDFDocument.load(fixtureBytes);
    const page = doc.getPage(0);
    const origCandidate = extractEmbeddedFontCandidate(doc, page, 'HpeVec-7098480789')!;

    // Build a retained-GID subset with GSUB intact that only has outlines for "नमस्ते".
    const small = evaluateOwnFontForLines(engine, notoBytes, [
      { text: 'नमस्ते', xPt: 40, baselinePt: 100 },
    ]);
    expect(small.useOwnFont).toBe(true);
    const kept = new Set<number>([0]);
    if (small.useOwnFont) {
      for (const line of small.lines) {
        for (const c of line.clusters) {
          for (const g of c.glyphs) kept.add(g.gid);
        }
      }
    }
    const subsetCandidate = {
      ...origCandidate,
      fontBytes: subsetOutlinesOnly(notoBytes, kept),
    };

    let bundledFontFetches = 0;
    const editedLine = 'सूर्य, धर्म और क्षेत्र में विद्यालय';
    const handled = await drawVectorTextEdits(
      doc,
      [
        {
          page,
          editorToUser: [1, 0, 0, -1, 0, page.getHeight()],
          items: [
            {
              id: 'fallback-edit-1',
              fontFamily: 'NotoSansDevanagari',
              fontWeight: 400,
              fontSizePt: 14,
              color: '#111111',
              ownFontCandidates: [subsetCandidate],
              lines: [{ text: editedLine, xPt: 40, baselinePt: 300 }],
            },
          ],
        },
      ],
      {
        engine,
        loadFontBytes: async () => {
          bundledFontFetches++;
          return notoBytes;
        },
      },
    );

    expect(handled.has('fallback-edit-1')).toBe(true);
    expect(bundledFontFetches).toBe(1);

    const outBytes = await doc.save();
    const extracted = (await extractEmbeddedTextLines(outBytes, 0)).map((l) => l.text);
    expect(extracted.some((l) => l.replace(/\s+/g, ' ').trim() === editedLine)).toBe(true);
  });
});
