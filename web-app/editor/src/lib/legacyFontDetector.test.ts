import { PDFDocument, PDFName } from "@cantoo/pdf-lib";
import { expect, it } from "vitest";
import { detectLegacyFonts, looksLikeLegacyDevanagariText } from "./legacyFontDetector";
it("rejects a referenced font with no inspectable name", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.node.set(
    PDFName.of("Resources"),
    doc.context.obj({ Font: { F1: { Type: "Font", Subtype: "Type1" } } }),
  );
  await expect(detectLegacyFonts(await doc.save())).rejects.toThrow(
    "font name",
  );
});
it("accepts an image/empty page with no referenced fonts and detects known legacy names", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  await expect(detectLegacyFonts(await doc.save())).resolves.toEqual([]);
  page.node.set(
    PDFName.of("Resources"),
    doc.context.obj({
      Font: { F1: { Type: "Font", Subtype: "Type1", BaseFont: "KrutiDev010" } },
    }),
  );
  await expect(detectLegacyFonts(await doc.save())).resolves.toEqual([
    { page: 0, fontName: "KrutiDev010" },
  ]);
});
it("recognises KrutiDev-encoded text but not English or Unicode Hindi", () => {
  expect(
    looksLikeLegacyDevanagariText(
      "rFkk dsUnz ljdkj ds deZpkfj;ksa dks le; le; ij ns; lkekU; HkÙkksa lfgr vLFkkbZ inksa dks Hkjus ds fy, vkWuykbu",
    ),
  ).toBe(true);
  expect(
    looksLikeLegacyDevanagariText(
      "Candidates are advised to visit the bank website regularly for details and updates on the recruitment.",
    ),
  ).toBe(false);
  expect(
    looksLikeLegacyDevanagariText("केन्द्र सरकार के कर्मचारियों को समय समय पर देय सामान्य भत्तों सहित"),
  ).toBe(false);
});
