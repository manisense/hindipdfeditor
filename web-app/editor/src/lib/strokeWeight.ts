/**
 * Matches the weight of replacement text to the original by stroke thickness. A PDF often does not
 * say how heavy its text is (Chrome-printed fonts carry no name; a light face is still "Regular"),
 * so the thickness of the strokes on the page image is compared with the same text rendered at
 * each weight the replacement font offers.
 */

/**
 * Typical stroke thickness in a text band: the median width of horizontal ink runs, which stems
 * and bowls dominate. Each pixel counts by how much ink covers it (paper 0, the darkest ink 1), so
 * anti-aliased edges give sub-pixel widths: at 2 px per point a regular stem is only 2–3 px wide.
 * Rows that are mostly ink (rules, underlines) are skipped.
 *
 * @param rgba Band pixels, RGBA row-major.
 * @param widthPx Band width, in px.
 * @param heightPx Band height, in px.
 * @returns Median ink run, in px, or null when the band holds too little ink to judge.
 */
export function medianInkRunPx(rgba: Uint8ClampedArray, widthPx: number, heightPx: number): number | null {
  const pixels = widthPx * heightPx;
  const luma = new Float32Array(pixels);
  for (let p = 0; p < pixels; p++) luma[p] = 0.299 * rgba[p * 4] + 0.587 * rgba[p * 4 + 1] + 0.114 * rgba[p * 4 + 2];
  const sorted = Float32Array.from(luma).sort();
  const paper = sorted[Math.floor(pixels * 0.9)] ?? 255;
  const ink = sorted[Math.floor(pixels * 0.005)] ?? 0;
  if (paper - ink < 60) return null;
  const coverage = (p: number) => Math.min(1, Math.max(0, (paper - luma[p]) / (paper - ink)));
  const runs: number[] = [];
  for (let y = 0; y < heightPx; y++) {
    let rowInk = 0;
    for (let x = 0; x < widthPx; x++) rowInk += coverage(y * widthPx + x);
    if (rowInk > widthPx * 0.6) continue;
    let run = 0;
    for (let x = 0; x <= widthPx; x++) {
      const c = x < widthPx ? coverage(y * widthPx + x) : 0;
      if (c > 0.1) run += c;
      else if (run > 0) {
        // A run with no solid pixel is an edge or a hairline, not a stroke.
        if (run >= 0.5) runs.push(run);
        run = 0;
      }
    }
  }
  if (runs.length < 20) return null;
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length / 2)];
}

/** Rendered stroke thickness of one candidate weight. */
export type WeightSample = { weight: number; stemPx: number };

/** Stroke ratio within which the current weight is kept (rendering noise, not a real difference). */
const KEEP_WITHIN = 1.12;

/**
 * The candidate weight whose strokes are closest to the original's, or `fallback` when no
 * candidate is clearly closer than it.
 *
 * @param originalStemPx Median ink run of the original text, in px.
 * @param samples Candidate weights (CSS 100–900) and their median ink run at the same size, in px.
 * @param fallback Weight to keep unless another is clearly closer (CSS 100–900).
 */
export function closestWeight(originalStemPx: number, samples: readonly WeightSample[], fallback: number): number {
  const distance = (stemPx: number) => Math.abs(Math.log(stemPx / originalStemPx));
  const current = samples.find((s) => s.weight === fallback);
  let best = current ?? null;
  for (const sample of samples) if (!best || distance(sample.stemPx) < distance(best.stemPx)) best = sample;
  if (!best) return fallback;
  if (current && Math.exp(distance(current.stemPx)) <= KEEP_WITHIN) return fallback;
  return best.weight;
}

/**
 * Face and stroke for repainting a faux-bold original (glyphs filled and stroked). A stroke adds
 * its full width to every stem, so the stroke needed with a face is the original stem minus that
 * face's stem. The face kept is the one needing a stroke closest to the one the PDF used, so the
 * look stays "this face, emboldened" (on a tie, the one needing less); the stroke then makes the stems match exactly, even when the
 * replacement font is a little lighter or heavier than the original.
 *
 * @param originalStemPx Median stem of the original line, in px.
 * @param samples Candidate weights and their unstroked median stems at the same size, in px.
 * @param pdfStrokePx Stroke width the PDF painted the original with, in px.
 * @returns The weight (CSS 100–900) and the stroke width to paint, in px; null without samples.
 */
export function fauxBoldWeight(
  originalStemPx: number,
  samples: readonly WeightSample[],
  pdfStrokePx: number,
): { weight: number; strokePx: number } | null {
  let best: { weight: number; strokePx: number; miss: number } | null = null;
  for (const sample of samples) {
    const needed = originalStemPx - sample.stemPx;
    const miss = needed < 0 ? Math.abs(needed) + pdfStrokePx : Math.abs(needed - pdfStrokePx);
    const strokePx = Math.max(0, needed);
    // On a tie, the face needing less stroke stays closer to its own design.
    const better = !best || miss < best.miss - 1e-6 || (Math.abs(miss - best.miss) <= 1e-6 && strokePx < best.strokePx);
    if (better) best = { weight: sample.weight, strokePx, miss };
  }
  return best && { weight: best.weight, strokePx: best.strokePx };
}
