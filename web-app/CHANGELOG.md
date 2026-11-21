# Changelog

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
