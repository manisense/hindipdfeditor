import { expect, it } from 'vitest';

import { inkColumns, nearestGap } from './wordGaps';

function band(width: number, height: number, inkAt: (x: number, y: number) => boolean) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      rgba[o] = rgba[o + 1] = rgba[o + 2] = inkAt(x, y) ? 20 : 250;
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

it('marks ink columns and ignores a border crossing the band', () => {
  // Words at 0–9 and 15–29 (with a 1 px gap between digits at 20) in a 60 px band, and a border
  // across row 0.
  const rgba = band(60, 10, (x, y) => y === 0 || (y > 2 && (x < 10 || (x >= 15 && x < 30 && x !== 20))));
  const columns = inkColumns(rgba, 60, 10);
  expect(Array.from(columns.slice(8, 22))).toEqual([1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1]);
});

it('snaps to the nearest real word gap, skipping hairline gaps between digits', () => {
  const columns = Uint8Array.from({ length: 30 }, (_, x) => (x < 10 || (x >= 15 && x !== 20) ? 1 : 0));
  expect(nearestGap(columns, 19, 8, 3)).toEqual({ start: 10, end: 15 });
  expect(nearestGap(columns, 28, 2, 3)).toBeNull();
});
