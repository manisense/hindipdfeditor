import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { sharedPdfDocument } from './sharedPdfDocument';

/**
 * pdf.js 5 took any glyph whose text holds a combining sign (a conjunct read from its font, such
 * as क्ष or त्र) for a zero-width mark: it measured it as 0 wide and skipped its line-break check,
 * so line boxes came out short (OCR crops cut the line's end) and a line-start conjunct joined the
 * line above. scripts/patch-pdfjs.mjs anchors that test as pdf.js 6 does.
 */
describe('pdf.js mark test (scripts/patch-pdfjs.mjs)', () => {
  it('measures conjunct glyphs, so no Devanagari text item is zero width', async () => {
    const bytes = new Uint8Array(readFileSync(path.join(__dirname, '../../../../mobile-app/fixtures/mismapped-tounicode-fixture.pdf')));
    const page = await (await sharedPdfDocument(bytes)).getPage(1);
    const items = (await page.getTextContent()).items.filter((item) => 'str' in item && /[क-ह]/u.test(item.str));
    expect(items.length).toBeGreaterThan(0);
    expect(items.filter((item) => 'width' in item && item.width === 0).map((item) => ('str' in item ? item.str : ''))).toEqual([]);
  }, 30000);
});
