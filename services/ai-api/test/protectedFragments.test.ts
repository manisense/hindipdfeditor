import { describe, expect, it } from "vitest";

import { protectFragments, restoreFragments } from "../src/protectedFragments";

describe("protected translation fragments", () => {
  it("protects identifiers, names, URLs, emails, dates, amounts, filenames, and acronyms", () => {
    const source =
      "Seema Sharma sent REF-2026/07 and report-2026.pdf to support@hindipdfeditor.com on 22/07/2026 for ₹1,250.50 via PDF at https://hindipdfeditor.com/support/.";
    const protectedText = protectFragments(source);
    expect(protectedText.fragments.map((fragment) => fragment.value)).toEqual(
      expect.arrayContaining([
        "Seema Sharma",
        "REF-2026/07",
        "report-2026.pdf",
        "support@hindipdfeditor.com",
        "22/07/2026",
        "₹1,250.50",
        "PDF",
        "https://hindipdfeditor.com/support/",
      ]),
    );
    expect(restoreFragments(protectedText.text, protectedText.fragments)).toBe(
      source,
    );
  });

  it("rejects missing, duplicated, and invented placeholders", () => {
    const protectedText = protectFragments("Reference REF-2026/07");
    expect(() =>
      restoreFragments("Reference", protectedText.fragments),
    ).toThrow(/not preserved/);
    expect(() =>
      restoreFragments(
        `${protectedText.text} ${protectedText.text}`,
        protectedText.fragments,
      ),
    ).toThrow(/not preserved/);
    expect(() =>
      restoreFragments(`${protectedText.text} ⟦P99⟧`, protectedText.fragments),
    ).toThrow(/unknown protected fragment/);
  });
});
