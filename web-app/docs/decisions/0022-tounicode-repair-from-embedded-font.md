# 0022: Repair mis-mapped ToUnicode maps from the embedded font

Date: 27 November 2026. Status: accepted (autonomous session; owner granted merge and deploy).

## Context
Real Railway Recruitment Board notices made in Word with Nirmala UI and passed through iLovePDF carry a ToUnicode map that names the wrong letter for many Devanagari glyphs (pre-base ि → "व", थ → "ि", ण → "ड"). Their text layer scored 58 % against hand-checked text; the editor detected the damage and fell back to Tesseract, which reads table pages poorly, so PDF to Word scored 64.5 % and left table cells empty. The embedded TrueType font was intact: its own cmap and GSUB still say what every glyph is.

## Decision
- Read each glyph's letters from the font program (`fontGlyphText.ts`: cmap formats 4 and 12; GSUB single, ligature and extension lookups, composed to a fixed point; `rphf` outputs marked as reph; ि marked as pre-base). No new dependency.
- For Identity-H CIDFontType2 fonts whose ToUnicode contradicts the font's cmap on at least 3 single letters and 5 % of them (after NFC), build a ToUnicode from the font and read text from an **in-memory copy** carrying it (`pdfToUnicodeRepair.ts`, used by `sharedPdfDocument.ts`). The opened file and every export keep the original bytes; rendering does not use ToUnicode. Any failure leaves the file as it was, so the existing OCR checks still apply.
- Reorder the ि and reph marks per text item (`devanagariMarks.ts`).
- In documents with a repaired font, keep the PDF's text when OCR disagrees but at least 75 % of its words are dictionary words (`readsAsHindi`; correct Hindi measured 85–87 %, mis-mapped layers 53–65 %).
- Join a zero-width Hindi run to the run drawn right after it, and drop spaces measured before vowel signs.

