# 0008 — Verify embedded Devanagari text against OCR

Date: 21 November 2026

## Decision

The web editor no longer trusts a PDF's embedded Devanagari text on its own. Each page with Devanagari is read with Tesseract Hindi OCR before it is marked ready (`detectTextLines` in `editor/src/lib/ocr.ts`). The page keeps its embedded lines unless:

- the text layer lost characters (`embedded-degraded`, for example Chrome-printed PDFs that store NUL), or
- `isEmbeddedDevanagariCorrupted` finds that embedded words with ि, a halant, a nasal sign or a doubled letter match OCR far less often than plain words (ratio below 0.7, at least 15 words in each group).

On such a page, Hindi lines and their boxes come from OCR, Latin lines with letters or digits keep the PDF's text, Hindi rows that page OCR skipped are read one rectangle at a time, and low-confidence logo/border lines are dropped. Those lines stay `embedded-degraded`, so consented translation still upgrades them to cloud OCR. Pages are detected one at a time in page order; opening a page starts it at once.

## Reason

Word exports often carry a broken ToUnicode map: the Bank of Baroda notice stores कर्मचारी as कममचारी and a Vidhayak letter stores विधायक as ववधायक, and the same PDFs under-report run widths. Tapping such a line prefilled the wrong text, and editing one word re-rendered the whole line misspelt. Nothing in the text itself reveals the fault, so it can only be found by comparing it with what the page shows. Measured on real files: a correctly mapped page scored a complex-to-plain ratio of 1.00; the broken pages scored 0.27–0.57.

## Rejected

- Trusting the text layer and relying on users to notice (silent corruption of their document).
- A frequency test on ि alone: one broken page still had 2.6 % ि.
- Keeping embedded boxes and swapping in OCR words: the broken PDFs also misplace runs, so boxes came out split and misordered.
- Cloud OCR for every Hindi page: it needs consent and quota; it stays opt-in through Enhance with AI and Translate.

## Cost

Hindi pages become ready a few seconds later (Bank of Baroda page 1: about 16 s including the first OCR model load), and Add text waits for detection as before. English-only pages skip the check.
