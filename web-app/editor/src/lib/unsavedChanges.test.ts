import { expect, it } from "vitest";
import type { DocumentState } from "../state/editStore";
import { editSnapshot, hasUnexportedChanges } from "./unsavedChanges";
const doc: DocumentState = {
  sourceName: "private.pdf",
  pageCount: 1,
  legacyFontWarnings: [],
  pages: [
    {
      pageIndex: 0,
      widthPt: 612,
      heightPt: 792,
      backgroundImageUri: "",
      imagePxWidth: 1224,
      imagePxHeight: 1584,
      edits: [],
      ocrLines: [],
    },
  ],
};
it("ignores untouched files and OCR changes but protects authoring changes", () => {
  expect(hasUnexportedChanges(null, null)).toBe(false);
  expect(hasUnexportedChanges(doc, null)).toBe(false);
  const changed = structuredClone(doc);
  changed.pages[0].edits.push({
    type: "mask",
    id: "mask",
    page: 0,
    xPt: 1,
    yPt: 2,
    wPt: 3,
    hPt: 4,
    color: "#ffffff",
  });
  expect(hasUnexportedChanges(changed, null)).toBe(true);
  const snapshot = editSnapshot(changed);
  expect(hasUnexportedChanges(changed, snapshot)).toBe(false);
  changed.pages[0].edits[0].xPt = 5;
  expect(hasUnexportedChanges(changed, snapshot)).toBe(true);
  expect(hasUnexportedChanges(doc, snapshot)).toBe(true);
});
