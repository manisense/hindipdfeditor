# Test fixtures

`devanagari-fixture.pdf` is the one fixed test fixture required by `AGENTS.md`'s testing section — use the _same_ file for every Phase 0/1/3 verification pass instead of eyeballing different ad hoc text each time.

## What it contains

Two sentences chosen to hit every shape category called out in spec Section 10 (Phase 0) and `AGENTS.md`:

| Feature              | Word                | Detail          |
| -------------------- | ------------------- | --------------- |
| Conjunct             | क्षेत्र             | क्ष (क + ् + ष) |
| Conjunct             | ज्ञान               | ज्ञ (ज + ् + ञ) |
| Conjunct (bonus)     | क्षेत्र, विद्यालय   | त्र, द्य        |
| Reph                 | धर्म, सूर्य         | र्              |
| Matra above baseline | क्षेत्र, में, रोशनी | े, ो            |
| Matra below baseline | गुरुजी, सूर्य       | ु, ू            |

## How it was generated

`devanagari-fixture.pdf` is **not hand-edited**. It's generated from `devanagari-fixture.html` via headless Chrome (Chromium's HarfBuzz-backed renderer — the same rendering lineage this app's whole architecture depends on, see spec Section 2–3), so the fixture itself is produced the same way this app will produce its output, not by some unrelated tool that might shape Devanagari differently.

To regenerate after editing the HTML:

```bash
cd fixtures
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-sandbox \
  --print-to-pdf="devanagari-fixture.pdf" --print-to-pdf-no-header \
  "file://$(pwd)/devanagari-fixture.html"
```

Verify after regenerating — don't just trust the command exited 0:

```bash
file devanagari-fixture.pdf          # should say "PDF document", not report anything else
pdftotext devanagari-fixture.pdf -   # confirms extracted text is real Unicode Devanagari, not garbled
pdftoppm -png -r 150 -f 1 -l 1 devanagari-fixture.pdf preview  # then look at preview-1.png
```

## Verified July 2026

Extracted text round-trips correctly (real Unicode Devanagari, not garbled) and a visual render at 150dpi confirms every conjunct listed above renders as a single joined glyph, reph sits correctly above the following consonant, and matras attach in the correct position — no disconnected pieces. This is a positive signal for the architecture's core HarfBuzz assumption, generated via desktop Chrome rather than Android's WebView — it does not replace the actual Phase 0 spike on a real Android build (spec Section 10), which still must be run and recorded separately.

## `multipage-fixture.pdf`

A separate, minimal 3-page fixture (`multipage-fixture.html` → `multipage-fixture.pdf`, same generation process as above) used only for Phase 2's page-navigation/persistence/multi-page-export verification. Each page has distinct identifying text ("पहला पृष्ठ" / "दूसरा पृष्ठ" / "तीसरा पृष्ठ") so a navigation bug (wrong page rendered, edits leaking across pages) is visually obvious. Kept separate from `devanagari-fixture.pdf` rather than making that one multi-page, since AGENTS.md requires the _same_ fixture across every Phase 0/1/3 verification pass for comparable results — this fixture isn't part of that set.

## Translation fixtures

`translation-quality.json` is the deterministic semantic acceptance corpus for Hindi → English
and English → Hindi. It records required meaning and fragments that must survive byte-for-byte,
without requiring one exact model phrasing.

`translation-bilingual-fixture.html` and its generated PDF contain separate Hindi and English
source pages with tables, formal prose, names, dates, amounts, URLs, identifiers, conjuncts, and a
reph. Generate and validate the PDF with the same headless-Chrome and Poppler commands documented
above; this is an additional translation fixture and does not replace the canonical shaping fixture.

## `legacy-krutidev-fixture.pdf`

A stand-in for a Kruti Dev document, used to check that editors refuse to edit legacy-font pages. It fails closed on the web and offers raster-only replacement on Android. Its text is stored as ASCII ("d\`fr nso" is how Kruti Dev stores कृति देव), and its font's BaseFont is `KrutiDev010`. The real font is proprietary and not shipped, so the glyphs render as Helvetica. The detector keys on the font name, exactly as it does for a real file. Regenerate it with `node scripts/make-legacy-font-fixture.mjs` from `web-app/editor`.

## faux-bold-fixture.pdf

Latin lines emboldened the way Word does for a font with no bold face: text render mode 2 (fill and stroke) with a line width of 0.025 and 0.05 of the 16 pt font size, next to a regular line and a real Helvetica-Bold line. Used by the web edit-quality gate to check that new words in faux-bold lines are repainted with the same stroke. Latin only, because pdf-lib (which writes the stroke operators) cannot shape Devanagari; headless Chrome prints `-webkit-text-stroke` as two separate passes, not render mode 2, so it cannot produce this either. Regenerate (deterministic) with:

```bash
node web-app/scripts/make-faux-bold-fixture.mjs
```

## form-fixture.pdf

A one-page AcroForm: one-line text fields (one with a tooltip name), a multi-line text field, a check box, a two-button radio group and a dropdown, each with a printed Latin label. Used by the web edit-quality gate to check Fill PDF form: Hindi answers keep their Unicode value and get a browser-drawn appearance, Latin answers keep pdf-lib's vector appearance. Regenerate (deterministic) with:

```bash
node web-app/scripts/make-form-fixture.mjs
```
