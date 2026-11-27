import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFName, PDFString } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';

import { fontGlyphText } from './fontGlyphText';
import { applyActualText, drawnGlyphs, markedContentStarts, type MarkedContentOps } from './pdfActualText';
import { extractEmbeddedTextLines } from './pdfTextExtract';
import { buildToUnicode } from './pdfToUnicodeRepair';

const NUL = String.fromCharCode(0);
const OPS: MarkedContentOps = { showText: 1, beginMarkedContent: 2, beginMarkedContentProps: 3, endMarkedContent: 4 };

describe('markedContentStarts', () => {
  it('reads each BDC tag and its ActualText (UTF-16 hex), in order', () => {
    const content = [
      '/Span<</ActualText <FEFF0927094D092F093E> >> BDC <33> Tj EMC',
      '/OC /oc1 BDC <4C> Tj EMC',
      '/Span <</MCID 3 /ActualText (Hi)>> BDC (x) Tj EMC',
    ].join('\n');
    expect(markedContentStarts(content)).toEqual([
      { tag: 'Span', actualText: 'ध्या' },
      { tag: 'OC', actualText: null },
      { tag: 'Span', actualText: 'Hi' },
    ]);
  });

  it('decodes #XX hex escapes in PDF Name BDC tags to match pdf.js', () => {
    const content = [
      '/Normal#20#28Web#29<</MCID 2>>BDC',
      '/Span<</ActualText<FEFF09380947>>>BDC <010A> Tj EMC',
      'EMC',
    ].join('\n');
    expect(markedContentStarts(content)).toEqual([
      { tag: 'Normal (Web)', actualText: null },
      { tag: 'Span', actualText: 'से' },
    ]);
  });
});

describe('drawnGlyphs', () => {
  const glyph = (unicode: string) => ({ unicode });

  it('marks glyphs inside an ActualText section, nested sections included', () => {
    const fnArray = [1, 3, 1, 2, 1, 4, 4, 1];
    const argsArray = [[[glyph('अ')]], ['Span', null], [[glyph(NUL), 12, glyph('ा')]], ['P'], [[glyph('x')]], null, null, [[glyph('य')]]];
    expect(drawnGlyphs(fnArray, argsArray, [{ tag: 'Span', actualText: 'ध्या' }], OPS)).toEqual([
      { text: 'अ', section: null },
      { text: NUL, section: 0 },
      { text: 'ा', section: 0 },
      { text: 'x', section: 0 },
      { text: 'य', section: null },
    ]);
  });

  it('gives up when the sections do not match the content stream', () => {
    expect(drawnGlyphs([3, 4], [['Span', null], null], [{ tag: 'OC', actualText: null }], OPS)).toBeNull();
    expect(drawnGlyphs([3, 4], [['Span', null], null], [], OPS)).toBeNull();
  });
});

