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

it("keeps a doubtful Hindi line over English gibberish that is barely more confident", () => {
  // A scanned "पत्रांक: … दिनांक: …" line: Hindi OCR reports 0, English reads Hindi as letters at 4.
  const merged = mergeOcrLines(
    [{ ...box, text: "पत्रांक: वि.प्र.स./२०२६/४७ दिनांक: 2/7/2026", confidence: 0 }],
    [{ ...box, text: "Hi: fa.9.3. 2028/80 feria: 12/11/2026", confidence: 4 }],
  );
  expect(merged.map((l) => l.text)).toEqual(["पत्रांक: वि.प्र.स./२०२६/४७ दिनांक: 2/7/2026"]);
});

it("keeps a mixed Hindi and English line when English is sure of its English words only", () => {
  const merged = mergeOcrLines(
    [{ ...box, text: "नमूना दस्तावेज़ - केवल परीक्षण के लिए / Sample document", confidence: 55 }],
    [{ ...box, text: "gn zener for eer fe Sample document", confidence: 66, sureWordShare: 0.3 }],
  );
  expect(merged.map((l) => l.text)).toEqual(["नमूना दस्तावेज़ - केवल परीक्षण के लिए / Sample document"]);
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
