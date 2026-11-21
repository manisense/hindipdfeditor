import { expect, it } from "vitest";

import { eraseInkKeepingLines } from "./inkEraser";

function region(width: number, height: number) {
  const rgba = new Uint8ClampedArray(width * height * 4).fill(245);
  const paint = (x: number, y: number, value: number) => {
    const o = (y * width + x) * 4;
    rgba[o] = rgba[o + 1] = rgba[o + 2] = value;
  };
  const at = (x: number, y: number) => rgba[(y * width + x) * 4];
  return { rgba, paint, at };
}

it("removes glyph ink but keeps a table border and a cell divider", () => {
  const width = 200;
  const height = 30;
  const { rgba, paint, at } = region(width, height);
  for (let x = 0; x < width; x++) paint(x, 2, 20); // top border
  for (let y = 0; y < height; y++) paint(150, y, 20); // vertical divider
  for (let y = 10; y < 20; y++) for (let x = 40; x < 46; x++) paint(x, y, 30); // a letter
  paint(39, 15, 170); // anti-aliased edge of the letter

  const paper = eraseInkKeepingLines(rgba, width, height);

  expect(paper).toEqual([245, 245, 245]);
  expect(at(100, 2)).toBe(20);
  expect(at(150, 15)).toBe(20);
  expect(at(42, 15)).toBe(245);
  expect(at(39, 15)).toBe(245);
});

it("handles an empty region", () => {
  expect(eraseInkKeepingLines(new Uint8ClampedArray(0), 0, 0)).toEqual([255, 255, 255]);
});

it("erases a Devanagari headline with letters hanging from it", () => {
  const width = 200;
  const height = 40;
  const { rgba, paint, at } = region(width, height);
  for (let x = 20; x < 160; x++) paint(x, 10, 20); // headline (शिरोरेखा), 140 px long
  // Letter bodies under the headline: about half its length, as measured on a real scan (43–59 %).
  for (let x = 20; x < 160; x += 4) for (let y = 11; y < 30; y++) { paint(x, y, 20); paint(x + 1, y, 20); }
  for (let x = 0; x < width; x++) paint(x, 37, 20); // a table border below, with paper above it

  eraseInkKeepingLines(rgba, width, height);

  expect(at(90, 10)).toBe(245);
  expect(at(44, 20)).toBe(245);
  expect(at(100, 37)).toBe(20);
});
