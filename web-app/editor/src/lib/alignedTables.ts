/**
 * Tables without drawn lines, found from how their text lines up: a run of rows whose pieces
 * are split by wide gaps, where the gaps fall at the same places in every row. Cells are never
 * merged. Used by PDF to Word only; the editor does not need table structure.
 */

import type { DetectedTable, TableCell } from './tableDetect';
import type { OcrLine } from '../state/editStore';

/** A gap at least this many line heights wide separates two cells. */
const CELL_GAP_LINES = 1;
/** Rows whose baselines are further apart than this many line heights end the table. */
const ROW_STEP_LINES = 2.5;
/** Baselines closer than this share of the line height are one visual row. */
const SAME_ROW = 0.35;
/** Fewest rows with two or more cells for a table. */
const MIN_ROWS = 3;
/** A column whose pieces are typically longer than this many characters holds running text. */
const PROSE_CHARS = 40;
/** A list marker: 9.1, 12-, (iv), क), a. (Latin or Devanagari digits and letters). */
const LIST_MARKER = /^[([]?(?:[0-9०-९]+(?:\.[0-9०-९]+)*|[ivxlcdmIVXLCDM]+|[a-zA-Z]|[\u0915-\u0939])[.)\]:-]*$/u;
/** Space kept around the table's text, in pt. */
const PAD_PT = 2;

type Row = { lines: OcrLine[]; top: number; bottom: number; baseline: number; hPt: number };

const baselineOf = (line: OcrLine) => line.baselineYPt ?? line.yPt + line.hPt;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** Lines on one visual row, left to right. */
function visualRows(lines: readonly OcrLine[]): Row[] {
  const rows: Row[] = [];
  for (const line of [...lines].sort((a, b) => baselineOf(a) - baselineOf(b) || a.xPt - b.xPt)) {
    const row = rows.find((r) => Math.abs(r.baseline - baselineOf(line)) <= SAME_ROW * Math.max(r.hPt, line.hPt));
    if (row) {
      row.lines.push(line);
      row.top = Math.min(row.top, line.yPt);
      row.bottom = Math.max(row.bottom, line.yPt + line.hPt);
      row.hPt = Math.max(row.hPt, line.hPt);
    } else rows.push({ lines: [line], top: line.yPt, bottom: line.yPt + line.hPt, baseline: baselineOf(line), hPt: line.hPt });
  }
  for (const row of rows) row.lines.sort((a, b) => a.xPt - b.xPt);
  return rows.sort((a, b) => a.baseline - b.baseline);
}

/** Whether a row has two or more pieces, each split from the next by a cell-wide gap. */
function isSplit(row: Row): boolean {
  if (row.lines.length < 2) return false;
  return row.lines.every((line, i) => i === 0 || line.xPt - (row.lines[i - 1].xPt + row.lines[i - 1].wPt) >= CELL_GAP_LINES * row.hPt);
}

/** The x-spans covered by text in these rows (pt), left to right, joined where closer than `gapPt`. */
function columnSpans(rows: readonly Row[], gapPt: number): [number, number][] {
  const spans = rows.flatMap((row) => row.lines.map((line) => [line.xPt, line.xPt + line.wPt] as [number, number])).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [from, to] of spans) {
    const last = out[out.length - 1];
    if (last && from - last[1] < gapPt) last[1] = Math.max(last[1], to);
    else out.push([from, to]);
  }
  return out;
}

