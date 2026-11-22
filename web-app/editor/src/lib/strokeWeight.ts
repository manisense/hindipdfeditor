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
