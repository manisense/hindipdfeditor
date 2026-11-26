/**
 * Table ruling lines found in a page image (a scan), for pages with no drawn lines to read: long
 * thin runs of dark pixels, horizontal and vertical. Letter strokes (a Devanagari headline is a
 * horizontal stroke) are shorter than the minimum, or touch no other line, so table detection
 * ignores them.
 */

import type { Ruling } from './pdfRulings';

/** Pixels darker than this (0–255 luma) are ink. */
const INK_LUMA = 150;
/** Shortest ruling, in pt: horizontal lines are longer than most words; vertical ones span a row. */
const MIN_HORIZONTAL_PT = 30;
const MIN_VERTICAL_PT = 12;
/** Gaps up to this (pt) inside a line are bridged (scans break thin lines). */
const MAX_GAP_PT = 1.5;
/** Thicker than this (pt), a dark band is a filled shape, not a line. */
const MAX_THICKNESS_PT = 3;

type Run = { at: number; from: number; to: number };

function runsAlong(
  length: number,
  count: number,
  dark: (along: number, across: number) => boolean,
  minPx: number,
  gapPx: number,
): Run[] {
  const runs: Run[] = [];
  for (let across = 0; across < count; across++) {
    let start = -1;
    let lastDark = -1;
    for (let along = 0; along <= length; along++) {
      const isDark = along < length && dark(along, across);
      if (isDark) {
        if (start < 0) start = along;
        lastDark = along;
      } else if (start >= 0 && (along === length || along - lastDark > gapPx)) {
        if (lastDark - start + 1 >= minPx) runs.push({ at: across, from: start, to: lastDark + 1 });
        start = -1;
      }
    }
  }
  return runs;
}

/**
 * Joins runs on neighbouring rows (a line a few pixels thick) into one line each. Thickness is
 * measured across the line at each point along it, not from its first row to its last: on a
 * slightly turned scan a long line drifts across many rows while staying thin everywhere.
 */
function joinThickness(runs: Run[], maxThicknessPx: number): Run[] {
  return thinLines(runs, maxThicknessPx).map((l) => ({ at: (l.first + l.last + 1) / 2, from: l.from, to: l.to }));
}

type ThinLine = Run & { first: number; last: number; runs: Run[] };

/** Runs on neighbouring rows joined into lines, keeping only lines no thicker than the limit. */
function thinLines(runs: Run[], maxThicknessPx: number): ThinLine[] {
  const out: ThinLine[] = [];
  for (const run of [...runs].sort((a, b) => a.at - b.at || a.from - b.from)) {
    const line = out.find((l) => run.at - l.last <= 1 && run.from < l.to && run.to > l.from);
    if (line) {
      line.last = run.at;
      line.from = Math.min(line.from, run.from);
      line.to = Math.max(line.to, run.to);
      line.runs.push(run);
    } else out.push({ ...run, first: run.at, last: run.at, runs: [run] });
  }
  return out.filter((l) => thickestCrossing(l.runs) <= maxThicknessPx);
}

/** Most rows a line covers at any one point along it, in px. */
function thickestCrossing(runs: readonly Run[]): number {
  const edges = runs.flatMap((run) => [
    { along: run.from, delta: 1 },
    { along: run.to, delta: -1 },
  ]);
  edges.sort((a, b) => a.along - b.along || a.delta - b.delta);
  let covering = 0;
  let most = 0;
  for (const edge of edges) {
    covering += edge.delta;
    most = Math.max(most, covering);
  }
  return most;
}

/**
 * Ruling lines in a page image.
 *
 * @param pixels RGBA pixels, row by row.
 * @param widthPx Image width, in px.
 * @param heightPx Image height, in px.
 * @param pxPerPt Image scale, in px per pt.
 * @returns Rulings in editor space (pt, top-left origin).
 */
