# Web editor — solutions research, 21 November 2026

Companion to `editor-audit-2026-11-21.md`. For every audit issue: the chosen solution, what was tried or rejected, and the evidence. Where no existing tool met the quality bar, the solution is our own code, and a prototype was built to prove it.

## Evidence from prototypes (scratch code, not in the product yet)

| Prototype | Question | Result |
|---|---|---|
| OCR shoot-out | Is a newer engine better than Tesseract for Hindi? | Known-truth A4 page, 8 pt, plain/bold/oblique rows in table cells, rendered at 2×. **Tesseract hin: CER 1.0 %, word recall 96.8 %. PaddleOCR PP-OCRv5 Devanagari: CER 2.5 %, recall 84.9 %** (splits words, e.g. "कि या"). Scan-like copy (60 % resolution, 0.9° tilt, JPEG q35): **Tesseract CER 1.7 %; PaddleOCR CER 40 %** (breaks on tilt). Keep Tesseract. |
| Glyph removal (digital) | Can we delete original text instead of painting over it? | Own content-stream editor (~120 lines: tokenizer, CTM/text-matrix tracking, deletes Tj/TJ whose origin falls in the box). Bank of Baroda title: 7 ops removed, 782 kept, **underline kept**. Table-cell date: 5 ops removed, **every table border kept**. File 922 → 931 KB. |
| Ink removal (scans) | Can we clean text off a scan without erasing borders? | Own line-preserving eraser: paper colour from the bright half of the box, ink = darker than paper − 25, dark runs longer than 1.5× box height (horizontal) or 0.8× (vertical) are kept as lines, other ink plus a 2 px halo replaced. **Top, bottom and side borders kept; text gone without traces.** The flat mask used today broke all three borders. |
| KrutiDev conversion | Is an existing converter accurate enough? | `@anthro-ai/krutidev-unicode` (ISC, port of LTRC kru2uni) on four CISF lines with known text: **66/69 words (96 %)**. Misses: `आॅ` → `ऑ` normalisation, one KrutiDev variant mapping `’` to श, one possibly genuine ending. Fixable with a small post-map. |
| No-op edit | Does replacing a line with itself keep its size? | After the C1 fix (PR #7): yes, on the Word PDF and its scanned copy. |

## Target pipeline

**Digital PDFs (have a text layer)**
1. Detect and verify text (done in PR #7); keep each line's link to its content-stream operators.
2. Edit by word: diff old vs new line text; only changed words are touched.
3. Remove the changed words' glyphs from the content stream (own rewriter; split `TJ` arrays at glyph boundaries using the font's `/Widths` or `/W` for word-level edits).
4. Draw the new words, baseline-aligned, in a matched font:
   - **Plan A (now):** browser renders the words (HarfBuzz shaping inside Chromium/Firefox/Safari) to a transparent PNG at 4× and it is placed with `pdf-lib` `drawImage`.
   - **Plan B (decision needed, Phase 5):** shape with harfbuzzjs, write glyph IDs with an Identity-H font and a ToUnicode map → vector, searchable, tiny.
5. Export: start from the original file; change only the edited pages' content streams and add image XObjects. Unedited pages stay byte-identical; links, forms, bookmarks survive.

**Scans (no text layer)**
1. Tesseract with word boxes, median word band for size (done).
2. Line-preserving ink removal in the edit box only.
3. Overlay one PNG patch (cleaned region + new text) on the original page image; the rest of the scan is untouched.

## Solutions per issue

| Issue | Solution | Rejected / why | Confidence | Effort |
|---|---|---|---|---|
| C1 size | Done: PDF run heights, median word band | Ratio-only tuning (fails on merged row numbers) | Proven | — |
| C2 masks (digital) | Own glyph-removal rewriter | MuPDF.js `applyRedactions` (AGPL or commercial licence); PDFium WASM (removal APIs not documented in JS) | Proven on BoB | 4–6 days incl. word-level `TJ` splitting, Type3/inline images, form XObjects |
| C2 masks (scans) | Own line-preserving eraser; optional quantised LaMa ONNX (37 MB, Apache-2.0) only for photos/backgrounds | MI-GAN/LaMa as default: 37–80 MB, not trained on documents, unpredictable on text | Proven on scan copy | 2–3 days |
| C3 export | Original file + per-page overlay (pdf-lib `copyPages`, content-stream edit, `drawImage`) | html2canvas whole-page raster (current); server Chromium `page.pdf()` (changes privacy claim) | High | 3–4 days |
| C4 OCR text baked in | Word-level edits: untouched words keep original glyphs/pixels | Line rewrite (current) | High | 3 days |
| M1 fonts | Font matcher: PDF `BaseFont`/flags → bundled OFL fonts. Hind→Hind, Mukta, Noto Sans/Serif Devanagari, Tiro Devanagari Hindi; Mangal/Nirmala/Arial Unicode MS→Noto Sans Devanagari; Kokila→Noto Serif Devanagari; Calibri→Carlito, Cambria→Caladea, Arial/Helvetica→Liberation Sans/Arimo, Times→Liberation Serif/Tinos. Bold from flags/name; italic from name or text-matrix shear (render with matching CSS skew) | Re-using embedded subset fonts (Devanagari subsets lack the new glyphs) | High | 3 days + font provenance/rasteriser checks per AGENTS.md |
| M2 baseline | Baseline from the PDF run (transform `f`) or OCR word bottoms; position text by the font's real ascent (opentype.js/fontkit metrics), not CSS `line-height: normal` | — | High | 1–2 days |
| M3 performance | One pdf.js document per file, `destroy()`; render visible pages only, in a worker (OffscreenCanvas); Blob URLs, not base64; OCR queue in a worker with priority and cancellation; cache "font set verified OK" so later pages skip OCR; page/size limits with a friendly message | — | High | 3–4 days |
| M4 OCR | Keep Tesseract (measured best); self-host worker/core/models; 3× upscale for text under ~9 pt; per-row recognition for skipped rows (done); visible message when OCR is unavailable | PaddleOCR v5 (worse on both pages above); Surya (no browser build, no Hindi benchmark found) | Measured | 2 days |
| Broken ToUnicode | Repair instead of bypass: per font, align glyph IDs in `TJ` strings with OCR clusters across the document, majority-vote each glyph's Unicode, rebuild the map; then the PDF's own text and geometry are correct on every page | — (no existing tool found) | Medium (R&D) | 5–8 days |
| M5 undo | History of edits only (not detection results); redo stack; mask↔text pairing stored in the edit itself | Snapshotting whole documents (current bug) | High | 1–2 days |
| M6 KrutiDev | Convert with the LTRC-derived map + our post-map fixes, verify each converted page against OCR, warn on mismatch | Blocking (current); downloading/decoding the legacy font | Measured 96 % → ~99 % expected | 2–3 days; **needs AGENTS.md change** |
| M7 paragraphs | Group lines into blocks (shared left edge, line pitch, font); paragraph mode reflows within the block width | — | Medium | 3–4 days |
| M8 mixed lines | Word-level script split: Devanagari words from Hindi OCR, Latin words from the PDF or English OCR | — | High | 1 day |
| Rotated pages | Apply the viewport rotation before the horizontal check | — | High | 0.5 day |
| Passwords | Catch `PasswordException`, prompt, pass the password to pdf.js and pdf-lib | — | High | 0.5 day |
| Hindi errors | Map every error to `useTx(en, hi)` messages | — | High | 1 day |
| Stale results | Per-open document ID instead of file name | — | High | 0.5 day |
| html2canvas | Removed by the overlay export (text rendered with Canvas 2D `fillText`, which shapes Devanagari in all major browsers) | — | High | part of C3 |
| `EditPdfTool.tsx` size | Split into detection hook, edit-session hook, toolbar, export controller | — | High | 1–2 days |
| Roman→Hindi typing | `@indic-transliteration/sanscript` with Hindi syncope (`ajay` → अजय) plus an InScript layout | Google Transliterate (online only) | High | 2 days |
| Hindi spell check | nspell + a Hindi Hunspell dictionary (check licence before bundling) | — | Medium | 2 days |
| Find and replace | Document-wide search on verified text; replace uses the word-level edit path | — | High once word edits land | 2 days |
| Signatures/images/whiteout | `pdf-lib` `drawImage`/`drawRectangle` overlays | — | High | 2–3 days |

## Quality gate

A fixed corpus in the repo (Word exports with broken maps, government notices with tables, scans, KrutiDev, Chrome prints, English-only, rotated, password-protected) and automated checks on every change:
- **No-op edit:** replacing text with itself must leave pixels outside the edited words unchanged and keep the edited words within a small SSIM threshold.
- **OCR CER** on known-truth pages.
- **Export:** unedited pages byte-identical; text of unedited lines still extractable; file-size ratio.
- **Time to first ready page.**

## Decisions needed

1. **Plan B** (shaped glyph injection) for searchable, vector edited text — AGENTS.md defers it to an explicit decision.
2. **KrutiDev conversion** instead of blocking — AGENTS.md currently says "detect, never convert".
3. Confirm own glyph-removal code over MuPDF (AGPL/commercial). Recommended: own code (proven above).

## Suggested order

1. C3 overlay export + glyph removal (digital) + line-preserving eraser (scans) — fixes C2 and C3 together.
2. Word-level edits (C4) + font matching (M1) + baseline (M2) + no-op quality gate.
3. Performance (M3), undo/redo (M5), rotation, passwords, Hindi errors, document IDs, split `EditPdfTool.tsx`.
4. ToUnicode repair, paragraph reflow, Roman→Hindi typing, find and replace, spell check.
5. After decisions: Plan B, KrutiDev conversion.

Sources: [quantised LaMa ONNX 37 MB](https://huggingface.co/othytenk/lama-int4-int8) · [MI-GAN in the browser](https://dev.to/martindelophy/removing-video-watermarks-entirely-in-the-browser-with-mi-gan-onnx-runtime-web-and-webgpu-1jdi) · [ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr) · [OCR engine comparison](https://withinnoise.dev/blog/posts/ocr-benchmark/) · [Open-source OCR for low-resource languages (Tesseract 93 % Hindi)](https://aclanthology.org/2024.icon-1.48.pdf) · [MuPDF.js redactions](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/annotations/redactions/index.html) · [MuPDF licence](https://mupdf.readthedocs.io/en/1.27.0/license.html) · [EmbedPDF PDFium](https://www.embedpdf.com/docs/pdfium/introduction) · [harfbuzzjs](https://harfbuzz.github.io/harfbuzzjs) · [krutidev-unicode](https://npmjs.com/package/@anthro-ai/krutidev-unicode) · [libindic conversion maps](https://github.com/libindic/unicode-conversion-maps) · [Sanscript](https://unpkg.com/@indic-transliteration/sanscript@1.3.3/README.md)
