import { clampPan, fitPage, zoomAround } from './zoomMath';

describe('fitPage', () => {
  it('fits a portrait page to the height when the screen is taller than wide', () => {
    expect(fitPage(400, 800, 0.5)).toEqual({ width: 400, height: 800 });
    expect(fitPage(400, 600, 0.5)).toEqual({ width: 300, height: 600 });
  });
});

describe('clampPan', () => {
  it('keeps an unzoomed page centred', () => {
    expect(clampPan(50, -30, 1, 300, 600)).toEqual({ x: 0, y: 0 });
  });

  it('lets a zoomed page move until its edge reaches the view edge', () => {
    // At 2x a 300x600 page overhangs by 150 x 300 on each side.
    expect(clampPan(200, -400, 2, 300, 600)).toEqual({ x: 150, y: -300 });
    expect(clampPan(20, 10, 2, 300, 600)).toEqual({ x: 20, y: 10 });
  });
});

describe('zoomAround', () => {
  it('keeps the point under the fingers in place', () => {
    // Focal point 100dp right of centre, unpanned, 1x to 2x: the page shifts 100dp left.
    expect(zoomAround({ x: 0, y: 0 }, 1, 2, { x: 100, y: 0 })).toEqual({ x: -100, y: 0 });
  });
});