export function rulingsFromImage(pixels: Uint8ClampedArray, widthPx: number, heightPx: number, pxPerPt: number): Ruling[] {
  const ink = new Uint8Array(widthPx * heightPx);
  for (let i = 0; i < ink.length; i++) {
    const k = i * 4;
    ink[i] = 0.299 * pixels[k] + 0.587 * pixels[k + 1] + 0.114 * pixels[k + 2] < INK_LUMA ? 1 : 0;
  }
  const gap = Math.round(MAX_GAP_PT * pxPerPt);
  const thick = Math.max(2, Math.round(MAX_THICKNESS_PT * pxPerPt));
  const horizontal = joinThickness(
    runsAlong(widthPx, heightPx, (x, y) => ink[y * widthPx + x] === 1, MIN_HORIZONTAL_PT * pxPerPt, gap),
    thick,
  );
  const vertical = joinThickness(
    runsAlong(heightPx, widthPx, (y, x) => ink[y * widthPx + x] === 1, MIN_VERTICAL_PT * pxPerPt, gap),
    thick,
  );
  return [
    ...horizontal.map((r) => ({ horizontal: true, at: r.at / pxPerPt, from: r.from / pxPerPt, to: r.to / pxPerPt })),
    ...vertical.map((r) => ({ horizontal: false, at: r.at / pxPerPt, from: r.from / pxPerPt, to: r.to / pxPerPt })),
  ];
}

/** A border spans at least this share of a cell crop's width or height. */
const BORDER_SPAN = 0.8;
/** Grey halo whitened either side of a border, in pt. */
const BORDER_HALO_PT = 0.5;
/** Band along each crop edge checked for faint border remains, in pt. */
const EDGE_BAND_PT = 1.5;
/** Pixels darker than this (0–255 luma) count towards a faint edge line. */
const FAINT_LUMA = 235;

/**
 * Whitens the table borders in a crop of one scanned table cell, so OCR does not read them as
 * letters (। | ० : at the ends of a cell). A border is a thin dark line across at least
 * {@link BORDER_SPAN} of the crop; letter strokes, the Devanagari headline included, are shorter.
 * Only the line's own pixels are whitened.
 *
 * @param pixels RGBA pixels, row by row; changed in place.
 * @param widthPx Crop width, in px.
 * @param heightPx Crop height, in px.
 * @param pxPerPt Crop scale, in px per pt.
 */
export function eraseCellBorders(pixels: Uint8ClampedArray, widthPx: number, heightPx: number, pxPerPt: number): void {
  const dark = (x: number, y: number) => {
    const k = (y * widthPx + x) * 4;
    return 0.299 * pixels[k] + 0.587 * pixels[k + 1] + 0.114 * pixels[k + 2] < INK_LUMA;
  };
  const gap = Math.round(MAX_GAP_PT * pxPerPt);
  const thick = Math.max(2, Math.round(MAX_THICKNESS_PT * pxPerPt));
  // A scanned border has a grey halo lighter than ink; it is whitened too, this far either side.
  const halo = Math.max(1, Math.round(BORDER_HALO_PT * pxPerPt));
  const whitenPixel = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < widthPx && y < heightPx) pixels.set([255, 255, 255], (y * widthPx + x) * 4);
  };
  for (const line of thinLines(runsAlong(widthPx, heightPx, dark, BORDER_SPAN * widthPx * 0.25, gap), thick)) {
    if (line.to - line.from < BORDER_SPAN * widthPx) continue;
    for (const run of line.runs) {
      for (let x = run.from; x < run.to; x++) for (let d = -halo; d <= halo; d++) whitenPixel(x, run.at + d);
    }
  }
  for (const line of thinLines(runsAlong(heightPx, widthPx, (y, x) => dark(x, y), BORDER_SPAN * heightPx, gap), thick)) {
    if (line.to - line.from < BORDER_SPAN * heightPx) continue;
    for (const run of line.runs) {
      for (let y = run.from; y < run.to; y++) for (let d = -halo; d <= halo; d++) whitenPixel(run.at + d, y);
    }
  }
  // A border just outside the crop leaves a faint grey edge inside it, too light to count as ink.
  const edge = Math.max(1, Math.round(EDGE_BAND_PT * pxPerPt));
  const grey = (x: number, y: number) => {
    const k = (y * widthPx + x) * 4;
    return 0.299 * pixels[k] + 0.587 * pixels[k + 1] + 0.114 * pixels[k + 2] < FAINT_LUMA;
  };
  for (let i = 0; i < edge; i++) {
    for (const x of [i, widthPx - 1 - i]) {
      let count = 0;
      for (let y = 0; y < heightPx; y++) if (grey(x, y)) count++;
      if (count >= BORDER_SPAN * heightPx) for (let y = 0; y < heightPx; y++) whitenPixel(x, y);
    }
    for (const y of [i, heightPx - 1 - i]) {
      let count = 0;
      for (let x = 0; x < widthPx; x++) if (grey(x, y)) count++;
      if (count >= BORDER_SPAN * widthPx) for (let x = 0; x < widthPx; x++) whitenPixel(x, y);
    }
  }
}
