# Our own solutions: what open source does not give us

Written 27 November 2026, after testing real government PDFs (Railway Recruitment Board notices made in Word with Nirmala UI, and a 135-page notice with a mis-mapped Hindi text layer). Companion to `docs/hard-problems-brief.md`. Owner direction: free tools stand on our own code; Sarvam is a later premium extra only.

The idea behind all of these: **a PDF carries far more truth than its text layer.** It carries the font program (outlines, cmap, GSUB shaping rules, glyph names), every glyph's exact position, and the same glyph repeated hundreds of times. Competitors read the text layer, and when it is broken they fall back to OCR of pixels. We can read the font itself.

## Evidence from today

| Page | Text layer | Editor PDF to Word today | Raw Tesseract | Raw Paddle | Font-derived (prototype) |
|---|---|---|---|---|---|
| RRB notice p2, Word + Nirmala UI, 141 words | 58.2 % | 64.5 % | 17.7 % | 64.5 % | **90.8 %** |
| Sample scan, 144 words | n/a | 99.3 % | 87.5 % | 94.4 % | n/a |

On the Word page the ToUnicode map is wrong (pre-base ि glyph → "व", थ → "ि", ण → "ड"), but the embedded font is intact: its own cmap says GID 0xF9 is `uni0916`, and its GSUB still holds the conjunct and reph rules. The prototype's remaining misses are its crude line splitting, not the method.

## Ideas, ranked by impact and evidence

### 1. Font forensics: read text from the font, not the text layer (problems 3, 5)
- For each embedded TrueType/OpenType font: build glyph → Unicode by reversing the font's own cmap, then GSUB (single, ligature and extension lookups, iterated to a fixed point) for half forms, conjuncts, reph and matra ligatures. Classify glyphs by the GSUB feature that made them (`rphf` reph, pre-base `ि` variants) and put them back in reading order.
- **Detection without OCR:** where font-derived Unicode and ToUnicode disagree on many glyphs, the text layer is mis-mapped. This is deterministic, so it fails closed only when the font gives no answer.
- Build: a small TypeScript reader for cmap (formats 4, 12) and GSUB (types 1, 4, 7); no new dependency. pdf.js gives exact glyph codes from the operator list; the original `FontFile2` bytes come from the PDF.
- Done when: RRB p2 reaches 100 % in PDF to Word with no OCR on that page.

### 2. Glyph-level OCR: classify each unique glyph once, by shape (problems 3, 5, and Skia/Type 3 files)
- **Evidence (27 Nov 2026):** Gazette of India PDFs (egazette.gov.in, iTextSharp) use subset fonts with no GSUB and a partial cmap, so the font cannot name its ि variants and ligatures, and the ToUnicode map names them wrongly. Production PDF to Word reads 81 % of a Gazette page's Hindi words. See `docs/autonomous-log.md`.
- When a font has no cmap or GSUB (Chrome/Skia Type 3 subsets, stripped fonts), render each **unique glyph** from its vector outline, cleanly and at any size, and identify it. A document has roughly 100–300 unique glyphs, used thousands of times. Classifying 200 clean, noise-free, isolated shapes is far easier and more reliable than OCR of whole pages, and the answer then holds everywhere that glyph is used.
- Identify by matching outlines against a reference library we render ourselves from open fonts (Noto, Mukta, Hind, Tiro, Kalam…), using outline features such as contours, normalised point sequences and perceptual hashes. Unknown shapes go to recognition of a single glyph image, then document-level voting (`glyphRepair.ts` already votes this way for unmapped glyphs).
- The same machinery identifies **which font** a document uses. That helps idea 5 and lets edits blend in.
- Legacy fonts (Chanakya etc.) could be decoded by shape instead of a licensed key map. AGENTS.md blocks this until the owner decides (brief problem 5).

