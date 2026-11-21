import { expect, it } from 'vitest';

import { findInDocument, replaceAllIn } from './findReplace';
import type { PageState } from '../state/editStore';

it('replaces every occurrence and matches across Unicode encodings', () => {
  expect(replaceAllIn('राम ने राम को देखा', 'राम', 'श्याम')).toBe('श्याम ने श्याम को देखा');
  // क़ written as क + nukta matches the precomposed form.
  expect(replaceAllIn('क़', 'क़', 'ख')).toBe('ख');
  expect(replaceAllIn('abc', '', 'x')).toBeNull();
  expect(replaceAllIn('abc', 'z', 'x')).toBeNull();
});

it('finds matches in detected lines and existing edits on every page', () => {
  const page = (pageIndex: number, line: string, edit?: string): PageState => ({
    pageIndex, widthPt: 100, heightPt: 100, backgroundImageUri: '', imagePxWidth: 200, imagePxHeight: 200,
    ocrLines: [{ id: `l${pageIndex}`, text: line, xPt: 0, yPt: 0, wPt: 10, hPt: 10 }],
    edits: edit ? [{ type: 'text', id: `e${pageIndex}`, page: pageIndex, xPt: 0, yPt: 0, fontSizePt: 10, text: edit, color: '#000', fontFamily: 'Hind' }] : [],
  });
  const result = findInDocument([page(0, 'तारीख: 23.05.2025'), page(1, 'कुछ नहीं', 'अंतिम तारीख 23.05.2025')], '23.05.2025', '24.05.2025');
  expect(result.lines.map((m) => [m.pageIndex, m.newText])).toEqual([[0, 'तारीख: 24.05.2025']]);
  expect(result.edits.map((m) => [m.pageIndex, m.newText])).toEqual([[1, 'अंतिम तारीख 24.05.2025']]);
});
