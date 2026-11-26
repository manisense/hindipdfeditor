import { describe, expect, it } from 'vitest';

import { eraseCellBorders, rulingsFromImage } from './rasterRulings';
import { detectTables } from './tableDetect';

/** A white RGBA image with dark rectangles drawn on it. */
function image(w: number, h: number, rects: [number, number, number, number][]): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x, y, rw, rh] of rects) {
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) pixels.set([20, 20, 20, 255], (yy * w + xx) * 4);
  }
  return pixels;
}

describe('rulingsFromImage', () => {
  it('finds a scanned grid, thick and broken lines included, and builds its table', () => {
    // 2 px per pt; a 2-column, 2-row grid: lines 2 px thick, one horizontal broken by a 2 px gap.
    const w = 400;
    const h = 200;
    const rects: [number, number, number, number][] = [
      [20, 20, 300, 2],
      [20, 80, 140, 2],
      [162, 80, 158, 2],
      [20, 140, 300, 2],
      [20, 20, 2, 122],
      [170, 20, 2, 122],
      [318, 20, 2, 122],
      // A short dark stroke (a letter) inside a cell: not a ruling.
      [40, 40, 30, 2],
    ];
    const rulings = rulingsFromImage(image(w, h, rects), w, h, 2);
    expect(rulings.filter((r) => r.horizontal)).toHaveLength(3);
    expect(rulings.filter((r) => !r.horizontal)).toHaveLength(3);
    const [table] = detectTables(rulings);
    expect(table.cells).toHaveLength(4);
    expect(table.columns.map(Math.round)).toEqual([11, 86, 160]);
  });

  it('finds the lines of a slightly turned scan', () => {
    // A 0.6° turn: each 600 px horizontal line drifts 10 px down, more than the 6 px thickness limit.
    const w = 700;
    const h = 260;
    const rects: [number, number, number, number][] = [];
    for (const top of [20, 110, 200]) {
      for (let x = 20; x < 620; x += 60) rects.push([x, top + Math.floor((x - 20) / 60), 60, 2]);
    }
    for (const left of [20, 320, 618]) rects.push([left, 20, 2, 200 + Math.floor((left - 20) / 60)]);
    const rulings = rulingsFromImage(image(w, h, rects), w, h, 2);
    expect(rulings.filter((r) => r.horizontal)).toHaveLength(3);
    const [table] = detectTables(rulings);
    expect(table?.cells).toHaveLength(4);
  });

  it('ignores filled shapes and blank pages', () => {
    expect(rulingsFromImage(image(200, 100, [[20, 20, 150, 40]]), 200, 100, 2)).toEqual([]);
    expect(rulingsFromImage(image(200, 100, []), 200, 100, 2)).toEqual([]);
  });
});

describe('eraseCellBorders', () => {
  const dark = (pixels: Uint8ClampedArray, w: number, x: number, y: number) => pixels[(y * w + x) * 4] < 150;

  it('whitens the borders of a turned cell and keeps the letters', () => {
    // A 400 x 60 px cell crop: top border drifting 4 px across, bottom and side borders, and a
    // Devanagari-style headline 160 px long with a stroke under it.
    const w = 400;
    const h = 60;
    const rects: [number, number, number, number][] = [];
    for (let x = 0; x < 400; x += 100) rects.push([x, 2 + x / 100, 100, 2]);
    rects.push([0, 55, 400, 2], [1, 0, 2, 60], [396, 0, 2, 60]);
    rects.push([60, 24, 160, 2], [100, 26, 3, 14]);
    const pixels = image(w, h, rects);
    eraseCellBorders(pixels, w, h, 4);
    expect(dark(pixels, w, 50, 2)).toBe(false);
    expect(dark(pixels, w, 350, 5)).toBe(false);
    expect(dark(pixels, w, 200, 55)).toBe(false);
    expect(dark(pixels, w, 1, 30)).toBe(false);
    expect(dark(pixels, w, 397, 30)).toBe(false);
    expect(dark(pixels, w, 150, 24)).toBe(true);
    expect(dark(pixels, w, 101, 30)).toBe(true);
  });

  it('whitens a faint grey border left at the crop edge', () => {
    const w = 200;
    const h = 40;
    const pixels = image(w, h, [[50, 10, 3, 20]]);
    for (let y = 0; y < h; y++) pixels.set([200, 200, 200], (y * w + (w - 1)) * 4);
    eraseCellBorders(pixels, w, h, 4);
    expect(pixels[(20 * w + w - 1) * 4]).toBe(255);
    expect(dark(pixels, w, 51, 20)).toBe(true);
  });
});
