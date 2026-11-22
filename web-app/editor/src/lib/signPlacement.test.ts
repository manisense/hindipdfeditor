import { describe, expect, it } from 'vitest';

import { parsePageList, presetRect } from './signPlacement';

describe('parsePageList', () => {
  it('reads single pages and ranges, in order, without repeats', () => {
    expect(parsePageList('1, 3-5, 4, 8', 10)).toEqual({ pages: [0, 2, 3, 4, 7] });
    expect(parsePageList(' 2 ', 3)).toEqual({ pages: [1] });
  });

  it('accepts Hindi digits and spaces around the dash', () => {
    expect(parsePageList('१, ३ - ४', 5)).toEqual({ pages: [0, 2, 3] });
  });

  it('rejects pages outside the document and malformed text', () => {
    expect(parsePageList('0', 3)).toEqual({ error: 'range' });
    expect(parsePageList('2-9', 3)).toEqual({ error: 'range' });
    expect(parsePageList('5-2', 9)).toEqual({ error: 'range' });
    expect(parsePageList('1,,x', 3)).toEqual({ error: 'format' });
    expect(parsePageList('  ', 3)).toEqual({ error: 'empty' });
  });
});

describe('presetRect', () => {
  const page = { widthPt: 600, heightPt: 800 };
  it('puts the signature in a corner, inside the margin, keeping its shape', () => {
    expect(presetRect(page, 0.5, 'bottom-right', 150, 36)).toEqual({ xPt: 414, yPt: 689, wPt: 150, hPt: 75 });
    expect(presetRect(page, 0.5, 'top-left', 150, 36)).toEqual({ xPt: 36, yPt: 36, wPt: 150, hPt: 75 });
    expect(presetRect(page, 0.5, 'bottom-center', 150, 36)).toEqual({ xPt: 225, yPt: 689, wPt: 150, hPt: 75 });
  });

  it('shrinks a signature too big for the page', () => {
    const rect = presetRect({ widthPt: 200, heightPt: 300 }, 0.5, 'top-right', 400, 20);
    expect(rect.wPt).toBe(160);
    expect(rect.xPt).toBe(20);
  });
});
