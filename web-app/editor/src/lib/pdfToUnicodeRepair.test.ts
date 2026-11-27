import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFName, PDFString } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';

import { fontGlyphText, PRE_BASE_MARK, REPH_MARK } from './fontGlyphText';
import { extractEmbeddedTextLines } from './pdfTextExtract';
import { baseFontName, buildToUnicode, parseToUnicode, repairedToUnicode, repairMisMappedToUnicode } from './pdfToUnicodeRepair';

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
});