describe('applyActualText', () => {
  it('puts each section text in place of its glyphs, across items and around added spaces', () => {
    // अध्याय drawn as अ, [ध्य (unmapped), ा] in a span, य; the span's glyphs fall in two items.
    const glyphs = [
      { text: 'अ', section: null },
      { text: NUL, section: 0 },
      { text: 'ा', section: 0 },
      { text: 'य', section: null },
      { text: ' ', section: null },
      { text: '1', section: null },
    ];
    const result = applyActualText([`अ${NUL}`, 'ाय', ' ', '1'], glyphs, ['ध्या']);
    expect(result?.items.join('')).toBe('अध्याय 1');
    expect(result?.replaced).toEqual([true]);
  });

  it('prefers /ActualText even when all glyphs are mapped and reports unmapped glyphs outside sections', () => {
    const glyphs = [
      { text: 'क', section: 0 },
      { text: NUL, section: null },
    ];
    const result = applyActualText([`क${NUL}`], glyphs, ['ख']);
    expect(result?.items).toEqual([`ख${NUL}`]);
    expect(result?.replaced).toEqual([false]);
  });

  it('restores logical Devanagari reading order from /ActualText for mapped visual-order glyphs', () => {
    // Visual order from ToUnicode: िकताब, प्र कृित (with synthetic pdf.js space), धमर्.
    const glyphs = [
      { text: 'ि', section: 0 },
      { text: 'क', section: 0 },
      { text: 'त', section: 0 },
      { text: 'ा', section: 0 },
      { text: 'ब', section: 0 },
      { text: ' ', section: null },
      { text: 'प्र', section: 1 },
      { text: 'क', section: 1 },
      { text: 'ृ', section: 1 },
      { text: 'ि', section: 1 },
      { text: 'त', section: 1 },
      { text: ' ', section: null },
      { text: 'ध', section: 2 },
      { text: 'म', section: 2 },
      { text: 'र्', section: 2 },
    ];
    const result = applyActualText(['िकताब', ' ', 'प्र', ' ', 'कृित', ' ', 'धमर्'], glyphs, ['किताब', 'प्रकृति', 'धर्म']);
    expect(result?.items.join('')).toBe('किताब प्रकृति धर्म');
    expect(result?.replaced).toEqual([]);
  });

  it('ignores whitespace-only /ActualText spans (such as NBSP) whose space glyph pdf.js omitted', () => {
    const glyphs = [
      { text: ' ', section: 0 },
      { text: '|', section: null },
      { text: 'ध', section: 1 },
      { text: 'म', section: 1 },
      { text: 'र्', section: 1 },
    ];
    const result = applyActualText(['|', 'धमर्'], glyphs, ['\u00a0', 'धर्म']);
    expect(result?.items.join('')).toBe('|धर्म');
  });

  it('lines up ligature glyphs that pdf.js decomposed in its text', () => {
    const glyphs = [
      { text: 'ﬁ', section: null },
      { text: 'le ', section: null },
      { text: NUL, section: 0 },
    ];
    expect(applyActualText(['file', ' ', NUL], glyphs, ['धर्म'])?.items).toEqual(['file', ' ', 'धर्म']);
  });

  it('removes spaces pdf.js added inside Hindi words when the page draws its spaces', () => {
    const glyphs = [...'शिक्षा नीति'].map((text) => ({ text, section: null }));
    expect(applyActualText(['शि', ' ', 'क्षा', ' ', 'नीति'], glyphs, [])?.items.join('')).toBe('शिक्षा नीति');
    // Without drawn spaces, pdf.js's spaces are the only word breaks and stay.
    const unspaced = [...'शिक्षानीति'].map((text) => ({ text, section: null }));
    expect(applyActualText(['शि', ' ', 'क्षा'], unspaced.slice(0, 6), [])?.items.join('')).toBe('शि क्षा');
  });

  it('preserves a drawn space glyph that pdf.js omitted from textContent after an /ActualText span', () => {
    // Models Pdftools SDK: "के" drawn as क + 0x0A ('\n') inside /ActualText, followed by a drawn
    // space glyph that pdf.js deduplicated against '\n' and omitted from getTextContent().
    const glyphs = [
      { text: 'क', section: 0 },
      { text: '\n', section: 0 },
      { text: ' ', section: null },
      { text: 'स', section: null },
      { text: 'भी', section: null },
    ];
    const acrossItems = applyActualText(['क', 'सभी'], glyphs, ['के']);
    expect(acrossItems?.items).toEqual(['के', 'सभी']);
    expect(acrossItems?.spaceAfter).toEqual([true, false]);

    const sameItem = applyActualText(['कसभी'], glyphs, ['के']);
    expect(sameItem?.items).toEqual(['के सभी']);
  });

  it('keeps a drawn space pdf.js omitted after a half form out of the text (a typed joiner, CEN 08/2024)', () => {
    // Chrome draws a typed joiner inside उम्‍मीदवार as a space glyph that pdf.js leaves out of its
    // text; a space left out right after a half form (virama) is not a word break.
    const glyphs = [
      { text: 'उ', section: null },
      { text: 'म्', section: null },
      { text: ' ', section: null },
      { text: 'मी', section: null },
    ];
    expect(applyActualText(['उम्मी'], glyphs, [])?.items).toEqual(['उम्मी']);
    expect(applyActualText(['उम्', 'मी'], glyphs, [])?.spaceAfter).toEqual([false, false]);
    // After a full letter it is a word break (Pdftools: और केंद्रीय).
    const word = [{ text: 'और', section: null }, { text: ' ', section: null }, { text: 'के', section: null }];
    expect(applyActualText(['और', 'के'], word, [])?.spaceAfter).toEqual([true, false]);
  });

  it('gives up when the glyphs do not match the items', () => {
    expect(applyActualText(['abc'], [{ text: 'x', section: 0 }, { text: NUL, section: 0 }], ['y'])).toBeNull();
  });

  it('applies /ActualText spans nested inside a #XX-escaped BDC tag in a real PDF', async () => {
    const noto = new Uint8Array(readFileSync(path.join(__dirname, '../../public/fonts/NotoSansDevanagari-Variable.ttf')));
    const reading = fontGlyphText(noto).text;
    const gidOf = (ch: string) => {
      const found = [...reading.entries()].find(([, text]) => text === ch);
      if (!found) throw new Error(`missing glyph for ${ch}`);
      return found[0];
    };
    const gSa = gidOf('स');
    const gE = gidOf('े');
    const gVa = gidOf('व');
    const gAa = gidOf('ा');
    // Polluted ToUnicode (as Pdftools SDK produces when reusing स from "सं" in "सेवा"):
    // स -> "सं", व -> "वा", while े and ा map to ASCII control bytes.
    const toUni = buildToUnicode(
      new Map<number, string>([
        [gSa, 'सं'],
        [gE, '\u0002'],
        [gVa, 'वा'],
        [gAa, '\u0005'],
      ]),
    );
    const doc = await PDFDocument.create();
    const ctx = doc.context;
    const cid = ctx.obj({
      Type: 'Font',
      Subtype: 'CIDFontType2',
      BaseFont: 'TESTCC+Mangal-Regular',
      CIDSystemInfo: { Registry: PDFString.of('Adobe'), Ordering: PDFString.of('Identity'), Supplement: 0 },
      CIDToGIDMap: 'Identity',
      DW: 600,
      FontDescriptor: ctx.register(
        ctx.obj({
          Type: 'FontDescriptor',
          FontName: 'TESTCC+Mangal-Regular',
          Flags: 32,
          FontBBox: [0, -300, 1000, 900],
          ItalicAngle: 0,
          Ascent: 900,
          Descent: -300,
          CapHeight: 700,
          StemV: 80,
        }),
      ),
    });
    const type0 = ctx.register(
      ctx.obj({
        Type: 'Font',
        Subtype: 'Type0',
        BaseFont: 'TESTCC+NotoSansDevanagari',
        Encoding: 'Identity-H',
        DescendantFonts: [ctx.register(cid)],
        ToUnicode: ctx.register(ctx.flateStream(toUni)),
      }),
    );
    const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
    const utf16Hex = (s: string) => `FEFF${[...s].map((c) => hex4(c.charCodeAt(0))).join('')}`;
    const stream = [
      '/Normal#20#28Web#29<</MCID 1>>BDC',
      'BT /F1 12 Tf 40 120 Td',
      `/Span<</ActualText<${utf16Hex('से')}>>>BDC <${hex4(gSa)}${hex4(gE)}> Tj EMC`,
      `/Span<</ActualText<${utf16Hex('वा')}>>>BDC <${hex4(gVa)}${hex4(gAa)}> Tj EMC`,
      'ET',
      'EMC',
    ].join('\n');
    const page = doc.addPage([300, 200]);
    page.node.setFontDictionary(PDFName.of('F1'), type0);
    page.node.addContentStream(ctx.register(ctx.flateStream(stream)));
    const bytes = new Uint8Array(await doc.save({ useObjectStreams: false }));

    const text = (await extractEmbeddedTextLines(bytes, 0)).map((l) => l.text).join(' ');
    expect(text).toContain('सेवा');
    expect(text).not.toContain('संवा');
  }, 30000);
});
