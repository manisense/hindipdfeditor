/**
 * Recursive XY-cut over page layout boxes: splits a digital page into reading-order regions by
 * cutting at the widest empty vertical (column) gaps first, and only using horizontal cuts to
 * isolate spanning bands (full-width titles, dividers, or tables) that block a column gutter.
 *
 * Non-text anchors (tables and pictures) are included as atomic boxes so cuts run around detected
 * tables rather than through them.
 */

export type LayoutBox = {
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  /** True for text lines; false for atomic anchors (tables, pictures). Defaults to true. */
  isLine?: boolean;
  /** True for boxes that count as substantive column content (lines and tables). Defaults to true. */
  isContent?: boolean;
};

export type LayoutRegion<T extends LayoutBox> = {
  items: T[];
  /** True when this leaf came from splitting side-by-side columns via a vertical cut. */
  columnar: boolean;
};

/** Minimum column gutter width as a multiple of median line height. */
const MIN_GUTTER_LINES = 1.2;
/** Absolute minimum column gutter width, in PDF points. */
const MIN_GUTTER_PT = 12;
/** Minimum width of each side of a valid column split, as a share of page width. */
const MIN_COLUMN_WIDTH_RATIO = 0.18;
/** Cap on minimum column width, in PDF points, so narrow pages still split cleanly. */
const MAX_MIN_COLUMN_WIDTH_PT = 100;
/** Vertical tolerance (share of line height) for counting distinct visual rows. */
const SAME_ROW_RATIO = 0.5;

const isLine = (box: LayoutBox) => box.isLine !== false;
const isContent = (box: LayoutBox) => box.isContent !== false;

function medianHeight(items: readonly LayoutBox[]): number {
  const heights = items.filter(isLine).map((b) => b.hPt);
  const sample = heights.length > 0 ? heights : items.map((b) => b.hPt);
  if (sample.length === 0) return 12;
  const sorted = [...sample].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Counts distinct visual rows among text lines (tables count as at least 2 rows of vertical span). */
function visualRowCount(items: readonly LayoutBox[]): number {
  const lines = items.filter(isLine);
  if (lines.length === 0) {
    return items.some(isContent) ? 2 : 0;
  }
  const rows: { centerY: number; hPt: number }[] = [];
  for (const box of [...lines].sort((a, b) => a.yPt - b.yPt)) {
    const centerY = box.yPt + box.hPt / 2;
    const match = rows.find((r) => Math.abs(r.centerY - centerY) <= SAME_ROW_RATIO * Math.max(r.hPt, box.hPt));
    if (match) match.hPt = Math.max(match.hPt, box.hPt);
    else rows.push({ centerY, hPt: box.hPt });
  }
  return rows.length;
}

/** Finds all empty gaps of width >= minGap between merged X-intervals of `items`. */
function emptyXGaps(items: readonly LayoutBox[], minGap: number): { start: number; end: number; width: number }[] {
  if (items.length < 2) return [];
  const spans = items.map((b) => [b.xPt, b.xPt + b.wPt] as [number, number]).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [from, to] of spans) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  const gaps: { start: number; end: number; width: number }[] = [];
  for (let i = 0; i + 1 < merged.length; i += 1) {
    const width = merged[i + 1][0] - merged[i][1];
    if (width >= minGap) gaps.push({ start: merged[i][1], end: merged[i + 1][0], width });
  }
  return gaps;
}

/** Finds the widest valid vertical (column) cut through `items`, or null if none qualifies. */
function findVerticalCut<T extends LayoutBox>(
  items: readonly T[],
  pageWidthPt: number,
): { left: T[]; right: T[]; mid: number } | null {
  if (items.length < 2) return null;
  const minGap = Math.max(MIN_GUTTER_PT, MIN_GUTTER_LINES * medianHeight(items));
  const minSideWidth = Math.min(MAX_MIN_COLUMN_WIDTH_PT, pageWidthPt * MIN_COLUMN_WIDTH_RATIO);
  const gaps = emptyXGaps(items, minGap).sort((a, b) => b.width - a.width);

  for (const gap of gaps) {
    const mid = (gap.start + gap.end) / 2;
    const left: T[] = [];
    const right: T[] = [];
    for (const item of items) {
      if (item.xPt + item.wPt / 2 < mid) left.push(item);
      else right.push(item);
    }
    if (left.length === 0 || right.length === 0) continue;
    if (!left.some(isContent) || !right.some(isContent)) continue;

    const leftWidth = Math.max(...left.map((b) => b.xPt + b.wPt)) - Math.min(...left.map((b) => b.xPt));
    const rightWidth = Math.max(...right.map((b) => b.xPt + b.wPt)) - Math.min(...right.map((b) => b.xPt));
    if (leftWidth < minSideWidth || rightWidth < minSideWidth) continue;

    // A single visual row split into two pieces (e.g. left ref / right date) is not two columns.
    if (Math.max(visualRowCount(left), visualRowCount(right)) < 2) continue;

    // True columns sit side-by-side and overlap vertically; stacked left/right blocks do not.
    const leftTop = Math.min(...left.map((b) => b.yPt));
    const leftBottom = Math.max(...left.map((b) => b.yPt + b.hPt));
    const rightTop = Math.min(...right.map((b) => b.yPt));
    const rightBottom = Math.max(...right.map((b) => b.yPt + b.hPt));
    if (Math.min(leftBottom, rightBottom) <= Math.max(leftTop, rightTop)) continue;

    return { left, right, mid };
  }
  return null;
}

