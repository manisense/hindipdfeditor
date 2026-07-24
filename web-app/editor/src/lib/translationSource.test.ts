import {
  containsDevanagari,
  containsLatin,
  detectTranslationDirection,
  isTranslatableEnglishLine,
  isTranslatableHindiLine,
} from "./translationSource";

describe("translation source filtering", () => {
  it("detects Devanagari and accepts predominantly Hindi lines", () => {
    expect(containsDevanagari("Hello नमस्ते")).toBe(true);
    expect(containsLatin("Hello नमस्ते")).toBe(true);
    expect(containsLatin("नमस्ते")).toBe(false);
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

  it("accepts English lines and rejects Devanagari mixed into English filter", () => {
    expect(isTranslatableEnglishLine("Employee name and date")).toBe(true);
    expect(isTranslatableEnglishLine("नमस्ते")).toBe(false);
    expect(isTranslatableEnglishLine("Hello नमस्ते")).toBe(false);
  });

  it("picks one translation direction from detected lines", () => {
    expect(
      detectTranslationDirection([
        "आवेदन पत्र का प्रपत्र",
        "कर्मचारी का नाम",
        "FORM",
      ]),
    ).toBe("hi-en");
    expect(
      detectTranslationDirection([
        "PROGRAMME: Bachelor of Technology",
        "DISCIPLINE: Electronics and Communication Engineering",
        "CE 101",
      ]),
    ).toBe("en-hi");
    expect(detectTranslationDirection(["...", "123"])).toBeNull();
  });
});
