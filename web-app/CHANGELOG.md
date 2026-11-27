# Changelog

## Glyph repair: OCR joiners no longer block confirmation, 27 November 2026

### Fixed
- A word repaired from OCR (`glyphRepair.ts`) is kept only when OCR of its line contains it; Tesseract writes words such as दिल्‍ली with a zero-width joiner the PDF does not have, so correct repairs were rejected and their rows re-read by OCR. The check (`ocrConfirmsRepair`) now ignores zero-width joiners and spaces on the OCR side. Benchmarks unchanged; part of the Gazette of India work (see `docs/autonomous-log.md`).

## Devanagari PDF extraction: corpus mapping fixes, 27 November 2026

### Fixed
- Review (built by Gemini 4 Neon, reviewed and re-verified here): Neon's separate fix for phantom spaces after half forms was left out, since the pdf.js patch (ADR 0023) already removes them (CAG c11: splits after virama 10 → 0 without it). Restoring drawn spaces that pdf.js leaves out first split उम्मीदवारों, स्क्राइब and अनुलग्नक on CEN 08/2024 (Chrome draws typed joiners after half forms as spaces), so a left-out space is restored except right after a half form. Corpus (first 6 pages, files outside git): Gazette Mangal c3 backwards rakar 24 → 0 and unknown words 17 % → 12 %; Pdftools c10 unknown words 60 % → 14 %; RRB 01/2026 unchanged; CEN 08/2024 gains 17 dictionary words (मानक फिटनेस, स्वस्थ करना, and एसडी (बिना एन/एल डीएफ) no longer swallows a neighbouring cell). Benchmarks unchanged.
- **`/ActualText` with `#XX`-escaped BDC tags and omitted drawn spaces (`pdfActualText.ts`, ADR 0022 amendment):** `markedContentStarts` now decodes `#XX` hex escapes in PDF Name tags (such as `/Normal#20#28Web#29 → Normal (Web)`) so `drawnGlyphs` matches pdf.js's decoded tags and applies `/ActualText` spans on Pdftools SDK exports instead of falling back to their polluted ToUnicode maps; `applyActualText` also preserves drawn space glyphs that pdf.js deduplicated against preceding control-byte matras (`0x0A`). Pdftools SDK corpus file `c10.pdf` (first 6 pages): unknown Hindi words 144 / 213 (67.6 %) → 25 / 174 (14.4 %, all 25 valid proper nouns, abbreviations, or out-of-dictionary Hindi terms; 0 garbled words).

- **Rakar mapped backwards (`fontGlyphText.ts`, `pdfToUnicodeRepair.ts`, ADR 0022 amendment):** OpenType `deva` v1 `blwf` rules (`[र, ्] → rakar`) are now read as `"्र"` (and `vatu` `[half(C), rakar]` as `C्र्`) rather than `"र्"`, and `repairedToUnicode` now catches and repairs ToUnicode maps that map a rakar glyph or rakar conjunct backwards as `"र्"` while leaving real `rphf` reph glyphs on `REPH_MARK`. Gazette corpus file `c3.pdf` (first 6 pages): backwards-rakar words 136 → 0 (unknown Hindi words 366 → 287 of 2083).

## Text extraction: pdf.js measures Devanagari conjuncts, 27 November 2026

### Fixed
- pdf.js 5 counted any glyph whose text contains a combining sign (क्ष, त्र, प्र, हु) as a zero-width mark: it measured it as 0 wide and skipped its line-break check. Line boxes came out short (Gazette of India lines by up to 50 pt, so OCR crops missed line ends) and words split inside conjuncts in PDF to Word (व्य क्ति, उम् मीदवारों, प्र माण). `editor/scripts/patch-pdfjs.mjs` (postinstall) anchors the pattern as pdf.js 6 does (web ADR 0023). The line-start workaround from PR #96 is removed. Gazette page 81.0 % → 82.1 %; whole RRB and CEN files read more dictionary words; benchmarks otherwise unchanged. The glyph-repair gate case now expects the fixture's whole label row, which pdf.js used to cut after "क्ष".

## PDF to Word: two-column XY-cut layout and running headers/footers, 27 November 2026

### Added
- Review (built by Gemini 4 Neon, re-verified here on real files outside git): RRB 01/2026 (38 pages) loses no word and gets page numbers in the Word footer; a Gazette of India notice writes its English running header once (2 duplicate copies gone, Hindi header kept in the body); CEN 08/2024 (135 pages) loses no word, and its two-box candidate/scribe form now reads box by box instead of interleaved. Its running footer is not detected: the English and Hindi halves each use their own footer, so neither reaches half the pages. Word recall and reading order unchanged on CEN p70, RRB p2, the notices and the Gazette page.
- **Recursive XY-cut column detection on digital pages (`xyCut.ts`, `wordLayout.ts`, `alignedTables.ts`):** digital pages with side-by-side columns are now split at the widest empty vertical gaps (with horizontal cuts isolating full-width titles, dividers, and detected tables) so columns read column by column and paragraphs never join across the gutter. Narrow multi-column prose is rejected by `detectAlignedTables` so it is not misclassified as a borderless table, while ruled and aligned tables remain intact.
- **Cross-page running headers and footers (`runningHeaders.ts`, `pdfToWord.ts`, `convertPdfToWord.ts`):** lines whose digit-normalised text repeats at about the same place in the top or bottom 12 % of at least 3 pages and at least half of the converted pages are omitted from the body and written once into Word's section header/footer (`Header`, `Footer`, and `PageNumber.CURRENT` for incrementing page numbers), or dropped from the body when digits vary irregularly. Unique lines are never dropped.
- **Structure benchmark and browser gate (`score.mjs`, `score.test.mjs`, `make-two-column-fixture.mjs`, `edit-quality-gate.mjs`):** extended `score.mjs` with reading-order pair retention and `--repeated` header/footer leakage counting, generated a 3-page two-column Hindi/Latin fixture (`two-column-structure-fixture.pdf`, reading order 59.1 % → 100.0 %, body header/footer leakage 6 → 0, Hindi recall 100.0 %; `notice-digital.pdf` unchanged at 100.0 % recall / 100.0 % reading order; `notice-scanned.pdf` unchanged at 97.9 % recall / 76.9 % reading order), and added `wordStructureCase` to the default edit-quality gate.

## Glyph repair: ि before the anusvara, 27 November 2026

### Fixed
- A pre-base ि learned from OCR (`glyphRepair.ts`) was put at the start of the next syllable, after a ं ँ or ः that ends its own, so हिंदी (drawn ि ह ं द ी) came out हंिदी. It now goes after the consonants and before those signs. First of several fixes found on Gazette of India PDFs (see `docs/autonomous-log.md`); benchmarks unchanged (CEN p70 620/620, RRB p2 141/141, notice 100 % / 99.3 %, Gazette page 81.0 %).

## Plan B trial: typeset Hindi edits in the document's own embedded font, 27 November 2026

### Added
- Review fix: the own font is used only when the edit keeps its weight (bold or not, from OS/2 usWeightClass) and serif style (PANOSE); an edit the user turns bold or sets in the serif face gets the bundled font they chose. Built by Gemini 4 Neon, reviewed and re-verified here (gate 26/26 with Plan B, 24/24 without).
- **Own-font typesetting inside the opt-in Plan B trial (`?planB=1` / `hpe.export.vectorText`, off by default; ADR 0021 amendment):** when an edit replaces a run drawn with an embedded TrueType/OpenType CID font (`Type0` / `CIDFontType2` / `Identity-H`, `FontFile2`), Plan B now inspects and shapes the replacement directly in that embedded font (`ownFont.ts`, `contentStreamText.ts`, `pdfTextRemoval.ts`, `pdfVectorText.ts`, `exportPdf.ts`) instead of adding bundled Noto Sans Devanagari.
- Strict fail-closed checks fall back unchanged to the bundled Noto Plan B path whenever the embedded font lacks active `GSUB` Devanagari features (`deva`/`dev2`), sets OS/2 `fsType` bit 1 (restricted licence), produces `.notdef` (GID 0), or omits a needed glyph outline (or composite component outline) in `glyf`/`loca`.
- Emits a new `Type0` / `CIDFontType2` / `Identity-H` font object (`HpeOwn*`) that reuses the original `FontFile2` indirect stream reference without modifying the original font dictionary, with `/W` widths from `hmtx`, a complete `ToUnicode` CMap for every written GID, and word-level `/ActualText` spans.
- Added unit tests (`ownFont.test.ts`, `contentStreamText.test.ts`), a synthetic retained-GID subset fixture generator (`make-subset-own-font-fixture.mjs`), and a `PLAN_B=1` edit-quality gate case (`planBOwnFontCase`) covering both own-font reuse and missing-glyph fallback.

## Editor: lines to check, 27 November 2026

### Added
- When a page's text was read by OCR, or is PDF text that OCR could not confirm, the editor shows "N lines to check" under the tools. It steps through those lines top to bottom: each is outlined on the page and scrolled to the middle, and a card at the bottom of the screen shows its text, where it came from ("Read by OCR from the page image. Check names and numbers."), Next, Edit this line and Done. Pages read straight from the PDF show nothing. Pages whose Hindi was read through fonts repaired from themselves (web ADR 0022) say so in one line instead: that text is exact, and listing every line would be noise (RRB p2: all 73 Hindi lines; the word list lacks too many formal words to pick some out). New gate case `lineCheckCase`.

### Fixed
- Repaired fonts were recorded under their escaped PDF names (`Nirmala#20UI`), so they never matched pdf.js's names; they are now decoded.

## PDF to Word: empty boxes are reported, not read as letters, 27 November 2026

