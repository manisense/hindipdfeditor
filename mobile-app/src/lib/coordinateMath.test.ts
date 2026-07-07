import {
  dpSizeToPt,
  dpToPt,
  imagePxSizeToPt,
  imagePxToPt,
  ptSizeToDp,
  ptSizeToImagePx,
  ptToDp,
  ptToImagePx,
} from './coordinateMath';

describe('dpToPt', () => {
  it('is identity when the view is displayed at 1:1 with the page', () => {
    expect(dpToPt(100, 200, 595, 595)).toEqual({ xPt: 100, yPt: 200 });
  });

  it('scales down when the on-screen view is larger than the page (dp > pt)', () => {
    // View is 2x the page's point-width -> 1dp covers half as many points.
    expect(dpToPt(200, 400, 1190, 595)).toEqual({ xPt: 100, yPt: 200 });
  });

  it('scales up when the on-screen view is smaller than the page (dp < pt)', () => {
    // View is half the page's point-width -> 1dp covers twice as many points.
    expect(dpToPt(50, 100, 297.5, 595)).toEqual({ xPt: 100, yPt: 200 });
  });

  it('maps the origin to the origin', () => {
    expect(dpToPt(0, 0, 400, 595)).toEqual({ xPt: 0, yPt: 0 });
  });
});

describe('ptToDp', () => {
  it('is identity when the view is displayed at 1:1 with the page', () => {
    expect(ptToDp(100, 200, 595, 595)).toEqual({ xDp: 100, yDp: 200 });
  });

  it('is the exact inverse of dpToPt for the same viewWidthDp/pageWidthPt pair', () => {
    const viewWidthDp = 360;
    const pageWidthPt = 595;
    const original = { xDp: 123.4, yDp: 567.8 };
    const { xPt, yPt } = dpToPt(original.xDp, original.yDp, viewWidthDp, pageWidthPt);
    const roundTripped = ptToDp(xPt, yPt, viewWidthDp, pageWidthPt);
    expect(roundTripped.xDp).toBeCloseTo(original.xDp, 10);
    expect(roundTripped.yDp).toBeCloseTo(original.yDp, 10);
  });

  it('maps the origin to the origin', () => {
    expect(ptToDp(0, 0, 400, 595)).toEqual({ xDp: 0, yDp: 0 });
  });
});

describe('ptToImagePx', () => {
  it('is identity when the background image is rendered at 1px per point', () => {
    expect(ptToImagePx(100, 200, 595, 595)).toEqual({ x: 100, y: 200 });
  });

  it('matches the spec example: an A4 page (595x842pt) rendered at 2x scale', () => {
    // A point at the exact center of the page should land at the center of the 2x image.
    const pageWidthPt = 595;
    const imagePxWidth = 1190; // 595pt * 2
    const { x, y } = ptToImagePx(pageWidthPt / 2, 842 / 2, imagePxWidth, pageWidthPt);
    expect(x).toBeCloseTo(595, 10);
    expect(y).toBeCloseTo(842, 10);
  });

  it('scales both axes by the same width-derived ratio (no independent Y scale/flip)', () => {
    const pageWidthPt = 595;
    const imagePxWidth = 1785; // 3x scale
    const { x, y } = ptToImagePx(10, 20, imagePxWidth, pageWidthPt);
    expect(x).toBe(30);
    expect(y).toBe(60);
  });

  it('maps the origin to the origin', () => {
    expect(ptToImagePx(0, 0, 1190, 595)).toEqual({ x: 0, y: 0 });
  });
});

describe('imagePxToPt', () => {
  it('is the exact inverse of ptToImagePx for the same imagePxWidth/pageWidthPt pair', () => {
    const imagePxWidth = 1190;
    const pageWidthPt = 595;
    const original = { xPt: 123.4, yPt: 567.8 };
    const { x, y } = ptToImagePx(original.xPt, original.yPt, imagePxWidth, pageWidthPt);
    const roundTripped = imagePxToPt(x, y, imagePxWidth, pageWidthPt);
    expect(roundTripped.xPt).toBeCloseTo(original.xPt, 10);
    expect(roundTripped.yPt).toBeCloseTo(original.yPt, 10);
  });

  it('maps the origin to the origin', () => {
    expect(imagePxToPt(0, 0, 1190, 595)).toEqual({ xPt: 0, yPt: 0 });
  });

  it('scales both axes by the same width-derived ratio (no independent Y scale/flip)', () => {
    const imagePxWidth = 1785; // 3x scale
    const pageWidthPt = 595;
    const { xPt, yPt } = imagePxToPt(30, 60, imagePxWidth, pageWidthPt);
    expect(xPt).toBe(10);
    expect(yPt).toBe(20);
  });
});

describe('imagePxSizeToPt', () => {
  it('is the exact inverse of ptSizeToImagePx for the same imagePxWidth/pageWidthPt pair', () => {
    const imagePxWidth = 1190;
    const pageWidthPt = 595;
    const original = { wPt: 42.5, hPt: 18.25 };
    const { wPx, hPx } = ptSizeToImagePx(original.wPt, original.hPt, imagePxWidth, pageWidthPt);
    const roundTripped = imagePxSizeToPt(wPx, hPx, imagePxWidth, pageWidthPt);
    expect(roundTripped.wPt).toBeCloseTo(original.wPt, 10);
    expect(roundTripped.hPt).toBeCloseTo(original.hPt, 10);
  });

  it('maps a zero size to a zero size', () => {
    expect(imagePxSizeToPt(0, 0, 1190, 595)).toEqual({ wPt: 0, hPt: 0 });
  });
});

describe('dpSizeToPt', () => {
  it('matches dpToPt applied to the same numbers (a size is a zero-offset scale, same as a position)', () => {
    expect(dpSizeToPt(200, 400, 1190, 595)).toEqual({ wPt: 100, hPt: 200 });
  });

  it('maps a zero size to a zero size', () => {
    expect(dpSizeToPt(0, 0, 400, 595)).toEqual({ wPt: 0, hPt: 0 });
  });
});

describe('ptSizeToDp', () => {
  it('is the exact inverse of dpSizeToPt for the same viewWidthDp/pageWidthPt pair', () => {
    const viewWidthDp = 360;
    const pageWidthPt = 595;
    const original = { wDp: 42.5, hDp: 18.25 };
    const { wPt, hPt } = dpSizeToPt(original.wDp, original.hDp, viewWidthDp, pageWidthPt);
    const roundTripped = ptSizeToDp(wPt, hPt, viewWidthDp, pageWidthPt);
    expect(roundTripped.wDp).toBeCloseTo(original.wDp, 10);
    expect(roundTripped.hDp).toBeCloseTo(original.hDp, 10);
  });
});

describe('ptSizeToImagePx', () => {
  it('scales both axes by the same width-derived ratio, matching ptToImagePx', () => {
    const pageWidthPt = 595;
    const imagePxWidth = 1785; // 3x scale
    expect(ptSizeToImagePx(10, 20, imagePxWidth, pageWidthPt)).toEqual({ wPx: 30, hPx: 60 });
  });

  it('maps a zero size to a zero size', () => {
    expect(ptSizeToImagePx(0, 0, 1190, 595)).toEqual({ wPx: 0, hPx: 0 });
  });
});