### 3. Hindi-aware OCR decoding (problem 2)
- Paddle's recognizer gives a probability for every character at every step. Replace the greedy decoding with **CTC beam search constrained by a Hindi lexicon trie and a character n-gram model**, built from our own `public/dict` word list plus text from government notices. Most real errors (dropped matra, ब for व) produce words that are not in the dictionary; the beam fixes them for free.
- Combine engines line by line (ROVER-style voting) between Paddle and Tesseract, using per-character confidences, the lexicon and agreement.
- Preprocessing for small print: upscale only boxes whose line height is below about 30 px; deskew and remove stamps by colour (red and blue stamps sit over black text).

### 4. Our own recognition model, trained on synthetic and corrected data (problem 2)
- We can render unlimited labelled Hindi lines: our dictionary and notice text, in 30+ open Devanagari fonts, bold, table cells, 8–14 pt, with degradation modelled on real scans (blur, JPEG, speckle, skew, stamp overlays, photocopy contrast). Fine-tune PP-OCRv5's mobile Devanagari recognizer (Apache-2.0) on government-notice style.
- Data flywheel, opt-in only: lines users correct in the review notice become new training pairs with their consent. Nobody else has Hindi office-document data at this scale.
- Keep the model small (int8 under 10 MB) so it runs in the browser.

### 5. Edits typeset in the document's own font (problems 1, 6)
- Word-made PDFs often embed the font with GSUB (Nirmala UI here, 4,595 glyphs). Shape new text with HarfBuzz **using the PDF's own embedded font**, and write glyph IDs into that same font when every needed glyph is present. The edit then uses the original typeface, size and weight. Fall back to a matched open font (identified by idea 2), then to Plan A.
- Acrobat cannot do this for Hindi. It is the most visible "#1" difference a user sees.
- Needs the ToUnicode bug from the Plan B review fixed first: every written glyph needs a correct ToUnicode entry, and the export must read back exactly in pdf.js.

### 6. Structure from vectors and repetition (problem 4)
- **Status (27 Nov 2026):** shipped for PDF to Word: recursive XY-cut column detection on digital pages around detected tables (`xyCut.ts`, `wordLayout.ts`, `alignedTables.ts`), cross-page running header/footer detection and Word section header/footer output with page-number fields (`runningHeaders.ts`, `pdfToWord.ts`, `convertPdfToWord.ts`), structure scoring in `score.mjs` (reading order and `--repeated` header/footer leakage, tested in `score.test.mjs`), and a 3-page two-column Hindi/Latin fixture (`two-column-structure-fixture.pdf`) verified by `wordStructureCase` in the edit-quality gate. Not yet: cell-placement scoring in `score.mjs`, scanned-page column splitting.
- Digital PDFs give exact rulings, glyph positions and font sizes. Detect columns with an XY-cut on glyph boxes, headers and footers by repetition across pages (the same text at the same place on most pages), and tables from rulings, or from alignment when borders are missing. This is deterministic and fast, with no model.
- Score structure, not only words: extend `score.mjs` with reading-order and cell-placement checks.

### 7. Trust you can see
- **Status (27 Nov 2026):** first part shipped in the web editor ("N lines to check": OCR and unconfirmed lines, step through with Next / Edit / Done; font-repaired pages carry a one-line note). Not yet: per-line confidence, side-by-side page crops.
- Every line gets a provenance tag: read from the PDF, repaired from the font, or OCR (and with what confidence). The review notice shows only the lines that need eyes, side by side with the page image. This turns "AI guessed" into "checked against the file", which matters to users of official documents.

## Suggested order
1. Font forensics (1): evidence is strongest (58 % → about 91 % already), no dependency, fixes a common real-world failure.
2. The ToUnicode fix and read-back gate for Plan B, then edits in the document's own font (5).
3. Glyph-level OCR (2), which also covers Chrome/Skia and font identification.
4. Lexicon-constrained decoding (3), cheap and measurable on the OCR benchmark.
5. Synthetic training (4) once there are 10+ real scans with ground truth to measure against.
6. Structure (6), then the trust UI (7).

Each step needs a red benchmark result first, then green, as the brief requires.
