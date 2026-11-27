import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PDFDocument, PDFName, PDFString, StandardFonts } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';

import { extractEmbeddedTextLines } from './pdfTextExtract';
import { missingGlyphPagesOf, sharedPdfDocument } from './sharedPdfDocument';
import { repairMisMappedToUnicode } from './pdfToUnicodeRepair';

/**
 * Page 1 draws "अअअ RRB" where the Hindi is glyph 0 (the font's missing-glyph box) of a CID font
 * whose ToUnicode names it "अ", as Word does when it sets Hindi in a font without Devanagari.
 * Page 2 has the same font but draws only its space glyph; page 3 is ordinary text.
 */
async function boxesPdf(glyphZero = '0905'): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const ctx = doc.context;
  const toUnicode = ctx.register(
    ctx.flateStream(
      [
        '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
        '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
        '/CMapName /Adobe-Identity-UCS def /CMapType 2 def',
        '1 begincodespacerange <0000> <FFFF> endcodespacerange',
        `2 beginbfchar <0000> <${glyphZero}> <0003> <0020> endbfchar`,
        'endcmap CMapName currentdict /CMap defineresource pop end end',
      ].join('\n'),
    ),
  );
  const cid = ctx.obj({
    Type: 'Font',
    Subtype: 'CIDFontType2',
    BaseFont: 'ABCDEE+CourierNew',
    CIDSystemInfo: { Registry: PDFString.of('Adobe'), Ordering: PDFString.of('Identity'), Supplement: 0 },
    CIDToGIDMap: 'Identity',
    DW: 600,
    // Any TrueType program: what matters is that glyph 0 is its empty box.
    FontDescriptor: ctx.register(
      ctx.obj({
        Type: 'FontDescriptor',
        FontName: 'ABCDEE+CourierNew',
        Flags: 32,
        FontBBox: [0, -300, 1000, 900],
        ItalicAngle: 0,
        Ascent: 900,
        Descent: -300,
        CapHeight: 700,
        StemV: 80,
        FontFile2: ctx.register(ctx.flateStream(readFileSync(path.join(__dirname, '../../public/fonts/NotoSansDevanagari-Variable.ttf')))),
      }),
    ),
  });
  const type0 = ctx.register(
    ctx.obj({ Type: 'Font', Subtype: 'Type0', BaseFont: 'ABCDEE+CourierNew', Encoding: 'Identity-H', DescendantFonts: [ctx.register(cid)], ToUnicode: toUnicode }),
  );
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const boxes = doc.addPage([300, 200]);
  boxes.node.setFontDictionary(PDFName.of('F9'), type0);
  boxes.drawText('RRB', { x: 200, y: 100, size: 12, font: helvetica });
  const content = ctx.register(ctx.flateStream('BT /F9 12 Tf 20 100 Td <0000000000000003> Tj ET'));
  boxes.node.addContentStream(content);
  const unused = doc.addPage([300, 200]);
  unused.node.setFontDictionary(PDFName.of('F9'), type0);
  unused.drawText('Font listed, box not drawn', { x: 20, y: 150, size: 12, font: helvetica });
  unused.node.addContentStream(ctx.register(ctx.flateStream('BT /F9 12 Tf 20 100 Td <0003> Tj ET')));
  doc.addPage([300, 200]).drawText('Plain page', { x: 20, y: 100, size: 12, font: helvetica });
  return doc.save({ useObjectStreams: false });
}

describe('text drawn with a missing glyph', () => {
  it('is found per page and dropped from the readable copy', async () => {
    const bytes = await boxesPdf();
    const repair = await repairMisMappedToUnicode(bytes);
    // Pages that use the font; whether they draw its box is judged from their text.
    expect(repair.missingGlyphPages).toEqual([0, 1]);
    expect(repair.repairedFonts).toEqual([]);
  });

  it('is not reported when glyph 0 is mapped to no letter (U+0000, NIC eOffice)', async () => {
    const repair = await repairMisMappedToUnicode(await boxesPdf('0000'));
    expect(repair.missingGlyphPages).toEqual([]);
  });

  it('is reported only for pages that draw the box', async () => {
    const bytes = await boxesPdf();
    await sharedPdfDocument(bytes);
    expect(await missingGlyphPagesOf(bytes)).toEqual([0]);
  }, 30000);

  it('does not come out as letters', async () => {
    const text = (await extractEmbeddedTextLines(await boxesPdf(), 0)).map((line) => line.text).join('\n');
    expect(text).toContain('RRB');
    expect(text).not.toMatch(/अ/u);
  }, 30000);
});
