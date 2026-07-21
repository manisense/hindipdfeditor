import {
  AI_API_VERSION,
  parseTranslationRequest,
  sourceLanguage,
  targetLanguage,
} from "@hindipdfeditor/translation-contract";

describe("shared translation contract", () => {
  it("resolves in the web build and validates both directions", () => {
    expect(sourceLanguage("hi-en")).toBe("hi");
    expect(targetLanguage("en-hi")).toBe("hi");
    expect(
      parseTranslationRequest({
        version: AI_API_VERSION,
        requestId: "web-request",
        direction: "en-hi",
        lines: [{ id: "line-1", page: 0, text: "Government of India" }],
      }).direction,
    ).toBe("en-hi");
  });
});
