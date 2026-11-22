import { describe, expect, it } from 'vitest';

import { applyChangedSpans, changedSpan } from './changedSpan';
import type { Edit } from '../state/editStore';

// 1 pt per spacing character; Devanagari vowel signs and the virama take no width of their own,
// as in a real font. Lines are drawn at x=100 with their natural width.
const measure = (text: string) => [...text].filter((ch) => !/[\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962\u0963]/u.test(ch)).length;

describe('changedSpan', () => {
  it('returns null when nothing changed', () => {
    expect(changedSpan('आवेदन की तारीख', 'आवेदन की तारीख', 100, 14, measure)).toBeNull();
  });

  it('redraws only the edited word in the middle of a line', () => {
    // "जमा करने और थल्क भुगतान": fix the OCR slip थल्क → शुल्क only.
    const original = 'जमा करने और थल्क भुगतान';
    const span = changedSpan(original, 'जमा करने और शुल्क भुगतान', 100, measure(original), measure);
    expect(span).toEqual({ xPt: 100 + measure('जमा करने और '), wPt: measure('थल्क'), text: 'शुल्क' });
  });

  it('extends to the end of the line when the new word needs more room', () => {
    const original = 'name: Ram Kumar';
    const span = changedSpan(original, 'name: Ramchandra Kumar', 100, 15, measure);
    expect(span).toEqual({ xPt: 106, wPt: 9, text: 'Ramchandra Kumar' });
  });

  it('takes the rest of the line for a change at the end', () => {
    const span = changedSpan('Date: 03.05.2025', 'Date: 04.05.2025', 100, 16, measure);
    expect(span).toEqual({ xPt: 106, wPt: 10, text: '04.05.2025' });
  });

  it('scales measured widths to the original line width', () => {
    const span = changedSpan('ab cd', 'ab XY', 0, 10, measure);
    expect(span).toEqual({ xPt: 6, wPt: 4, text: 'XY' });
  });
});

describe('applyChangedSpans', () => {
  const mask: Edit = { type: 'mask', id: 'm', page: 0, xPt: 97, yPt: 50, wPt: 30, hPt: 12, color: '#fff', kind: 'replace' };
  const text = (value: string, extra: object = {}): Edit => ({
    type: 'text', id: 't', page: 0, xPt: 100, yPt: 50, fontSizePt: 10, text: value, color: '#000',
    fontFamily: 'Hind', widthPt: 40, maskId: 'm',
    original: { text: 'ab cd', xPt: 100, wPt: 5, editXPt: 100, fontSizePt: 10 }, ...extra,
  });
  const m = (_edit: unknown, value: string) => [...value].length;

  it('drops an unchanged replacement and its mask', () => {
    expect(applyChangedSpans([mask, text('ab cd')], m)).toEqual([]);
  });

  it('narrows the mask and the text to the changed word', () => {
    const [narrowMask, narrowText] = applyChangedSpans([mask, text('ab XY')], m);
    expect(narrowMask).toMatchObject({ xPt: 102.5, wPt: 3, yPt: 50, hPt: 12 });
    expect(narrowText).toMatchObject({ xPt: 103, text: 'XY' });
    expect(narrowText).not.toHaveProperty('widthPt');
  });

  it('snaps span edges to real word gaps on the page', () => {
    const gap = (_mask: unknown, x: number) => (x < 103.5 ? { startPt: 101.6, endPt: 102.4 } : null);
    const [snapMask, snapText] = applyChangedSpans([mask, text('ab XY')], m, gap);
    expect(snapMask).toMatchObject({ xPt: 102, wPt: 3.5 });
    expect(snapText).toMatchObject({ xPt: 102.4, text: 'XY' });
  });

  it('shrinks longer new words to the cleared span, keeping their baseline', () => {
    // Original "ab cd" (5 pt) followed by other text; "cd" → "XYZW" needs 4 pt but only 2 pt is clear.
    const [, fitted] = applyChangedSpans([mask, text('ab XYZW')], m, undefined, () => 1);
    expect(fitted).toMatchObject({ xPt: 103, text: 'XYZW' });
    expect((fitted as { fontSizePt: number }).fontSizePt).toBeCloseTo(7.5); // capped at 25 % smaller
    expect((fitted as { yPt: number }).yPt).toBeCloseTo(52.5); // baseline stays at yPt + 10
  });

  it('leaves a moved edit whole', () => {
    expect(applyChangedSpans([mask, text('ab XY', { xPt: 120 })], m)[1]).toMatchObject({ text: 'ab XY', xPt: 120 });
  });
});
