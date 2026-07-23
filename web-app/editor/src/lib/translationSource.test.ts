import {
  containsDevanagari,
  isTranslatableHindiLine,
} from "./translationSource";

describe("translation source filtering", () => {
  it("detects Devanagari and accepts predominantly Hindi lines", () => {
    expect(containsDevanagari("Hello नमस्ते")).toBe(true);
    expect(isTranslatableHindiLine("आवेदन पत्र का प्रपत्र")).toBe(true);
    expect(isTranslatableHindiLine("विभाग / कार्यालय:")).toBe(true);
  });

  it("rejects English-only, one-character, and Latin-heavy OCR noise", () => {
    expect(isTranslatableHindiLine("FORM OF APPLICATION FOR LEAVE")).toBe(
      false,
    );
    expect(isTranslatableHindiLine("अ")).toBe(false);
    expect(isTranslatableHindiLine("FORM OF APPLICATION पत्र FOR LEAVE")).toBe(
      false,
    );
  });
});