type HorizontalBand<T extends LayoutBox> = { top: number; bottom: number; items: T[] };

/** Groups items into top-to-bottom horizontal bands separated by empty horizontal gaps. */
function horizontalBands<T extends LayoutBox>(items: readonly T[]): HorizontalBand<T>[] {
  const sorted = [...items].sort((a, b) => a.yPt - b.yPt || a.xPt - b.xPt);
  const bands: HorizontalBand<T>[] = [];
  for (const item of sorted) {
    const last = bands[bands.length - 1];
    if (last && item.yPt < last.bottom - 0.5) {
      last.items.push(item);
      last.bottom = Math.max(last.bottom, item.yPt + item.hPt);
    } else {
      bands.push({ top: item.yPt, bottom: item.yPt + item.hPt, items: [item] });
    }
  }
  return bands;
}

/**
 * When no vertical cut spans the whole region (e.g. a full-width title, table, or closing note
 * crosses the column gutter), finds a horizontal cut that isolates a spanning band from the
 * largest contiguous multi-column band range. Returns null if the region is purely single-column.
 */
function findHorizontalCut<T extends LayoutBox>(
  items: readonly T[],
  pageWidthPt: number,
): { top: T[]; bottom: T[] } | null {
  const bands = horizontalBands(items);
  if (bands.length < 2) return null;

  const minGap = Math.max(MIN_GUTTER_PT, MIN_GUTTER_LINES * medianHeight(items));
  const rawMids: number[] = [];
  for (const band of bands) {
    for (const gap of emptyXGaps(band.items, minGap)) {
      rawMids.push((gap.start + gap.end) / 2);
    }
  }
  if (rawMids.length === 0) return null;

  // Deduplicate nearby candidate gutter midpoints.
  rawMids.sort((a, b) => a - b);
  const candidateMids: number[] = [];
  for (const m of rawMids) {
    if (candidateMids.length === 0 || m - candidateMids[candidateMids.length - 1] > minGap / 2) {
      candidateMids.push(m);
    }
  }

  let best: { cutIndex: number; count: number; gapWidth: number } | null = null;
  for (const mid of candidateMids) {
    const isBlocker = bands.map((band) =>
      band.items.some((item) => item.xPt < mid && item.xPt + item.wPt > mid),
    );
    let runStart = 0;
    while (runStart < bands.length) {
      if (isBlocker[runStart]) {
        runStart += 1;
        continue;
      }
      let runEnd = runStart;
      while (runEnd + 1 < bands.length && !isBlocker[runEnd + 1]) runEnd += 1;

      if (runStart > 0 || runEnd < bands.length - 1) {
        const runItems = bands.slice(runStart, runEnd + 1).flatMap((b) => b.items);
        if (findVerticalCut(runItems, pageWidthPt) !== null) {
          const cutIndex = runStart > 0 ? runStart : runEnd + 1;
          const gapWidth = bands[cutIndex].top - bands[cutIndex - 1].bottom;
          if (
            !best ||
            runItems.length > best.count ||
            (runItems.length === best.count && gapWidth > best.gapWidth)
          ) {
            best = { cutIndex, count: runItems.length, gapWidth };
          }
        }
      }
      runStart = runEnd + 1;
    }
  }

  if (!best) return null;
  return {
    top: bands.slice(0, best.cutIndex).flatMap((b) => b.items),
    bottom: bands.slice(best.cutIndex).flatMap((b) => b.items),
  };
}

/**
 * Partitions layout boxes into reading-order leaf regions via recursive XY-cut.
 * Single-column regions stay intact as a single leaf with `columnar: false`.
 */
export function xyCutRegions<T extends LayoutBox>(
  items: readonly T[],
  pageWidthPt: number,
): LayoutRegion<T>[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ items: [items[0]], columnar: false }];

  const split = (subset: readonly T[], inColumn: boolean): LayoutRegion<T>[] => {
    if (subset.length <= 1) return subset.length === 0 ? [] : [{ items: [...subset], columnar: inColumn }];
    const vCut = findVerticalCut(subset, pageWidthPt);
    if (vCut) {
      return [...split(vCut.left, true), ...split(vCut.right, true)];
    }
    const hCut = findHorizontalCut(subset, pageWidthPt);
    if (hCut) {
      return [...split(hCut.top, inColumn), ...split(hCut.bottom, inColumn)];
    }
    return [{ items: [...subset], columnar: inColumn }];
  };

  return split(items, false);
}
