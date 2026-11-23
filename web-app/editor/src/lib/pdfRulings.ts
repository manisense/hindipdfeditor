/**
 * Table ruling lines from pdf.js's operator list: thin horizontal and vertical segments drawn as
 * stroked lines or as filled thin rectangles (how Word draws table borders). Curves, clips and
 * large shapes are ignored.
 */

import { IDENTITY, multiply, type Matrix } from './pdfImageRects';

/** The pdf.js operator codes this module reads. */
export type PathOps = {
  save: number;
  restore: number;
  transform: number;
  paintFormXObjectBegin: number;
  paintFormXObjectEnd: number;
  constructPath: number;
  stroke: number;
  closeStroke: number;
  fill: number;
  eoFill: number;
  fillStroke: number;
  eoFillStroke: number;
  closeFillStroke: number;
  closeEOFillStroke: number;
};

/** pdf.js's encoding of path commands inside constructPath data (DrawOPS). */
const MOVE_TO = 0;
const LINE_TO = 1;
const CURVE_TO = 2;
const QUAD_TO = 3;
const CLOSE = 4;

/** A ruling segment in PDF user space, in pt: horizontal (y fixed) or vertical (x fixed). */
export type Ruling = { horizontal: boolean; at: number; from: number; to: number };

/** Thicker than this (pt), a filled rectangle is a shape, not a line. */
const MAX_RULE_THICKNESS_PT = 3;
/** Shorter than this (pt), a segment is a tick or a glyph part, not a ruling. */
const MIN_RULE_LENGTH_PT = 4;

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function rulingFromBox(x1: number, y1: number, x2: number, y2: number): Ruling | null {
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  if (h <= MAX_RULE_THICKNESS_PT && w >= MIN_RULE_LENGTH_PT && w > h) {
    return { horizontal: true, at: (y1 + y2) / 2, from: Math.min(x1, x2), to: Math.max(x1, x2) };
  }
  if (w <= MAX_RULE_THICKNESS_PT && h >= MIN_RULE_LENGTH_PT && h > w) {
    return { horizontal: false, at: (x1 + x2) / 2, from: Math.min(y1, y2), to: Math.max(y1, y2) };
  }
  return null;
}

/**
 * Every ruling segment the page draws, in PDF user space (pt).
 *
 * @param fnArray pdf.js operator codes.
 * @param argsArray Their arguments; constructPath's are [paint op, [path data], bbox].
 */
export function rulingsFromOperators(fnArray: readonly number[], argsArray: readonly unknown[], ops: PathOps): Ruling[] {
  const stroking = new Set([ops.stroke, ops.closeStroke, ops.fillStroke, ops.eoFillStroke, ops.closeFillStroke, ops.closeEOFillStroke]);
  const filling = new Set([ops.fill, ops.eoFill, ops.fillStroke, ops.eoFillStroke, ops.closeFillStroke, ops.closeEOFillStroke]);
  const rulings: Ruling[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = IDENTITY;
  fnArray.forEach((fn, i) => {
    const args = argsArray[i] as unknown[] | null;
    if (fn === ops.save) stack.push(ctm);
    else if (fn === ops.restore) ctm = stack.pop() ?? ctm;
    else if (fn === ops.transform && args) ctm = multiply(ctm, args.slice(0, 6).map(Number) as Matrix);
    else if (fn === ops.paintFormXObjectBegin) {
      stack.push(ctm);
      const matrix = args?.[0] as ArrayLike<number> | null | undefined;
      if (matrix && matrix.length >= 6) ctm = multiply(ctm, Array.from(matrix).slice(0, 6) as Matrix);
    } else if (fn === ops.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === ops.constructPath && args) {
      const paint = Number(args[0]);
      const data = (args[1] as ArrayLike<unknown> | undefined)?.[0] as ArrayLike<number> | null | undefined;
      if (!data || !(stroking.has(paint) || filling.has(paint))) return;
      // Split into subpaths of straight segments; a subpath with a curve is not a ruling.
      let points: [number, number][] = [];
      let curved = false;
      const flush = () => {
        if (points.length >= 2 && !curved) {
          const xs = points.map((p) => p[0]);
          const ys = points.map((p) => p[1]);
          if (filling.has(paint)) {
            const ruling = rulingFromBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
            if (ruling) rulings.push(ruling);
          }
          if (stroking.has(paint)) {
            for (let k = 1; k < points.length; k++) {
              const [ax, ay] = points[k - 1];
              const [bx, by] = points[k];
              const ruling = rulingFromBox(ax, ay, bx, by);
              if (ruling && Math.min(Math.abs(bx - ax), Math.abs(by - ay)) < 0.5) rulings.push(ruling);
            }
          }
        }
        points = [];
        curved = false;
      };
      for (let k = 0; k < data.length; ) {
        const op = data[k];
        if (op === MOVE_TO) {
          flush();
          points.push(apply(ctm, data[k + 1], data[k + 2]));
          k += 3;
        } else if (op === LINE_TO) {
          points.push(apply(ctm, data[k + 1], data[k + 2]));
          k += 3;
        } else if (op === CURVE_TO) {
          curved = true;
          k += 7;
        } else if (op === QUAD_TO) {
          curved = true;
          k += 5;
        } else if (op === CLOSE) {
          if (points.length > 0) points.push(points[0]);
          k += 1;
        } else break;
      }
      flush();
    }
  });
  return rulings;
}
