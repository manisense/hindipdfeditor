# Hard problems brief: making Hindi PDF Editor the world's #1 Hindi + English PDF editor

Written 27 November 2026, after a session that shipped PRs #74–#80. Audience: the next agent working on this repo. Every claim below was checked in this repo or on production that day; anything unverified is marked.

The goal is measured, not declared: **output quality on real Hindi and English files first**, then speed, then breadth of tools. The site is https://hindipdfeditor.com (web, `web-app/`); the Android app (`mobile-app/`) is on hold by the owner.

## How to work

1. Read `AGENTS.md` (root) before touching code. Its architecture rules, public-claims rules and testing rules are binding; this brief never overrides them.
2. Pick the highest-ranked problem below whose **Owner decision** is "none" or already granted. Problems needing a decision: write the decision request (options, cost, recommendation) and move to the next problem.
3. Make each problem's check go **red** before you fix it (a failing test, a benchmark score below target, a gate line missing), then **green**. A fix without a red first is unproven.
4. Verify in a real browser against the production Worker build (`web-app/.claude/skills/verify/SKILL.md`), then on production after deploy. Report what you could not verify (a phone, Microsoft Word) by name.
5. Ship small PRs; the owner has granted merge and deploy. Record each change in `web-app/CHANGELOG.md`, and each architectural call as an ADR in `web-app/docs/decisions/`.

Done for a problem = its **Done when** line holds on production, with the evidence in the PR description.

## Tools you already have

