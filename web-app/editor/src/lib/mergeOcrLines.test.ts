import { expect, it } from "vitest";

import { mergeOcrLines, mergeWordReadings } from "./mergeOcrLines";

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

it('uses confident English readings for English words inside a Hindi line', () => {
  const w = (text: string, x: number, confidence: number) => ({ text, x, y: 10, width: 40, height: 12, confidence });
  const hindi = [w('कर्मचारी', 0, 91), w('का', 45, 93), w('नाम:', 70, 90), w('सीमा', 120, 35), w('शर्मा', 170, 30)];
  const latin = [w('Ae', 0, 20), w('Seema', 121, 92), w('Sharma', 171, 94)];
  expect(mergeWordReadings(hindi, latin)).toBe('कर्मचारी का नाम: Seema Sharma');
});
