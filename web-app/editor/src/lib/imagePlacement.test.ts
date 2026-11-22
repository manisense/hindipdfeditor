import { describe, expect, it } from 'vitest';

import { clampToPage, inkBounds, placeImage, resizeKeepingAspect, visiblePageCentre } from './imagePlacement';

describe('placeImage', () => {
  it('centres a wide image at up to 40 % of the page width, keeping its shape', () => {
    const rect = placeImage(1000, 500, 600, 800);
    expect(rect.wPt).toBeCloseTo(240);
    expect(rect.hPt).toBeCloseTo(120);
    expect(rect.xPt).toBeCloseTo(180);
    expect(rect.yPt).toBeCloseTo(340);
  });

  it('limits a tall image by the page height', () => {
    const rect = placeImage(100, 1000, 600, 800);
    expect(rect.hPt).toBeCloseTo(320);
    expect(rect.wPt).toBeCloseTo(32);
  });

  it('never enlarges a small image past 1 pt per px', () => {
    const rect = placeImage(50, 20, 600, 800);
    expect(rect.wPt).toBeCloseTo(50);
    expect(rect.hPt).toBeCloseTo(20);
  });
});

describe('clampToPage', () => {
  it('keeps a moved box fully on the page', () => {
    expect(clampToPage({ xPt: -10, yPt: 790, wPt: 100, hPt: 50 }, 600, 800)).toEqual({
      xPt: 0, yPt: 750, wPt: 100, hPt: 50,
    });
  });
});

describe('resizeKeepingAspect', () => {
  const rect = { xPt: 100, yPt: 100, wPt: 200, hPt: 100 };
  it('scales height with width from the top-left corner', () => {
    expect(resizeKeepingAspect(rect, 300, 600, 800)).toEqual({ xPt: 100, yPt: 100, wPt: 300, hPt: 150 });
  });
  it('stops at the page edge and at a minimum size', () => {
    expect(resizeKeepingAspect(rect, 900, 600, 800).wPt).toBeCloseTo(500);
    expect(resizeKeepingAspect(rect, 2, 600, 800).wPt).toBeCloseTo(12);
  });
});

describe('inkBounds', () => {
  it('finds the box around non-transparent pixels', () => {
    const w = 10;
    const h = 8;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (const [x, y] of [[2, 3], [6, 5]]) rgba[(y * w + x) * 4 + 3] = 255;
    expect(inkBounds(rgba, w, h)).toEqual({ x: 2, y: 3, w: 5, h: 3 });
  });
  it('returns null for an empty canvas', () => {
    expect(inkBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
  });
});

describe('visiblePageCentre', () => {
  it('centres on the part of the page that is on screen', () => {
    // Page drawn 600 px wide for a 300 pt page (2 px per pt), its top 400 px above the screen.
    const centre = visiblePageCentre({ left: 0, top: -400, width: 600, height: 800 }, { width: 800, height: 600 }, 300);
    expect(centre).toEqual({ xPt: 150, yPt: 300 });
  });

  it('falls back to the page centre when the page is off screen', () => {
    const centre = visiblePageCentre({ left: 0, top: 900, width: 600, height: 800 }, { width: 800, height: 600 }, 300);
    expect(centre).toEqual({ xPt: 150, yPt: 200 });
  });
});