- **Benchmark:** `web-app/benchmark/` holds a one-page Hindi sample notice (digital Chrome-made PDF and a scanned copy), its ground truth, and `score.mjs`, which scores any .docx/.txt/.pdf output as the share of the 144 Hindi words exactly right (`node web-app/benchmark/score.mjs <file>`). Current PDF to Word: digital 100 %, scanned 99.3 %.
- **Gates:** `npm run test:edit-quality` (web-app; needs `NODE_PATH=/Users/manish/paithra/app/node_modules` and `SMOKE_BASE_URL`), `web-app/scripts/browser-smoke.cjs`, `npm run check:publish`, `test:routing`, `test:content`, editor `npm test`, `npm run lint`, `npx tsc --noEmit`.
- **Fixtures:** `mobile-app/fixtures/` (canonical Devanagari fixture with conjuncts, matras, reph; KrutiDev stand-in; forms; multipage).
- **Research:** `reports/Hindi PDF editor market study.md` (competitors, India search demand, pain points, distribution, money) and `web-app/docs/editor-audit-2026-11-21.md` (the editor's gap list and history).

## The problems, ranked by impact on "#1"

### 1. Edited and added Hindi is an image, not text (Plan B)

- **Why it matters:** every new or replaced word in Edit PDF, every Hindi Fill-form answer, and Word to PDF's image mode produce pictures of text. They cannot be searched, copied or read aloud, look soft when zoomed, and fail courts' "searchable PDF" rules. Acrobat users complain about broken Hindi editing; an editor whose Hindi edits are real text would have no equal.
- **Why it is hard:** PDF has no text shaping. Correct Devanagari needs shaping (conjuncts, pre-base ि, reph) done before writing glyph IDs, plus a ToUnicode map and `/ActualText` so copy and search return the right letters. Errors look right in code and wrong on screen.
- **Known approach:** harfbuzzjs (WASM) shapes with the same font file; pdf-lib embeds a subset as CID/Identity-H and writes glyph IDs with `TJ`; `/ActualText` per word. Keep the image path as fallback behind a switch.
- **Guardrail:** AGENTS.md forbids string `drawText()` for Devanagari and makes this "Phase 5, explicit separate decision". Glyph-ID writing after harfbuzz shaping is that Phase 5.
- **Owner decision:** **required** (approve a web-only trial). Not yet given.
- **Done when:** the canonical fixture's edited words render identically (pixel diff) in pdf.js and Poppler, `pdftotext` returns the exact Unicode, and the edit-quality gate passes with the switch on.

### 2. Hindi OCR accuracy ceiling (Tesseract)

- **Why it matters:** scans, image-only PDFs and broken-font pages all depend on OCR. The research found Acrobat has no Hindi OCR at all, so this is a moat, but only if accuracy holds on real scans (stamps, low resolution, small print). The benchmark's one remaining miss is a 9 pt word.
- **Why it is hard:** Tesseract `hin` is weak on bold, small and table text; better engines are large to ship in a browser; cloud OCR changes the privacy story.
- **Options:** benchmark PaddleOCR PP-OCRv5 Devanagari via `onnxruntime-web` (Apache-2.0) against Tesseract on a set of real scans; preprocessing (deskew, contrast). The fix must be our own free, in-browser path; Sarvam Document AI is only a later premium extra (problem 8), never what the free tool depends on.
- **Progress (27 Nov 2026):** `web-app/benchmark/ocr-bench.mjs` compares the two engines. On the one sample scan at 200 dpi, raw page OCR: Tesseract 87.5 %, Paddle 94.4 % (the editor's full Tesseract pipeline gets 99.3 %). Still needs 10 real scans with ground truth.
- **Owner decision:** none for the benchmark; a model over ~10 MB or any cloud default needs one.
- **Done when:** a scanned set of at least 10 real pages scores higher word accuracy with the new path than Tesseract, measured with `score.mjs`-style ground truth, with load time stated.

### 3. Word-made PDFs and mis-mapped glyphs are untested

- **Why it matters:** most Hindi office PDFs come from Microsoft Word (Mangal, Nirmala UI, Kokila; CID TrueType fonts). Some map glyphs to the wrong characters, so their text falls back to OCR and can misread names and numbers (audit item "Mis-mapped glyphs"). The benchmark covers only Chrome-made (Skia, Type 3) and scanned files.
- **Why it is hard:** this machine has neither Word nor LibreOffice, and no real mis-mapped sample is in the repo.
- **Approach:** install LibreOffice (or get Word exports from the owner) and add Word-style PDFs of `web-app/benchmark/notice.html` to the benchmark. Real samples now exist (owner, 27 Nov 2026, kept out of git in `pdfs-for-testing/`): a Railway Recruitment Board notice made in Word 2016 with Nirmala UI (its text layer turns "विस्तृत" into "ववस्तृत" and drops spaces), and a 135-page notice whose Hindi pages (from about page 68) extract as "अनुसूिचत" and lose र्, क्ष, श्र. The planned repair is voting glyph IDs against OCR across the document (`glyphRepair.ts` already does this for Skia files).
- **Owner decision:** none.
- **Done when:** the benchmark has a Word-made digital file scoring 100 % in PDF to Word, and a mis-mapped sample's text is repaired from the PDF itself, not OCR.

### 4. PDF to Word layout fidelity

- **Why it matters:** "pdf to word" is about 5M searches a month in India (Semrush estimate). Output today keeps text, sizes, headings, ruled tables, borderless tables on digital pages and pictures in reading order, but not exact positions, columns, headers and footers, or borderless tables on scans.
- **Approach:** add multi-column and header/footer detection; place pictures and text boxes by position where Word can (anchored frames); extend the benchmark with a two-column page and score structure, not only words.
- **Owner decision:** none.
- **Done when:** a two-column Hindi page and a page with header/footer come out in the right reading order and structure, checked by an extended scorer.

### 5. Legacy fonts beyond KrutiDev

- **Why it matters:** legacy-font conversion is about 400K searches a month (Semrush). KrutiDev and DevLys are covered both ways (PDF, text, .docx). Chanakya, Shivaji, Walkman-Chanakya, Agra, Amar stay blocked by AGENTS.md.
- **Why it is hard:** each font family needs its own verified key map; the fonts are proprietary, so realistic test PDFs need the real font, which cannot be shipped. Text that only *looks* legacy (Latin letters in a normal font) must still fail closed.
- **Approach:** the ADR 0010 pattern: positively identified font name, pinned mapping, OCR agreement check per page, review notice. Mapping tables must come from a permissive source.
- **Owner decision:** **required** (AGENTS.md blocks other encodings).
- **Done when:** one more family (Chanakya first) converts on a real sample PDF supplied by the owner, with the OCR agreement check, and unknown fonts still block.

### 6. Paragraph reflow and true text editing

- **Why it matters:** when an edit outgrows its line, the paragraph reflows, but reflowed lines become images (audit, Minor/missing). Real editors reflow live text.
- **Depends on:** problem 1. Plan B first.
- **Done when:** a reflowed Hindi paragraph exports as searchable text with the original line spacing (edit-quality gate `PARAGRAPH_FLOW_OK` plus a `pdftotext` check).

### 7. Public competitor benchmark

- **Why it matters:** proof beats claims, and answer engines quote measured pages. AGENTS.md allows claims about named competitors only when measured.
- **Why it is hard:** most competitors' terms forbid automated use; Adobe needs an account. The owner chose to run competitors by hand later.
- **Approach:** when the owner sends competitor outputs for `notice-digital.pdf` and `notice-scanned.pdf`, score them with `score.mjs`, then build a dated `/benchmark/` page with method, files and screenshots. Re-run quarterly.
- **Owner decision:** granted for publishing measured results; waiting for the owner's manual runs.
- **Done when:** `/benchmark/` is live with dated, reproducible scores for at least iLovePDF, Smallpdf, Sejda and Acrobat.

### 8. AI features: Sarvam, live test, paying for them

**Owner direction (27 Nov 2026):** Sarvam is a later **premium** extra. Never rely on it: every free tool (OCR, PDF to Word, repair of mis-mapped text) must work fully on our own in-browser code, and Sarvam may only add a paid "higher accuracy" option on top.

- **State:** `services/ai-api` uses Gemini only. Sarvam API access exists (tested 28 Oct 2026: translate and Doc AI OCR).
- **Sarvam Document AI (docs read 27 Nov 2026, https://docs.sarvam.ai/doc-ai/getting-started/overview):** async jobs at `https://api.sarvam.ai/doc-ai/v1/job/{parse|extract|split|classify}` (header `api-subscription-key`), then `GET /doc-ai/v1/job/<id>/status` and `/results`. **Parse** (₹0.50/page, 20 pages a call) returns pages → blocks with text, `layout_tag`, `reading_order`, pixel `coordinates`, `bbox_norm` and confidence; tables as HTML; boxes are per block, not per line. **Extract** (₹1/page basic, ₹2.50 advanced) takes a JSON schema and returns each field with confidence and its page and box. PDF, PNG, JPG, TIFF, DOCX, ZIP; 100 MiB; 22 Indian languages plus English. Premium uses: higher-accuracy OCR (2), better PDF to Word layout (4), auto-filling a form from a document (Extract). **Retention:** the docs disagree (8 days on the capabilities endpoint; "indefinitely" until a workspace Owner sets a data policy, which Document AI does not support yet). Set and confirm retention before any user file is sent, and say it on the consent screen. Consented translation and AI OCR have never been tested end to end on production. Costs: Sarvam OCR ₹0.50/page, translate ~₹5/page.
- **Approach:** add Sarvam behind the existing `/v1/ocr` and `/v1/translate` with provider order as a Worker var; meter pages; run the live test with consent; then UPI passes (research suggests ₹19–99 day/week passes; prices are estimates).
- **Owner decision:** **required** for a monthly Sarvam budget (the grant is mainly for another product, Paithra) and for a payment account and GST.
- **Done when:** a consented Hindi PDF translates on production through Sarvam with Gemini fallback, and the cost per page is logged.

### 9. Android: device verification debt and the Play listing

- **State:** the web app is installable with an Android share target (ADR 0020), not yet tried on a phone. The native app 1.1.0 has unchecked items on device (pinch zoom, TalkBack, back behaviour, full matrix), and Expo SDK 56 has a known Hermes memory regression fixed in SDK 57.
- **Why it is hard:** no phone here. Every Android claim needs the owner to test.
- **Approach:** a Trusted Web Activity (Bubblewrap) wrapping the web app is the cheap Play presence; it needs `assetlinks.json` and the owner's Play Console.
- **Owner decision:** **required**: new listing or replace `com.hindipdfeditor.app`; resume or keep holding the native app.
- **Done when:** the owner confirms "Share → Hindi PDF Editor → Edit PDF" works from WhatsApp on a real phone.

### 10. Low-end phone performance

- **State:** memory and worker counts were measured on an emulated phone only (ADR 0015). Edit PDF's OCR and Word conversion of long files are the heavy paths.
- **Done when:** a real low-end Android phone (2–3 GB RAM) opens, edits and exports the 31-page KrutiDev notice and a 100-page PDF without a crash, with times recorded.

### 11. Offline support for the installed app

- **State:** the service worker caches nothing, on purpose, so an installed app never runs a stale build.
- **Hard part:** the editor's OCR and font files are megabytes; a cache must be versioned per deploy and evicted.
- **Done when:** with the network off, an installed app opens Edit PDF and exports a digital Hindi PDF, and after a deploy the next launch runs the new build.

### 12. Smaller asks that need the owner

- **Compress to a target size** ("under 100 KB"): AGENTS.md currently says "quality slider, not size presets"; needs the owner's OK and an honest "could not reach" message.
- **Certificate-based digital signatures (DSC):** only image signatures exist; needs a signing provider or user certificate flow (PAdES).
- **Exam presets for the photo/signature resizer:** limits must come from official notices; government sites blocked automated downloads in this session.

### 13. Operations that quietly hurt growth

- **GitHub Actions is locked for billing**, so CI (CSP check, IndexNow workflow) does not run; IndexNow now runs from the Cloudflare deploy, unverified (no access to build logs). Owner action.
- **Search Console:** sitemap acceptance and indexing unchecked; GA4 counts page views twice (site script plus tag gateway). Owner action.
- **`npm run refresh:content` rewrites `llms.txt` and `llms-full.txt` from a template and drops their hand-written lines** (seen twice this session). Fix the generator so it keeps hand-written content, or move that content into the template. No owner decision needed; do this early, since every article change runs it.

## What cannot be done, and why

- **A PDF in KrutiDev:** needs the KrutiDev font embedded; its licence is unclear. Output stays text or .docx.
- **Any guaranteed file size or 100 % OCR:** some files cannot reach a size at a readable quality, and OCR is probabilistic. Say so in the UI.
- **Editing documents issued by an authority** (admit cards, mark sheets, land records): out of bounds by policy. Point to the correction window or affidavit route.
- **Device, Word or third-party verification from this machine:** state it as unverified and ask the owner.

## Owner decisions, in one list

| # | Decision | Unblocks |
|---|---|---|
| 1 | Approve a web-only Plan B trial | Problems 1, 6 |
| 2 | Allow Chanakya (and later other) legacy decoding | Problem 5 |
| 3 | Monthly Sarvam budget; payment account and GST | Problem 8 |
| 4 | Play listing: new or replace; native app resume or hold | Problem 9 |
| 5 | Compress to target size | Problem 12 |
| 6 | Signing provider for DSC | Problem 12 |
| 7 | Clear GitHub billing lock; check Search Console; fix GA double count | Problem 13 |
| 8 | Send competitor outputs, a mis-mapped Word PDF, a real Chanakya PDF; test sharing on a phone | Problems 3, 5, 7, 9 |
