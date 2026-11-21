import { expect, it } from 'vitest';

import { fontHintFromPdfFont, replacementFontFor } from './fontMatch';

it('reads weight, style and family from real PDF font names', () => {
  expect(fontHintFromPdfFont('ABCDEE+Cambria,BoldItalic', 'serif', false)).toEqual({ serif: true, bold: true, italic: true });
  expect(fontHintFromPdfFont('JAAAAA+Times-Bold', 'serif', false)).toEqual({ serif: true, bold: true, italic: false });
  expect(fontHintFromPdfFont('LAAAAA+Arial-BoldMT', 'sans-serif', false)).toEqual({ serif: false, bold: true, italic: false });
  expect(fontHintFromPdfFont('ABCDEE+Hind', 'sans-serif', true)).toEqual({ serif: false, bold: false, italic: true });
  expect(fontHintFromPdfFont('ABCDEE+NotoSerifDevanagari-Regular', 'sans-serif', false).serif).toBe(true);
  expect(fontHintFromPdfFont('CIDFont+F1', 'serif', false).serif).toBe(true);
});

it('maps a hint to the bundled replacement font', () => {
  expect(replacementFontFor({ serif: true, bold: true, italic: true })).toEqual({
    fontFamily: 'NotoSerifDevanagari',
    fontWeight: 'bold',
    fontStyle: 'italic',
  });
  expect(replacementFontFor(undefined)).toEqual({ fontFamily: 'NotoSansDevanagari', fontWeight: 'normal' });
});
