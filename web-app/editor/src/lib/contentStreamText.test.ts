import { describe, expect, it } from "vitest";

import { removeGlyphsInRects, tokenize, type FontMetrics } from "./contentStreamText";

const simple: FontMetrics = { codeBytes: 1, width: () => 500 };
const identity: FontMetrics = { codeBytes: 2, width: () => 1000 };
const fonts = (name: string) => ({ F1: simple, F2: identity })[name as "F1" | "F2"];

describe("removeGlyphsInRects", () => {
  it("removes only the glyphs inside the rectangle and keeps the rest in place", () => {
    // 10 pt font, 5 pt per glyph: A at 100, B at 105, C at 110, D at 115.
    const content = "BT /F1 10 Tf 1 0 0 1 100 700 Tm (ABCD) Tj ET";
    const result = removeGlyphsInRects(content, fonts, [{ x0: 104, y0: 695, x1: 114, y1: 712 }]);
    expect(result.content).toBe("BT /F1 10 Tf 1 0 0 1 100 700 Tm [<41> -1000 <44>] TJ ET");
    expect(result.removedPerRect).toEqual([2]);
  });

  it("leaves paths, other text and untouched runs byte-identical", () => {
    const content = "0 0 1 RG 50 690 m 300 690 l S BT /F1 10 Tf 100 500 Td (XY) Tj ET";
    const result = removeGlyphsInRects(content, fonts, [{ x0: 0, y0: 680, x1: 400, y1: 720 }]);
    expect(result.content).toBe(content);
    expect(result.removedPerRect).toEqual([0]);
  });

  it("follows kerning numbers inside TJ arrays", () => {
    // A at 100; -1000 moves +10 pt, so B sits at 115.
    const content = "BT /F1 10 Tf 100 700 Td [(A) -1000 (B)] TJ ET";
    const result = removeGlyphsInRects(content, fonts, [{ x0: 115, y0: 695, x1: 121, y1: 712 }]);
    expect(result.content).toBe("BT /F1 10 Tf 100 700 Td [<41> -1500] TJ ET");
  });

  it("reads two-byte codes for Identity-H fonts and applies the CTM", () => {
    const content = "q 2 0 0 2 0 0 cm BT /F2 10 Tf 50 350 Td <00410042> Tj ET Q";
    // In user space the text starts at x=100, y=700, and each glyph is 20 pt wide.
    const result = removeGlyphsInRects(content, fonts, [{ x0: 100, y0: 695, x1: 119, y1: 720 }]);
    expect(result.content).toBe("q 2 0 0 2 0 0 cm BT /F2 10 Tf 50 350 Td [-1000 <0042>] TJ ET Q");
    expect([...result.removedFontsPerRect[0].entries()]).toEqual([["F2", 1]]);
  });

  it("records removed font resource names and counts per rectangle", () => {
    const content = "BT /F1 10 Tf 1 0 0 1 100 700 Tm (AB) Tj /F2 10 Tf <004100420043> Tj ET";
    const result = removeGlyphsInRects(content, fonts, [{ x0: 99, y0: 695, x1: 145, y1: 712 }]);
    expect(result.removedPerRect).toEqual([5]);
    expect([...result.removedFontsPerRect[0].entries()]).toEqual([
      ["F1", 2],
      ["F2", 3],
    ]);
  });

  it("restores the font after Q and reports runs with unknown fonts", () => {
    const content = "q BT /F9 10 Tf 100 700 Td (A) Tj ET Q";
    const result = removeGlyphsInRects(content, fonts, [{ x0: 90, y0: 690, x1: 120, y1: 720 }]);
    expect(result.content).toBe(content);
    expect([...result.unresolvedRects]).toEqual([0]);
  });

  it("rewrites the ' operator keeping its line move", () => {
    const content = "BT /F1 10 Tf 12 TL 100 712 Td (Z) Tj (A) ' ET";
    const result = removeGlyphsInRects(content, fonts, [{ x0: 98, y0: 695, x1: 106, y1: 706 }]);
    expect(result.content).toBe("BT /F1 10 Tf 12 TL 100 712 Td (Z) Tj T* [-500] TJ ET");
  });
});

it("tokenizes escaped literal strings and skips inline image data", () => {
  const tokens = tokenize("(a\\)b\\101) Tj BI /W 1 ID \u0000EI\u0001 EI Q");
  expect(tokens[0]).toMatchObject({ kind: "str", bytes: [97, 41, 98, 65] });
  expect(tokens.filter((t) => t.kind === "op").map((t) => (t as { value: string }).value)).toEqual([
    "Tj",
    "BI",
    "ID",
    "EI",
    "Q",
  ]);
});