/** A table from a run of rows (each starting with a split row), or null when it does not hold. */
function tableFrom(group: readonly Row[][]): DetectedTable | null {
  if (group.length < MIN_ROWS) return null;
  const all = group.flat();
  const gapPt = CELL_GAP_LINES * median(all.map((row) => row.hPt));
  const spans = columnSpans(all, gapPt);
  if (spans.length < 2) return null;
  const pieces = spans.map(([from, to]) => all.flatMap((row) => row.lines).filter((line) => line.xPt >= from && line.xPt < to));
  // Running text in a column is a page layout or numbered paragraphs, not a table.
  if (pieces.some((column) => median(column.map((line) => line.text.trim().length)) > PROSE_CHARS)) return null;
  // Two columns led by list markers are a list.
  if (spans.length === 2 && pieces[0].every((line) => line.text.trim().split(/\s+/u).every((word) => LIST_MARKER.test(word)))) return null;

  const columns = [spans[0][0] - PAD_PT, ...spans.slice(1).map(([from], i) => (spans[i][1] + from) / 2), spans[spans.length - 1][1] + PAD_PT];
  const tops = group.map((rows) => Math.min(...rows.map((row) => row.top)));
  const bottoms = group.map((rows) => Math.max(...rows.map((row) => row.bottom)));
  const rowEdges = [tops[0] - PAD_PT, ...tops.slice(1).map((top, i) => (bottoms[i] + top) / 2), bottoms[bottoms.length - 1] + PAD_PT];
  const cells: TableCell[] = [];
  for (let r = 0; r < group.length; r++) {
    for (let c = 0; c < spans.length; c++) {
      cells.push({
        row: r,
        col: c,
        rowSpan: 1,
        colSpan: 1,
        xPt: columns[c],
        yPt: rowEdges[r],
        wPt: columns[c + 1] - columns[c],
        hPt: rowEdges[r + 1] - rowEdges[r],
      });
    }
  }
  return {
    xPt: columns[0],
    yPt: rowEdges[0],
    wPt: columns[columns.length - 1] - columns[0],
    hPt: rowEdges[rowEdges.length - 1] - rowEdges[0],
    columns,
    rows: rowEdges,
    cells,
    ruled: false,
  };
}

/**
 * Tables aligned by space alone (no drawn lines). A table needs three or more rows split into
 * two or more pieces by gaps of at least one line height, with the gaps at the same places; a
 * single piece that fits inside one column continues the row above (a wrapped cell). A column
 * of running text (page layouts, numbered paragraphs) and a two-column list led by markers
 * are not tables; missing a table is better than turning paragraphs into one.
 *
 * @param lines Detected lines; boxes in PDF points (top-left origin).
 * @param ruled Ruled tables already found (see `detectTables`); their lines are skipped. Boxes in pt.
 * @returns Tables in pt (editor space), top to bottom, with `ruled: false`.
 */
export function detectAlignedTables(lines: readonly OcrLine[], ruled: readonly DetectedTable[]): DetectedTable[] {
  const free = lines.filter((line) => {
    if (!line.text.trim()) return false;
    const x = line.xPt + line.wPt / 2;
    const y = line.yPt + line.hPt / 2;
    return !ruled.some((t) => x >= t.xPt && x <= t.xPt + t.wPt && y >= t.yPt && y <= t.yPt + t.hPt);
  });
  const tables: DetectedTable[] = [];
  // Each entry is one table row: a split row and the wrapped lines under it.
  let group: Row[][] = [];
  const close = () => {
    const table = tableFrom(group);
    if (table) tables.push(table);
    group = [];
  };
  for (const row of visualRows(free)) {
    const last = group[group.length - 1]?.at(-1);
    const near = last !== undefined && row.baseline - last.baseline <= ROW_STEP_LINES * Math.max(row.hPt, last.hPt);
    if (!near) close();
    if (isSplit(row)) {
      if (group.length === 0 || columnSpans([...group.flat(), row], CELL_GAP_LINES * row.hPt).length >= 2) {
        group.push([row]);
        continue;
      }
      close();
      group.push([row]);
      continue;
    }
    // A single piece continues the table only when it keeps every column gap open.
    if (group.length > 0) {
      const before = columnSpans(group.flat(), CELL_GAP_LINES * row.hPt).length;
      if (columnSpans([...group.flat(), row], CELL_GAP_LINES * row.hPt).length === before) {
        group[group.length - 1].push(row);
        continue;
      }
    }
    close();
  }
  close();
  return tables;
}
