import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFName, PDFString } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';

import { fontGlyphText, PRE_BASE_MARK, REPH_MARK } from './fontGlyphText';
import { extractEmbeddedTextLines } from './pdfTextExtract';
import {
  baseFontName,
  buildToUnicode,
  CLUSTER_FILLER_MARK,
  fontFamilyKey,
  parseToUnicode,
  repairedSpaceFillerToUnicode,
  repairedToUnicode,
  repairMisMappedToUnicode,
} from './pdfToUnicodeRepair';

describe('ToUnicode maps', () => {
  it('parses bfchar, bfrange and array bfrange entries', () => {
    const cmap = [
      '2 beginbfchar', '<0003> <0020>', '<0048> <0069>', 'endbfchar',
      '2 beginbfrange', '<00E6> <00E7> <0905>', '<00F8> <00F9> [<0915> <093F>]', 'endbfrange',
    ].join('\n');
    const map = parseToUnicode(cmap);
    expect(map.get(0x03)).toBe(' ');
    expect(map.get(0xe7)).toBe('आ');
    expect(map.get(0xf9)).toBe('ि');
  });

  it('round-trips through buildToUnicode, including multi-letter targets', () => {
    const map = new Map([[0x10, 'क्ष'], [0x2a, 'a']]);
    expect(parseToUnicode(buildToUnicode(map))).toEqual(map);
  });
});

describe('baseFontName', () => {
  it('decodes escaped characters, as pdf.js names the font', () => {
    expect(baseFontName(PDFName.of('ABCDEE+Nirmala UI,Bold'))).toBe('ABCDEE+Nirmala UI,Bold');
    expect(baseFontName(undefined)).toBe('');
  });
});

