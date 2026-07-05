# Hindi PDF Editor — React Native Build Specification

**Status:** Ready to build. Tech stack finalized and version-pinned (Section 4) against package registries and Expo's compatibility matrix as of July 2026. This document is self-contained — it does not assume the reader has any other context. Hand this whole file to your coding agent as its primary brief.

## 1. What we're building

An Android-first React Native app that opens an existing PDF containing Hindi (Devanagari) text and lets the user edit it directly on the page — tap to add new text, or mask and replace existing text — while seeing correctly-shaped Devanagari at every step (proper conjuncts, matras, reph — never broken into disconnected pieces), and exports a real PDF file at the end.

**Hard requirements:**
- Android app, built with React Native.
- Zero budget: open-source / free-tier libraries only. No paid PDF SDKs (no Nutrient/PSPDFKit, no Apryse, no commercial engines).
- True WYSIWYG: what the user sees while editing must match what comes out in the final PDF.
- Devanagari text must **never** render as broken/disconnected characters, at any stage — while typing, in the preview, or in the exported file.

**Non-goals for v1 (do not build these unless explicitly asked):**
- iOS support (architecture is cross-platform-friendly, but don't spend time on iOS-specific polish yet).
- Reflowing/re-justifying surrounding paragraph text when a word is replaced (out of scope — see Section 2).
- OCR of scanned/image-only PDFs.
- Real-time multi-user collaboration.

## 2. The core technical problem (why this isn't a simple task)

PDF is not a semantic format like HTML or DOCX. It stores text as absolute-positioned paint instructions — specific glyph IDs at specific X/Y coordinates on a fixed canvas. It has no concept of "paragraph," "word," or "reflow."

Devanagari is an abugida: consonants carry an inherent vowel, vowel signs (matras) attach above/below/around a consonant, and consonant clusters merge into single conjunct glyphs (e.g. क + ् + ष → क्ष). Correctly displaying this requires **OpenType shaping** — resolving a Unicode string into the right sequence of positioned glyphs via a font's GSUB (substitution) and GPOS (positioning) tables. This is exactly what engines like HarfBuzz do.

**The failure mode this app must avoid:** most basic PDF-generation libraries do a naive 1:1 Unicode-character-to-glyph mapping. Fed Devanagari, they draw disconnected base characters instead of shaped conjuncts. This is a well-documented, recurring problem across many unrelated tools (dompdf, PDF.js, enterprise reporting engines, etc.) — it is not a one-off bug, it's structural to how naive engines handle this script.

**The solution this spec uses:** don't reimplement Devanagari shaping. Android's WebView is Chromium, and Chromium's text renderer is HarfBuzz-backed — the same correct shaping engine already used system-wide on Android. Render the final page as HTML/CSS inside a WebView and export via Android's native print-to-PDF pipeline. 100% of the Devanagari shaping is delegated to production-grade code that already works, instead of hand-rolled or third-party glyph math.

**Do NOT, at any point in this build:**
- Use `android.graphics.pdf.PdfDocument` / `Canvas.drawText()` to draw Devanagari text directly.
- Use `pdf-lib`'s string-based `drawText()` with a raw Unicode string for Devanagari content.
- Introduce any custom OpenType/GSUB/GPOS shaping code in Phase 0–4 of this build.

All of the above either risk rasterizing text into an unselectable image, or require reimplementing shaping logic that's easy to get subtly wrong for this script. Section 12 covers the one sanctioned exception (Phase 5, optional, later).

## 3. Architecture decision (committed — do not re-litigate mid-build)

**Chosen approach: "Render & Print."** The app never computes PDF glyph coordinates itself. Instead:

1. The specific PDF page being edited is rasterized to a high-resolution PNG using the OS's native PDF renderer (this becomes a background image).
2. User edits (new text, masked-and-replaced regions) are tracked as simple positioned data — never as PDF drawing instructions.
3. At save/export time, an HTML document is assembled: one `<div>` per page, with the background PNG as `background-image` and the edits layered on top as absolutely-positioned `<span>`/`<div>` elements, using a real embedded Devanagari font.
4. This HTML is loaded into a WebView and exported to PDF via Android's native print pipeline (`WebView.createPrintDocumentAdapter()`), not by manually drawing onto a `Canvas`.
5. Chromium's own HarfBuzz-backed text renderer does all Devanagari shaping during that render — correctly, because it's the same renderer Android already trusts everywhere else.

This is a real, load-bearing architectural decision, not one option among several — build only this for Phases 0–4. A documented (but deferred) Phase 5 alternative exists for later — see Section 12 — do not build both in parallel.

### Why not the alternatives (context, not a decision to make again)
- **`android.graphics.pdf.PdfDocument` (native Canvas):** risks silently rasterizing text into an unselectable bitmap; designed for generating new documents, not editing existing ones.
- **`pdf-lib` + `@pdf-lib/fontkit`:** fontkit does have real Indic-shaping infrastructure, but this path requires hand-writing all PDF coordinate/baseline/Y-flip math yourself, and there's no strong independent evidence of its reliability across arbitrary real-world Devanagari text. More moving parts, more ways to get it subtly wrong.
- **`pdfnative` (npm):** a real, well-engineered, zero-dependency TypeScript PDF library with genuine Devanagari OpenType shaping. Rejected specifically because its public API is built around **generating new documents** from structured `blocks` (headings, paragraphs, tables) — not placing text at arbitrary coordinates on an **existing** PDF page. Its documented existing-PDF operations are page-tree level (merge/split/extract/inspect), not content-level text placement. Wrong shape for this task, however good the library is at its own job.

## 4. Tech stack

Every package below was checked for current maintenance status and Expo SDK compatibility before being pinned, per this project's dependency-vetting rule — don't swap in an "obviously equivalent" alternative without doing the same check. Re-verify this table if a build is started long after July 2026; the mobile ecosystem's compatibility matrices shift release to release.

### 4.1 Core stack

| Purpose | Choice | Version | Why |
|---|---|---|---|
| App framework | Expo (custom dev client — `expo prebuild` / `expo-dev-client`), **not** Expo Go, **not** bare RN CLI | SDK 56 (React Native 0.85, React 19.2) | `expo-print` is first-party; `react-native-pdf` and `react-native-pdf-page-image` are native modules Expo Go can't load. SDK 56 over the newer SDK 57 (released within days of this check) for stability — zero-budget solo build, no bandwidth to firefight bleeding-edge SDK issues. **New Architecture is mandatory on this SDK** — Legacy Architecture was removed from React Native entirely as of 0.82, so every native module below must run under Fabric/TurboModules, either natively or via RN's Legacy Interop Layer. |
| PDF viewing | `react-native-pdf` + `react-native-blob-util` | 7.0.4 | Displays the source PDF for browsing/page navigation. Actively maintained (Mar 2026). Has documented Fabric/New-Architecture blank-view issues on **iOS**; irrelevant here since v1 is Android-only. Android rendering path is stable. |
| PDF page → image | `react-native-pdf-page-image` | 0.1.5 | Uses PDFKit (iOS) / `PdfRenderer` (Android) natively to rasterize a specific page to PNG, with a `scale` parameter matching Section 8's resolution requirement. **Caveat:** last published Sept 2024, small (16-star) project — see Section 4.2 for the required validation step and fallback plan. Do not treat this row as settled until Phase 0's new checklist item (Section 10) passes. |
| HTML → PDF export | `expo-print` (`Print.printToFileAsync`) | matches SDK 56 | First-party, WebView-based, routes through Android's real print framework. If Phase 0's spike shows meaningfully better selectability or page-break behavior from `react-native-html-to-pdf` instead, swap it in — same architectural slot, don't rebuild around it. |
| Existing-PDF metadata (page size, font inspection) | `@cantoo/pdf-lib` | 2.7.1 | Maintained, API-compatible fork of `pdf-lib`. The original `pdf-lib` (Hopding) is effectively unmaintained — no response to issues/PRs since 2023–2024 — and the ecosystem (including projects like Stirling-PDF) has migrated to this fork. Read-only use here: `PDFDocument.load()`, `getPage(i).getSize()`, and font-dictionary inspection for Section 9's legacy-font detector. Not used for drawing Devanagari text. |
| Devanagari font | Noto Sans Devanagari + Noto Serif Devanagari, Regular + Bold `.ttf`, bundled as app assets | latest from Noto Fonts (OFL license) | Free, open, complete Devanagari OpenType coverage. |
| Edit state | `zustand` | 5.0.14 | Not the hard part of this app — minimal API, no boilerplate. |
| Open PDF from device storage | `expo-document-picker` | matches SDK 56 | First-party file picker; needed for Phase 1's "open an existing PDF from device storage." |
| Font/asset base64 loading | `expo-asset` + `expo-file-system` | matches SDK 56 | Backs `fontAsset.ts` — loads and base64-encodes the bundled font once. |
| Sharing exported PDF | `expo-sharing` | matches SDK 56 | Gets a print-pipeline output PDF (saved to app cache) into an external viewer app — required for Phase 0's "open in at least two different PDF viewers" check. |
| Unique edit IDs | `expo-crypto` (`randomUUID()`) | matches SDK 56 | First-party; avoids adding a dependency just for UUIDs. |
| Testing | `jest` + `jest-expo` | matches SDK 56 | Required for `coordinateMath.ts`'s pure functions (Section 11). |
| Lint/format | `eslint` (`eslint-config-expo`) + `prettier` | latest | Run before considering any checklist item done. |
| Language | TypeScript, strict mode | — | No `any` without a one-line justifying comment. |

### 4.2 The one unresolved dependency risk

`react-native-pdf-page-image` is the least-replaceable, least-maintained package in this stack. It's a pure `NativeModule` (no rendered view — lower New Architecture interop risk than a Fabric UI component like a PDF viewer, but not zero risk). Two newer alternatives exist (`@dariyd/react-native-pdf-page-image`, `expo-pdf-to-image`), but both are single-maintainer projects published within months of this check with no track record, and `expo-pdf-to-image` doesn't even expose the scale/DPI parameter this spec's resolution requirement needs. None of the three is a safe blind pick.

**Resolution: fold this into Phase 0.** Before Phase 1 starts, confirm `react-native-pdf-page-image` actually links, builds, and renders correctly under Expo SDK 56's mandatory New Architecture on a real Android build (see the added checklist item in Section 10).

**If it fails:** don't reach for `@dariyd/react-native-pdf-page-image` or `expo-pdf-to-image` as an automatic next step — vet whichever is tried the same way this section vets everything else. The more robust fallback is a thin, in-house Expo Module (Kotlin, via the Expo Modules API) wrapping `android.graphics.pdf.PdfRenderer` directly — roughly 80 lines, full control over the render scale matrix, zero third-party dependency for the single most fragile piece of the pipeline. `PdfRenderer` is a stable, first-party Android API; this isn't a shortcut around Section 2's shaping rule — it only rasterizes a background image, exactly like the library it would replace.

### 4.3 Explicitly excluded

- Commercial PDF SDKs (Nutrient/PSPDFKit, Apryse) — hard requirement, zero budget.
- `harfbuzzjs` + `pdf-lib` low-level glyph placement — Phase 5 only, deferred; not part of this stack until Phases 0–4 ship and are in real use.
- `@pdf-lib/fontkit` — not needed; this app never draws text with pdf-lib/`@cantoo/pdf-lib`, only inspects existing documents read-only.
- Redux/MobX — zustand covers the state needs described in Sections 7–8.

## 5. Data flow (text description — implement exactly this shape)

```
[Existing Hindi PDF]
        |
        |  react-native-pdf-page-image renders the page being edited
        v
[Background PNG, 2-3x the page's point-dimensions]         [Live text edits]
        |                                                    (native <TextInput>
        |                                                     overlay, tracked as
        |                                                     state — see Section 7)
        |                                                            |
        +-------------------- combined at save time ------------------+
                                    |
                                    v
                  [HTML page: background-image + positioned
                   <span>/<div> layers for each edit]
                                    |
                                    v
                  [Hidden WebView renders the HTML —
                   Chromium's HarfBuzz-backed renderer
                   shapes the Devanagari correctly]
                                    |
                                    v
                  [Android print pipeline, via the WebView's
                   own print adapter — expo-print / react-
                   native-html-to-pdf, NOT a hand-rolled
                   Canvas draw]
                                    |
                                    v
                        [Final exported PDF file]
```

Live editing and export both ultimately depend on the same underlying HarfBuzz-based renderer (Android's native text stack for the live `<TextInput>`, Chromium's for the export) — this is what makes "what you see while editing" and "what you get in the file" consistent.

## 6. Project structure

```
/src
  /components
    PdfPageViewer.tsx        // shows current page: PNG background + live overlays
    EditableTextOverlay.tsx  // the tap-to-edit TextInput
    MaskOverlay.tsx          // drag-to-select mask rectangle for "replace text" edits
    LegacyFontWarning.tsx    // banner shown when a page uses a non-Unicode legacy font
  /lib
    pdfToImages.ts           // wraps react-native-pdf-page-image
    htmlCompositor.ts        // builds per-page HTML for export
    exportPdf.ts             // calls expo-print (or react-native-html-to-pdf)
    legacyFontDetector.ts    // flags Kruti Dev / Shivaji / Chanakya / DevLys etc. on load
    coordinateMath.ts        // dp <-> PDF points <-> background-image-px conversions
    fontAsset.ts             // loads and base64-encodes the bundled Devanagari font once
  /state
    editStore.ts             // DocumentState / PageState / Edit, see Section 8
  /assets/fonts
    NotoSansDevanagari-Regular.ttf
App.tsx
```

## 7. Data model (TypeScript)

Canonical unit for every stored edit is **PDF points** (the page's real, resolution-independent size — from `getSize()`), not device pixels and not the background image's pixel dimensions. Convert to on-screen dp for display and to image pixels for HTML compositing, but always store and reason about edits in points, so re-rendering the background image at a different resolution never invalidates stored edit positions.

```typescript
type TextEdit = {
  type: 'text';
  id: string;
  page: number;              // 0-indexed
  xPt: number;                // top-left origin, page-relative, in PDF points
  yPt: number;
  fontSizePt: number;
  text: string;
  color: string;              // hex
  fontFamily: 'NotoSansDevanagari' | 'NotoSerifDevanagari' | string;
};

type MaskEdit = {
  type: 'mask';
  id: string;
  page: number;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  color: string;               // sampled background color to paint over old text
};

type Edit = TextEdit | MaskEdit;

type PageState = {
  pageIndex: number;
  widthPt: number;
  heightPt: number;
  backgroundImageUri: string;   // local file:// path to the rendered PNG
  imagePxWidth: number;
  imagePxHeight: number;
  edits: Edit[];
};

type DocumentState = {
  sourceUri: string;
  pageCount: number;
  pages: PageState[];
  legacyFontWarnings: { page: number; fontName: string }[];
};
```

## 8. Module specs

### `coordinateMath.ts`
Three conversions, all origin top-left (no Y-flip anywhere in this pipeline — HTML/CSS, RN views, and image pixels all share top-left origin; only raw PDF drawing operations use bottom-left origin, and this architecture never touches that directly):

```typescript
// Screen (dp) -> Points, when the user taps/types in the live overlay
function dpToPt(xDp: number, yDp: number, viewWidthDp: number, pageWidthPt: number): { xPt: number; yPt: number };

// Points -> Screen (dp), to position stored edits back onto the live view
function ptToDp(xPt: number, yPt: number, viewWidthDp: number, pageWidthPt: number): { xDp: number; yDp: number };

// Points -> background-image pixels, for the HTML compositor at save time
function ptToImagePx(xPt: number, yPt: number, imagePxWidth: number, pageWidthPt: number): { x: number; y: number };
```

All three are simple linear scale conversions (`scale = target / pageWidthPt`, or its inverse) — no rotation, no baseline offset math is needed anywhere in Plan A, because nothing here writes directly to PDF content-stream coordinates.

### `pdfToImages.ts`
Wraps `react-native-pdf-page-image`. Renders the specific page being edited at 2–3× its point-dimensions (e.g. a 595×842pt A4 page → ~1190×1684px or higher) so text stays crisp through the print pipeline. Returns `{ uri, pxWidth, pxHeight }`.

### `htmlCompositor.ts`
Builds the full multi-page HTML string for export. One `<div>` per page in the document (even unedited pages need their background image, since export regenerates the whole document in one print call), sized to that page's background image pixel dimensions:

```typescript
function pageHtml(page: PageState): string {
  const layers = page.edits.map(e => {
    const { x, y } = ptToImagePx(e.xPt, e.yPt, page.imagePxWidth, page.widthPt);
    if (e.type === 'mask') {
      const wPx = e.wPt * (page.imagePxWidth / page.widthPt);
      const hPx = e.hPt * (page.imagePxWidth / page.widthPt);
      return `<div style="position:absolute;left:${x}px;top:${y}px;width:${wPx}px;height:${hPx}px;background:${e.color}"></div>`;
    }
    const fontPx = e.fontSizePt * (page.imagePxWidth / page.widthPt);
    return `<span style="position:absolute;left:${x}px;top:${y}px;font-size:${fontPx}px;font-family:'${e.fontFamily}';color:${e.color}">${escapeHtml(e.text)}</span>`;
  }).join('');
  return `<div style="position:relative;width:${page.imagePxWidth}px;height:${page.imagePxHeight}px;background-image:url('${page.backgroundImageUri}');background-size:cover">${layers}</div>`;
}

function documentHtml(doc: DocumentState, devanagariFontBase64: string): string {
  // Wrap all pageHtml(...) outputs with a page-break rule between them and
  // an embedded @font-face using the base64 string (see "font embedding" below).
}
```

Masks render before text at the same coordinate (DOM order or `z-index`) so new text sits visibly on top of the masked-out region.

**Font embedding — do this, not a file path:** embed the Devanagari font as base64 inside an `@font-face` rule in the HTML `<style>` block. WebView print (especially WKWebView on iOS, and unreliably on some Android WebView versions) does not consistently resolve local `file://` paths for CSS assets. Base64-inline it once via `fontAsset.ts` and reuse the string.

### `exportPdf.ts`
Calls `Print.printToFileAsync({ html, width, height })` with `width`/`height` in points matching the source document's actual page size (e.g. 595×842 for A4 — read real values from `@cantoo/pdf-lib`'s `getSize()`, don't hardcode A4 if the source PDF might not be A4).

### `legacyFontDetector.ts`
On document load, use `@cantoo/pdf-lib`'s `PDFDocument.load()` to enumerate embedded font names across all pages. Match against known legacy Devanagari font name patterns: `KrutiDev*`, `Shivaji*`, `Chanakya*`, `DevLys*`, `Walkman-Chanakya*`, `Agra*`, `Amar*`. If any match, populate `DocumentState.legacyFontWarnings` and surface `LegacyFontWarning.tsx` before allowing edits on that specific page — **do not silently allow masking/editing** on a page using one of these encodings (see Section 9 for why).

### `EditableTextOverlay.tsx`
On tap, spawns an absolutely-positioned, transparent-background `<TextInput>` at the tapped location, using the bundled Devanagari font family. Because this is a real native `TextInput`, Android's own text stack (HarfBuzz-backed since Android O) shapes Devanagari correctly live, with zero custom shaping code. On blur/submit, converts the `TextInput`'s dp position to points (`dpToPt`) and commits a `TextEdit` to `editStore`.

### `MaskOverlay.tsx`
Lets the user drag out a rectangle over existing burned-in text they want to replace. On release: sample the average color of the pixels just outside the selected rectangle (from the background PNG) to use as the mask fill color, then commit a `MaskEdit` to `editStore`, followed immediately by spawning an `EditableTextOverlay` in the same region for the replacement text.

## 9. Why the legacy-font check is not optional

Pre-Unicode Devanagari fonts (Kruti Dev, Shivaji, Chanakya, DevLys, and similar) work by mapping Latin keystrokes to Devanagari **shapes** purely visually — the underlying stored bytes are plain ASCII/Latin, not Unicode Devanagari code points. If a page is set in KrutiDev and the app masks over what visually looks like "क" without checking the font, the byte actually stored there is some Latin letter, and any *extraction* of that region (search, copy, accessibility tools) will yield English gibberish, not "क". Detecting and warning before edit prevents building on top of a document whose text layer is already fundamentally mismatched with what's visually displayed.

## 10. Phased build plan (build and verify in this order)

### Phase 0 — Spike (must pass before any other phase starts)
Prove the core architectural assumption before writing app code. This phase now validates two independent things — Devanagari shaping through the print pipeline, and whether the chosen native page-rasterization module actually works — and both must be recorded, not just the first.
- [ ] Minimal Expo + custom dev client project with `expo-print` installed.
- [ ] Hardcoded HTML string containing real Devanagari text with at least: one consonant conjunct (e.g. क्ष or ज्ञ), one reph, one matra above and one below the baseline.
- [ ] Devanagari font embedded as base64 `@font-face` per Section 8.
- [ ] Export via `Print.printToFileAsync`.
- [ ] Open the resulting PDF in at least two different viewers (e.g. Google Drive's built-in viewer and Adobe Acrobat Reader).
- [ ] **Record the result in writing**: do conjuncts render as single joined glyphs (pass) or disconnected pieces (fail — stop and re-evaluate)? Is the text selectable, or does it behave like a flattened image? (Either is an acceptable *pass* for this app's stated requirements — selectability is a bonus, not a requirement — but record which one you got.)
- [ ] **Separately**, install `react-native-pdf-page-image` in the same custom dev client project and confirm it links, builds, and rasterizes a real PDF page on an actual Android build under Expo SDK 56's mandatory New Architecture (see Section 4.2 for why this isn't assumed to just work). If it fails to link or build, stop and implement the Section 4.2 fallback (in-house `PdfRenderer`-based Expo Module) before starting Phase 1 — do not silently substitute a different unvetted third-party package.

### Phase 1 — MVP: single-page edit and export
- [ ] Open an existing PDF from device storage via `react-native-pdf`.
- [ ] Display page 1; tapping anywhere spawns a `TextInput` at that location.
- [ ] Typing Hindi text shows correct live conjunct formation (native `TextInput` shaping).
- [ ] "Save" triggers the full Section 5 pipeline for that page.
- [ ] Resulting PDF, opened in a viewer, shows the typed text in the correct position with correct shaping.

### Phase 2 — Multi-page support
- [ ] Page navigation (next/previous).
- [ ] Edits tracked per-page in `DocumentState.pages[i].edits`, persisted when navigating away and back.
- [ ] Export produces every page of the document in one PDF, not only the page that was edited.

### Phase 3 — Masking / replace-existing-text
- [ ] Long-press or a dedicated "replace" mode triggers `MaskOverlay`.
- [ ] User drags to define the region to mask.
- [ ] Background color sampling implemented (see Section 8).
- [ ] Masked region + replacement text renders correctly in the exported PDF.

### Phase 4 — Legacy font detection
- [ ] `legacyFontDetector.ts` runs on document load.
- [ ] Matches implemented per Section 9's pattern list.
- [ ] `LegacyFontWarning.tsx` blocks or warns before edits on an affected page.

### Phase 5 — Optional, later, only if Phase 0–4 is in real use and you need it
A vector-preserving, smaller-diff alternative export path: `@cantoo/pdf-lib` (see Section 4.1 for why this fork over the unmaintained original `pdf-lib`) + `harfbuzzjs` (the actual HarfBuzz C++ project compiled to WASM by the HarfBuzz maintainers themselves, not a reimplementation — safer than `fontkit` for a script this edge-case-heavy). `harfbuzzjs.shape()` returns glyph IDs and x/y advances via `getGlyphInfosAndPositions()`; walk that array and call the library's low-level glyph-placement API (not its string-based `drawText()`) to place each shaped glyph at its exact coordinate, with font subsetting to keep file size down. This requires real, non-trivial plumbing (font-unit-to-point conversion, subsetting, no shortcuts) — do not attempt this before Phases 0–4 are working and validated in practice.

## 11. Testing / definition of done (per release, not just per phase)

- Devanagari text with at least 3 distinct conjuncts and one reph renders correctly in: the live editing view, and the exported PDF, opened in two different PDF viewers.
- A page detected as using a legacy font blocks/warns before edit, and does not silently corrupt the page.
- Export of a 10+ page document completes without an out-of-memory crash on a mid-range Android device.
- Every edit's position in the exported PDF visually matches its position in the live editing view (no drift from coordinate math errors).

## 12. Known risks and things this spec could not verify with certainty

Be aware of these; validate them yourself rather than assuming either outcome:
- **Text selectability of `expo-print`/`react-native-html-to-pdf` output varies by library version and wasn't confirmed either way for current versions** — Phase 0 must record which you got. It does not block shipping either way, since selectability was never a stated hard requirement — correct, unbroken Devanagari rendering is the requirement, and that holds regardless.
- **Very large documents (100+ pages) exported in a single print call** may be slow or memory-heavy on low-end Android hardware. If this becomes a real problem, export in batches of a few pages and merge the resulting PDFs with `@cantoo/pdf-lib`'s page-copying (`copyPages`), which is cheap and doesn't touch text rendering at all — do this only if you actually hit the problem, not preemptively.
- **Versions are now pinned (Section 4.1, checked July 2026):** Expo SDK 56, `react-native-pdf` 7.0.4, `expo-print` matching SDK 56, `@cantoo/pdf-lib` 2.7.1. What research couldn't resolve without an actual build is whether `react-native-pdf-page-image` behaves correctly under React Native's now-mandatory New Architecture — Section 4.2 explains the risk and Section 10's Phase 0 now gates on it explicitly, with a documented fallback if it fails. Re-check this table before starting a build far in the future.
