# Changelog

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