describe('repairedToUnicode', () => {
  it('makes single-letter entries the font cannot vouch for unknown, in a map shown to be wrong', () => {
    // Gazette of India subsets: no GSUB, a cmap for 4 glyphs; glyphs 8 and 9 (ि variants) are
    // named "द" and "ह" by the map, glyph 10 (a conjunct) "क्ष". Glyphs 1–4 prove the map wrong.
    const font = new Map<number, string>([[1, 'क'], [2, 'ख'], [3, 'ग'], [4, 'घ']]);
    const existing = new Map<number, string>([[1, 'ख'], [2, 'ग'], [3, 'घ'], [4, 'क'], [8, 'द'], [9, 'ह'], [10, 'क्ष'], [11, 'a']]);
    const repaired = repairedToUnicode(existing, font)!;
    expect([8, 9].map((gid) => repaired.get(gid))).toEqual([String.fromCharCode(0), String.fromCharCode(0)]);
    expect(repaired.get(10)).toBe('क्ष');
    expect(repaired.get(11)).toBe('a');
    // A map the font agrees with is left alone, unknown glyphs included.
    expect(repairedToUnicode(new Map([[1, 'क'], [2, 'ख'], [3, 'ग'], [4, 'घ'], [8, 'द']]), font)).toBeNull();
  });

  const font = new Map<number, string>([[1, 'क'], [2, 'ख'], [3, 'ग'], [4, 'घ'], [5, PRE_BASE_MARK], [6, 'a'], [7, 'क्ष']]);

  it('leaves a map that agrees with the font (Unicode normalisation and ligatures aside)', () => {
    const existing = new Map<number, string>([[1, 'क'], [2, 'ख'], [3, 'ग'], [4, 'घ'], [7, 'क्‍ष']]);
    expect(repairedToUnicode(existing, font)).toBeNull();
  });

  it('rebuilds a map that names the wrong letters, keeping non-Devanagari entries', () => {
    const existing = new Map<number, string>([[1, 'क'], [2, 'ि'], [3, 'व'], [5, 'व'], [6, 'a'], [9, 'x']]);
    const repaired = repairedToUnicode(existing, font);
    expect(repaired?.get(2)).toBe('ख');
    expect(repaired?.get(5)).toBe(PRE_BASE_MARK);
    expect(repaired?.get(7)).toBe('क्ष');
    expect(repaired?.get(9)).toBe('x');
  });

  it('repairs a map in drawing order: fills unmapped ligatures, marks ि, keeps agreeing entries', () => {
    const existing = new Map<number, string>([[1, 'क'], [2, 'ख'], [5, 'ि'], [6, 'b']]);
    const repaired = repairedToUnicode(existing, font);
    expect(repaired?.get(5)).toBe(PRE_BASE_MARK);
    expect(repaired?.get(7)).toBe('क्ष');
    expect(repaired?.get(6)).toBe('b');
    expect(repaired?.get(2)).toBe('ख');
  });

  it('needs at least three disagreements', () => {
    const existing = new Map<number, string>([[1, 'क'], [2, 'ि'], [3, 'व'], [5, 'व']]);
    expect(repairedToUnicode(new Map([[1, 'क'], [2, 'ि'], [3, 'व']]), font)).toBeNull();
    expect(repairedToUnicode(existing, font)).not.toBeNull();
  });

  it('repairs a rakar glyph or conjunct mapped backwards as र् even when single letters agree, without breaking reph', () => {
    const withRakar = new Map<number, string>([
      [1, 'प'],
      [2, 'त'],
      [3, 'र'],
      [4, '्'],
      [8, '्र'], // below-base rakar from GSUB blwf
      [9, 'प्र'], // rakar conjunct
      [10, REPH_MARK], // real reph from GSUB rphf
    ]);
    // Standalone rakar mapped backwards as "र्" while single letters agree and reph is absent from ToUnicode
    const backwardsRakar = new Map<number, string>([[1, 'प'], [2, 'त'], [3, 'र'], [4, '्'], [8, 'र्']]);
    const fixed = repairedToUnicode(backwardsRakar, withRakar);
    expect(fixed?.get(8)).toBe('्र');
    expect(fixed?.get(10)).toBe(REPH_MARK);

    // Rakar conjunct mapped backwards ("पर्" instead of "प्र")
    const backwardsConjunct = new Map<number, string>([[1, 'प'], [2, 'त'], [3, 'र'], [4, '्'], [9, 'पर्']]);
    const fixedConjunct = repairedToUnicode(backwardsConjunct, withRakar);
    expect(fixedConjunct?.get(9)).toBe('प्र');
    expect(fixedConjunct?.get(10)).toBe(REPH_MARK);

    // Correctly mapped rakar ("्र") does not trigger repair
    const correctRakar = new Map<number, string>([[1, 'प'], [2, 'त'], [3, 'र'], [4, '्'], [8, '्र'], [9, 'प्र']]);
    expect(repairedToUnicode(correctRakar, withRakar)).toBeNull();

    // Real reph mapped as "र्" still gets REPH_MARK (not "्र")
    const rephInDrawingOrder = new Map<number, string>([[1, 'प'], [2, 'त'], [10, 'र्']]);
    const fixedReph = repairedToUnicode(rephInDrawingOrder, withRakar);
    expect(fixedReph?.get(10)).toBe(REPH_MARK);
  });

  it('repairs backwards rakar in a real PDF while keeping real reph glyphs in reading order', async () => {
    const noto = new Uint8Array(readFileSync(path.join(__dirname, '../../public/fonts/NotoSansDevanagari-Variable.ttf')));
    const reading = fontGlyphText(noto).text;
    const gidOf = (ch: string) => {
      const found = [...reading.entries()].find(([, text]) => text === ch);
      if (!found) throw new Error(`missing glyph for ${ch}`);
      return found[0];
    };
    const gPa = gidOf('प');
    const gAa = gidOf('ा');
    const gDha = gidOf('ध');
    const gMa = gidOf('म');
    const gRakar = gidOf('्र');
    const gReph = gidOf(REPH_MARK);
    const gSpace = gidOf(' ');

    const cmap = buildToUnicode(
      new Map<number, string>([
        [gPa, 'प'],
        [gAa, 'ा'],
        [gDha, 'ध'],
        [gMa, 'म'],
        [gSpace, ' '],
        // Backwards rakar: ToUnicode says "र्" for the below-base rakar glyph.
        [gRakar, 'र्'],
        // Real reph glyph in drawing order.
        [gReph, 'र्'],
      ]),
    );
    const doc = await PDFDocument.create();
    const ctx = doc.context;
    const cid = ctx.obj({
      Type: 'Font',
      Subtype: 'CIDFontType2',
      BaseFont: 'TESTAA+NotoSansDevanagari',
      CIDSystemInfo: { Registry: PDFString.of('Adobe'), Ordering: PDFString.of('Identity'), Supplement: 0 },
      CIDToGIDMap: 'Identity',
      DW: 600,
      FontDescriptor: ctx.register(
        ctx.obj({
          Type: 'FontDescriptor',
          FontName: 'TESTAA+NotoSansDevanagari',
          Flags: 32,
          FontBBox: [0, -300, 1000, 900],
          ItalicAngle: 0,
          Ascent: 900,
          Descent: -300,
          CapHeight: 700,
          StemV: 80,
          FontFile2: ctx.register(ctx.flateStream(noto)),
        }),
      ),
    });
    const type0 = ctx.register(
      ctx.obj({
        Type: 'Font',
        Subtype: 'Type0',
        BaseFont: 'TESTAA+NotoSansDevanagari',
        Encoding: 'Identity-H',
        DescendantFonts: [ctx.register(cid)],
        ToUnicode: ctx.register(ctx.flateStream(cmap)),
      }),
    );
    const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
    const page = doc.addPage([400, 200]);
    page.node.setFontDictionary(PDFName.of('F1'), type0);
    // Draws "प्रा धर्म": [प, rakar, ा, space, ध, म, reph]
    const hexRun = [gPa, gRakar, gAa, gSpace, gDha, gMa, gReph].map(hex4).join('');
    page.node.addContentStream(ctx.register(ctx.flateStream(`BT /F1 14 Tf 40 120 Td <${hexRun}> Tj ET`)));
    const bytes = new Uint8Array(await doc.save({ useObjectStreams: false }));

    const repair = await repairMisMappedToUnicode(bytes);
    expect(repair.repairedFonts).toEqual(['TESTAA+NotoSansDevanagari']);
    const text = (await extractEmbeddedTextLines(bytes, 0)).map((line) => line.text).join(' ');
    expect(text).toContain('प्रा');
    expect(text).toContain('धर्म');
    expect(text).not.toContain('पर्ा');
  }, 30000);

  it('normalizes subset prefixes and weight/style suffixes in fontFamilyKey', () => {
    expect(fontFamilyKey('ABCDEE+Mangal')).toBe('mangal');
    expect(fontFamilyKey('ABCDEE+Mangal-Bold')).toBe('mangal');
    expect(fontFamilyKey('ABCDEE+Mangal,Bold')).toBe('mangal');
    expect(fontFamilyKey('FORKWM+Mangal-Regular')).toBe('mangal');
    expect(fontFamilyKey('ABCDEE+Nirmala UI,BoldItalic')).toBe('nirmalaui');
    expect(fontFamilyKey('NRGBNY+NotoSansDevanagari-W400')).toBe('notosansdevanagari');
  });

  it('repairs a small subset with 1-2 disagreements when a sibling font was repaired, while leaving right-mapped siblings untouched', () => {
    const smallBroken = new Map<number, string>([[1, 'क'], [2, 'ख'], [3, 'ग'], [4, 'ि']]);
    // Standalone with only 1 disagreement (घ -> ि): stays null without sibling context.
    expect(repairedToUnicode(smallBroken, font)).toBeNull();
    // With a repaired sibling font of the same family: repaired!
    const fixed = repairedToUnicode(smallBroken, font, { siblingRepaired: true });
    expect(fixed?.get(4)).toBe('घ');
    // A right-mapped sibling (0 disagreements) must stay untouched even when siblingRepaired is true.
    const rightSibling = new Map<number, string>([[1, 'क'], [2, 'ख'], [3, 'ग'], [4, 'घ']]);
    expect(repairedToUnicode(rightSibling, font, { siblingRepaired: true })).toBeNull();
  });

  it('repairs a standalone font when its map names a font-proven pre-base ि or reph glyph as a consonant', () => {
    const fontWithMarks = new Map<number, string>([
      [1, 'क'],
      [2, 'ख'],
      [3, 'ग'],
      [4, 'घ'],
      [5, PRE_BASE_MARK],
      [6, REPH_MARK],
    ]);
    // Pre-base ि mapped to consonant "व" (single disagreement, below 3-glyph threshold): repaired!
    const iAsConsonant = new Map<number, string>([[1, 'क'], [2, 'ख'], [3, 'ग'], [4, 'घ'], [5, 'व']]);
    expect(repairedToUnicode(iAsConsonant, fontWithMarks)?.get(5)).toBe(PRE_BASE_MARK);
    // Reph mapped to consonant "ण" (single disagreement): repaired!
    const rephAsConsonant = new Map<number, string>([[1, 'क'], [2, 'ख'], [3, 'ग'], [4, 'घ'], [6, 'ण']]);
    expect(repairedToUnicode(rephAsConsonant, fontWithMarks)?.get(6)).toBe(REPH_MARK);
    // Reph mapped as "र्" is drawing-order, not a mis-mapped consonant, so other disagreements are not forced.
    const rephDrawingOrder = new Map<number, string>([[1, 'क'], [2, 'ख'], [6, 'र्'], [99, 'custom']]);
    const drawingRepaired = repairedToUnicode(rephDrawingOrder, fontWithMarks);
    expect(drawingRepaired?.get(6)).toBe(REPH_MARK);
    expect(drawingRepaired?.get(99)).toBe('custom');
  });

  it('preserves reph on GSUB-proven reph ligatures whose base vowel sign was stripped from cmap', () => {
    const subsetFont = new Map<number, string>([[1, 'स'], [2, 'व'], [3, 'च'], [4, 'च्']]);
    // Word mapped व -> र्व and ो+reph(574) -> ो; gid 574 is in rephLigatures because ो was stripped from cmap.
    const existing = new Map<number, string>([[1, 'स'], [2, 'र्व'], [3, 'च'], [4, 'च्'], [574, 'ो']]);
    const repaired = repairedToUnicode(existing, subsetFont, {
      siblingRepaired: true,
      rephLigatures: new Set([574]),
    });
    expect(repaired?.get(2)).toBe('व');
    expect(repaired?.get(574)).toBe(`${REPH_MARK}ो`);
  });

  it('repairs a small bold subset alongside a mis-mapped regular sibling in a PDF while leaving a right sibling untouched', async () => {
    const noto = new Uint8Array(readFileSync(path.join(__dirname, '../../public/fonts/NotoSansDevanagari-Variable.ttf')));
    const reading = fontGlyphText(noto).text;
    const gidOf = (ch: string) => {
      const found = [...reading.entries()].find(([, text]) => text === ch);
      if (!found) throw new Error(`missing glyph for ${ch}`);
      return found[0];
    };
    const gKa = gidOf('क');
    const gKha = gidOf('ख');
    const gGa = gidOf('ग');
    const gGha = gidOf('घ');
    const gVa = gidOf('व');
    const gTa = gidOf('त');
    const gSpace = gidOf(' ');

    const doc = await PDFDocument.create();
    const ctx = doc.context;
    const makeFont = (baseName: string, cmapMap: Map<number, string>) => {
      const cid = ctx.obj({
        Type: 'Font',
        Subtype: 'CIDFontType2',
        BaseFont: baseName,
        CIDSystemInfo: { Registry: PDFString.of('Adobe'), Ordering: PDFString.of('Identity'), Supplement: 0 },
        CIDToGIDMap: 'Identity',
        DW: 600,
        FontDescriptor: ctx.register(
          ctx.obj({
            Type: 'FontDescriptor',
            FontName: baseName,
            Flags: 32,
            FontBBox: [0, -300, 1000, 900],
            ItalicAngle: 0,
            Ascent: 900,
            Descent: -300,
            CapHeight: 700,
            StemV: 80,
            FontFile2: ctx.register(ctx.flateStream(noto)),
          }),
        ),
      });
      return ctx.register(
        ctx.obj({
          Type: 'Font',
          Subtype: 'Type0',
          BaseFont: baseName,
          Encoding: 'Identity-H',
          DescendantFonts: [ctx.register(cid)],
          ToUnicode: ctx.register(ctx.flateStream(buildToUnicode(cmapMap))),
        }),
      );
    };

    // Register Bold subset BEFORE Regular body font (as in 32_court_sci.pdf) with only 1 disagreement (व -> र्व).
    const boldFont = makeFont(
      'ABCDEE+NotoSansDevanagari,Bold',
      new Map([[gKa, 'क'], [gKha, 'ख'], [gGa, 'ग'], [gGha, 'घ'], [gTa, 'त'], [gVa, 'र्व'], [gSpace, ' ']]),
    );
    // Register a right-mapped sibling subset (0 disagreements) that must stay untouched.
    const rightSibling = makeFont(
      'FORKWM+NotoSansDevanagari-Regular',
      new Map([[gKa, 'क'], [gKha, 'ख'], [gGa, 'ग'], [gSpace, ' ']]),
    );
    // Register Regular body font with 3 disagreements (repaired in Pass 1).
    const bodyFont = makeFont(
      'ABCDEE+NotoSansDevanagari',
      new Map([[gKa, 'ख'], [gKha, 'ग'], [gGa, 'घ'], [gGha, 'घ'], [gVa, 'व'], [gTa, 'त'], [gSpace, ' ']]),
    );

    const page = doc.addPage([400, 200]);
    page.node.setFontDictionary(PDFName.of('F1'), boldFont);
    page.node.setFontDictionary(PDFName.of('F2'), rightSibling);
    page.node.setFontDictionary(PDFName.of('F3'), bodyFont);
    const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
    const boldRun = [gVa, gTa].map(hex4).join('');
    page.node.addContentStream(ctx.register(ctx.flateStream(`BT /F1 14 Tf 40 120 Td <${boldRun}> Tj ET`)));
    const bytes = new Uint8Array(await doc.save({ useObjectStreams: false }));

    const repair = await repairMisMappedToUnicode(bytes);
    expect(repair.repairedFonts).toContain('ABCDEE+NotoSansDevanagari');
    expect(repair.repairedFonts).toContain('ABCDEE+NotoSansDevanagari,Bold');
    expect(repair.repairedFonts).not.toContain('FORKWM+NotoSansDevanagari-Regular');
    const text = (await extractEmbeddedTextLines(bytes, 0)).map((line) => line.text).join(' ');
    expect(text).toContain('वत');
  }, 30000);

  it('keeps Word 2021 िं and ां attached when CIDToGIDMap maps non-space Devanagari filler CIDs to space', async () => {
    const noto = new Uint8Array(readFileSync(path.join(__dirname, '../../public/fonts/NotoSansDevanagari-Variable.ttf')));
    const reading = fontGlyphText(noto).text;
    const gidOf = (ch: string) => {
      const found = [...reading.entries()].find(([, text]) => text === ch);
      if (!found) throw new Error(`missing glyph for ${ch}`);
      return found[0];
    };
    const gSpace = gidOf(' ');
    const gSa = gidOf('स');
    const gHa = gidOf('ह');
    const gKa = gidOf('क');
    const gTa = gidOf('त');
    const gDa = gidOf('द');
    const gNa = gidOf('न');
    const gAa = gidOf('ा');
    const gA = gidOf('अ');
    const gYa = gidOf('य');
    const gI = gidOf(PRE_BASE_MARK);
    const gAnusvara = gidOf('ं');
    const gU = gidOf('ु');

    // Word 2021 allocates a separate CID per visual cluster slot via a CIDToGIDMap stream and maps
    // the middle Devanagari glyph of 3-glyph clusters (सिं, किं, दां/नां) to U+0020 space.
    const cidToGidEntries: [number, number][] = [
      [0x00, 0],
      [0x01, gSpace], // real space
      [0x02, gI], // pre-base ि mapped to "स"
      [0x03, gSa], // middle स mapped to " " (Word filler space!)
      [0x04, gAnusvara], // zero-width ं mapped to "िं"
      [0x05, gHa], // ह
      [0x06, gA], // अ
      [0x07, gNa], // न
      [0x08, gYa], // य
      [0x09, gI], // pre-base ि mapped to "क"
      [0x0a, gKa], // middle क mapped to " " (Word filler space!)
      [0x0b, gTa], // त
      [0x0c, gU], // ु (w=0)
      [0x0d, gI], // pre-base ि mapped to "द"
      [0x0e, gDa], // द mapped to "ि"
      [0x0f, gAa], // middle ा mapped to " " (Word filler space!)
      [0x10, gAnusvara], // zero-width ं mapped to "ां"
      [0x11, gKa], // real क
      [0x12, gSa], // real स (so GID gSa also has a Devanagari sibling CID)
    ];
    const cidToGidBytes = new Uint8Array((cidToGidEntries.length + 1) * 2);
    for (const [cid, gid] of cidToGidEntries) {
      cidToGidBytes[cid * 2] = (gid >> 8) & 0xff;
      cidToGidBytes[cid * 2 + 1] = gid & 0xff;
    }

    const cmap = buildToUnicode(
      new Map<number, string>([
        [0x01, ' '],
        [0x02, 'स'],
        [0x03, ' '],
        [0x04, 'िं'],
        [0x05, 'ह'],
        [0x06, 'अ'],
        [0x07, 'न'],
        [0x08, 'य'],
        [0x09, 'क'],
        [0x0a, ' '],
        [0x0b, 'त'],
        [0x0c, 'ु'],
        [0x0d, 'द'],
        [0x0e, 'ि'],
        [0x0f, ' '],
        [0x10, 'ां'],
        [0x11, 'क'],
        [0x12, 'स'],
      ]),
    );

    const doc = await PDFDocument.create();
    const ctx = doc.context;
    const cidFont = ctx.obj({
      Type: 'Font',
      Subtype: 'CIDFontType2',
      BaseFont: 'BCDGEE+NotoSansDevanagari',
      CIDSystemInfo: { Registry: PDFString.of('Adobe'), Ordering: PDFString.of('Identity'), Supplement: 0 },
      CIDToGIDMap: ctx.register(ctx.flateStream(cidToGidBytes)),
      DW: 600,
      W: [
        0x01, [500, 313, 730, 0, 548, 782, 678, 678, 313, 782, 665, 0, 313, 574, 261, 0, 782, 730],
      ],
      FontDescriptor: ctx.register(
        ctx.obj({
          Type: 'FontDescriptor',
          FontName: 'BCDGEE+NotoSansDevanagari',
          Flags: 32,
          FontBBox: [0, -300, 1000, 900],
          ItalicAngle: 0,
          Ascent: 900,
          Descent: -300,
          CapHeight: 700,
          StemV: 80,
          FontFile2: ctx.register(ctx.flateStream(noto)),
        }),
      ),
    });
    const type0 = ctx.register(
      ctx.obj({
        Type: 'Font',
        Subtype: 'Type0',
        BaseFont: 'BCDGEE+NotoSansDevanagari',
        Encoding: 'Identity-H',
        DescendantFonts: [ctx.register(cidFont)],
        ToUnicode: ctx.register(ctx.flateStream(cmap)),
      }),
    );

    const page = doc.addPage([500, 300]);
    page.node.setFontDictionary(PDFName.of('F1'), type0);
    // Line 1: "सिंह अनय" with Word 2021 GPOS TJ shifts [-69] before zero-width िं and [+70] before ह
    // Line 2: "सिंह" alone followed by space + "दिनांक"
    // Line 3: "किंतु अनय" with Word 2021 GPOS TD backtrack (7.44 0.48 TD / 1.92 -0.48 TD) and a 7.5pt justified space
    const stream = [
      'BT /F1 12 Tf 1 0 0 1 72 240 Tm [<0002>4<0003>-69<0004>70<00050001000600070008>] TJ ET',
      'BT /F1 12 Tf 1 0 0 1 72 200 Tm [<0002>4<0003>-69<0004>70<0005>] TJ ET',
      'BT /F1 12 Tf 1 0 0 1 72 160 Tm [<000D000E0007000F00100011>] TJ ET',
      'BT /F1 12 Tf 1 0 0 1 72 120 Tm <0009> Tj 3.72 0 TD <000A> Tj 7.44 0.48 TD <0004> Tj 1.92 -0.48 TD <000B000C> Tj 15.48 0 TD <000600070008> Tj ET',
    ].join('\n');
    page.node.addContentStream(ctx.register(ctx.flateStream(stream)));
    const bytes = new Uint8Array(await doc.save({ useObjectStreams: false }));

    const repair = await repairMisMappedToUnicode(bytes);
    // Filler-space normalization must not falsely mark the font as cmap-rebuilt.
    expect(repair.repairedFonts).toEqual([]);
    const lines = await extractEmbeddedTextLines(bytes, 0);
    expect(lines.map((line) => line.text)).toEqual(['सिंह अनय', 'सिंह', 'दिनांक', 'किंतु अनय']);
  }, 30000);

  it('replaces only non-space Devanagari filler CIDs in repairedSpaceFillerToUnicode and fails closed on empty-cmap fonts', () => {
    const fromFont = new Map<number, string>([
      [3, ' '],
      [160, 'स'],
      [545, 'ा'],
    ]);
    // GID 547 is a GSUB contextual ी variant absent from cmap (Word stripped GSUB) but proven by sibling CID 0x16 -> "ी".
    const cidToGid = new Map<number, number>([
      [0x00, 0], // .notdef
      [0x09, 3], // real space
      [0x16, 547], // real ी
      [0x2c, 547], // filler ी mapped to " "
      [0x3b, 160], // filler स mapped to " "
      [0x7d, 545], // filler ा mapped to " "
      [0x99, 999], // unknown non-Devanagari glyph mapped to " "
    ]);
    const existing = new Map<number, string>([
      [0x00, ' '],
      [0x09, ' '],
      [0x16, 'ी'],
      [0x2c, ' '],
      [0x3b, ' '],
      [0x7d, ' '],
      [0x99, ' '],
    ]);
    const fixed = repairedSpaceFillerToUnicode(existing, (cid) => cidToGid.get(cid) ?? -1, fromFont);
    expect(fixed?.get(0x00)).toBe(' '); // glyph 0 untouched
    expect(fixed?.get(0x09)).toBe(' '); // real space untouched
    expect(fixed?.get(0x2c)).toBe(CLUSTER_FILLER_MARK); // sibling-proven ी replaced
    expect(fixed?.get(0x3b)).toBe(CLUSTER_FILLER_MARK); // cmap-proven स replaced
    expect(fixed?.get(0x7d)).toBe(CLUSTER_FILLER_MARK); // cmap-proven ा replaced
    expect(fixed?.get(0x99)).toBe(' '); // unproven glyph untouched

    // Clean font with only real space returns null.
    const clean = new Map<number, string>([[0x09, ' '], [0x16, 'ी']]);
    expect(repairedSpaceFillerToUnicode(clean, (cid) => cidToGid.get(cid) ?? -1, fromFont)).toBeNull();

    // Dummy OCR font (Tesseract GlyphLessFont): empty cmap, every CID mapped to GID 1 — must fail closed!
    const glyphLess = new Map<number, string>([[0x20, ' '], [0x21, 'क']]);
    expect(repairedSpaceFillerToUnicode(glyphLess, () => 1, new Map())).toBeNull();
  });
});
