# 0021 — Web-only Plan B trial: HarfBuzz WASM + CID/Identity-H vector Hindi text

Date: 27 November 2026

## Decision

The web editor adds an opt-in **Plan B** vector text export path, **off by default**, with today's Plan A raster PNG path (ADR 0009) kept as the default and per-edit fallback. The Android app (`mobile-app/`) is out of scope and stays on Plan A.

- **Switch (`vectorTextFlag.ts`):** disabled unless `?planB=1` (or `true`/`on`) is on the URL, `localStorage['hpe.export.vectorText'] === 'on'`, or `exportPdf(..., { vectorText: true })` is passed explicitly. `?planB=0` overrides `localStorage`. When off, the Plan B module and HarfBuzz WASM binaries are never fetched.
- **Shaping (`harfbuzzWasm.ts`):** `harfbuzzjs@1.6.4` (MIT, zero runtime dependencies, maintained by HarfBuzz maintainers, released 22 October 2026). Both `harfbuzz.wasm` (444 KB) and `harfbuzz-subset.wasm` (684 KB) are bundled as content-hashed same-origin Vite assets under `/edit/assets/`, complying with the strict CSP (`'wasm-unsafe-eval'`, no `'unsafe-eval'`). Mixed lines are split into `Deva`/`Latn` script runs and shaped with `hb_buffer_add_utf16` and monotone grapheme clusters.
- **Subsetting and variable-font instancing (`harfbuzzWasm.ts`, `ttfMetrics.ts`):** each used `(fontFamily, weight)` is subsetted once per document with `harfbuzz-subset.wasm` using `HB_SUBSET_FLAGS_RETAIN_GIDS` (so `CIDToGIDMap /Identity` uses HarfBuzz GIDs directly) and pinning `wght` to the edit weight plus every other `fvar` axis (e.g. `wdth`) to its default. This turns the 647 KB variable Noto font into a ~11 KB Flate-compressed static TrueType subset that Poppler, pdf.js, Acrobat and Preview render identically.
- **PDF emission (`pdfVectorText.ts`):** embeds a Type0 / `CIDFontType2` / `Identity-H` font with metrics and `/W` widths parsed directly from the static subset's `head`/`hhea`/`maxp`/`hmtx`/`OS/2`/`post` tables, plus a chunked `ToUnicode` CMap (≤ 100 entries per `beginbfchar` block). Never uses `pdf-lib`'s string-based `drawText()`; writes 2-byte glyph IDs inside `TJ` arrays with exact `xAdvance`/`xOffset` adjustments and `Ts` text rise for non-zero `yOffset`.
- **Copy and search (`/ActualText`):** wraps each non-whitespace word containing a multi-glyph or multi-codepoint cluster in `/Span << /ActualText <FEFF...> >> BDC ... EMC` (UTF-16BE hex with BOM), leaving single-glyph space characters outside `/Span`. Wrapping whole words rather than individual clusters prevents Poppler (`pdftotext`) from inserting spurious spaces after GPOS `xOffset` mark adjustments (such as `ृ` in `प्रकृति`).
- **Layout and fallback (`textRaster.ts`, `exportPdf.ts`):** Plan B reuses the browser's exact line wrapping and baseline measurements (`measureTextEditLayouts`), preserving z-order relative to images and highlights. Any edit using a WOFF2-only matched font (`Arimo`, `Tinos`, `Carlito`, `Caladea`, `Hind`), producing a `.notdef` (GID 0) glyph, or hitting a WASM load error falls back transparently to Plan A.

## Reason

Under Plan A (ADR 0009), untouched original text stays real PDF text, but every edited or newly added Hindi word becomes a transparent PNG that cannot be selected, copied, or searched and softens when zoomed. Plan B makes edited and newly added Devanagari sharp vector outlines and real selectable Unicode text while keeping default exports untouched until the trial is validated on more real documents.

## Rejected

- **Enabling Plan B by default immediately:** real-world government notices, rotated/cropped pages and exotic font mixes need trial validation before flipping the default.
- **Adding `wawoff2` to decode matched Latin `.woff2` fonts:** `wawoff2@2.0.1` has not been updated since May 2022; falling back to Plan A for the five `.woff2`-only matched families avoids taking on an unmaintained dependency while covering every `NotoSansDevanagari` and `NotoSerifDevanagari` edit in Plan B.
- **Cluster-level `/ActualText` spans:** verified with Poppler 25.03.0 that GPOS `xOffset` jumps between adjacent `/Span` blocks caused `pdftotext` to split `प्रकृति` into `प्रकृ ति`; word-level `/ActualText` spans fixed it cleanly.
- **Mobile Plan B:** out of scope; the Android app remains on Plan A (Phase 5 deferred).

## Amendment — Typesetting edits in the document's own embedded font (27 November 2026)

Still **off by default** inside the Plan B trial (`?planB=1` / `hpe.export.vectorText`), when an edit replaces a run on a page whose original font is an embedded TrueType/OpenType CID font (`Type0` / `CIDFontType2` / `Identity-H`, `FontFile2`), Plan B typesets the replacement in **that same embedded font program** instead of bundling Noto Sans Devanagari (`ownFont.ts`, `contentStreamText.ts`, `pdfTextRemoval.ts`, `pdfVectorText.ts`, `exportPdf.ts`).

- **Font identification (`contentStreamText.ts`, `pdfTextRemoval.ts`, `exportPdf.ts`):** `removeGlyphsInRects` records the PDF font resource names and removed glyph counts per replacement mask (`removedFontsPerRect`). Candidates are ordered by removed glyph count descending and extracted lazily (only when Plan B is active) without modifying the page or source PDF.
- **Strict fail-closed eligibility (`ownFont.ts`):** an embedded font is used only when all of the following hold; any failure falls back unchanged to the bundled Noto Plan B path:
  1. Valid TrueType sfnt (`head`, `hhea`, `maxp`, `hmtx`, `loca`, `glyf`, `GSUB`).
  2. `OS/2` `fsType` does not forbid embedding (bit 1, `0x0002`, restricted licence); installable (`0`), preview & print (`0x0004`), and editable (`0x0008`) are permitted because the font is already embedded in the same document.
  3. `GSUB` contains a `deva` or `dev2` script whose `LangSys` references at least one active feature with valid lookups.
  4. HarfBuzz loads the font at its native coordinates and shapes every line with no `.notdef` (GID 0), every whitespace glyph has positive advance, and every visible glyph (including recursive components of composite glyphs) has a real outline in `glyf`/`loca`.
- **Non-mutating PDF emission (`pdfVectorText.ts`):** writes a **new** `Type0` / `CIDFontType2` / `Identity-H` font object (`HpeOwn*`) whose `FontDescriptor` `/FontFile2` reuses the original embedded stream's indirect `PDFRef` directly (zero duplicate font bytes and zero mutation of the original font dictionary used by untouched text), with `/W` widths from the font's `hmtx`, a complete `ToUnicode` CMap for every written GID, and word-level `/ActualText` spans. Size, position, colour, `scaleX`, italic shear, and faux-bold stroke match the existing Plan B path.