## Rejected
- Glyph-by-glyph voting against OCR (the brief's first idea): needs OCR on every page and inherits its table errors; the font already holds the answer.
- Trusting the dictionary on every page: common short words survive mis-mapping, so it is only used where the font itself supplied the letters.
- Rewriting ToUnicode in exported files: exports copy unedited pages unchanged (AGENTS.md), so the repair stays read-only.

## Evidence
PDF to Word on RRB notice page 2 (141 Hindi words): 64.5 % → 100 %, 6.0 s → 2.9 s. Sample notice: digital 100 %, scanned 99.3 % (unchanged). Repair check: 156 ms on a 135-page file it leaves alone, 424 ms on the 38-page file it repairs. Editor tests 469/469, edit-quality gate 23/23, browser smoke `BROWSER_ERRORS []`.

## Amendment, 27 November 2026: maps in drawing order
The 135-page CEN 08/2024 notice (Chrome output merged by PDFsam, so its Producer no longer says Skia) maps letters correctly but in drawing order (pre-base ि named "ि", reph "र्") and leaves conjuncts unmapped, so letters vanished and the editor fell back to OCR (17 s a page, whole phrases missed). Now:
- A map that names a pre-base ि or reph glyph by its plain letter is also repaired: missing entries come from the font, ि and reph get marks; agreeing entries are kept (`inDrawingOrder`).
- Such documents draw their spaces and leave gaps inside words, so, as on Skia pages, only drawn spaces break their Hindi words. A drawn space that the next TJ shift takes straight back (Chrome's typed zero-width joiner, विभिन्‍न) is not a break.
- Marks are resolved after /ActualText alignment, and again at line level when a word is split across pdf.js items (उ ि ल्ल | ि खत); a run ending in a pre-base mark continues on the same line with no space; a run starting with a vowel sign or virama stays on the line of the word before it.
- Ligature glyphs take their full letters before single substitutions.

Evidence: CEN p70, 160 hand-checked Hindi words (items 2–3 and the note before them): OCR path 88.8 %, font path **100 %**; the page reads 621 Hindi words instead of 492, in 1.8 s instead of 17.2 s. RRB p2 100 %, sample notice 100 % / 99.3 % unchanged; gate 23/23, Plan B case, smoke clean.

## Open
- ~~The 135-page CEN 08/2024 notice is broken differently~~: drawing-order maps, handled (amendment above, PR #87).
- ~~A self-made mis-mapped fixture~~: `mobile-app/fixtures/mismapped-tounicode-fixture.pdf` (PR #85).

## Amendment, 27 November 2026: text drawn as empty boxes

Word sets Hindi in a font without Devanagari (Courier New, Gulim) when the chosen font lacks it; the PDF then draws glyph 0, the font's empty box, and its ToUnicode names that glyph "अ" or "क" (RRB 01/2026 pages 4, 21–22, 25, 30, 32–35). The file does not hold that text, so it cannot be repaired, and OCR reads boxes no better. In the same read-only copy, a Type0 Identity font whose map names code 0 as a letter has that entry replaced by a private-use mark that extraction drops, so boxes no longer read as "अअअअ". Pages that use such a font are kept as candidates and confirmed from their text (the mark appears); PDF to Word lists them and asks the user for the original file. Rejected: OCR of those pages (it reads the boxes as random letters) and guessing the text.

## Amendment, 27 November 2026: below-base rakar (`blwf`) and backwards rakar maps

OpenType Devanagari v1 (`deva`) fonts (such as Arial Unicode MS and older Mangal tables) define the below-base rakar glyph (`blwf`) on `[र, ्]` rather than `[्, र]` and compose rakar conjuncts via `vatu` (`[प, rakar] → प्र`, `[प्, rakar] → प्र्`). Reading `blwf` naively as `"र्"` turned every rakar conjunct backwards (`प्राधिकार → पर्ाधिकार`, `राजपत्र → राजपतर्`). In addition, a PDF's ToUnicode can name a below-base rakar glyph or rakar conjunct backwards as `"र्"` while agreeing on every single letter. Now:
- `fontGlyphText.ts` reads `blwf` outputs of `[र, ्]` or `[्, र]` as `"्र"` (rakar), and composes `[half(C), rakar]` in `vatu` as `C्र्`. Real reph glyphs (`rphf`) remain marked with `REPH_MARK` (`\uE0F0`), and half-ra (`half`) stays `"र्"`.
- `pdfToUnicodeRepair.ts` (`hasBackwardsRakar`) also triggers repair when ToUnicode maps a `"्र"` glyph or rakar conjunct backwards as `"र्"`, updating those entries without disturbing real reph glyphs.

## Amendment, 27 November 2026: `/ActualText` with escaped PDF Name tags and omitted spaces

Pdftools SDK exports (corpus file `c10.pdf`) embed Hindi in a simple `/TrueType` font (no Unicode cmap, no GSUB) whose ToUnicode maps the first glyph of each syllable to the entire syllable it first appeared in (leaving trailing matra glyphs unmapped, including byte `0x0A` `'\n'`), while placing exact UTF-16BE `/ActualText` on every syllable inside Word style tags such as `/Normal#20#28Web#29 <</MCID 2>> BDC`. Two bugs in `pdfActualText.ts` broke those pages:
- `markedContentStarts` left `#XX` PDF Name escapes undecoded (`Normal#20#28Web#29`), whereas pdf.js's `Lexer.getName` decodes them (`Normal (Web)`), so `drawnGlyphs` aborted on tag mismatch and dropped all `/ActualText` spans on the page. Now `markedContentStarts` decodes `#XX` escapes to match pdf.js.
- When a real drawn space glyph outside `/ActualText` was dropped by pdf.js from `getTextContent()` (deduplicated against a preceding `0x0A` matra byte), `applyActualText` silently skipped it and lost the word break (`के सभी → केसभी`). Now omitted drawn spaces are recorded and emitted as `spaceAfter` (across items) or an inline space (within an item).

## Amendment, 27 November 2026: small bold heading subsets and GSUB lookup type 6

Word exports with Mangal body text and small Mangal-Bold heading subsets (e.g. UP payscale GO, Supreme Court of India orders) repaired the body font but left the bold subset unrepaired: headings drew only width-matched contextual `ि` variants (`pres` GSUB lookup type 6, format 3) and half/reph ligatures, so Word's subsetter omitted base `ि` (U+093F), virama (`्`), and standalone `ो` from the subset font's `cmap` while leaving GSUB intact. That left the bold subset with only 1–2 single-letter disagreements (below the 3-glyph threshold), so headings read `ववत्त`, `ददनांकः`, `ससवर्वल`, `अधिकाररता`. Now:
- `fontGlyphText.ts` reads GSUB lookup type 6 (format 3) inside `pres` lookups: an unmapped single input glyph with ≥3 distinct contextual single-substitution variants before Devanagari lookahead glyphs is seeded as `ि` (`PRE_BASE_MARK`), so all its contextual variants are resolved. Likewise, an `rphf` `[र/ऱ, virama]` ligature seeds an omitted virama, and reph-carrying ligatures whose base vowel sign was omitted from `cmap` are reported in `rephLigatures` so repairing `व` (`र्व → व`) preserves the reph on `ो+reph` (`सर्वोच्च`).
- `pdfToUnicodeRepair.ts` repairs a font when its map names any font-proven `PRE_BASE_MARK` or `REPH_MARK` glyph as a Devanagari consonant (`misMapsMarkAsConsonant`, excluding `REPH_MARK → "र्"` drawing order), or in a second pass when a sibling font of the same family (`fontFamilyKey`) was already repaired as mis-mapped and the subset has at least one disagreement. Sibling subsets whose map is right (zero disagreements, such as `FORKWM+Mangal-Regular` in `c3` and `ABCDEE+Mangal` in `c11`) remain untouched.

## Amendment, 27 November 2026: silent corrupted pages that skip OCR (mixed unrelated scripts, glued tokens, failed fonts)

Two classes of corrupted Devanagari text layers could silently skip OCR fallback when the page was too short for `canJudgeDevanagari` (15 complex + 15 plain words):
- Older Acrobat Distiller / PDFMaker `ArialUnicodeMS` maps (e.g. RBI circular `37_bank_rbi`) map Devanagari conjunct/presentation glyph IDs into unrelated Unicode blocks (`U+1B80–U+1CFF`, producing `पिरिश᳥`, `पिरपᮢ`, `अᲦूबर`, `देखᱶ`). Now `hasMixedUnrelatedScript` in `embeddedTextVerification.ts` flags any token mixing Devanagari letters with `U+1B80–U+1CFF` or non-Devanagari/non-Latin/non-Greek letters, returning `"corrupted"` even on short pages.
- Pages whose Hindi is glued into a few very long tokens without spaces (e.g. Rajasthan High Court order `30_court_hcraj` p4: 6 lines, 8 tokens up to 55 characters long) fell below `canJudgeDevanagari` and hit `ocr.ts`'s `FEW_DEVANAGARI_LINES` early return without falling back to OCR. Now `hasGluedDevanagariWords` flags pages where ≥ 35 % of Devanagari word characters lie in ≥ 25-character tokens (≥ 2 glued tokens, or 1 glued token ≥ 30 chars on a ≤ 4-word page), and `embeddedTextTrust.ts` (`hasFailedFont`) + `ocr.ts` also ensure short pages using a font that already failed on earlier pages bypass the early-return shortcut and are judged corrupted when fewer than 50 % of their words agree with OCR.





