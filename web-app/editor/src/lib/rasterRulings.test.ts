import { describe, expect, it } from 'vitest';

import { rulingsFromImage } from './rasterRulings';
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

  it('ignores filled shapes and blank pages', () => {
    expect(rulingsFromImage(image(200, 100, [[20, 20, 150, 40]]), 200, 100, 2)).toEqual([]);
    expect(rulingsFromImage(image(200, 100, []), 200, 100, 2)).toEqual([]);
  });
});
