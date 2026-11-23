import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';

import { buildWordDocument } from './pdfToWord';

describe('buildWordDocument', () => {
  it('writes one section per page with its size, text, sizes and Hindi font', async () => {
    const blob = await buildWordDocument([
      {
        widthPt: 595,
        heightPt: 842,
        paragraphs: [
          { text: 'धर्म और क्षेत्र', fontSizePt: 18, bold: true, italic: false, align: 'center', spaceBeforePt: 0, indentPt: 0 },
          { text: 'Body <text> & more', fontSizePt: 11, bold: false, italic: false, align: 'left', spaceBeforePt: 12, indentPt: 18 },
        ],
      },
      { widthPt: 842, heightPt: 595, paragraphs: [] },
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
});
