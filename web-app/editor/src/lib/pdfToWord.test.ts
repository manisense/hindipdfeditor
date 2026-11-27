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
              borders: true,
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
    expect(xml).toMatch(/<w:tblBorders>[\s\S]*?<w:insideV w:val="single"/);
  });

  it('writes a table aligned by space without borders', async () => {
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
              borders: false,
              columnWidthsPt: [100, 60],
              rows: [{ heightPt: 20, cells: [{ col: 0, colSpan: 1, rowSpan: 1, paragraphs: [cell('पद')] }, { col: 1, colSpan: 1, rowSpan: 1, paragraphs: [cell('14')] }] }],
            },
          },
        ],
      },
    ]);
    const xml = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']);
    const borders = xml.match(/<w:tblBorders>[\s\S]*?<\/w:tblBorders>/)?.[0] ?? '';
    expect(borders).toContain('<w:insideV w:val="none"');
    expect(borders).not.toContain('w:val="single"');
  });

  it('embeds a picture at its size', async () => {
    // A 1×1 white JPEG.
    const jpeg = Uint8Array.from(
      atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='),
      (c) => c.charCodeAt(0),
    );
    const blob = await buildWordDocument([
      { widthPt: 595, heightPt: 842, blocks: [{ kind: 'picture', picture: { xPt: 72, yPt: 100, wPt: 144, hPt: 72, jpeg }, indentPt: 36 }] },
    ]);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const xml = strFromU8(files['word/document.xml']);
    expect(Object.keys(files).some((name) => name.startsWith('word/media/'))).toBe(true);
    expect(xml).toContain('<w:drawing>');
    // 144 pt × 72 pt = 2 in × 1 in = 1828800 × 914400 EMU.
    expect(xml).toContain('cx="1828800"');
    expect(xml).toContain('cy="914400"');
  });

  it('writes running header and footer once in header/footer XML without repeating them in the body', async () => {
    const para = (text: string) => ({
      kind: 'paragraph' as const,
      paragraph: { text, fontSizePt: 11, bold: false, italic: false, align: 'left' as const, spaceBeforePt: 0, indentPt: 0 },
    });
    const blob = await buildWordDocument(
      [
        { widthPt: 595, heightPt: 842, blocks: [para('Page one body')] },
        { widthPt: 595, heightPt: 842, blocks: [para('Page two body')] },
        { widthPt: 595, heightPt: 842, blocks: [para('Page three body')] },
      ],
      {
        header: [
          {
            runs: [{ kind: 'text', text: 'Quarterly Bulletin 2026' }],
            fontSizePt: 9,
            bold: false,
            italic: false,
            align: 'left',
          },
        ],
        footer: [
          {
            runs: [
              { kind: 'text', text: 'Page ' },
              { kind: 'pageNumber' },
              { kind: 'text', text: ' of 3' },
            ],
            fontSizePt: 9,
            bold: false,
            italic: false,
            align: 'center',
          },
        ],
      },
    );
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const docXml = strFromU8(files['word/document.xml']);
    const headerXml = strFromU8(files['word/header1.xml']);
    const footerXml = strFromU8(files['word/footer1.xml']);
    expect(docXml).not.toContain('Quarterly Bulletin 2026');
    expect(docXml).not.toContain('of 3');
    expect(headerXml).toContain('Quarterly Bulletin 2026');
    expect(footerXml).toContain('PAGE');
    expect(footerXml).toContain('of 3');
  });
});

