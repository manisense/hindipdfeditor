# Web editor audit — 21 November 2026

Scope: the browser PDF editor in `web-app/editor` (Hindi and English editing). Method: read the editing pipeline end to end, then ran a **no-op edit test** on a real Bank of Baroda notice: replace four lines with their own unchanged text, export, and compare with the original.

Result of the no-op test before fixes: replacement text 1.5–2× too large and overlapping, table borders erased, font and bold/italic changed, OCR errors written in (थल्क for शुल्क, 2305.2025), file 922 KB → 6.4 MB.

Status column: open unless noted.

## Critical — the edited output is visibly wrong

| # | Issue | Evidence | Status |
|---|---|---|---|
| C1 | Replacement text too large on OCR-derived lines | Tesseract line boxes are ~10 pt for 8 pt text, 14–18 pt when a row number or border joins; `detectedLineTextGeometry.ts` sized font at 1.0–1.08× box height | Fixed in PR #7: verified pages take height from the PDF run; OCR lines use the median word band. No-op test on the Word and scanned copies now matches size |
| C2 | Edits are covered with flat-colour rectangles | `maskAndReplaceRegion` paints one averaged colour; erases table lines, underlines, stamps, watermarks; patches on scanned paper | Fixed (PR #8, #15): glyphs deleted from the content stream (incl. Type3); line-preserving eraser for scans |
| C3 | Export rasterises every page, even unedited ones | `exportPdf.ts`: html2canvas → JPEG 0.92 on top of a JPEG background; output not searchable/selectable/accessible, loses links/forms/bookmarks, ~7× larger | Fixed (PR #8): export from the original file; BoB 985 KB vs 6.4 MB |
| C4 | Editing one word redraws the whole line from OCR text | OCR mistakes in untouched words reach the document silently | Fixed (PR #11): only changed words are redrawn, spans snap to word gaps |

## Major

Status as of 21 November 2026: M1 fixed (PR #9, #10: Hind/Tinos/Arimo/Carlito/Caladea, bold/italic; faux bold (stroked text) repainted with the same stroke, PR #27); M2 fixed (PR #9: baseline alignment); M3 fixed (PR #13: shared pdf.js document, 150-page limit; lazy page rendering and an OCR queue that reads the page on screen first); M4 partly (Tesseract measured best; self-hosted models and a visible "OCR unavailable" notice open); M5 fixed (PR #13); M6 open (needs decision); M7 partly fixed (word-level done; a longer word pushes the rest of the line into blank space after it; a line that outgrows its column flows into the rest of its paragraph, PR #28); M8 fixed (PR #16). Replacement weight is matched from stroke thickness (light originals no longer get heavier text); width still differs where no metric-compatible font exists.

| # | Issue |
|---|---|
| M1 | Only Noto Sans/Serif Devanagari; original bold/italic/serif lost; English redrawn in Noto's Latin; no italic |
| M2 | Text box anchored at top with `line-height: normal`; new text can sit lower than the original line |
| M3 | Whole PDF re-parsed per call and never destroyed (`renderPage`, `getPageCount`); all pages rasterised to base64 JPEG up front; no page/size limit in Edit; export builds one giant HTML; single OCR worker, not cancelled on file change |
| M4 | Tesseract Hindi is weak on bold/italic/table text; models from a third-party CDN; no preprocessing; OCR failure is silent |
| M5 | Undo restores old detection results (pages detected after the last edit lose their boxes); no redo; mask↔text pairing kept outside history |
| M6 | KrutiDev pages fully blocked on web — common in government notices |
| M7 | Line-only editing; no word-level edit, no paragraph reflow |
| M8 | On broken pages, mixed Hindi+English lines are read by Hindi OCR only; English lines on degraded pages are not re-read |

## Moderate

Status: rotation-aware text (PR #13), password/damaged/long-file messages and translated error titles (PR #13), document IDs (PR #13), html2canvas removed (PR #9) and `EditPdfTool.tsx` partly split (`lineReplacement.ts`, `FindReplacePanel.tsx`) are done; pdf.js CMap/standard-font data open.

- Rotated pages (`/Rotate`): the horizontal-text check uses the pre-rotation transform, so text drops to OCR.
- Password-protected PDFs show a raw technical error.
- Errors are raw English strings (one-language-per-screen rule).
- Async results keyed by file name; a different file with the same name can receive stale lines.
- Hindi pages ready ~16 s later because of the OCR check; Add text waits for detection.
- html2canvas has had no release since 1.4.1 (2022).
- pdf.js CMap and standard-font data not configured.
- `EditPdfTool.tsx` is 1,449 lines (single-responsibility rule).

## Minor / missing

Status: find and replace (PR #15), Roman→Hindi typing (PR #14), labelled pager buttons and toolbar focus fix (PR #12, #14), whiteout and highlight tools (PR #24), images and signatures (PR #25), autosave (PR #26), in-editor page operations (PR #29) done; Hindi spell check open.

- No images, signatures, stamps, whiteout, highlight, alignment, underline, find-and-replace, Hindi spell check, Roman→Hindi typing, in-editor page operations, autosave.
- No check for characters the selected font lacks.
- Edit colour and font name interpolated into styles without validation (internal values, low risk).

## Solutions considered

| Targets | Approach | Technology | Notes |
|---|---|---|---|
| C3 | Keep original pages; overlay edits | `pdf-lib` `copyPages` / `embedPage` / `drawRectangle` + browser-rendered transparent PNG for new text | Local, Plan A, small files, untouched text stays vector and searchable. Biggest win per effort |
| C2 digital | Remove the original glyphs instead of masking | Own content-stream rewriter (pdf.js operator positions + pdf-lib), or MuPDF.js `applyRedactions` | MuPDF is AGPL or commercial; own code avoids that |
| C2 scans | Inpaint ink pixels, preserve long lines | Own algorithm, or OpenCV.js `inpaint` (Apache-2.0, ~8 MB) | |
| C1, M2 | Size and baseline from PDF runs; calibrated OCR ratio and word-box baselines; align with real font metrics | `opentype.js` / `fontkit` + own code | Add the no-op edit regression test |
| C4, M7 | Word-level diff edits; paragraph reflow mode | Own code on pdf.js runs / OCR word boxes | |
| M1 | Map PDF font names to open fonts (Hind→Hind, Mangal/Kokila→Noto, Calibri→Carlito, Cambria→Caladea, Arial/Times→Liberation/Arimo/Tinos); bold/italic from flags and shear | OFL/Apache fonts, pinned and verified per AGENTS.md | |
| M4 | Benchmark PaddleOCR PP-OCRv5 Devanagari in the browser; self-host models; preprocessing | `onnxruntime-web` + ppu-paddle-ocr or PaddleOCR.js (Apache-2.0) | Cloud OCR stays the consented upgrade |
| Broken ToUnicode | Repair the font's glyph→Unicode map by voting glyph IDs against OCR across the document | Own code | Makes the PDF's own text and geometry correct |
| M3 | Shared pdf.js document; destroy; render visible pages in a worker; Blob URLs; prioritised, cancellable OCR queue; cache per-font verdicts; limits; per-page export | Own code | |
| M5, moderate | Undo/redo with pairings; rotation-aware check; password prompt; Hindi errors; document IDs; split `EditPdfTool.tsx` | Own code | |
| Searchable edited text | (a) Chromium `page.pdf()` on Cloudflare Browser Rendering; (b) Plan B: harfbuzzjs shaping → glyph IDs with Identity-H + ToUnicode | | (a) changes the privacy claim; (b) is deferred Phase 5 and needs an explicit decision |
| M6 | Deterministic KrutiDev 010 → Unicode conversion, or Android's raster-only replacement mode on web | Own mapping table | AGENTS.md says "detect, never convert"; needs a decision |
| Leadership | Document-wide find and replace, Roman→Hindi and InScript typing, Hindi spell check, signatures/stamps/images, form filling, IndexedDB autosave | | |

Quality gate: a fixed corpus of real PDFs (Word exports, government notices, scans, KrutiDev, Chrome prints) with automated CER, no-op edit pixel/SSIM diff, export searchability and time-to-first-ready checks.

## Suggested order

1. Correct output: C1, no-op test, original pages + overlay export (C3), performance basics and limits, undo/redo, rotation, passwords, Hindi errors.
2. Native look: glyph removal, scan inpainting, word-level edits, font matching.
3. Accuracy: PaddleOCR benchmark, ToUnicode repair, paragraph reflow, Roman→Hindi typing, find and replace.
4. After decisions: Plan B vector text, KrutiDev conversion, server-side rendering.

## Open decisions

- Plan B (shaped glyph injection) — only fully local route to searchable, vector Hindi edits.
- Convert KrutiDev pages instead of blocking them.
- Own glyph-removal code vs MuPDF (AGPL/commercial).
- AGENTS.md names Android `Canvas.drawText()`; the web export already draws text through the browser canvas (html2canvas), which shapes Devanagari. Clarify the rule for web.

Sources: [ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr) · [PaddleOCR.js](https://www.paddleocr.ai/v3.5.0/en/version3.x/deployment/browser.html) · [PaddleOCR ONNX models](https://huggingface.co/monkt/paddleocr-onnx) · [MuPDF.js redactions](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/annotations/redactions/index.html) · [MuPDF licence](https://mupdf.readthedocs.io/en/1.27.0/license.html) · [Cloudflare Browser Rendering PDF](https://developers.cloudflare.com/browser-run/how-to/pdf-generation/) · [harfbuzzjs](https://harfbuzz.github.io/harfbuzzjs)
