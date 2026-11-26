# 0018 — Read /ActualText; OCR only when needed, with a page budget

Date: 26 November 2026

## Decision

- Text extraction reads `/ActualText` from a page's marked content (`pdfActualText.ts`). pdf.js keeps where each `BDC … EMC` section is in the operator list but drops its properties, so the raw content stream is parsed (pdf-lib, loaded once per file, and only for pages that have marked content) and its `BDC`s are matched to pdf.js's sections by order and tag. Each section that holds an unmapped glyph has its glyphs replaced by its text. Any mismatch (a section inside a form XObject, glyphs that do not line up with pdf.js's text items) leaves the page as pdf.js read it, with placeholders and OCR as before.
- On pages that draw their spaces as glyphs (files whose producer is Skia), a line's Devanagari runs are joined in drawing order and other runs are placed among them by position (Chrome draws a line font by font, so a Latin comma comes after the Hindi around it). Devanagari words break only at drawn spaces; other boundaries keep the gap rule. Word and other producers' tagged files are not re-parsed. Font trust (`embeddedTextTrust.ts`) judges such pages by font family on their whole Hindi text. A font still too sparse to judge after 3 checked pages no longer forces checks.
- PDF to Word has an OCR setting: only where needed (default), off, or every page. OCR reads at most 300 pages per file on a computer, 60 on a mid-range phone and 15 on a low-end phone (`ocrPageLimit`, by OCR worker count). Pages beyond the limit are listed as not read. Short checks of a few lines do not count. Long conversions spot-check trusted fonts every 64 pages.

## Reason

Users convert digital PDFs of about 2,000 pages, most of which need no OCR. Chrome, Google Docs and other Skia producers leave Devanagari ligature glyphs unmapped, so those pages went to full-page OCR: 6.5 s a page on a laptop, hours per file, and days on a low-end phone. These producers write each cluster's text as `/ActualText`; MuPDF reads it at 99.7 % word accuracy. Reading it here gave 100 % of 14,440 Hindi words at 0.11 s a page. Scans still need OCR, which takes about 4 s a page on a laptop and an estimated 88 s on a low-end phone, so a page budget keeps a conversion near 20 minutes and tells the user what was not read.

## Rejected

- MuPDF (WASM) for extraction: AGPL, a large download, and a second PDF engine beside pdf.js.
- Patching pdf.js to keep `/ActualText`: a fork to maintain against every upgrade.
- Glyph learning from OCR (`glyphRepair.ts`) as the main path for Skia PDFs: it needs OCR on every page to learn and confirm, which is the cost being removed. It stays as the fallback.
- Cloud OCR for large scans in this change: it uploads the file and changes the privacy wording; left for a separate, opt-in decision.
