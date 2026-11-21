import { expect, it } from "vitest";

import { textBandOfLine } from "./ocrLineGeometry";

it("ignores a tall row number when finding a line's text band", () => {
  // Bank of Baroda row 1: an 18 pt line box (36 px at 2×) around 7.5 pt words.
  const line = { x0: 100, y0: 300, x1: 1190, y1: 336 };
  const words = [
    { x0: 100, y0: 300, x1: 112, y1: 336 }, // the row number "1."
    { x0: 120, y0: 302, x1: 200, y1: 317 },
    { x0: 205, y0: 301, x1: 260, y1: 316 },
    { x0: 265, y0: 302, x1: 330, y1: 317 },
  ];
  expect(textBandOfLine(line, words)).toEqual({ x0: 100, y0: 302, x1: 1190, y1: 317 });
});

it("keeps the line box when there are no words", () => {
  const line = { x0: 0, y0: 10, x1: 50, y1: 30 };
  expect(textBandOfLine(line, [])).toBe(line);
});
