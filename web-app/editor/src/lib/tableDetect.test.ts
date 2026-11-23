import { describe, expect, it } from 'vitest';

import type { Ruling } from './pdfRulings';
import { detectTables } from './tableDetect';

const h = (at: number, from: number, to: number): Ruling => ({ horizontal: true, at, from, to });
const v = (at: number, from: number, to: number): Ruling => ({ horizontal: false, at, from, to });

/** A full grid: every border drawn. */
function grid(xs: number[], ys: number[]): Ruling[] {
  return [...ys.map((y) => h(y, xs[0], xs[xs.length - 1])), ...xs.map((x) => v(x, ys[0], ys[ys.length - 1]))];
}

describe('detectTables', () => {
  it('finds a full grid with its rows and columns', () => {
    const [table] = detectTables(grid([50, 150, 300], [100, 120, 140, 160]));
    expect(table.columns).toEqual([50, 150, 300]);
    expect(table.rows).toEqual([100, 120, 140, 160]);
    expect(table.cells).toHaveLength(6);
    expect(table.cells[3]).toEqual({ row: 1, col: 1, rowSpan: 1, colSpan: 1, xPt: 150, yPt: 120, wPt: 150, hPt: 20 });
  });

  it('joins segments drawn in pieces, as Word draws borders cell by cell', () => {
    const pieces = [h(100, 50, 150), h(100, 150, 300), h(120, 50, 150), h(120, 150.5, 300), v(50, 100, 120), v(150, 100, 120), v(300, 100, 120)];
    const [table] = detectTables(pieces);
    expect(table.cells).toHaveLength(2);
  });

  it('merges cells across a missing inner border', () => {
    // A heading cell spanning both columns, and a cell spanning two rows on the left.
    const rulings = [
      h(100, 50, 300),
      h(120, 50, 300),
      h(140, 150, 300),
      h(160, 50, 300),
      v(50, 100, 160),
      v(300, 100, 160),
      v(150, 120, 160),
    ];
    const [table] = detectTables(rulings);
    expect(table.cells.map((c) => [c.row, c.col, c.rowSpan, c.colSpan])).toEqual([
      [0, 0, 1, 2],
      [1, 0, 2, 1],
      [1, 1, 1, 1],
      [2, 1, 1, 1],
    ]);
  });

  it('ignores a lone box and loose lines', () => {
    expect(detectTables(grid([50, 300], [100, 160]))).toEqual([]);
    expect(detectTables([h(100, 50, 300), h(200, 50, 300)])).toEqual([]);
  });

  it('keeps separate tables apart, top to bottom', () => {
    const tables = detectTables([...grid([50, 100, 150], [400, 420]), ...grid([50, 100, 150], [100, 120])]);
    expect(tables.map((t) => t.yPt)).toEqual([100, 400]);
  });
});
