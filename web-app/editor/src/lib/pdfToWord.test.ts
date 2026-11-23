import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';

import { buildWordDocument } from './pdfToWord';

describe('buildWordDocument', () => {
  it('writes one section per page with its size, text, sizes and Hindi font', async () => {
    const blob = await buildWordDocument([
      {
        widthPt: 595,
        heightPt: 842,
        blocks: [
          { kind: 'paragraph', paragraph: { text: 'धर्म और क्षेत्र', fontSizePt: 18, bold: true, italic: false, align: 'center', spaceBeforePt: 0, indentPt: 0 } },
          { kind: 'paragraph', paragraph: { text: 'Body <text> & more', fontSizePt: 11, bold: false, italic: false, align: 'left', spaceBeforePt: 12, indentPt: 18 } },
        ],
      },
      { widthPt: 842, heightPt: 595, blocks: [] },
    ]);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const xml = strFromU8(files['word/document.xml']);
    expect(xml).toContain('धर्म और क्षेत्र');
    expect(xml).toContain('Body &lt;text&gt; &amp; more');
    expect(xml).toContain('w:cs="Nirmala UI"');
    expect(xml).toContain('<w:sz w:val="36"/>');
    expect(xml).toContain('<w:jc w:val="center"/>');
    expect(xml.match(/<w:pgSz /g)).toHaveLength(2);
    expect(xml).toContain('w:w="11900"');
    expect(xml).toMatch(/w:orient="landscape"/);
  });

  it('writes a ruled table with column widths and merged cells', async () => {
    const cell = (text: string) => ({ text, fontSizePt: 10, bold: false, italic: false, align: 'left' as const, spaceBeforePt: 0, indentPt: 0 });
    const blob = await buildWordDocument([
      {
        widthPt: 595,
        heightPt: 842,
        blocks: [
          {
            kind: 'table',
            table: {
              xPt: 50,
              columnWidthsPt: [100, 60, 60],
              rows: [
                { heightPt: 20, cells: [{ col: 0, colSpan: 1, rowSpan: 2, paragraphs: [cell('आरक्षक / रसोइया')] }, { col: 1, colSpan: 2, rowSpan: 1, paragraphs: [cell('सीधी')] }] },
                { heightPt: 20, cells: [{ col: 1, colSpan: 1, rowSpan: 1, paragraphs: [cell('1')] }, { col: 2, colSpan: 1, rowSpan: 1, paragraphs: [] }] },
              ],
            },
          },
        ],
      },
    ]);
    const xml = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']);
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:gridCol w:w="2000"/>');
    expect(xml).toContain('<w:gridSpan w:val="2"/>');
    expect(xml).toContain('<w:vMerge w:val="restart"/>');
    expect(xml).toContain('<w:vMerge w:val="continue"/>');
    expect(xml).toContain('आरक्षक / रसोइया');
    expect(xml.match(/<w:tr[ >]/g)).toHaveLength(2);
  });
});
