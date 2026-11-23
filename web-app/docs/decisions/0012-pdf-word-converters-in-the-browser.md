# 0012 — PDF ↔ Word conversion runs in the browser

Date: 23 November 2026

## Decision

**PDF to Word** (`/tools/pdf-to-word/`) reads every page with the editor's own text detection
(`detectTextLines`: the PDF's text layer where reliable, Hindi checked against OCR with unmapped
glyphs repaired, KrutiDev converted, OCR for scans and unconvertible legacy fonts), groups the
lines into paragraphs (`wordLayout.ts`: rows joined, size, bold, centring, indent, spacing) and
writes a `.docx` with `docx` 9.15.3 (MIT): one section per PDF page with its size, Hindi in the
complex-script font Nirmala UI.

**Word to PDF** (`/tools/word-to-pdf/`) lays the `.docx` out with `docx-preview` 0.4.1
(Apache-2.0), mapping Office fonts to the bundled metric-compatible ones (Calibri → Carlito,
Cambria → Caladea, Arial → Arimo, Times New Roman → Tinos) and Devanagari to Noto. It offers two
outputs:

- **Download PDF**: each page captured with `html-to-image` 1.11.13 (MIT) and placed as a JPEG with
  pdf-lib; sections longer than a page are cut at blank rows (`pageCuts.ts`). Looks like the
  preview; text is not selectable.
- **Print / Save as PDF**: the same layout in a print frame with `@page` sized to the document,
  for the browser's "Save as PDF" — real, selectable, browser-shaped text.

Dependencies are pinned to exact versions at least two weeks old; `npm audit` reported none.

## Why

- Files stay on the device, matching the rest of the site; no server conversion service.
- Plan A: Devanagari is only ever shaped by the browser. pdf-lib's `drawText` is never used for it,
  so a vector PDF with Hindi text can only come from the browser's own print pipeline.
- Reusing the editor's detection gives the converter the same Hindi accuracy (glyph repair,
  KrutiDev, OCR) without a second implementation.

## Rejected

- Server-side LibreOffice: best fidelity, but documents would leave the device.
- `mammoth` for Word to PDF: semantic HTML without page size or layout.
- Rebuilding images in PDF to Word: left out. Ruled tables are rebuilt since 23 November 2026 (see the addendum below).
  and stated on the tool page.

## Addendum, 23 November 2026: ruled tables

PDF to Word rebuilds ruled tables as Word tables.

- **Ruling lines:** these come from the page's operators (`pdfRulings.ts`): stroked straight segments and filled thin rectangles (up to 3 pt thick, at least 4 pt long), following save/restore, `cm` and form XObjects.
- **Grid (`tableDetect.ts`):** collinear pieces are joined (Word draws borders cell by cell). Crossing lines form a grid. A missing inner border, under 70 % drawn, merges the cells on both sides; only rectangular merges are kept. A lone box (one cell) is a frame, not a table.
- **Text into cells:** each text line goes to the cell holding its centre. A cell's lines become its paragraphs, indented from the cell's own edge.
- **Word output:** the table carries fixed column widths, at-least row heights, `gridSpan` and `vMerge`, and the table's indent. Paragraphs above, between and below tables keep their order.
- **Picture text:** text drawn as images is never joined across a vertical table border, so each header word lands in its own cell.
- **Limits:**
  - Tables aligned only by spaces, without lines, are not detected.
  - Scanned pages have no drawn lines, so their tables stay as paragraphs.
  - A text line that spans two cells goes to the cell holding its centre.
- **Checks:** gate case `WORD_TABLE_OK`. On the 31-page notice, 14 tables are rebuilt, including a two-level header and row merges.

