import { expect, it } from "vitest";
import { inspectFontsOrBlock } from "./fontInspectionPolicy";
it("blocks failed or inconclusive inspection instead of falling back to OCR", async () => {
  await expect(
    inspectFontsOrBlock(async () => {
      throw new Error("parse failed");
    }),
  ).rejects.toThrow("blocked");
  await expect(
    inspectFontsOrBlock(async () => [{ page: 0, fontName: "unknown" }]),
  ).rejects.toThrow("blocked");
  await expect(
    inspectFontsOrBlock(async () => [{ page: 0, fontName: "KrutiDev010" }]),
  ).resolves.toHaveLength(1);
  await expect(inspectFontsOrBlock(async () => [])).resolves.toEqual([]);
});
