import { describe, expect, it } from 'vitest';

import { rulingsFromOperators, type PathOps } from './pdfRulings';

const OPS: PathOps = {
  save: 10,
  restore: 11,
  transform: 12,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  constructPath: 91,
  stroke: 20,
  closeStroke: 21,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
};
// DrawOPS: moveTo 0, lineTo 1, curveTo 2, closePath 4.
const rect = (x: number, y: number, w: number, h: number) => [0, x, y, 1, x + w, y, 1, x + w, y + h, 1, x, y + h, 4];

describe('rulingsFromOperators', () => {
  it('reads thin filled rectangles as rulings, by the current matrix', () => {
    const fn = [OPS.transform, OPS.constructPath, OPS.constructPath, OPS.constructPath];
    const args = [
      [1, 0, 0, 1, 10, 20],
      [OPS.fill, [Float32Array.from([...rect(0, 0, 200, 0.5), ...rect(0, 0, 0.5, 100)])], null],
      [OPS.fill, [Float32Array.from(rect(0, 0, 50, 50))], null],
      [OPS.fill, [Float32Array.from(rect(0, 0, 2, 2))], null],
    ];
    expect(rulingsFromOperators(fn, args, OPS)).toEqual([
      { horizontal: true, at: 20.25, from: 10, to: 210 },
      { horizontal: false, at: 10.25, from: 20, to: 120 },
    ]);
  });

  it('reads stroked straight segments and skips curves and clips', () => {
    const fn = [OPS.constructPath, OPS.constructPath, OPS.constructPath];
    const args = [
      [OPS.stroke, [Float32Array.from([0, 0, 0, 1, 100, 0, 1, 100, 50])], null],
      [OPS.stroke, [Float32Array.from([0, 0, 0, 2, 10, 10, 20, 10, 30, 0])], null],
      [28, [Float32Array.from(rect(0, 0, 100, 1))], null],
    ];
    expect(rulingsFromOperators(fn, args, OPS)).toEqual([
      { horizontal: true, at: 0, from: 0, to: 100 },
      { horizontal: false, at: 100, from: 0, to: 50 },
    ]);
  });
});
