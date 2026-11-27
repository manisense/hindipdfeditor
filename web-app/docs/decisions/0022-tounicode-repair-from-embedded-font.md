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
- The 135-page CEN 08/2024 notice is broken differently (not repaired by this rule); investigate next.
- The RRB page is not in the repo (third-party file); a self-made mis-mapped fixture should be added to the gate.

## Amendment, 27 November 2026: text drawn as empty boxes

Word sets Hindi in a font without Devanagari (Courier New, Gulim) when the chosen font lacks it; the PDF then draws glyph 0, the font's empty box, and its ToUnicode names that glyph "अ" or "क" (RRB 01/2026 pages 4, 21–22, 25, 30, 32–35). The file does not hold that text, so it cannot be repaired, and OCR reads boxes no better. In the same read-only copy, a Type0 Identity font whose map names code 0 as a letter has that entry replaced by a private-use mark that extraction drops, so boxes no longer read as "अअअअ". Pages that use such a font are kept as candidates and confirmed from their text (the mark appears); PDF to Word lists them and asks the user for the original file. Rejected: OCR of those pages (it reads the boxes as random letters) and guessing the text.
