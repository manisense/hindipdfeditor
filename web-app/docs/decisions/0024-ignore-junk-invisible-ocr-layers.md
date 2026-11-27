# 0024: Ignore junk invisible English OCR layers on scanned Hindi pages

Date: 27 November 2026. Status: accepted.

## Context

In the November 2026 corpus survey (`docs/corpus-research-2026-11.md`), 6 of 36 public official Hindi PDFs (71 pages across UPPSC, Rajasthan DoIT, Haryana Co-operative Act, Chhattisgarh Mahatari Vandan Yojana, Gautam Buddha Nagar District, and Uttarakhand UCC Rules p1) were scanned Hindi pages carrying an invisible (`3 Tr`) Latin text layer produced by office MFPs or mobile scanners (OmniPage, Canon MFPs, HP Smart Document Scan, Adobe Scan) whose OCR language defaulted to English.

Because the embedded text had no Devanagari and no invalid control characters, `extractEmbeddedTextLines` and `readPageLines` trusted it as a clean digital English page, and `sampleTextLayer` reported the document as needing no OCR. Both the editor and PDF to Word emitted unreadable gibberish (`6Rqlull *164)14) 31f4ftzili`, `tluNeII;T 1!lf6'R`, `trffig-.'tE qrr{rq`) with 0 Hindi words and no warning.

However, real English scans also carry an invisible (`3 Tr`) OCR layer (for example, `16_uk_ucc.pdf` page 2 is the scanned English translation of the Uttarakhand notification), and keeping those avoids unnecessary re-OCR and preserves fast digital extraction.

## Decision

Add a conservative, deterministic per-page detector in `web-app/editor/src/lib/invisibleOcrLayer.ts`:

1. **Text gate (`isEnglishOcrJunk`):** Immediately returns `false` if the page contains any Devanagari (`hasDevanagari`, leaving Devanagari pages to `verifyEmbeddedDevanagari`) or fewer than 12 scored non-numeric word tokens. Pure numbers, dates, times, currency figures, ordinals, and single-character tokens are excluded from the denominator so numeric calendars and tables cannot mask junk words. Each remaining token is judged for plausible English word structure (ASCII letters with normal casing, at least one vowel or common vowelless abbreviation, no triple identical letters, no 5+ consecutive consonants, no `q` without `u` outside known exceptions, and no trailing single-letter hyphen fragments); clean slash/comma pairs (`Secretary/Principal`, `Department,Uttarakhand`) are split before scoring. A page is flagged only when strictly fewer than 50 % of scored word tokens look plausible (`plausibleShare < 0.5`).
2. **PDF structure gate (`isInvisibleTextOverScanImage`):** Walks the page's pdf.js operator list tracking `save`/`restore` and Form XObject state to confirm that at least one non-whitespace glyph is drawn and **every** drawn non-whitespace glyph uses text rendering mode `3` (invisible), and computes the exact union area of painted images clipped to the page viewport (handling single-image, multi-strip, and overlapping MRC scans) requiring at least 60 % page coverage.
3. **Pipeline integration:**
   - `extractEmbeddedTextLines` (`pdfTextExtract.ts`) returns `[]` when `isJunkInvisibleOcrPage` is true, so `ocr.ts` (`readPageLines`) in both the editor and PDF to Word falls through to standard Hindi+English Tesseract OCR (and scanned table detection in PDF to Word).
   - `sampleTextLayer` (`convertPdfToWord.ts`) checks `isEnglishOcrJunk(text)` first (paying no extra operator-list cost on normal digital pages) and, when true, checks `isInvisibleTextOverScanImage` so junk-layer pages count in `withoutText` and UI time/scan estimates stay accurate.

## Rejected

- **Dropping all `3 Tr` text layers unconditionally:** Would force slow re-OCR on genuine scanned English documents such as `16_uk_ucc.pdf` p2 (plausible share 0.886), degrading speed and potentially accuracy on English scans.
- **Running OCR to compare against every Latin-only page:** Expensive on clean English PDFs; the deterministic lexical/structural score separates all 71 corpus junk pages (0.048–0.435) from real English OCR (0.769–1.000; `16_uk_ucc` p2 = 0.886) with a wide margin.
- **Counting pure numbers as plausible words:** On bilingual holiday calendars (`28_dist_gbnagar` p1: 405 calendar numbers vs 239 word tokens), pure numbers would hide the 135 junk Hindi holiday tokens.

## Evidence

- Unit tests (`invisibleOcrLayer.test.ts`): real English OCR kept (including `16_uk_ucc` p2 text with OCR typos and English invoices), all 6 corpus junk patterns rejected, Devanagari layers untouched, short/numeric pages kept conservatively, `sampleTextLayer` and `extractEmbeddedTextLines` verified on `invisible-english-ocr-fixture.pdf`, synthetic English scan with `3 Tr` OCR, `notice-digital.pdf`, and `notice-scanned.pdf`.
- Edit-quality gate (`invisibleEnglishOcrCase` in default gate): `invisible-english-ocr-fixture.pdf` (built from `notice-scanned.pdf` + `3 Tr` Helvetica junk via `web-app/scripts/make-invisible-ocr-fixture.mjs`) went from 0/144 Hindi words (0.0 % recall) to 143/144 (99.3 % recall) in PDF to Word, with UI scan note `"About 1 of 1 pages look scanned."`.
- Corpus (page 1 PDF to Word, files outside git): `03_uppsc_cal` 0 → 202 Hindi words, `11_rj_doit` 0 → 296, `19_hr_1` 0 → 37, `22_cg_mahatari` 0 → 173, `28_dist_gbnagar` 0 → 133, `16_uk_ucc` p1 0 → 146; `16_uk_ucc` p2 (real English OCR) kept unchanged; `notice-digital.pdf` (144/144) and `notice-scanned.pdf` (143/144) unchanged.
