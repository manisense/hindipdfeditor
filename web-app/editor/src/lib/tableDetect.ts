/**
 * Ruled tables from a page's ruling segments: crossing horizontal and vertical lines form a
 * grid; a missing inner border merges the cells on both sides of it. Tables aligned by space
 * alone are found by `detectAlignedTables`.
 */

import type { Ruling } from './pdfRulings';

/** One cell of a detected table; its box in pt (editor space, top-left origin). */
export type TableCell = { row: number; col: number; rowSpan: number; colSpan: number; xPt: number; yPt: number; wPt: number; hPt: number };

/**
 * A table: its column and row edges in pt (editor space), its cells in reading order, and
 * whether its borders are drawn (ruled) or it is aligned by space alone (see `alignedTables.ts`).
 */
export type DetectedTable = { xPt: number; yPt: number; wPt: number; hPt: number; columns: number[]; rows: number[]; cells: TableCell[]; ruled: boolean };

/** Positions closer than this (pt) are one line. */
const SNAP_PT = 2;
/** A border counts as drawn when segments cover this share of it. */
const BORDER_COVERAGE = 0.7;

/** Joins segments on one line whose spans touch or overlap. */
function mergeCollinear(rulings: readonly Ruling[]): Ruling[] {
  const sorted = [...rulings].sort((a, b) => a.at - b.at || a.from - b.from);
  const out: Ruling[] = [];
  for (const r of sorted) {
    const same = out.find((o) => o.horizontal === r.horizontal && Math.abs(o.at - r.at) <= SNAP_PT && r.from <= o.to + SNAP_PT && r.to >= o.from - SNAP_PT);
    if (same) {
      same.from = Math.min(same.from, r.from);
      same.to = Math.max(same.to, r.to);
    } else out.push({ ...r });
  }
  return out;
}

function crosses(h: Ruling, v: Ruling): boolean {
  return v.at >= h.from - SNAP_PT && v.at <= h.to + SNAP_PT && h.at >= v.from - SNAP_PT && h.at <= v.to + SNAP_PT;
}

function cluster(values: number[]): number[] {
  const out: number[] = [];
  for (const value of [...values].sort((a, b) => a - b)) {
    if (out.length === 0 || value - out[out.length - 1] > SNAP_PT) out.push(value);
  }
  return out;
}

function covered(lines: readonly Ruling[], at: number, from: number, to: number): boolean {
  const spans = lines
    .filter((l) => Math.abs(l.at - at) <= SNAP_PT && l.to > from && l.from < to)
    .map((l) => [Math.max(from, l.from), Math.min(to, l.to)] as const)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let end = from;
  for (const [a, b] of spans) {
    if (b <= end) continue;
    total += b - Math.max(a, end);
    end = b;
  }
  return total >= BORDER_COVERAGE * (to - from);
}

/**
 * Ruled tables on a page.
 *
 * @param rulings Ruling segments in editor space (pt, top-left origin).
 * @returns Tables of at least two cells, top to bottom.
 */
export function detectTables(rulings: readonly Ruling[]): DetectedTable[] {
  const lines = mergeCollinear(rulings);
  const seen = new Set<Ruling>();
  const tables: DetectedTable[] = [];
  for (const start of lines) {
    if (seen.has(start)) continue;
    // Lines connected by crossings form one table.
    const group: Ruling[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const line = queue.pop() as Ruling;
      group.push(line);
      for (const other of lines) {
        if (seen.has(other) || other.horizontal === line.horizontal) continue;
        if (line.horizontal ? crosses(line, other) : crosses(other, line)) {
          seen.add(other);
          queue.push(other);
        }
      }
    }
    const horizontals = group.filter((l) => l.horizontal);
    const verticals = group.filter((l) => !l.horizontal);
    const columns = cluster(verticals.map((l) => l.at));
    const rows = cluster(horizontals.map((l) => l.at));
    if (columns.length < 2 || rows.length < 2 || (columns.length - 1) * (rows.length - 1) < 2) continue;

    const nRows = rows.length - 1;
    const nCols = columns.length - 1;
    const parent = Array.from({ length: nRows * nCols }, (_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (a: number, b: number) => {
      parent[find(a)] = find(b);
    };
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        if (c + 1 < nCols && !covered(verticals, columns[c + 1], rows[r], rows[r + 1])) union(r * nCols + c, r * nCols + c + 1);
        if (r + 1 < nRows && !covered(horizontals, rows[r + 1], columns[c], columns[c + 1])) union(r * nCols + c, (r + 1) * nCols + c);
      }
    }
    const groups = new Map<number, number[]>();
    for (let i = 0; i < nRows * nCols; i++) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
    const cells: TableCell[] = [];
    for (const members of groups.values()) {
      const rs = members.map((i) => Math.floor(i / nCols));
      const cs = members.map((i) => i % nCols);
      const [r0, r1, c0, c1] = [Math.min(...rs), Math.max(...rs), Math.min(...cs), Math.max(...cs)];
      // Only rectangular merges are kept; an irregular one falls back to single cells.
      const parts = members.length === (r1 - r0 + 1) * (c1 - c0 + 1) ? [[r0, r1, c0, c1]] : members.map((i) => [Math.floor(i / nCols), Math.floor(i / nCols), i % nCols, i % nCols]);
      for (const [a, b, c, d] of parts) {
        cells.push({
          row: a,
          col: c,
          rowSpan: b - a + 1,
          colSpan: d - c + 1,
          xPt: columns[c],
          yPt: rows[a],
          wPt: columns[d + 1] - columns[c],
          hPt: rows[b + 1] - rows[a],
        });
      }
    }
    cells.sort((a, b) => a.row - b.row || a.col - b.col);
    tables.push({
      xPt: columns[0],
      yPt: rows[0],
      wPt: columns[nCols] - columns[0],
      hPt: rows[nRows] - rows[0],
      columns,
      rows,
      cells,
      ruled: true,
    });
  }
  return tables.sort((a, b) => a.yPt - b.yPt);
}
