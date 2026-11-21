/**
 * Finds the gaps between words on the page image so a changed-word span starts and ends at real
 * word boundaries. Positions estimated from detected text drift when that text differs from the
 * glyphs (an OCR reading of 23.05.2025 as 2305.2025 shifts the estimate by a digit), which would
 * leave part of the old word behind.
 */

/**
 * Ink presence per column of a text band, ignoring rows that are mostly ink (table borders and
 * underlines crossing the band).
 *
 * @param rgba Band pixels, RGBA row-major.
 * @param widthPx Band width, in px.
 * @param heightPx Band height, in px.
 * @returns 1 for columns containing ink, 0 for blank columns.
 */
export function inkColumns(rgba: Uint8ClampedArray, widthPx: number, heightPx: number): Uint8Array {
  const luma = (p: number) => 0.299 * rgba[p * 4] + 0.587 * rgba[p * 4 + 1] + 0.114 * rgba[p * 4 + 2];
  const lumas = Array.from({ length: widthPx * heightPx }, (_, p) => luma(p)).sort((a, b) => b - a);
  const paper = lumas[Math.floor(lumas.length / 10)] ?? 255;
  const isInk = (p: number) => luma(p) < paper - 60;
  const columns = new Uint8Array(widthPx);
  for (let y = 0; y < heightPx; y++) {
    let rowInk = 0;
    for (let x = 0; x < widthPx; x++) rowInk += isInk(y * widthPx + x) ? 1 : 0;
    if (rowInk > widthPx * 0.6) continue;
    for (let x = 0; x < widthPx; x++) if (isInk(y * widthPx + x)) columns[x] = 1;
  }
  return columns;
}

/**
 * The blank gap nearest to `estimate`, as `{ start, end }` column indexes (end exclusive), or null
 * when no gap at least `minGap` wide lies within `radius`.
 *
 * @param columns Output of `inkColumns`.
 * @param estimate Estimated boundary, in column units.
 * @param radius Search distance either side, in column units.
 * @param minGap Narrowest gap that counts as a word gap, in column units.
 */
export function nearestGap(
  columns: Uint8Array,
  estimate: number,
  radius: number,
  minGap: number,
): { start: number; end: number } | null {
  const from = Math.max(0, Math.floor(estimate - radius));
  const to = Math.min(columns.length, Math.ceil(estimate + radius));
  let best: { start: number; end: number } | null = null;
  let bestDistance = Infinity;
  let start = -1;
  for (let x = from; x <= to; x++) {
    const blank = x < to && columns[x] === 0;
    if (blank && start < 0) start = x;
    if (!blank && start >= 0) {
      // A gap cut by the search window still extends to its real edges.
      let gapStart = start;
      let gapEnd = x;
      while (gapStart > 0 && columns[gapStart - 1] === 0) gapStart--;
      while (gapEnd < columns.length && columns[gapEnd] === 0) gapEnd++;
      if (gapEnd - gapStart >= minGap) {
        const distance = Math.abs((gapStart + gapEnd) / 2 - estimate);
        if (distance < bestDistance) {
          best = { start: gapStart, end: gapEnd };
          bestDistance = distance;
        }
      }
      start = -1;
    }
  }
  return best;
}
