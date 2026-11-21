import { expect, it } from "vitest";

import { mergeOcrLines } from "./mergeOcrLines";

const box = { x: 100, y: 100, width: 400, height: 20 };

it("prefers a confident English reading over Hindi OCR's invented Devanagari", () => {
  const merged = mergeOcrLines(
    [{ ...box, text: "#लताञ्नाल्तूडूर फिनां फिड", confidence: 31 }],
    [{ ...box, text: "I acknowledge that this saved question paper", confidence: 91 }],
  );
  expect(merged.map((l) => l.text)).toEqual(["I acknowledge that this saved question paper"]);
});

it("keeps a real Hindi line over the English model's garbage", () => {
  const merged = mergeOcrLines(
    [{ ...box, text: "कर्मचारी संवर्ग में नियमित", confidence: 93 }],
    [{ ...box, text: "eer Wa FA Ufa", confidence: 22 }],
  );
  expect(merged.map((l) => l.text)).toEqual(["कर्मचारी संवर्ग में नियमित"]);
});

it("keeps the Devanagari line when engines report no confidence", () => {
  const merged = mergeOcrLines([{ ...box, text: "विभाग/ Department" }], [{ ...box, text: "Department" }]);
  expect(merged.map((l) => l.text)).toEqual(["विभाग/ Department"]);
});
