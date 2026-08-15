import { buildTranslationLinesWithContext } from "./translationContext";

describe("translation context", () => {
  it("adds the adjacent detected lines without translating those context lines", () => {
    const orderedPageLines = [
      { id: "heading", text: "भारत सरकार" },
      { id: "label", text: "कर्मचारी का नाम" },
      { id: "hint", text: "Name as recorded in service book" },
    ];

    expect(
      buildTranslationLinesWithContext(2, orderedPageLines, [
        orderedPageLines[1]!,
      ]),
    ).toEqual([
      {
        id: "label",
        page: 2,
        text: "कर्मचारी का नाम",
        contextBefore: "भारत सरकार",
        contextAfter: "Name as recorded in service book",
      },
    ]);
  });

  it("keeps context across request batch boundaries", () => {
    const orderedPageLines = Array.from({ length: 42 }, (_, index) => ({
      id: `line-${index}`,
      text: `Line ${index}`,
    }));

    const result = buildTranslationLinesWithContext(
      0,
      orderedPageLines,
      orderedPageLines,
    );
    const batches = [result.slice(0, 40), result.slice(40)];

    expect(batches[0]?.[39]?.contextAfter).toBe("Line 40");
    expect(batches[1]?.[0]?.contextBefore).toBe("Line 39");
  });

  it("normalizes and caps context while preserving source text and inputs", () => {
    const longContext = `  ${"x".repeat(450)}\n`;
    const orderedPageLines = Object.freeze([
      Object.freeze({ id: "before", text: longContext }),
      Object.freeze({ id: "source", text: "  आवेदन पत्र  " }),
    ]);

    const [result] = buildTranslationLinesWithContext(4, orderedPageLines, [
      orderedPageLines[1]!,
    ]);

    expect(result).toMatchObject({
      id: "source",
      page: 4,
      text: "  आवेदन पत्र  ",
    });
    expect(result?.contextBefore).toHaveLength(400);
    expect(orderedPageLines[0]?.text).toBe(longContext);
  });

  it("omits context for a source line absent from the detected page", () => {
    expect(
      buildTranslationLinesWithContext(
        1,
        [{ id: "known", text: "Known" }],
        [{ id: "missing", text: "लापता" }],
      ),
    ).toEqual([{ id: "missing", page: 1, text: "लापता" }]);
  });
});
