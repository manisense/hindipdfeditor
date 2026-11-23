import { describe, expect, it } from 'vitest';

import { imageRectsFromOperators, pictureBoxes, stackStrips, stripAt, textImageRows, type ImageOps } from './pdfImageRects';

const OPS: ImageOps = {
  save: 10,
  restore: 11,
  transform: 12,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  paintImageMaskXObject: 83,
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
  paintImageXObjectRepeat: 88,
};

describe('imageRectsFromOperators', () => {
  it('places an image by the current matrix, through save, restore and forms', () => {
    const fn = [OPS.save, OPS.transform, OPS.paintImageXObject, OPS.restore, OPS.paintFormXObjectBegin, OPS.transform, OPS.paintImageXObject, OPS.paintFormXObjectEnd, OPS.paintImageXObject];
    const args = [null, [36, 0, 0, 10, 100, 700], ['img1', 300, 90], null, [[1, 0, 0, 1, 50, 50], [0, 0, 10, 10]], [20, 0, 0, 5, 0, 0], ['img2'], null, ['img3']];
    expect(imageRectsFromOperators(fn, args, OPS)).toEqual([
      [100, 700, 136, 710],
      [50, 50, 70, 55],
      [0, 0, 1, 1],
    ]);
  });

  it('places each copy of a repeated image', () => {
    const rects = imageRectsFromOperators([OPS.paintImageXObjectRepeat], [['img', 4, 2, [10, 20, 30, 40]]], OPS);
    expect(rects).toEqual([
      [10, 20, 14, 22],
      [30, 40, 34, 42],
    ]);
  });
});

describe('textImageRows', () => {
  const box = (xPt: number, yPt: number, wPt: number, hPt: number) => ({ xPt, yPt, wPt, hPt });

  it('joins line-height images on one line into a row', () => {
    const rows = textImageRows([box(100, 50, 36, 11), box(138, 50, 4, 11), box(145, 50, 23, 11)], []);
    expect(rows).toEqual([box(100, 50, 68, 11)]);
  });

  it('skips pictures, slivers and rows the text layer already has', () => {
    const rows = textImageRows(
      [box(0, 0, 200, 150), box(10, 300, 1, 11), box(100, 400, 80, 12), box(100, 500, 80, 12)],
      [box(95, 398, 90, 14)],
    );
    expect(rows).toEqual([box(100, 500, 80, 12)]);
  });

  it('does not join images across a table border', () => {
    const rows = textImageRows([box(100, 50, 36, 11), box(140, 50, 30, 11)], [], [{ x: 138, y1: 40, y2: 70 }]);
    expect(rows).toHaveLength(2);
  });

  it('keeps separate lines apart', () => {
    expect(textImageRows([box(100, 50, 40, 11), box(100, 70, 40, 11)], [])).toHaveLength(2);
  });
});

describe('stackStrips', () => {
  it('cuts padded areas and stacks them with gaps', () => {
    const { strips, widthPx, heightPx } = stackStrips(
      [
        { xPt: 10, yPt: 20, wPt: 100, hPt: 10 },
        { xPt: 0, yPt: 0, wPt: 50, hPt: 5 },
      ],
      { widthPx: 300, heightPx: 300 },
      2,
      2,
      10,
      5,
    );
    expect(strips).toEqual([
      { sx: 16, sy: 36, w: 208, h: 28, top: 10 },
      { sx: 0, sy: 0, w: 104, h: 14, top: 48 },
    ]);
    expect(widthPx).toBe(218);
    expect(heightPx).toBe(72);
    expect(stripAt(strips, 20)).toBe(0);
    expect(stripAt(strips, 40)).toBe(-1);
    expect(stripAt(strips, 50)).toBe(1);
  });
});

describe('pictureBoxes', () => {
  const page = { widthPt: 595, heightPt: 842 };
  const box = (xPt: number, yPt: number, wPt: number, hPt: number) => ({ xPt, yPt, wPt, hPt });

  it('keeps logo-sized images and skips text lines and page backgrounds', () => {
    expect(pictureBoxes([box(50, 50, 80, 60), box(50, 200, 300, 12), box(0, 0, 595, 842)], page)).toEqual([box(50, 50, 80, 60)]);
  });

  it('joins tiles of one picture', () => {
    expect(pictureBoxes([box(100, 100, 100, 50), box(100, 150, 100, 50)], page)).toEqual([box(100, 100, 100, 100)]);
  });
});

