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
- Exact positions in PDF to Word: left out (Word reflows). Ruled tables and pictures are carried over since 23 November 2026 (see the addenda below).
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
  - Scanned pages: see the scanned-tables addendum.
  - A text line that spans two cells goes to the cell holding its centre.
- **Checks:** gate case `WORD_TABLE_OK`. On the 31-page notice, 14 tables are rebuilt, including a two-level header and row merges.

## Addendum, 23 November 2026: pictures

PDF to Word carries pictures over.

- **What counts:** a painted image at least 40 pt tall and 24 pt wide (`pictureBoxes`): a logo, photo, stamp or signature. Smaller images are text-line candidates (ADR 0016). Images covering more than 85 % of the page are backgrounds (scans) and are skipped. Tiles of one picture are joined.
- **Cutting:** each picture is cut from one render of the page at 2 px/pt as a JPEG over white, so masks and transparency look as they do on the page.
- **Placing:** pictures are placed in reading order by their top edge, as their own paragraph, indented to their left edge, at their size (capped to the text width). A picture inside a ruled table goes into its cell.
- **Limits:** vector logos (drawn with paths) are not pictures, and text drawn over a picture stays as a paragraph beside it.
- **Checks:** gate case `WORD_PICTURE_OK`. On the 31-page notice, the CISF emblem comes through at the top of page 1.

## Addendum, 23 November 2026: tables on scanned pages

- **Finding the lines:** a scanned page has no drawn lines to read. When every line on a page came from OCR, `rulingsFromImage` looks for table lines in a render of the page at 2 px/pt.
  - It keeps long thin dark runs: horizontal ones at least 30 pt long, vertical ones at least 12 pt, up to 3 pt thick, with gaps up to 1.5 pt bridged.
  - Letter strokes are shorter, or touch no other line, so `detectTables` ignores them. That includes a Devanagari headline.
- **Reading the cells:** whole-page OCR runs a table row across its cells, so each cell is read on its own, 3 pt inside its borders. Both the Hindi and English models read every cell. Hindi wins when it found Devanagari letters (not just Devanagari digits) and is about as confident; otherwise the more confident reading wins.
- **Block mode:** cells and text-image rows (ADR 0016) are read by their own Tesseract workers in single-block mode (PSM 6). Page layout mode missed short items such as a lone "14". Separate workers keep the mode from leaking into full-page reads running at the same time.
- **Checks:** gate case `SCAN_TABLE_OK` (a 3×3 table on a page image, each value read into its cell). Tables without lines: see the next addendum.

## Addendum, 24 November 2026: tables without lines

- **Finding them:** `detectAlignedTables` (`alignedTables.ts`) looks at the page's lines after ruled tables are found. A table is three or more rows split into two or more pieces by gaps of at least one line height, with the gaps at the same x positions in every row. A single piece that fits in one column continues the row above (a wrapped cell). Rows more than 2.5 line heights apart end the table.
- **What is not a table:** a column whose pieces are typically longer than 40 characters (two-column page layouts, numbered paragraphs with a hanging indent), and a two-column block whose first column is only list markers (`9.1`, `(iv)`, `क)`). Missing a table is better than turning paragraphs into one: on the 31-page notice, a first version without these rules turned 19 numbered sections into tables.
- **Writing them:** cells are never merged; column edges sit in the middle of each gap. The Word table has no borders (`TableBorders.NONE`); ruled tables keep theirs (`DetectedTable.ruled`).
- **Rejected:** reading columns from OCR word boxes on scans. Tesseract runs a row across its cells as one line, so scans without lines stay paragraphs.
- **Checks:** gate case `WORD_ALIGNED_TABLE_OK` (a 3×4 table drawn without lines becomes a borderless Word table, one value per cell, text above and below in order). No borderless table turned up in 8 real sample PDFs, the 31-page notice among them: 67 ruled tables found, none added by mistake. No real file with a borderless table has been tested yet.
