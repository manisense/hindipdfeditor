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
      } else if (start >= 0 && along - lastDark > gapPx) {
        if (lastDark - start + 1 >= minPx) runs.push({ at: across, from: start, to: lastDark + 1 });
        start = -1;
      }
    }
  }
  return runs;
}

/** Joins runs on neighbouring rows (a line a few pixels thick) into one line each. */
function joinThickness(runs: Run[], maxThicknessPx: number): Run[] {
  const out: (Run & { first: number; last: number })[] = [];
  for (const run of [...runs].sort((a, b) => a.at - b.at || a.from - b.from)) {
    const line = out.find((l) => run.at - l.last <= 1 && run.from < l.to && run.to > l.from);
    if (line) {
      line.last = run.at;
      line.from = Math.min(line.from, run.from);
      line.to = Math.max(line.to, run.to);
    } else out.push({ ...run, first: run.at, last: run.at });
  }
  return out.filter((l) => l.last - l.first + 1 <= maxThicknessPx).map((l) => ({ at: (l.first + l.last + 1) / 2, from: l.from, to: l.to }));
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
