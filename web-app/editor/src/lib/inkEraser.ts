/**
 * Removes text ink from a raster region while keeping ruled lines (table borders, underlines).
 *
 * A flat fill erases every border that crosses the edited box. Instead: estimate the paper colour
 * from the brighter half of the region, treat anything clearly darker as ink, keep dark runs long
 * enough to be lines rather than letters, and repaint the remaining ink plus a small halo of
 * anti-aliasing with the paper colour.
 *
 * Devanagari complicates "long horizontal run": the headline (शिरोरेखा) joining a word's letters
 * is one. A ruled line has paper on both sides along its length; a headline has letter bodies
 * hanging from it. Runs with ink attached directly above or below along much of their length are
 * therefore treated as text.
 */

/** Ink must be this much darker (0–255 luma) than the paper. Catches anti-aliased glyph edges. */
const INK_LUMA_MARGIN = 25;
/** Pixels around removed ink that are repainted too, so no grey outline of the letters remains. */
const HALO_PX = 2;
/** Thickest ruled line, in px, measured when looking past a run for attached ink. */
const MAX_LINE_THICKNESS_PX = 4;
/** A run with ink attached above or below along more than this share of its length is text. */
const MAX_ATTACHED_SHARE = 0.25;

function luma(data: Uint8ClampedArray, offset: number): number {
  return 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[sorted.length >> 1] ?? 255;
}

/**
 * Erases text ink in place and returns the paper colour used.
 *
 * @param rgba Region pixels, RGBA, row-major (as in `ImageData.data`).
 * @param widthPx Region width, in px.
 * @param heightPx Region height, in px.
 */
export function eraseInkKeepingLines(
  rgba: Uint8ClampedArray,
  widthPx: number,
  heightPx: number,
): [number, number, number] {
  const count = widthPx * heightPx;
  if (count === 0) return [255, 255, 255];

  const byBrightness = Array.from({ length: count }, (_, p) => p).sort(
    (a, b) => luma(rgba, b * 4) - luma(rgba, a * 4),
  );
  const light = byBrightness.slice(0, Math.max(1, count >> 1));
  const paper: [number, number, number] = [0, 1, 2].map((channel) =>
    median(light.map((p) => rgba[p * 4 + channel])),
  ) as [number, number, number];
  const paperLuma = 0.299 * paper[0] + 0.587 * paper[1] + 0.114 * paper[2];

  const ink = new Uint8Array(count);
  for (let p = 0; p < count; p++) {
    ink[p] = luma(rgba, p * 4) < paperLuma - INK_LUMA_MARGIN ? 1 : 0;
  }

  // A run is a line, not a letter, when it is much longer than any glyph stroke: horizontal runs
  // longer than 1.5× the region height, vertical runs spanning most of it.
  const line = new Uint8Array(count);
  const minHorizontalRun = Math.max(40, heightPx * 1.5);
  const minVerticalRun = heightPx * 0.8;
  /** Share of columns in [start, end) with ink just beyond the run's thickness, above or below. */
  const attachedShare = (y: number, start: number, end: number): number => {
    const rowIsMostlyInk = (row: number) => {
      let on = 0;
      for (let x = start; x < end; x++) on += ink[row * widthPx + x];
      return on > (end - start) * 0.5;
    };
    let best = 0;
    for (const direction of [-1, 1]) {
      let row = y;
      for (let k = 0; k < MAX_LINE_THICKNESS_PX && row + direction >= 0 && row + direction < heightPx && rowIsMostlyInk(row + direction); k++) {
        row += direction;
      }
      const probe = row + direction * 2;
      if (probe < 0 || probe >= heightPx) continue;
      let attached = 0;
      for (let x = start; x < end; x++) attached += ink[probe * widthPx + x];
      best = Math.max(best, attached / (end - start));
    }
    return best;
  };

  for (let y = 0; y < heightPx; y++) {
    let start = -1;
    for (let x = 0; x <= widthPx; x++) {
      const on = x < widthPx && ink[y * widthPx + x] === 1;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= minHorizontalRun && attachedShare(y, start, x) <= MAX_ATTACHED_SHARE) {
          line.fill(1, y * widthPx + start, y * widthPx + x);
        }
        start = -1;
      }
    }
  }
  for (let x = 0; x < widthPx; x++) {
    let start = -1;
    for (let y = 0; y <= heightPx; y++) {
      const on = y < heightPx && ink[y * widthPx + x] === 1;
      if (on && start < 0) start = y;
      if (!on && start >= 0) {
        if (y - start >= minVerticalRun) {
          for (let k = start; k < y; k++) line[k * widthPx + x] = 1;
        }
        start = -1;
      }
    }
  }

  const erase = new Uint8Array(count);
  for (let y = 0; y < heightPx; y++) {
    for (let x = 0; x < widthPx; x++) {
      const p = y * widthPx + x;
      if (!ink[p] || line[p]) continue;
      for (let dy = -HALO_PX; dy <= HALO_PX; dy++) {
        for (let dx = -HALO_PX; dx <= HALO_PX; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < heightPx && xx >= 0 && xx < widthPx) erase[yy * widthPx + xx] = 1;
        }
      }
    }
  }
  for (let p = 0; p < count; p++) {
    if (!erase[p] || line[p]) continue;
    rgba[p * 4] = paper[0];
    rgba[p * 4 + 1] = paper[1];
    rgba[p * 4 + 2] = paper[2];
  }
  return paper;
}