### Fixed
- Some Word PDFs draw Hindi with a font that has no Devanagari, so the page shows empty boxes (the font's glyph 0) while the text map names each box "अ" or "क"; PDF to Word wrote "अअअअ…" for them. Such boxes are now left out of the text, and PDF to Word says which pages show boxes and that the text is not in the file (ask the sender for the original). RRB 01/2026: pages 4, 21–22, 25, 30, 32–35 reported, no "अअअ"/"ककक" left; CEN 08/2024 (135 pages) nothing reported. Benchmarks unchanged (CEN p70 620/620, RRB p2 100 %, sample notice 100 % / 99.3 %). Web ADR 0022 amended.

## Text extraction: ि stays outside conjuncts split across text items, 27 November 2026

### Fixed
- When a pdf.js text item ended inside a conjunct after a pre-base ि (व्य ि क् | तयों, drawing-order fonts, web ADR 0022), the first reordering pass, which runs on each item, put ि after the half form alone and gave व्यकि्तयों. A cluster cut off after a virama or nukta is now left for the pass over the whole line. A full-document scan of CEN 08/2024 (135 pages) found 25 such words on 24 lines (व्यक्तियों, रिक्तियों, सिक्किम, नियुक्ति, मस्तिष्क); all are now right, and no other line changed. RRB 01/2026 (38 pages) is unchanged; CEN p70 620/620, RRB p2 100 %, sample notice 100 % / 99.3 %.

## Text extraction: ligatures that start a line stay on it, 27 November 2026

### Fixed
- pdf.js treats any glyph whose text holds a combining sign (a ligature read from the font, such as प्र) as a zero-width mark and skips its line-break check, so when such a glyph starts a line it is left at the end of the line above ("भर्ती प्र" / "क्रिया"). `drawnGlyphs` now notes the first glyph drawn after the text matrix moves to another line (more than half the font size), and `applyActualText` moves such a glyph, with what follows it in that item, to the start of the next item. CEN 08/2024 page 70: 619 → **620 / 620** Hindi words, no extra words (a line wrongly split after उपलब्ध is also whole again). RRB p2, the sample notice (digital and scan) are unchanged.

## PDF to Word: no false joins before a danda, 27 November 2026

### Fixed
- Joining Hindi words split by a gap (repaired fonts, web ADR 0022) judged the letters at the gap together with a following danda, so "अपेक्षित है।" was tested as "अपेक्षितहै।", which the spell checker does not judge, and became one word. Danda and Devanagari digits no longer count as letters there. CEN 08/2024 page 70, all 620 Hindi words (ground truth outside git, built from where the font path and Tesseract agree, disagreements checked on the page image): 615 → 619. RRB p2, the sample notice (digital and scan) and the checked part of p70 are unchanged.

## OCR benchmark: per-line vote between engines, 27 November 2026

### Added
- `web-app/benchmark/rover.mjs`: for each line PaddleOCR (with lexicon decoding) finds, the Tesseract words inside the same box form a second reading, and the reading with more words from the editor's Hindi word list wins (a tie keeps Paddle); Tesseract lines outside every Paddle box are kept. `ocr-bench.mjs` reports it as "Vote (per line)". Same three pages: sample scan 98.6 % (best single engine 96.5 %), RRB render 70.2 % (68.8 %), CEN render 98.1 % (Tesseract 99.4 %); all pages 89.4 % vs 86.7 %, with no more extra words than either engine. It costs both engines' time. Benchmark only; the editor still uses Tesseract.

## OCR benchmark: dictionary-weighted decoding, 27 November 2026

### Added
- `web-app/benchmark/paddleOcr.mjs` gains `ctcBeamDecode`: CTC prefix beam search (8 readings, 6 likeliest classes a step) that adds a bonus when a reading completes a word from the editor's Hindi word list, with no penalty for unknown words. `ocr-bench.mjs` now reports Tesseract, Paddle and Paddle + lexicon. On three pages (the sample scan, and renders of the RRB contents page and part of a CEN 08/2024 page; the last two are digital pages, not scans): Tesseract 69.7 %, Paddle 84.0 %, Paddle + lexicon 86.7 % of Hindi words; the lexicon helped on every page (+2.1, +4.3, +1.9 points) at about 1.3× the decoding time. Tesseract stays best on the clean CEN render (99.4 %), so per-line voting between engines is the next step. Benchmark only; the editor still uses Tesseract.

## Hindi from Chrome PDFs merged by other tools, 27 November 2026

### Fixed
- PDFs printed from Chrome and then merged (PDFsam and similar tools drop the "Skia" producer) gave Hindi in drawing order with conjuncts missing, so the editor read them with OCR: 17 s a page and whole phrases lost. The text is now read from the embedded font and put in reading order (web ADR 0022 amendment). On a Railway CEN 08/2024 notice page: 160 hand-checked words 88.8 % → 100 %, 621 Hindi words read instead of 492, 1.8 s instead of 17.2 s.

## Opt-in Plan B vector Hindi text export (web trial), 27 November 2026

### Added
- Opt-in **Plan B** vector text export for the web editor (`vectorTextFlag.ts`, `ttfMetrics.ts`, `harfbuzzWasm.ts`, `pdfVectorText.ts`; web ADR 0021). Off by default; enable with `?planB=1` on the editor URL or `localStorage['hpe.export.vectorText'] = 'on'`.
- Shapes edited and added Devanagari/Latin lines in `NotoSansDevanagari` and `NotoSerifDevanagari` with `harfbuzzjs@1.6.4` (MIT, WASM), subsets and instances variable fonts into static TrueType subsets with `harfbuzz-subset.wasm`, embeds them as `Type0` / `CIDFontType2` / `Identity-H` with a `ToUnicode` CMap, writes 2-byte glyph IDs via `TJ`/`Ts` (never string-based `drawText()`), and wraps multi-glyph/multi-codepoint words in `/Span << /ActualText <FEFF...> >>` for exact copy and search.
- Keeps today's Plan A transparent-PNG export as the default and automatic fallback for WOFF2-only matched fonts (`Arimo`, `Tinos`, `Carlito`, `Caladea`, `Hind`), `.notdef` glyphs, or WASM load errors; zero HarfBuzz assets are fetched when the switch is off.
- Checked locally against the built site (`web-app/dist`, strict CSP): all 24 edit-quality gate cases passed with `PLAN_B=1`, including `planBDevanagariCase` on `devanagari-fixture.pdf` (`pdftotext` matched both full edited canonical lines with conjuncts, pre-base `ि`, reph, and `ृ` GPOS offsets; `pdffonts` confirmed newly embedded `CID TrueType` `Identity-H` subset with `ToUnicode`; `pdf.js` vs Poppler `pdftoppm` diff 0.958 % raw / 0.0199 % structural within 1 px). Not yet verified on live Cloudflare Workers deployment.

## Hindi text from Word files with a broken text map, 27 November 2026

### Fixed
- Word files passed through iLovePDF (seen on Railway Recruitment Board notices) map many Hindi glyphs to the wrong letters, so the editor fell back to OCR, which misread tables and left cells empty. The editor now reads each glyph from the embedded font itself (its cmap and shaping rules) and uses that text when the file's own map contradicts the font (web ADR 0022). The file itself is never changed. PDF to Word on a contents page with a table: 64.5 % → 100 % of 141 Hindi words, twice as fast.
- Words split after प्र, क्र and before vowel signs in Word files are kept whole.
- `mobile-app/fixtures/mismapped-tounicode-fixture.pdf` (built by `web-app/scripts/make-mismapped-fixture.mjs` from our own fixture text) has a deliberately wrong ToUnicode map and no /ActualText; a unit test checks the editor reads it from the font. Ligature glyphs now take their full letters (ें was read as ं).

## OCR engine benchmark: Tesseract against PaddleOCR, 27 November 2026

### Added
- `web-app/benchmark/ocr-bench.mjs` compares the editor's OCR engine (tesseract.js, `hin` 4.0.0 best_int) with PaddleOCR PP-OCRv5 Devanagari (official Apache-2.0 ONNX exports, 4.8 MB detector and 7.9 MB recognizer, on onnxruntime-web 1.30.0) on scanned pages listed in `ocr-set.json`, scored with `score.mjs`. Models are fetched by `download-ocr-models.mjs`, pinned to a commit and checked by SHA-256; they are git-ignored. The Paddle pre- and post-processing is plain JS (`paddleOcr.mjs`, unit-tested), so the same code can run in the browser.
- First result, on the one scanned sample page at 200 dpi, raw page OCR with no re-reads: Tesseract 87.5 % (126/144), Paddle 94.4 % (136/144); 300 dpi gives 87.5 % and 91.0 %. Paddle takes about twice as long per page (3.8 s against 1.9 s on an M-series Mac in Node). The editor's full pipeline, which re-reads lines and table cells with Tesseract, already gets 99.3 % on this page, so a raw-engine win does not yet show an end-to-end gain.
- Paddle's default line padding (unclip 1.5) dropped letters: the recognizer has one character slot per 8 px of a 48 px tall crop, and a dense Hindi line has more code points than that. Padding 0.6 is used; it was tuned on this one page.
- Not done yet (brief problem 2): the set has 1 page, not the 10 real scans the check needs, and Paddle is not wired into the editor. Shipping 12.7 MB of models needs the owner's decision.

## Installable app and sharing files into it, 27 November 2026

### Added
- The site is an installable web app (`manifest.webmanifest`, `sw.js`; web ADR 0020). On Android, the installed app appears in the share sheet for PDFs, images and .docx files; shared files open on `/share/`, which offers the tools that fit, and the chosen tool opens with the file loaded. Files stay in the browser's storage until a tool takes them, or an hour. The service worker caches nothing.
- Privacy pages (English and Hindi) list the shared files kept in browser storage.
- Checked in Chrome on the production Worker: no manifest or installability errors in a normal profile; a multipart POST to `/share-target/` reached `/share/` with ten PDF tools; Compress and Edit PDF opened the shared PDF, JPG to PDF took two shared images; the file was gone afterwards; with service workers blocked the Worker redirected to `/share/?error=receive`. The Android share sheet itself needs a real phone.

## Photo and signature resizer for forms, 27 November 2026

### Added
- `/tools/resize-photo-signature/`: makes a JPG of the width and height a form asks for (cm at a chosen dpi, written into the JPEG, or pixels) inside a KB range. It crops the edges at a chosen position or keeps the whole image with a white border, and picks the best JPEG quality under the largest size (binary search). When the range cannot be reached at that size it says which way and gives the closest file. Signature mode turns light paper white and darkens the ink. No exam presets: limits differ by notice and year, and official notices could not be checked.
- Checked in Chrome on the production Worker: 3.5 × 4.5 cm at 200 dpi gave 276 × 354 px, 48.5 KB within 20–50 KB, 200 dpi in the file; a 2 KB limit was reported as unreachable; a signature on grey paper came out 350 × 150 px, 12.5 KB, paper pure white; Hindi screen at 360 px without overflow.

## PDF to JPG and JPG to PDF, 27 November 2026

### Added
- `/tools/pdf-to-jpg/`: chosen pages (or all, up to 300 at a time) as JPG or PNG at 150 or 300 dpi, drawn by pdf.js in the browser; one page downloads as an image, several as a ZIP with names in page order. Long sides are capped at 8,000 px.
- `/tools/jpg-to-pdf/`: up to 200 JPG, PNG or WebP images into a new PDF, one per page, reordered with arrows, on A4 (turned to suit each image, scaled down to fit a 10 mm margin) or at image size (96 px per inch). JPG and PNG are embedded unchanged; WebP and phone photos with an EXIF turn are re-encoded as JPG so they come out upright. The output is parsed back before download.
- The file picker takes images (`kind="image"`); `ChoiceChips` and `moveItem` are shared by the tools.
- Checked in Chrome on the production Worker: order, both page sizes, EXIF orientation 6 upright, ZIP of 3 pages, single 300 dpi PNG, page range error, Hindi screens at 360 px; smoke passes.

## Fixes found by the Hindi benchmark sample, 27 November 2026

A one-page sample notice (`web-app/benchmark/`, conjuncts, reph, nukta, a ruled table, English words) is now scored by `score.mjs`: the share of its 144 Hindi words a tool gets exactly right. Running PDF to Word on it found four bugs. PDF to Word on the digital copy went from 94.4 % to 100 %; on the scanned copy (0.6° turn, blur, speckle) from 80.6 % to 99.3 %.

### Fixed
- Chrome "Save as PDF" and other Skia files: words were split after conjuncts (प्र|बंधन, उच्च|तर), sometimes onto two lines, because pdf.js measures some Type 3 ligature glyphs too narrow. On pages that draw their spaces, a Hindi run with no space after it now needs a 3 em gap to start a new column and a 1 em gap for a word break. Drawn spaces are now read on every Skia page, not only pages with `/ActualText`.
- Scanned tables on a slightly turned page were not found: a long ruling drifts across rows, and its whole drift was counted as thickness. Thickness is now measured across the line at each point. Rulings that reach the image edge are no longer dropped.
- Scanned table cells picked up their borders and speckle as letters (। ० : का) and lost digit-only cells (10:00). Cell crops now have their borders, the borders' grey halo and faint edge lines whitened, and short unsure words at a cell's ends are dropped; the confidence is judged on the words kept.
- English OCR replaced Hindi lines it had read as Latin gibberish whenever its confidence was higher, even at 4 against 0, or when it was sure only of a mixed line's English words. It now needs at least 60 and 80 % of its words sure.

## Guides for Mangal ↔ Kruti Dev conversion, 27 November 2026

### Added
- Two hand-written guides, an English/Hindi pair: `mangal-to-kruti-dev-converter` and `mangal-se-kruti-dev-kaise-badle`. They cover why changing the font is not enough, both conversion directions, what changes in a Word file, and what to check. They answer "Kurti Dev" and other misspellings, cite Unicode and Microsoft sources, and link to the converter. The two existing Kruti Dev guides link to them (reviewed date bumped). The new guides are added to the hub, `llms.txt`, the sitemap and the converter's help section.
- Articles can set their own call-to-action text (`cta` in `seo-keyword-queue.json`); the others keep "Open PDF tool".

## Unicode ↔ KrutiDev converter, 26 November 2026

### Added
- `/tools/unicode-to-krutidev/`: converts Hindi between Unicode (Mangal) and KrutiDev 010 in both directions, as you type or for a whole Word (.docx) file, in the browser (web ADR 0019). In a Word file, English words keep their font and only KrutiDev or DevLys text is converted back to Unicode. Characters with no KrutiDev key are kept and listed. Linked from the KrutiDev PDF page, the homepage catalog, the site header and the footer; `llms.txt` updated.
- Checked in Chrome on the production Worker: both directions, Swap, Copy, both Word directions (output XML well-formed, fonts and sizes as expected), Hindi screen at 375 px; smoke and edit-quality gates pass.

### Fixed
- KrutiDev → Unicode read `pkS` as चै instead of चौ, and left ि before a virama in long clusters (डिस्टि्रक्ट for डिस्ट्रिक्ट). This affects the KrutiDev PDF page and Edit PDF's KrutiDev display too.

## PDF to Word continues after the tab is closed, 26 November 2026

### Added
- Each finished page of a PDF to Word conversion is kept in the browser (IndexedDB, `conversionProgress.ts`), keyed by the file and its settings. Converting the same file with the same settings again continues where it stopped (a phone closing the tab, a reload, or Stop); the screen says how many pages are kept and offers Start over. One job is kept; it is deleted when the Word file is made. Checked in Chrome: closed at 16 of 40 pages, the second run took 4.2 s and the Word file has all 40 chapters in order. Privacy pages (English and Hindi) list the kept pages.

### Fixed
- After Stop, workers finishing their current page brought back the "Converting…" status.

## PDF to Word: choose pages, stop, skip blank pages, 26 November 2026

### Added
- Pages setting: all pages, or chosen pages ("1-500", "1, 3-5", Hindi digits too), so a long file converts in parts and files over 3,000 pages can still be converted. `parsePageList` moved to `pageList.ts`, shared with Sign PDF.
- Stop button while converting; nothing is downloaded and the screen says so.

### Fixed
- Blank pages counted as scanned: the estimate warned about OCR that was not needed, and "Only where needed" spent its OCR budget reading empty pages. A page with no text layer is read with OCR only if it paints an image or many paths (outlined text).

### Measured, not changed
- Main-thread blocking during a 2,000-page conversion at 8x CPU throttling: longest task 0.68 s, 5 over 0.2 s in 60 s. Moving conversion to a Web Worker is not worth its cost until a real phone shows otherwise.

## Edited Hindi text no longer comes back on copy, 26 November 2026

### Fixed
- Chrome and Google Docs give every Hindi cluster an `/ActualText`. The export removed the replaced glyphs but kept that text, so copying from the edited PDF, searching it, or reading it in MuPDF-based apps still found part of the old word ("ज्ञा" after replacing ज्ञान). A marked-content section that loses a glyph now loses its `/ActualText` too; its MCID stays. Unit test on the Devanagari fixture; edit gate 23 OK.

## Long documents: 2,000-page PDF to Word and Word to PDF, 26 November 2026

Measured in Chrome on a desktop with generated fixtures (scripts kept out of the repo).

### Changed
- PDF to Word takes up to 3,000 pages (was 150). A 2,000-page digital PDF with a Hindi heading on each page converted in 3 min 48 s, using under 100 MB of memory.
- Word to PDF image export embeds the document's fonts once, not once per page: 100 pages took 40 s (over 7 min before), with pixel-identical output. Documents over 300 pages use Save as PDF: their image PDF would be about 0.5 MB per page held in memory, and 2,000 pages crashed the tab. Save as PDF printed a 2,000-page Word file in 16 s (10 MB, selectable Hindi text).

### Fixed
- Pages with too little Devanagari for the OCR comparison (a Hindi heading on an English page) were OCR'd whole on every page, although the result could not change what was kept: 7.5 s per page. Only their Devanagari lines are read now (0.2 s per page), still recorded as evidence for the font.
- A page whose quick band check passed never counted towards trusting its font, so long Hindi documents with a good text map were band-checked on every page instead of being spot-checked. The band now counts for the fonts with words in it (`recordVerifiedBand`). Unit-tested; not yet measured on a real long Hindi PDF.

### Added
- PDF to Word has a Text recognition (OCR) setting: Only where needed (default), Off, or Every page. Each choice says what it does; the screen samples up to 12 pages and says how many look scanned and how long OCR will take on this device. OCR reads at most 300 pages per file on a computer, 60 on a mid-range phone and 15 on a low-end phone (by OCR worker count; measured 4 s, est. 19 s and est. 88 s a page), so a conversion stays near 20 minutes. Pages beyond the limit, and pages in a legacy font that cannot be converted when OCR is off, are listed as not read. Long conversions spot-check trusted Hindi fonts every 64 pages (the editor keeps 8).
- Hindi PDFs made by Chrome, Google Docs and other Skia tools are read from their `/ActualText` (`pdfActualText.ts`), which pdf.js drops: no OCR needed. Such pages are joined in drawing order, and Devanagari words break only at drawn spaces. A 40-page Chrome-made Hindi PDF converts in 4.6 s (0.11 s a page; 6.5 s a page with OCR before) with all 14,440 Hindi words correct. The editor reads these pages the same way.

### Fixed
- Chrome draws a line's runs font by font, so a comma in a Latin font was drawn after the Hindi around it and ended up at the line end ("नामपता"). On such pages Hindi runs keep drawing order and other runs are placed among them by position. Runs on one baseline in fonts of different heights now stay in one line. A 2,667-page Word file printed to PDF in Chrome converts in 3 min 34 s with all 618,011 Hindi words correct.
- Word-exported PDFs tag every paragraph as marked content; /ActualText is only read for files made by Skia producers or pages with unmapped glyphs, so other files are not parsed a second time.
- PDF to Word and Word to PDF keep the screen on while they run (Screen Wake Lock, where the browser allows it), and PDF to Word shows the time left and asks to keep the tab open. With OCR off, pages whose Hindi the PDF does not map to Unicode are listed as not read. The KrutiDev page does not offer OCR off: its conversion is always checked against the page image.
- Fonts with too little Devanagari to judge (headings, or Skia subset fonts that hold pieces of words) kept every page waiting for an OCR check. Skia pages are judged by font family on their whole text, and a font still too sparse to judge after 3 checked pages no longer forces checks: OCR cannot change its text.

## PDF to Word: tables without lines, 24 November 2026

### Added
- Tables that line their text up in columns without drawing lines become Word tables without borders, one value per cell, with wrapped cell text kept in its row (`alignedTables.ts`, web ADR 0012 addendum). Numbered paragraphs, short numbered lists and two-column page layouts stay paragraphs.
- Gate case `WORD_ALIGNED_TABLE_OK`. Tool guide, homepage card, `tool-routes.json` and `llms*.txt` now say tables, not only ruled tables, become Word tables.

## One header on every page: guides and info pages get the homepage header, 24 November 2026

### Changed
- The 20 guides, the guides hub, About, Privacy, Terms, Support, Data safety (English and Hindi) and the 404 page now use the homepage header: brand, grouped Tools menu with all 11 tools, Guides, About, Support, language switch, Android app and Open editor. Before, they had two older headers (a pill with uppercase links, and a three-link guide bar) with no way to reach most tools.
- One source: `scripts/site-header.mjs` renders it, `assets/site-nav.css` styles it, `assets/site-nav.js` runs it (Esc returns focus, tabbing out closes Tools, the phone menu focuses its first link and makes the page inert, reduced motion respected). Articles get it from `article-template.mjs`; info pages between `site-header` markers via `node scripts/sync-site-headers.mjs`. `scripts/site-header.test.mjs` (in `npm run test:content`) checks the tool list against the homepage catalog and `tool-routes.json`, and that every info page is current.
- Hindi pages show Hindi labels and link tools with `?lang=hi`. Below 360px the header shows the logo without the name (kept for screen readers) so nothing scrolls sideways.

### Fixed
- About (English and Hindi) said the web editor blocks Kruti Dev pages and exports each edited page as one image. It now says what the code does: Kruti Dev and DevLys pages are converted and checked against text recognition, other legacy fonts stay blocked, unedited pages are copied unchanged and only new words are images.

### Removed
- The old `.site-header`/`.nav*` rules in `site.css` and `.guide-header` rules in `article.css`.

## Homepage audit fixes: reduced motion, keyboard menus, honest copy, 24 November 2026

Found by a genjutsu audit (design-audit, tells, motion-principles) plus browser checks; the design
record genjutsu reads is now `web-app/MASTER.md`.

### Fixed
- **Reduced motion.** With the OS "reduce motion" setting on, Features, How it works, Use cases, guide cards, Work your way, the pointer box and the letter badge still slid in (a Features card measured 7.8px mid-move 80ms after scrolling in). The homepage is now wrapped in `MotionConfig reducedMotion="user"`, and the typewriter caret stops blinking.
- **Tools menu.** Esc puts focus back on the Tools button; tabbing past the last tool closes the menu instead of leaving it over the page. Both menus stay mounted and fade out as well as in; closed menus are `inert` and hidden.
- **Phone menu.** Focus moves to the first link when it opens, and the page behind is `inert` until it closes; Esc returns focus to the menu button.
- **FAQ.** Each question button points to its answer (`aria-controls`, `role="region"`). Answers stay in the page HTML while closed, so crawlers read the same text as the FAQPage JSON-LD. The answer no longer animates its height.
- **Decorative letter chips** next to the hero label are hidden from screen readers.
- **Guide cards** on the homepage used titles and summaries from before the guides were rewritten ("Without Uploading Them", "Keep the Layout"); they now use each guide's own title and summary. Read times were guesses and are now from word counts (200 words a minute in English, 150 in Hindi).
- **Copy.** "Loved for everyday Hindi paperwork" was an unsourced claim; it now says what the product is for. The tools menu said all tools run in the browser; it now says most do and AI features ask first. Middle-dot runs, em dashes, double arrows ("View all guides → →") and "engineered from scratch for Indic typography" are gone.
- **Illustrations** in Features show real Hindi sample text instead of grey bars.

### Changed
- One easing and three durations on the homepage (`home/motion.ts`: 180ms UI, 400ms section entries, 600ms hero), down from six.
- Use cases puts its heading on the left and the summary on the right, so three sections in a row no longer share the centred-heading layout.
- The hero's "Editing this line" tag is 13px (was 11px).

## Homepage refresh: typewriter hero, grouped tools menu, flatter sections, 24 November 2026

### Changed
- **Hero.** The typewriter headline is back (it was removed on 1 October because the line width jumped while typing). The second line now has a fixed height and stays on one line, so nothing below it moves. It types whole grapheme clusters, so a conjunct or matra never shows half-typed, and it stays still under reduced motion. The English cycle no longer includes a Hindi line (one language per screen). On the right, a sample Hindi letter retypes its subject line and signs itself when each line is done. The hover sweep on "one place" returns as CSS only. Four popular tools sit under the letter, with a link to all 11.
- **Navigation.** A plain sticky bar replaces the floating glass pill. "Tools" opens a menu listing all 11 tools in four groups (Edit & sign, Translate & convert, Merge & split, Compress) in their category colours. It opens on hover or click and closes on Esc or an outside click. The phone menu lists the same groups, then the page links and the Android app. Desktop links from 1024px; Use cases, FAQ and Android app from 1280px.
- **One tool list.** `home/toolCatalog.ts` now feeds the nav menu, the phone menu, the hero and the "Work your way" chips. The nav had its own copy that left out Organize and KrutiDev; the "Work your way" chips were English on Hindi screens.
- **Flatter sections.** Feature, use-case, step and guide cards no longer have outlines or resting shadows; surfaces are told apart by tone. Icons sit directly on the surface in their category colour (AGENTS.md), without tinted squares. "How it works" is now a heading column beside the four steps, without the 01–04 numbers. "Work your way" shows the real editor capture instead of grey bars. The footer sits on a tinted band without rules.
- Hindi hero: the Google Play button reads "गूगल प्ले पर पाएं". The Hindi headline is set smaller (54px max) so "हिंदी पीडीएफ एडिटर" stays on one line; on the first deploy it wrapped to three lines at 1440px.
- **Translation claim matches the code.** The feature card said translation keeps "exact tables, fonts, and bounding boxes". The tool translates line by line and places each line where the original was, in Noto Sans Devanagari, after AI consent; the card now says that.

## Design finish: one type scale, shared footer, real product shot, 23 November 2026

### Changed
- **Real editor in the hero.** The drawn mock document is replaced by a capture of the editor retyping the subject line of a fictional Hindi leave letter (`assets/product/editor-hindi-edit.webp`, 10 KB).
- **One type scale on the homepage:** 13 / 14 / 16 / 18 / 20 / 24 px plus display sizes, instead of 17 sizes; body copy is 16px and no readable text is under 13px (tiny text is left only inside drawn illustrations). Info pages use 16px body text.
- **Comparison on phones** is one card per row instead of a table cut off at the right edge.
- **Tool row** fits one line from 1180px up in English and Hindi (shorter Hindi names, "KrutiDev" for the KrutiDev page); below that it swipes with a fade instead of wrapping one tool onto its own line.
- **One footer pattern:** tool pages, guides and info pages show the same six links (Guides, About, Privacy, Data safety, Terms, Support), with Hindi labels and `/hi/` pages on Hindi screens. Info pages had only "Copyright 2026" on a navy bar.
- **Hindi screens:** the Hindi homepage and FAQ use "हिंदी पीडीएफ एडिटर" and "यूपी पुलिस" inside Hindi sentences; Merge, Split and Compress step labels are translated; three Hindi guides name buttons as the Hindi UI shows them (re-reviewed 2026-11-23).
- Homepage headline second line is "No broken fonts." so it stays on two lines; the "Work your way" visual no longer starts hidden (the last blank stretch on phones). Support's title says what the page is for, without an empty "Help" label or English in brackets.

## Text recognition loads on slow connections, 23 November 2026

### Fixed
- **OCR no longer fails on slow connections.** Every OCR worker downloaded its own copy of the 1.4–3 MB language model, so up to four workers per language and mode fetched the same file at once, and on a slow link they all hit the 60 s limit: on a throttled 1.6 Mbit/s connection the editor took 125 s and then skipped the Hindi check ("Text recognition could not load"). Each model now downloads once, and the download fails only if no bytes arrive for 30 s, not when it is merely slow; workers then start from the browser cache. Same throttle: ready in 38 s with the Hindi check. `/edit/ocr/*` is cached for a week. tesseract.js 6 cannot take the bytes directly (`{ code, data }` initialises with the data as the language name), so the cache carries them.

## Design audit fixes: tool guides, Hindi screens, two new tool pages, 23 November 2026

### Added
- **Organize PDF pages** (`/tools/organize-pdf/`): opens the editor straight into the Pages panel to turn, reorder, delete or add blank pages. Web ADR 0017.
- **KrutiDev PDF to Unicode** (`/tools/krutidev-to-unicode/`): the PDF to Word converter under its own heading. KrutiDev and DevLys text is converted to Unicode and checked against OCR; other old fonts are read by OCR. The Edit tool keeps the original KrutiDev text layer on lines you do not change, so this page uses PDF to Word, which gives real Unicode text. Web ADR 0017.
- **Every tool page explains its task** under the file picker: three steps, what to know (limits and privacy), questions and related guides, in English or Hindi. The English copy is prerendered into the static page and published as a FAQPage graph. Every claim was checked against the tool's code.
- **"Try a Hindi sample"** on Edit, Organize, Sign, Translate, Split, Compress and PDF to Word opens the bundled Devanagari fixture.
- **Merge** has up and down buttons to set the order; before, the order was only the order files were picked.

### Changed
- **Hindi screens are fully Hindi** in Translate (labels, consent, progress, errors), Merge, Compress, Split, parts of Edit and the security check. Library error text is no longer shown; the shared open-failure messages are, including for password-protected files. Hindi tool names and footer labels no longer carry English in brackets.
- The file picker's title is the page's h1 at display size (it was 28px at weight 400, under a "Ready when you are" label, which is gone). Body copy uses full ink at 17px.
- On phones the tool row fades at its edge and scrolls to the current tool.
- Static pages (guides, support, about): primary buttons are solid `#1843DD` with a darker hover, not a gradient with a blue shadow; the homepage brand button's blue shadow is now the neutral one. Check marks are icons, not text glyphs.
- Guides and info pages (support, about, privacy, terms, data safety) use the same floating header as the homepage and tool pages. Guide text is 17px in a 760px column (lines ran ~102 characters); info paragraphs cap at 70ch.
- **Homepage:** the hero headline no longer types and deletes itself; its second line is fixed ("No broken Hindi fonts." / "बिना फॉन्ट टूटे।"), and the hover-sparkle box is gone. Scroll reveals move cards but no longer hide them, so 27 blocks are visible in the prerendered page and on phones (two long blank stretches). The closing CTA uses the soft blurred mesh from `design-system.md` instead of hard arcs. The green "English" chip meets contrast. Hindi footer labels drop the English in brackets.

## Homepage shows every tool; tool pages follow the design system, 23 November 2026

### Changed
- **Homepage lists all nine tools.** The hero's toolkit card listed five tools; it now lists all nine (Edit, Sign, Fill form, Translate, PDF to Word, Word to PDF, Merge, Split, Compress) in two columns, and its line names signing and converting. The features grid gains cards for Sign PDF, Fill PDF form and PDF to Word (with Word to PDF), each with a small drawing of the result, and no longer leaves the privacy card alone on its own row. The privacy card now names every in-browser tool. English and Hindi.
- The translate shortcut said "Free in your browser"; translation goes to the AI service after you approve, so it now says that.
- The five yellow stars beside "Loved for everyday Hindi paperwork" are gone: they stood for a rating the site has no source for, and failed contrast (1.5:1).
- **Tool pages:** primary buttons and the current step are solid brand blue (`#1843DD`), as `design-system.md` says, instead of a gradient with a glow; the active tool tab has no shadow. On phones the progress steps fit the screen instead of being cut off at the edge; only the current step shows its label, and the others keep it for screen readers.

## PDF to Word finds tables on scanned pages, 23 November 2026

### Added
- **Tables on scanned pages become Word tables.** A scan has no drawn lines to read, so PDF to Word looks for table lines in the page image and reads each cell on its own, in Hindi and English, keeping the better reading. Whole-page OCR used to run a row's cells together. Gate case `SCAN_TABLE_OK`; web ADR 0012 addendum.

### Changed
- Table cells and text drawn as images are read in single-block mode by their own OCR workers, which no longer drops short items such as a lone "14". A Hindi reading made only of Devanagari digits no longer counts as Hindi, so a Latin word misread by the Hindi model is read again in English. On the 31-page notice the output is unchanged, and conversion takes about 42 s instead of 46 s.

## PDF to Word keeps pictures, 23 November 2026

### Added
- **Pictures come through to Word:** logos, photos, stamps and signatures are carried over at their size, in reading order between the paragraphs around them. A picture inside a table, such as an emblem in a header table, goes into its cell. They are cut from the rendered page, so they look exactly as on the page; full-page scan backgrounds are not repeated. On a 31-page notice, the CISF emblem now appears at the top of page 1.
- The tool page, `tool-routes.json` and `llms` files now say pictures are carried over; exact positions still are not. Gate case `WORD_PICTURE_OK`; web ADR 0012 addendum.

## Edit PDF: headings drawn as images are editable, 23 November 2026

### Added
- Edit PDF now finds text drawn as images (Word headings with effects, titles, table labels) and makes it editable. The page's own lines appear as fast as before; these image lines are added in the background a moment later. When one is replaced, the export cleans the old image text away and draws the new text. Image words inside a sentence are not added yet, because replacing that sentence would leave the image word underneath. Gate case `EDIT_TEXT_IMAGE_OK`; web ADR 0016 updated.

## PDF to Word: tall tables keep picture labels, 23 November 2026

### Fixed
- Reading text drawn as images stopped after 40 rows per page, so tall tables lost their lower labels. On a 31-page notice, the trade names in a table's first column ("आरक्षक / मोची", "आरक्षक / दर्जी" and others) came out as "/". The limit is now 160 rows per page; the notice converts in about 50 s instead of 46 s. Web ADR 0016 updated.

## CSP snippet check, 23 November 2026

### Added
- `scripts/check-csp-snippets.mjs` checks that every inline script the live site serves, including the Google tag gateway snippets Cloudflare injects, is allowed by the Content-Security-Policy. If one is not, it fails and prints the hash to add to `_headers`. It runs after each deploy, and weekly through `.github/workflows/csp-check.yml` once the GitHub billing lock is lifted. Tested against a page whose policy omits its inline script. Web ADR 0014 updated.

## Page jump in Sign PDF and Fill PDF form, 23 November 2026

### Added
- Sign PDF and Fill PDF form have a page number box between the arrows: type a page and press Enter (or leave the box) to go there. Hindi digits work (३), and numbers outside the document go to the first or last page.

## Word to PDF: selectable text first, 23 November 2026

### Changed
- Word to PDF now leads with **Save as PDF (selectable text)**: the browser's print engine makes a PDF with real Hindi and English text you can select, search and copy. After the print window opens, the tool shows how to choose "Save as PDF" (and Share or Save to Files on phones). **Download image PDF** stays as the second option, described as exact-looking pages whose text cannot be selected.
- An invisible text layer for the image PDF would mean drawing Devanagari with pdf-lib, which AGENTS.md forbids. It is listed with the Plan B decision.

### Fixed
- "1 pages laid out" now reads "1 page laid out".

## Edit PDF reads pages ahead in parallel, 23 November 2026

### Changed
- Edit PDF reads pages in the background in parallel lanes, one per OCR worker (2 on phones, up to 4 on desktops), still the page on screen first. On a 31-page Word-made Hindi notice, every page was ready for editing after 30 s instead of 66 s; the first page is ready in about 4 s, as before. Web ADR 0015 updated.

## PDF to Word keeps ruled tables, 23 November 2026

### Added
- **Ruled tables become Word tables.** PDF to Word finds tables drawn with lines (as Word, Excel and most government notices draw them), including borders drawn cell by cell. It rebuilds them as Word tables with their column widths, row heights and merged cells (a heading across columns, a label down several rows), and puts each line of text into its cell. Paragraphs above, between and below tables keep their order. On a 31-page recruitment notice, 14 tables come through, including a two-level header.
- Text drawn as images is not joined across a table's column borders, so header words land in their own cells.
- The tool's page, `tool-routes.json` and `llms` files now say ruled tables are carried over; pictures and exact positions still are not. Gate case `WORD_TABLE_OK`; web ADR 0012 addendum.

## PDF to Word reads text drawn as images; KrutiDev check fixed, 23 November 2026

### Fixed
- **Text drawn as images was dropped.** Word often draws headings with effects, text in shapes, and even single words as small images. PDF to Word now finds line-height images that the text layer does not cover and reads them with OCR, from one render per page with rows spread over the worker pool. Each reading is placed in its sentence. On a 31-page Word-made notice, page 1 gained its organisation name, title, dates, pay level and the word "ऑनलाइन" inside sentence 1.1.
- **A correct KrutiDev conversion was rejected.** On a table of small text, OCR misreads complex words more than plain ones, and the check read that as a broken font. Converted text is now judged by overall agreement with OCR (rejected below 40 %), so the table keeps its exact converted text instead of OCR errors such as "मर्ती" for भर्ती. Every converted page is still checked.
- Gate cases `TEXT_IMAGE_OK` (fails on the previous build) and `KRUTIDEV_MIXED_OK`. Web ADR 0016.

### Changed
- The 31-page notice now converts in about 46 s (32 s without reading images, 184 s before ADR 0015). Files without text images are unchanged in output and time.

## Phone-safe OCR worker pool, 23 November 2026

### Changed
- The OCR worker count now follows device memory: 1 worker on devices with 2 GB or less, at most 2 on 4 GB devices and on phones that do not report memory (iPhone Safari), and up to 4 on desktops, always leaving a core for the page. Before, phones without a memory figure could get 4.
- Measured on an emulated phone (CPU slowed 4×, 31 pages): 1 worker 74 s and 932 MB, 2 workers 49 s and 1001 MB, 4 workers 37 s and 1007 MB. A 120-page run holds steady at about 790 MB with no growth. Web ADR 0015 updated; a check on a real low-end phone is still open.

## Faster PDF to Word and page reading, 23 November 2026

### Changed
- **PDF to Word is about 5–6× faster on long digital Hindi PDFs:** a 31-page, 2.8 MB KrutiDev Word export went from 184 s to 32.5 s, and the fixture mix from 37.5 s to 18 s. The Word output is identical. Web ADR 0015.
  - OCR runs on a pool of up to 4 Tesseract workers (2 on low-memory devices), and pages are read side by side.
  - Pages with enough Hindi text are checked against OCR of a band of their lines instead of the whole page; only a passing band skips full-page OCR. Every KrutiDev page is still checked.
  - Unicode text in a font that has matched OCR on two pages is no longer checked on every page. Failed fonts are never trusted, and every 8th page is spot-checked.
  - Page images are drawn only for pages that need OCR.
- Progress reads "12 of 31 pages read" because pages finish side by side.
- The band check and worker pool also apply to Edit PDF's page reading.
- New gate case `KRUTIDEV_MIXED_OK`: a KrutiDev page with English in its own font converts only the KrutiDev line; the English, numbers and email stay exactly as written. (The repo fixture's English note is itself set in the KrutiDev font, so it is converted like the rest of that page; that is the correct reading of that font.)

## Sign PDF: custom position and per-page adjustment, 23 November 2026

### Added
- **Custom position:** with "Every page" or "Chosen pages", the new **Custom: drag on the page** option lets you drag the signature anywhere on the page and resize it from its corner, and the same spot is used on every signed page. The spot is kept as a share of the page size, so pages of other sizes get the same place; it is kept inside each page.
- **Per-page adjustment:** a "Move on: All pages / This page only" switch above the page preview. With "This page only", dragging or resizing changes just that page, which is marked "Own position on this page". The remove button takes the signature off that page alone. "Reset this page" and "Reset all pages" undo the adjustments. Dragging with "All pages" switches the shared position to Custom.
- In "Chosen pages" mode, a page outside the list says it won't be signed.
- Gate case `SIGN_POSITIONS_OK`: a custom spot dragged on page 1, page 2 moved on its own and page 3 left unsigned land exactly there in the signed file. Web ADR 0011 updated.

## Content-Security-Policy, 23 November 2026

### Security
- The site now sends an enforced `Content-Security-Policy`. Scripts may come only from the site itself, Google Tag Manager, Cloudflare Turnstile and the Cloudflare Web Analytics beacon; the two inline snippets Cloudflare's Google tag gateway injects are allowed by hash. Inline scripts and `eval` are otherwise blocked, and WebAssembly compilation is allowed for the self-hosted OCR. Connections may go only to the site, the consented AI API, analytics, Google Fonts and Turnstile. Plugins, foreign `<base>` tags, foreign form posts and framing are blocked. Web ADR 0014.
- The first release (PR #39) blocked the edge-injected scripts, which the local preview doesn't have, and was reverted (PR #40). The policy then ran report-only on production (PR #41) and was enforced after a clean sweep (PR #42, this change).
- Verified: locally, the full edit-quality gate (16/16), browser smoke and a violation sweep over every tool, OCR on a scan, PDF to Word and Fill form. On production, the same sweep (zero violations) and the gate's no-change, sign, converter and form cases.

## Fill PDF form: list boxes, turned fields, signature boxes, 23 November 2026

### Added
- Fill PDF form fills **list boxes**, single- and multi-select, on the page and in the side list. The selected export values go into `/V` and their row numbers into `/I`. Lists whose choices are all Latin keep pdf-lib's own list appearance; any other list gets a browser-drawn appearance showing the selected choices, one per line.
- Fields turned with their page (`/MK /R`, often on landscape pages stored as turned portrait pages) are drawn in their own turned box, so Hindi answers read upright in the output. The on-page control turns with the field.
- A form with a signature box now says so and links to Sign PDF; other fields it can't fill are still counted.

### Fixed
- The Fill PDF form preview drew each field's saved look under its control, so a prefilled value showed twice. The preview now leaves out the fields' drawings (`AnnotationMode.ENABLE_FORMS`), and the controls show every value.
- The form fixture adds a multi-select list box and a turned second page with a turned field. Gate case `FILL_FORM_OK` now also checks both list choices and an upright Hindi answer in the turned field (a horizontal headline run). Checked in pdf.js and Poppler.

## Fill PDF form, 23 November 2026

### Added
- New tool, **Fill PDF form** (`/tools/fill-pdf-form/`): type into a PDF's own form fields (text, multi-line text, check boxes, radio buttons, dropdowns) in Hindi or English, on the page preview or in a labelled list for the current page, with optional Roman→Hindi typing; download the filled copy, optionally flattened. Fields come from pdf.js (positions on the rendered page, rotation applied) with names from the field tooltip and radio choices from `/Opt`. Answers are written with pdf-lib: Latin answers keep pdf-lib's vector Helvetica appearance; any other answer (Hindi) keeps its Unicode text as the field value and gets an appearance drawn by the browser (the same text rasteriser as Edit PDF, Plan A) over the field's own border and background, shrunk to fit; `NeedAppearances` is cleared so viewers do not redraw it unshaped. XFA data is removed so viewers show the filled fields. The source file is never changed and the output is re-opened before download. List boxes and signature fields are left as they are and counted on screen; PDFs without fields point to Edit PDF's Add text. Web ADR 0013.
- Fixture `mobile-app/fixtures/form-fixture.pdf` (`scripts/make-form-fixture.mjs`) and gate case `FILL_FORM_OK`: Hindi and English answers stored, the Hindi name drawn inside its field, box, radio and dropdown set. Checked in pdf.js and Poppler: conjuncts, reph and nukta correct, borders kept. `GATE_ONLY=fillFormCase` runs chosen gate cases.
- Listed in the tool bar, homepage menu and footer, `llms.txt`, `llms-full.txt` and the README; smoke test covers the route.

## PDF to Word and Word to PDF, 23 November 2026

### Added
- **PDF to Word** (`/tools/pdf-to-word/`): converts a Hindi or English PDF, scans included, to an editable `.docx` in the browser. Pages are read with the editor's detection (PDF text, repaired Hindi glyphs, KrutiDev conversion, OCR), lines become paragraphs keeping size, bold headings, centred lines, indents and spacing (pieces of one row are joined), one Word section per page at the page's size, Hindi in Nirmala UI. Tables, pictures and exact positions are not carried over (stated on the page). On the Devanagari fixture every Hindi line arrives exactly as written.
- **Word to PDF** (`/tools/word-to-pdf/`): lays out a `.docx` in the browser (docx-preview) with a preview; Office fonts use the bundled metric-compatible fonts and Hindi uses Noto. "Download PDF" makes page images (text not selectable; long sections cut at blank rows); "Print / Save as PDF" prints the same layout for selectable text.
- New pinned dependencies: `docx` 9.15.3 (MIT), `docx-preview` 0.4.1 (Apache-2.0), `html-to-image` 1.11.13 (MIT); `npm audit`: 0 vulnerabilities. Web ADR 0012.
- The drop zone takes Word files for the new tool, and its messages are now in Hindi on Hindi screens.
- Both tools are in the tool bar, homepage menu and footer, `llms.txt` and `llms-full.txt`. Gate case `CONVERTERS_OK` converts the fixture to Word (Hindi text exact) and back to PDF; the smoke test covers both routes.

## Sign PDF, 23 November 2026

### Added
- New tool, **Sign PDF** (`/tools/sign-pdf/`): make a signature by drawing it, typing your name (Hindi or English, shaped by the browser, black or blue, sans or serif) or uploading a photo of it (its white paper made transparent by default), then place it by hand (sign this page, drag, resize from the corner, remove), on every page, or on chosen pages ("1, 3-5", Hindi digits too) at one of six positions with an adjustable width. The download is built on the editor's export (unsigned pages copied unchanged, rotation handled, output re-opened). Runs in the browser. The tool says it adds an electronic signature image, not a certificate-based digital signature (web ADR 0011).
- Listed in the tool bar, the homepage menu and footer, `llms.txt` and `llms-full.txt`; its page, sitemap entry and redirects come from `tool-routes.json`.
- Gate case `SIGN_OK`: a typed Hindi signature on every page of the multipage fixture lands only in the bottom-right corner and the page text is unchanged. Smoke test covers the tool's route.

### Fixed
- The "Selected PDF" label stayed English on Hindi screens (a default value hid the Hindi text).
- Footer links to the editor's Replace and Add text modes were broken on the Hindi homepage (two `?` in the URL).
- The publish check no longer hard-codes five tools.

## Hindi spell check, 23 November 2026

### Added
- While editing, Hindi words the user added that the word list does not know are listed under the text toolbar with up to four suggestions (one or two edits away, commonest first) and "Add to dictionary". Words from the original line (names, places) are not judged. Common inflections (आवेदनों, परीक्षाओं, लिखवाएंगे, करेंगे) are accepted from their stem, and nukta and chandrabindu spellings count as the same word.
- Word list: about 19,700 Devanagari words from FrequencyWords (Hermit Dave; MIT licence, word lists described as CC BY-SA 4.0; built from OpenSubtitles), in `editor/public/dict/` with its source and licence, built by `scripts/build-hindi-dictionary.mjs`. It loads (360 KB) only when an edit has Hindi text; checking runs in the browser. Words the user adds are kept in this browser; the privacy pages say so. Hunspell Hindi dictionaries were not used: they are GPL.

### Fixed
- Typing Hindi in front of a word (no space yet) scrambled it: a virama joins with the next consonant into one cluster, and browsers move the caret past the whole cluster, so the following letters landed inside the next word. Typed letters are now inserted at a tracked caret (IME input is left to the browser).

### Changed
- The edit-quality gate types a misspelt word before a Hindi word, checks the letters stay in order, that only that word is flagged, and that the suggestion fixes it.

## Fixes and gaps closed, 23 November 2026

### Fixed
- Text painted twice at the same place (Chrome prints stroked text as a fill pass and a stroke pass; some producers fake bold that way) was detected twice; it is now read once.
- Hindi lines with unmapped glyphs are re-read from a 4× render of their own area before repair (page images are 2 px per pt, too small for 9 pt labels). Glyph contexts use Devanagari letters only, so OCR misreading an arrow or a Latin word no longer blocks learning, and readings shared between font subsets are chosen by where the glyph is drawn (before a consonant it is a pre-base sign), which also unlocks the conjunct next to it. Every line of the Devanagari fixture, including the grey labels OCR misreads, now comes from the PDF exactly as written.
- New words keep the original's size and are scaled horizontally (85–110 %) to the width of the PDF's own line when the replacement font is wider or narrower; before, the size was shrunk. OCR lines keep the old size fit.
- Find & replace with longer text now flows into the rest of the paragraph, as typing does.
- Pages can be turned anticlockwise again (one click instead of three clockwise turns).
- The editor audit's status was out of date (self-hosted OCR, the OCR notice, KrutiDev conversion and pdf.js data were done); updated, with the remaining open items listed.

### Changed
- Draft autosave moved out of `EditPdfTool.tsx` into `useDraftAutosave` and `KeptDraftPrompt`.
- The gate's glyph check reads the fixture's label row (only the repaired PDF text has its "→"), and a new case checks find-and-replace flow.
- IndexNow was submitted by hand (38 URLs, HTTP 200): the workflow cannot start while the GitHub account is locked for billing.

## Hindi text with unmapped glyphs is repaired, 23 November 2026

### Added
- PDFs printed by Chrome, Google Docs and other Skia-based producers leave some Devanagari glyphs without Unicode (reph, pre-base ि, conjuncts such as क्ष, ज्ञ and द्य, combined signs such as ें), so their text layer reads with gaps and with reph and ि in drawing order. Each such glyph now stands as a placeholder (keyed by its PDF font and code) and is learned from OCR of the same line: the known characters around it are found in the OCR line, ignoring spaces, and the one extra run between them is what it stands for; where that run sits gives its place in reading order (a reph moves back one syllable, ि forward one). Readings are voted across the whole document, so glyphs learned on one page are read on the next, and glyphs next to each other are learned in turn. Subsets of one font share a reading for a glyph of the same advance width when every learned glyph with that width agrees.
- Repaired lines keep the PDF's own text and positions instead of OCR's, re-spaced like OCR where the two agree (text layers drop or add spaces where fonts switch). On the Devanagari fixture, the first heading comes from the PDF itself, exactly as written; rows whose repair OCR cannot confirm (the small grey labels, which OCR misreads) still use OCR.
- Safeguards: every repaired word must also appear in OCR of its line, the repaired Hindi must agree with OCR overall, and a row with any line left unrepaired or unconfirmed is read by OCR as a whole, so no text is lost and no guessed letter is kept.

### Not covered
- Glyphs mapped to the wrong characters (some Word/Mangal exports) are not repaired; those pages keep the OCR fallback.

### Changed
- The edit-quality gate checks that the fixture's Hindi heading reads exactly as written.

## Page operations in the editor, 23 November 2026

### Added
- A **Pages** panel in the editor lists every page with a preview (drawn when it scrolls into view). Each page can be moved earlier or later, turned clockwise, deleted, or followed by a new blank page (the size of the page before it); clicking a preview opens that page.
- Pages keep their edits, detected text and rendered image when they move. A turned page is drawn and read again; pages with edits cannot be turned (the edits cannot turn with them), which the button explains. A sideways scan turned upright is read and edited normally.
- The change is made to the open PDF in memory (never the user's file): pages are reordered inside the same document, so its bookmarks, form fields and links stay with it, and page content is not touched. The page tree is rebuilt as one flat list after copying inherited resources, sizes and rotation onto each page. Objects only a deleted page used are dropped, so a deleted page's content does not stay hidden in the saved file.
- Undo steps back over a page change once the edits made after it are undone (Ctrl+Z too). Page changes count as unsaved work for the leave-page warning, autosave and the download step.
- The toolbar's action and tool rows now each take the full width, so the tool buttons no longer wrap into a block beside the actions.
- The edit-quality gate moves, deletes (and undoes), and adds pages on the multipage fixture and checks the exported order, the blank page and that a whiteout stayed on its page.

## Edited lines flow into their paragraph, 23 November 2026

### Added
- When an edited line no longer fits its column, the edit takes in the next line of the same paragraph: its words are joined on, its area is cleared, and the text rewraps live in the editor at the paragraph's width and baseline spacing, as in a word processor. The first line stays on its original baseline (the box moves up by the extra half-leading the explicit line height adds). This repeats while the text overflows and stops at the paragraph's end.
- A line belongs to the paragraph when it is directly below (baseline step 0.9–2.2 line heights), left-aligned within one line height, the same size, and the line above it was full (the next line's first word would not have fitted after it). Rows OCR split into several boxes are taken whole, in reading order.
- Widths are compared in the original's terms (the replacement font is calibrated on the replaced line), with 3 % allowed for kerning, so a same-length change never flows.
- Deleting the edit brings back every line it took in; the caret stays where the user typed when words are joined on. Autosaved drafts keep the taken lines.
- The edit-quality gate grows a line of the bilingual fixture's paragraph and checks that the next line is taken in, the paragraph keeps its two rows at the original positions (within 3 px), and other lines keep their text.

### Changed
- A paragraph edit is redrawn whole (the words of the lines it covers become an image); a change that fits its line still redraws only the changed words. The one-word gate case uses a same-length replacement so it keeps testing that.

## Faux-bold text keeps its look, 23 November 2026

### Changed
- Word and other producers embolden a font that has no bold face by filling and stroking its text (render mode 2). The editor now reads that stroke from the page's operators (lining pdf.js's drawn characters up with its text items) and repaints new words the same way: the same face, filled and stroked, in the editor (`-webkit-text-stroke`) and in the export (Canvas `strokeText`, still shaped by the browser). Before, a heavier face was chosen, which matched stem thickness but made letters wider (104.7 % of the original word's width on the heavy fixture line; now 100.6 %).
- When the replacement face is the original or a metric match (Hind, Tinos, Arimo, Carlito, Caladea), the PDF's stroke is used as it is. Otherwise (for example Noto for Mangal) the face and stroke are chosen together so the stems match the page image, keeping the stroke closest to the PDF's.
- The Bold chip shows as on for faux-bold text; turning it off removes the stroke.

### Added
- `mobile-app/fixtures/faux-bold-fixture.pdf`, written by `web-app/scripts/make-faux-bold-fixture.mjs`: Latin lines filled and stroked at 0.025 and 0.05 of the font size, as Word writes them, next to regular and real bold lines.
- The edit-quality gate replaces a word on each faux-bold line and checks the new word's stems (7/7 px, 9/9 px at 4×) and width (within 4 %) against the original. It fails without stroke detection.

### Fixed
- The gate waited for the editing hint, which also shows before a page has been read, then read the page's line boxes; it now waits for the boxes.

## Unsaved edits survive a reload, 23 November 2026

### Added
- Edits not yet exported are kept in the browser (IndexedDB) 0.8 s after each change, with a copy of the open PDF (written once per file) and the detected lines of pages already read, so a refresh, a crash or a closed tab does not lose work. The file name row shows "Edits kept in this browser".
- The open screen offers "Continue where you left off?" with the file name, number of changes and time, above the drop zone. Restore reopens the PDF on its first edited page with every edit, the detected lines (pages already read are not read again) and the replacement pairings, so deleting a restored edit still brings the original line back. Discard deletes the draft.
- One draft is kept: editing another file replaces it. It is deleted once the edits are exported, or when the user closes the file and discards the changes.
- Privacy and data-safety pages (English and Hindi) say that unexported edits and a copy of the open PDF are kept in the browser until export or discard. The Hindi data-safety page said typed text ended when the browser closed; that is no longer true and was corrected.
- The edit-quality gate whiteouts a line, reloads, restores, exports and checks the text is still removed, then checks that an exported draft is not offered again.

## Images and signatures, 22 November 2026

### Added
- **Image**: insert a PNG, JPEG or WebP (up to 20 MB) on the page. It is stored at most 1600 px on its longest side; JPEG stays JPEG, PNG and WebP become PNG so transparency survives. It appears in the middle of the part of the page on screen, at most 40 % of the page width and height.
- **Signature**: draw a signature with a mouse, finger or stylus in black or ballpoint blue (changing the colour repaints what is drawn). It is cropped to the ink and placed with a transparent background, about 160 pt wide.
- Images and signatures can be dragged, resized from the corner (keeping their shape, within the page), nudged with the arrow keys (Shift: 10 pt) and removed with the bin button or Delete. Undo works as for other edits.
- Export embeds them unchanged, drawn with new text in the order they were added. Page text is left as it was.
- The edit-quality gate inserts an image, drags it, draws a signature and checks both land in the export where they were on screen, with the page text unchanged.

## Highlight and Whiteout tools, 22 November 2026

### Added
- **Highlight**: drag over text to mark it in yellow. It is drawn with a multiply blend, on screen and in the export, so the text under it stays dark, selectable and searchable.
- **Whiteout**: drag a box to cover anything on the page. The box takes the surrounding paper colour, and on export the text under it is deleted from the page, so covered words cannot be copied or found by search. Images and drawings under it are covered, not removed. Detected lines under a whiteout can no longer be tapped and edited.
- In either tool, each box has a × button to remove it; Undo works as for other edits. `?mode=highlight` and `?mode=whiteout` open the editor in those tools.
- The edit-quality gate whiteouts one line and highlights another on the bilingual fixture, and checks that the covered text is gone from the export, the marked text is kept, the whiteout hides all ink and the highlight is visible with dark text under it. It fails if whiteouts stop deleting text.

### Fixed
- Box tools (Erase box, Highlight, Whiteout) accept a long thin box: a drag counts once one side is 12 px and the other 3 px. Before, both sides had to be 12 px, so a box over one line of text on a phone (about 7 px tall) was taken as a click and left the tool.
- The hints for the new tools fit on one line on desktop, so switching tools no longer moves the page.

## Replacement text matches the original's weight, 22 November 2026

### Changed
- The weight of replacement text is measured from the original's strokes on the page image and matched to the closest weight the replacement font offers (Noto 300–700, Arimo 400–700, others 400/700). Light originals no longer get heavier new words, and bold text in PDFs that hide font names (Chrome-printed) stays bold. On the Devanagari fixture: grey labels 300, Hindi sentences 400, headings 700.

### Added
- The edit-quality gate checks that an edited word is drawn at the original size. It caught a font string left pointing at a function during this change (new words drawn at 10 px).

## Long PDFs open quickly, 22 November 2026

### Changed
- Pages are rendered when first needed (shown, read for text, or exported) instead of all at open; the next page is prepared in the background. On a 120-page test document the first page is ready in 2.4 s instead of 10.9 s.
- Pages are read for text one at a time, the page on screen first, then the pages after it, then the ones before. Paging past pages no longer queues them: on the same document, page 61's text arrived in 2.8 s after paging there, instead of 48 s.

## Scans with JPEG 2000 images open, 22 November 2026

### Fixed
- Pages whose images are JPEG 2000 (common in scanned government PDFs) were blank in the editor and in Translate, Split and Compress: pdf.js had no URL for its image decoders ("OpenJPEG failed to initialize"). pdf.js now gets its decoders (JPEG 2000, JBIG2), character maps, standard font data and ICC profiles from `/edit/pdfjs/`, copied at build time from the installed `pdfjs-dist` by `scripts/copy-pdfjs-assets.mjs`. Text in predefined-CMap (CJK) and non-embedded standard fonts now reads correctly as well.

## Longer words push the line along, 22 November 2026

### Changed
- A word replaced by a longer one mid-line no longer squeezes in: the new word and the rest of the line are redrawn at full size and run into the blank space after the line (up to the next ink, with a quarter-line clearance, or the text column's right edge). Text is shrunk (at most 25 %) only by what that space cannot hold. Checked on exported PDFs in English ("Name:" → "extraordinarily") and Hindi (अत्यधिकमहत्वपूर्ण). Wrapping into the next line is still open.

## Kruti Dev pages can be edited, 22 November 2026

### Added
- Pages typed in Kruti Dev or DevLys are converted to Unicode and can be edited (ADR 0010), instead of being blocked. Conversion runs per font, so English URLs and numbers stay as they are, and each page is checked against OCR. A notice asks the user to read every line. On whole CISF pages the converted words matched the page image 95–97 % before the fixes for curly quotes (श/ष) and vowel-sign fragments. Other legacy fonts and unknown fonts stay blocked.

### Fixed
- A trailing word replaced by a longer one no longer clears part of the next run on the same visual line; the new word is shrunk to fit (at most 25 %) on its original baseline.
- The homepage no longer says pages are saved as images (stale since the export change).

## OCR served from this site, 22 November 2026

### Changed
- The OCR engine, worker and Hindi/English language data are served from `/edit/ocr/` (copied at build time from pinned npm packages: `tesseract.js`, `tesseract.js-core`, `@tesseract.js-data/hin` and `/eng` 1.0.0) instead of a public CDN. Tested with every CDN blocked: scans and the Hindi text check still work.

### Fixed
- A failed language-data download no longer leaves pages in "Finding text…" forever: tesseract.js never settled `createWorker`; worker errors and a 60 s timeout now fail the load, the page falls back, and a notice explains that text recognition could not load.
- The "Finding text…" progress hint is translated, and Hindi hints name the Hindi buttons.

## Mixed Hindi and English lines, 21 November 2026

### Fixed
- English names, IDs and dates inside Hindi lines are read by the English OCR model on pages whose text comes from OCR: words are merged one by one, and a more confident English reading of a word replaces the Hindi model's. "कर्मचारी का नाम: Seema Sharma" now reads correctly, so find and replace matches it (2 of 2 instead of 1).

## Find and replace, 21 November 2026

### Added
- Find and replace (खोजें और बदलें) across every page: detected lines and text already edited, as one undo step. Combined with word-level export, only the replaced words are redrawn. Matching is exact after Unicode normalisation.

### Fixed
- Text in Type3 fonts (Chrome-printed PDFs) is now deleted from the page on replacement, using widths scaled by the font matrix. Before, it was only covered by a patch and stayed searchable and copyable.
- Tap-to-edit and find-and-replace share `lineReplacement.ts` (font match, baseline, width fit, ink colour), moving that logic out of `EditPdfTool.tsx`.
- The editing-modes group has a Hindi accessible name.

## Hindi typing on an English keyboard, 21 November 2026

### Added
- "Hindi typing" (हिंदी टाइपिंग) in the text toolbar converts each word typed in English letters to Devanagari when a space or punctuation follows: `mera naam kya hai` → मेरा नाम क्या है. Own phonetic engine (no new dependency): conjuncts for clusters, casual Hinglish habits for final `a`/`i`/`n`, `r`-clusters and र्य. Works with on-screen keyboards (input events, not key codes). The choice is remembered in this browser.

### Fixed
- Toolbar buttons no longer take focus from the text being edited, which closed the toolbar before the click landed.

## Robust editing, 21 November 2026

### Fixed
- Undo no longer wipes text detection that finished after the last edit, and restores the lines an edit consumed. Redo added (toolbar, Shift+Cmd/Ctrl+Z, Ctrl+Y); Cmd/Ctrl+Z undoes outside text fields.
- Async results are tied to a per-open document ID instead of the file name, so a different file with the same name never receives stale lines.
- One pdf.js document is shared per opened file for rendering and text extraction instead of re-parsing (and leaking) the PDF on every call; the English answer sheet's first page is ready in 3.2 s instead of 5.8 s.
- Password-protected, damaged and over-long (>150 pages) PDFs get clear messages in the screen's language; error titles are translated; technical causes go to the console.
- Text on pages with `/Rotate` is judged horizontal after the page rotation.

## Edit quality gate, 21 November 2026

### Added
- `npm run test:edit-quality` drives the real editor: tapping lines without changing them must leave 0 % of pixels and the page text unchanged (English digital page and Hindi fixture), and a one-word edit must keep the line's other words as original PDF text.

### Fixed
- Page navigation buttons use chevron icons with "Previous page"/"Next page" (Hindi: "पिछला पेज"/"अगला पेज") accessible names instead of ◀/▶ glyphs.

## Word-level edits, 21 November 2026

### Changed
- Export redraws only the words that changed. Untouched words keep the original glyphs or scan pixels, so OCR slips in detected text no longer reach the document, and a tapped but unchanged line exports untouched. Span edges snap to real word gaps on the page image. Bank of Baroda date row: changing only the date keeps the original "शुल्क" (OCR read थल्क).

## Matched fonts, 21 November 2026

### Changed
- Replacement text uses the original typeface or a metric-compatible match: Hind (exact), Tinos for Times, Arimo for Arial/Helvetica, Carlito for Calibri, Caladea for Cambria. Other fonts keep Noto Sans/Serif Devanagari; Latin-only matches fall back per character to Noto for Hindi. Bank of Baroda title (Hind): same size, width and baseline as the original; English answer sheet (Times-Bold → Tinos Bold): fits at full size.
- 18 woff2 files (306 KB, loaded per unicode range only when used) pinned to versioned `fonts.gstatic.com` URLs with sizes and SHA-256 in `editor/public/fonts/replacement/manifest.json`, checked by `npm run check:fonts`. Hind rendered in an exported PDF through pdf.js and macOS Quartz.
- Width fitting no longer applies an 8 % safety margin, which shrank exact-metric fonts; OCR widths get a 4 % tolerance and shrinking stays capped at 12 %.

### Known
- Word's faux bold (text render mode 2 with a stroke) is not reproduced; replaced text uses the regular weight.

## Native-looking replacement text, 21 November 2026

### Changed
- Replacement text matches the original's look: serif or sans, bold and italic are read from the PDF font name (`Times-Bold`, `Cambria,BoldItalic`, `Arial-BoldMT`) or an italic shear and mapped to Noto Serif/Sans Devanagari. Unchanged text is shrunk by up to 12 % towards the original line width when the substitute font is wider.
- Replacement text sits on the original baseline: lines carry the PDF run's or Tesseract's baseline, and the box is placed using the browser's measured baseline position of the chosen font. Bank of Baroda title: editor baseline 93.26 pt vs PDF 93.3 pt; the kept underline sits under the new text again.
- Export paints edited text with Canvas 2D `fillText` at the measured baseline, using the browser's own line breaks read back from the editor layout. html2canvas drew Devanagari about 5 pt low in the export frame; html2canvas and jspdf are removed.

### Known
- Exact widths need metric-compatible fonts (Hind, Liberation, Carlito, Caladea) with the font-provenance checks in AGENTS.md; until then text can look up to 12 % smaller or wrap.

## Export from the original file, 21 November 2026

### Changed
- The web export starts from the original PDF instead of photographing every page (ADR 0009). Unedited pages are copied unchanged, so their text stays selectable and their links, forms and bookmarks survive. On edited pages, replaced text is deleted from the page content at glyph level, scans are cleaned with an eraser that keeps table lines, whiteouts are vector rectangles, and new words are browser-shaped images. Bank of Baroda no-op test: every table border kept, pages 2–16 text identical, 985 KB instead of 6.4 MB.
- The editor previews replaced lines with the same eraser, so table borders stay visible while editing.
- Public copy, `llms*.txt`, 19 guides (reviewed date 21 November 2026) and AGENTS.md now describe the new export. New words are images and not searchable; any edit invalidates a digital signature.

### Fixed
- The scan eraser treats the Devanagari headline (शिरोरेखा) as text, not a ruled line: on a real scan headline runs had 43–59 % of their length attached to letters, borders 0–9 %.
- The smoke test ignores Turnstile's expected refusal on `localhost`.

## Editor detection fixes, 21 November 2026

### Fixed
- Pages set in a KrutiDev-family font are now blocked even when the PDF hides the font name (for example `CIDFont+F1`). The detector also checks the page text for common Hindi words typed as Latin keystrokes, so the editor no longer offers garbled text such as `rFkk dsUnz ljdkj` as editable lines. Tested on a 31-page CISF notice (every page flagged), Unicode Hindi and English PDFs (none flagged).
- Italic text no longer stops a page from being detected. Synthetic italics use a horizontal shear, which the extractor treated as rotation, so every page with an italic run fell back to browser OCR; on the 16-page Bank of Baroda notice that was 8 pages stuck in "Finding text".
- Embedded Hindi text is checked against Tesseract OCR before a page is ready (ADR 0008). Word exports with a broken Unicode map (the Bank of Baroda notice stored कर्मचारी as कममचारी, a Vidhayak letter विधायक as ववधायक) and Chrome-printed PDFs with missing characters now take their Hindi lines from OCR, keep the PDF's English text, rescue rows OCR skipped, and drop logo noise. Tapping the Bank of Baroda title now prefills "कर्मचारी संवर्ग में नियमित आधार पर कार्यालय सहायक (चपरासी) की भर्ती".
- Browser OCR returned no lines at all: tesseract.js v6 only reports lines and words when asked for blocks. Scanned pages now detect text.
- Pages are detected one at a time in page order, so the page on screen no longer waits behind every other page.
- Replacement text on OCR-derived lines is no longer 25–100 % too large. Tesseract line boxes run about 1.25× the font size and grow when a row number joins the line, so OCR lines now use the median word band, and lines on verified pages take their height from the PDF run (its font size is right even when its text map is not). Replacing lines with their own text on the Bank of Baroda notice and its scanned copy now keeps the original size.

### Verification
- Editor lint, 95 tests and production build; browser runs on the CISF notice (blocked as legacy), the Bank of Baroda notice, the Vidhayak letter, a Chrome-printed table, an image-only copy and an English PDF, with zero page errors; standard smoke test passed three times in a row.
- OCR slips remain possible on italic rows (for example 0305.2025 for 03.05.2025); users can correct them while editing, or use Enhance with AI.

## Production readiness, 20 November 2026

### Security
- npm audit reports zero findings in `web-app`, `web-app/editor` and `services/ai-api`. Lockfile updates cover vite, wrangler/miniflare, undici, sharp, typescript-eslint and DOMPurify; tests use happy-dom 21 and vitest 4.1.12.

### Verification
- Editor lint, 85 tests and build; publish, routing, content, analytics and pinned-font checks; AI API 22 tests, typecheck and dry-run deploy passed.
- Local Workers preview browser smoke passed with zero application errors: responsive home, edit export, merge, split, compress, translation consent and article pages. The exported fixture page was inspected and shows correct conjuncts, pre-base ि and reph.

## Released — AI quota, 28 October 2026 (live 20 November 2026)

### Changed
- The free AI allowance is 10 documents a day per device, up from 2; the 50 pages a day ceiling is unchanged and stays the cost cap. Changed in `AI_LIMITS.anonymousDocumentsPerDay` and the D1 trigger (migration `0003_raise_daily_document_limit.sql`). The web Translate tool shows the new number. The live API reports 10, and the production trigger was replaced through the D1 console on 20 November 2026, so Wrangler's migration table does not record `0003`; re-applying it is safe because it drops the trigger first.

## Unreleased — SEO implementation, 1 October 2026

### Changed
- The public homepage is rendered at build time at `/`, with a real Hindi equivalent at `/hi/` and stable reciprocal language links.
- Tool URLs now use `/tools/`; retired `/edit/?tool=` links permanently redirect to the equivalent task while preserving mode, language and tracking state.
- React and static pages share design-system tokens. The homepage uses equal-weight English/Hindi headlines, restrained category chips, pill actions and accessible native disclosures.
- Homepage privacy, legacy-font and image-based export descriptions now match the implemented behavior. Unsupported comparisons and animated headline components were removed.
- Invalid or mixed file selections produce actionable feedback instead of silent rejection.
- The editor records only coarse file-open and validated-export events, without document content or filenames.

### Verification
- TypeScript/build, full ESLint, and unit tests run during implementation; see the execution record for final counts.
- Local Cloudflare preview verified root/tool routing, initial and hydrated canonicals, responsive pages and a real Hindi fixture export.
- Production deployment, GSC selected canonicals, authenticated AI completion and field Core Web Vitals remain unverified.

### Release follow-up
- Final checks: 80 editor tests, 3 routing tests, lint, production build and artifact validation passed; responsive browser smoke and actual Devanagari export passed.
- Existing dependency audit warnings and production-only checks are recorded in `docs/marketing/SEO_EXECUTION_RECORD_2026-10-01.md`.

### Dependency security follow-up
- Compatible lockfile updates clear all 9 reported audit findings: PDF.js 5.5.207, DOMPurify 3.4.16 and Vitest 4.1.11 among the updates. Audit returned zero findings; 80 tests, lint, production build and real Hindi browser export passed.

### Editor navigation safeguard
- Unexported authoring edits trigger browser navigation protection and a focused discard confirmation when opening another file. OCR cache and viewport changes do not trigger it. Export snapshots preserve protection for edits made while an export is running.
- Lint, 81 tests, build and browser keep-editing/export regression passed.

### Validated utilities, consent and analytics
- Merge, split and compression outputs are parsed back and checked against expected page counts before download success. Busy operations disable conflicting file/settings changes; changing inputs clears stale completion state.
- Translation requires explicit text/image-processing consent. Font inspection failures and nameless referenced fonts block processing instead of silently assuming a safe encoding. Compact Turnstile layout and script-load errors are handled.
- Tool outcome events use coarse payloads. Page analytics excludes query strings and raw referrers; analytics runs only on production hostnames. English/Hindi privacy disclosures now describe actual AI and analytics processing.
- Final editor verification: 85 tests across 21 files, lint and TypeScript/build passed. Additional article, analytics and routing tests: 7 passed.

### Reviewed article system
- Replaced legacy generated layouts and unsupported claims with a shared design-system article template and reviewed source data for twenty guides, including four new translated counterparts.
- Five genuine article language pairs use reciprocal hreflang. Unpaired articles have no invented alternate URLs. Government guides link official sources and distinguish preparing an application from changing an issued record.
- Publication requires review metadata; regenerated source/output parity, visible FAQ/schema correspondence, internal links, sitemap dates and article hub are checked. Machine-readable site summaries now match product limitations.

### UI and performance release verification
- PDF vendors remain lazy with explicit chunk dependency ownership. Existing Inter/Noto UI families are pinned and served locally, with provenance, hashes and licenses; export fonts are unchanged.
- Shared popup/file-summary controls use approved geometry. Narrow legal/support navigation and long links reflow correctly. Eight priority guides and eight legal/support pages passed responsive browser checks.
- Local mobile Lighthouse: performance 89, accessibility 100, SEO 100; LCP 3.3 seconds, TBT 0, CLS 0. Field Core Web Vitals remain unverified.
- Actual Hindi exports and a 400/700/800-weight display-font PDF were visually inspected using independent rasterizers. Browser application errors: zero. Production release and account-level GSC/GA4/AI checks await owning-account access.

### Remote main integration
- Fetched remote main before merging. Retained mobile renderer/release work, bilingual recovery and tool labels, PDF.js legacy browser compatibility, About pages and publishing integrations. One shared canonical/build system supersedes the parallel SSR implementation; aliases preserve its previously published tool URLs.

- Article Person schema and visible bylines are aligned with the retained Manish About profile after merge. Source/output and article tests passed.

### Production Workers hosting and project credentials
- GitHub build evidence identifies the existing production Worker; replaced Pages-only deployment config with a Worker entrypoint and ASSETS binding, preserving the verified artifact and redirects. Added www-to-apex normalization.
- Project-installed Wrangler explicitly reads local, ignored credentials or an explicit CI token. The owning account is verified; global OAuth configuration is unchanged.

### Deployed release acceptance
- Runtime/setup release `29181ad1` deployed to the owning production Worker; manual deploy and connected Git build succeeded. Live root/Hindi HTML, retired-tool redirects, www normalization, 404s, font delivery and expanded browser/PDF acceptance passed. Global OAuth is unchanged; the token remains local and untracked.

### Restore the existing homepage
- Restored the original homepage components, styles, section order, floating navigation, cards and animated headline from remote main before the SEO merge (`a4d15967`). Removed the replacement homepage stylesheet.
- Retained crawlable root/Hindi HTML, canonical metadata, redirect compatibility and validated PDF tools. Added only compatibility adapters for the original translation labels and tool links. SEO work must preserve UI/UX unless a design change is explicitly requested.
