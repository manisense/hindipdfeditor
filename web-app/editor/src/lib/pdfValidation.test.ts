import { PDFDocument } from "@cantoo/pdf-lib";
import { expect, it } from "vitest";
import { validatePdfBytes } from "./pdfValidation";
it("rejects empty, corrupt and wrong-page-count output", async () => {
  await expect(validatePdfBytes(new Uint8Array(), 1)).rejects.toThrow();
  await expect(
    validatePdfBytes(new Uint8Array([1, 2, 3]), 1),
  ).rejects.toThrow();
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  const bytes = await pdf.save();
  await expect(validatePdfBytes(bytes, 1)).resolves.toBeUndefined();
  await expect(validatePdfBytes(bytes, 2)).rejects.toThrow("page count");
});
