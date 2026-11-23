import { describe, expect, it } from 'vitest';

import { anchorFromRect, parsePageList, placementRect, presetRect } from './signPlacement';

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

describe('placementRect', () => {
  const page = { widthPt: 600, heightPt: 800 };
  const small = { widthPt: 300, heightPt: 400 };

  it('uses the preset when the page has no adjustment', () => {
    expect(placementRect(page, 0.5, { kind: 'preset', position: 'bottom-right' }, 150, 36)).toEqual(presetRect(page, 0.5, 'bottom-right', 150, 36));
  });

  it('puts a custom spot at the same share of every page', () => {
    const anchor = anchorFromRect(page, { xPt: 100, yPt: 300, wPt: 200, hPt: 100 });
    expect(anchor).toEqual({ kind: 'custom', cx: 0.333_333_333_333_333_3, cy: 0.4375 });
    expect(placementRect(page, 0.5, anchor, 200, 36)).toEqual({ xPt: 100, yPt: 300, wPt: 200, hPt: 100 });
    // A page half the size: the centre lands at the same share; the signature keeps its width.
    const rect = placementRect(small, 0.5, anchor, 200, 36);
    expect(rect.xPt + rect.wPt / 2).toBeCloseTo(100);
    expect(rect.yPt + rect.hPt / 2).toBeCloseTo(175);
  });

  it('keeps a custom spot near the edge inside the page', () => {
    const rect = placementRect(small, 0.5, { kind: 'custom', cx: 0.98, cy: 0.99 }, 200, 36);
    expect(rect).toEqual({ xPt: 100, yPt: 300, wPt: 200, hPt: 100 });
  });

  it("uses a page's own adjusted box, following the signature's shape", () => {
    const anchor = { kind: 'preset', position: 'bottom-right' } as const;
    expect(placementRect(page, 0.4, anchor, 150, 36, { xPt: 50, yPt: 60, wPt: 100 })).toEqual({ xPt: 50, yPt: 60, wPt: 100, hPt: 40 });
    expect(placementRect(small, 0.5, anchor, 150, 36, { xPt: 290, yPt: 390, wPt: 100 })).toEqual({ xPt: 200, yPt: 350, wPt: 100, hPt: 50 });
  });
});
