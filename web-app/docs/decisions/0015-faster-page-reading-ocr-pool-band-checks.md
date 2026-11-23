# 0015 — Faster page reading: OCR worker pool, band checks and per-font trust

Date: 23 November 2026

## Problem

PDF to Word took about 3 minutes for a 31-page, 2.8 MB Word-made Hindi PDF in KrutiDev. Each page's converted text was checked against Tesseract OCR of the whole page, one page at a time on one worker. Full-page OCR of a dense page takes 5–10 s, and the conversion itself takes milliseconds.

## Decision

1. **Worker pool:** OCR runs on a pool of Tesseract workers per language (`poolSizeFor` in `ocrPoolSize.ts`). The pool is 1 worker on devices with 2 GB of memory or less, at most 2 on 4 GB devices and on phones that do not report memory (Safari), and at most 4 otherwise; never more than cores − 1. PDF to Word reads that many pages side by side and keeps them in page order. Progress counts finished pages.
2. **Band check:** a page with enough embedded Devanagari is checked on a band of its top lines, about 30 complex and 30 plain words, twice the minimum the check needs. The band is cut from the page image and goes through the same complex/plain comparison as before (`embeddedDevanagariVerdict`). Only a passing band skips full-page OCR. A failing or too-short band reads the whole page exactly as before. Pages with unmapped glyphs always read the whole page. So every KrutiDev page is still checked against OCR, as AGENTS.md requires.
3. **Per-font trust (Unicode text only):** when a font's own Devanagari has passed full-page checks over at least two pages, later pages that draw Devanagari only in trusted fonts keep their text without a check. A font that ever fails is never trusted again, and every 8th skippable page is checked anyway. KrutiDev conversions and pages with unmapped glyphs are never skipped. Trust is kept per opened document.
4. **Edit PDF read-ahead:** Edit PDF's background reading runs as many lanes as there are OCR workers, each taking the next page in `nextOcrPage` order, so the page on screen goes first (added later on 23 November: all 31 pages ready in 30 s instead of 66 s).
5. **Lazy page images:** PDF to Word draws a page image only when that page needs OCR.

## Result

Measured on an 8-core Mac in headless Chrome:

- **31-page KrutiDev Word PDF:** 184 s before, 32.5 s after.
- **31-page fixture mix:** 37.5 s before, 18 s after.

The Word files are byte-identical before and after in both cases. The edit-quality gate passes.

## Phone check (emulated)

Measured with a 390 px mobile viewport, the CPU slowed 4×, and spoofed memory and cores, converting the 31-page file:

| Workers | Time | Peak memory (whole browser) |
|---|---|---|
| 1 | 74 s | 932 MB |
| 2 | 49 s | 1001 MB |
| 4 | 37 s | 1007 MB |

Each extra worker adds about 70 MB. Converting 120 pages with 2 workers holds steady at about 790 MB (peaks near 1 GB), with no growth across pages. Chrome's CPU throttling may not slow web workers, so the times are indicative only; a real low-end phone still needs checking by hand.

## Trade-offs

- A band check reads fewer words than a full page, so a page whose top band is fine but whose lower part is corrupted would keep its text. Corruption comes from a font's character map or from misidentifying a legacy font, both of which affect the whole page. The band is twice the minimum sample.
- Up to 4 workers use more memory (each loads the Hindi model, about 70 MB). Devices with 2 GB or less use 1; 4 GB devices and phones without a memory figure use 2.
- Pages read in parallel can teach unmapped glyphs in a different order. Every repaired word must still match OCR of its line, so the result stays correct.

## Rejected

- **Lower OCR resolution:** small Hindi text drops below what Tesseract reads well, so more pages would fail the check and fall back to slower, worse OCR.
- **Skipping the check for KrutiDev pages:** AGENTS.md requires each converted page to be checked against OCR.
