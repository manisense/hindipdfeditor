# Hindi PDF Editor — React Native Build Specification

**Status:** Phases 0 through 4 all passed, verified on a real physical Android device (Section 10). Phase 0 confirmed the Devanagari shaping bet and the in-house `pdf-page-image` rasterization module work at runtime. Phase 1's single-page edit-and-export loop is confirmed end-to-end, including a real on-device bug found and fixed along the way (background image encoding hung the print WebView when combined with Devanagari text). Phase 2's page navigation, per-page edit persistence, and multi-page export are confirmed end-to-end with a dedicated 3-page fixture. Phase 3 closes the scope gap surfaced during Phase 2: a "Switch to replace text mode" toggle lets the user drag out a rectangle over existing burned-in text with `MaskOverlay.tsx`, which samples the surrounding background color via a new native `sampleAverageColor` call and commits a `MaskEdit` immediately followed by a fresh `TextEdit` in the same spot - confirmed end-to-end on the `devanagari-fixture.pdf` fixture, including in the exported PDF, not just the live preview. Phase 4 wires the already-built `legacyFontDetector.ts` into the app: `App.tsx` runs it on every document open (failing closed to "unknown encoding, block everything" if detection itself throws) and a new `LegacyFontWarning.tsx` banner disables both `handleTap` and `MaskOverlay` on any page whose embedded font matches a known pre-Unicode pattern - confirmed on-device with a synthetic KrutiDev-tagged fixture, and confirmed the real Unicode fixture still shows no false-positive warning. All five build phases from Section 10 are now complete; Phase 5 (direct glyph injection) remains explicitly deferred per AGENTS.md and is not started. Tech stack finalized and version-pinned (Section 4) against package registries and Expo's compatibility matrix as of July 2026. This document is self-contained — it does not assume the reader has any other context. Hand this whole file to your coding agent as its primary brief.

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

1. The specific PDF page being edited is rasterized to a high-resolution JPEG using the OS's native PDF renderer (this becomes a background image). PNG was the original choice here but is confirmed (Section 10, Phase 1) to hang Android's print WebView when a background this size is combined with real Devanagari text shaping through an embedded variable font - JPEG at quality 92 fixed this with no visible quality loss, since the bitmap has no meaningful alpha channel to begin with.
2. User edits (new text, masked-and-replaced regions) are tracked as simple positioned data — never as PDF drawing instructions.
3. At save/export time, an HTML document is assembled: one `<div>` per page, with the background image as `background-image` and the edits layered on top as absolutely-positioned `<span>`/`<div>` elements, using a real embedded Devanagari font.
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

| Purpose                                            | Choice                                                                                                                                          | Version                                           | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App framework                                      | Expo (custom dev client — `expo prebuild` / `expo-dev-client`), **not** Expo Go, **not** bare RN CLI                                            | SDK 56 (React Native 0.85, React 19.2)            | `expo-print` is first-party; `react-native-pdf` and the in-house `pdf-page-image` local module are native code Expo Go can't load. SDK 56 over the newer SDK 57 (released within days of this check) for stability — zero-budget solo build, no bandwidth to firefight bleeding-edge SDK issues. **New Architecture is mandatory on this SDK** — Legacy Architecture was removed from React Native entirely as of 0.82, so every native module below must run under Fabric/TurboModules, either natively or via RN's Legacy Interop Layer. |
| PDF viewing                                        | `react-native-pdf` + `react-native-blob-util`                                                                                                   | 7.0.4                                             | Displays the source PDF for browsing/page navigation. Actively maintained (Mar 2026). Has documented Fabric/New-Architecture blank-view issues on **iOS**; irrelevant here since v1 is Android-only. Android rendering path is stable.                                                                                                                                                                                                                                                                                                     |
| PDF page → image                                   | in-house `pdf-page-image` local Expo Module (`modules/pdf-page-image`)                                                                          | 0.1.0 (in-repo, unversioned-for-publish)          | `react-native-pdf-page-image` (originally pinned here) was confirmed broken — see Section 4.2 and ADR 0004. Replaced with a ~90-line Kotlin Expo Module wrapping `android.graphics.pdf.PdfRenderer` directly: `getPageCount(uri)` and `renderPage(uri, page, scale)`, same shape `pdfToImages.ts` always expected. No third-party dependency for this layer at all now.                                                                                                                                                                    |
| HTML → PDF export                                  | `expo-print` (`Print.printToFileAsync`)                                                                                                         | matches SDK 56                                    | First-party, WebView-based, routes through Android's real print framework. If Phase 0's spike shows meaningfully better selectability or page-break behavior from `react-native-html-to-pdf` instead, swap it in — same architectural slot, don't rebuild around it.                                                                                                                                                                                                                                                                       |
| Existing-PDF metadata (page size, font inspection) | `@cantoo/pdf-lib`                                                                                                                               | 2.7.1                                             | Maintained, API-compatible fork of `pdf-lib`. The original `pdf-lib` (Hopding) is effectively unmaintained — no response to issues/PRs since 2023–2024 — and the ecosystem (including projects like Stirling-PDF) has migrated to this fork. Read-only use here: `PDFDocument.load()`, `getPage(i).getSize()`, and font-dictionary inspection for Section 9's legacy-font detector. Not used for drawing Devanagari text.                                                                                                                  |
| Devanagari font                                    | Noto Sans Devanagari + Noto Serif Devanagari, **variable fonts** (`wght`/`wdth` axes, Thin–Black in one file per family), bundled as app assets | latest from the `google/fonts` repo (OFL license) | Free, open, complete Devanagari OpenType coverage. A variable font was used instead of separate static Regular/Bold files because that's what's actually published for these two families now — one `@font-face` per family, with `font-weight: 100 900`, covers every weight Chromium needs; no separate Bold file to keep in sync.                                                                                                                                                                                                       |
| Edit state                                         | `zustand`                                                                                                                                       | 5.0.14                                            | Not the hard part of this app — minimal API, no boilerplate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Open PDF from device storage                       | `expo-document-picker`                                                                                                                          | matches SDK 56                                    | First-party file picker; needed for Phase 1's "open an existing PDF from device storage."                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Font/asset base64 loading                          | `expo-asset` + `expo-file-system`                                                                                                               | matches SDK 56                                    | Backs `fontAsset.ts` — loads and base64-encodes the bundled font once.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Sharing exported PDF                               | `expo-sharing`                                                                                                                                  | matches SDK 56                                    | Gets a print-pipeline output PDF (saved to app cache) into an external viewer app — required for Phase 0's "open in at least two different PDF viewers" check.                                                                                                                                                                                                                                                                                                                                                                             |
| Unique edit IDs                                    | `expo-crypto` (`randomUUID()`)                                                                                                                  | matches SDK 56                                    | First-party; avoids adding a dependency just for UUIDs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Testing                                            | `jest` + `jest-expo`                                                                                                                            | matches SDK 56                                    | Required for `coordinateMath.ts`'s pure functions (Section 11).                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Lint/format                                        | `eslint` (`eslint-config-expo`) + `prettier`                                                                                                    | latest                                            | Run before considering any checklist item done.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Language                                           | TypeScript, strict mode                                                                                                                         | —                                                 | No `any` without a one-line justifying comment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### 4.2 The dependency risk this section flagged — confirmed broken, then resolved

`react-native-pdf-page-image` was the least-replaceable, least-maintained package originally pinned in this stack. Phase 0's validation step (this section's own prior requirement) confirmed it broken as of `0.2.1`: `./gradlew assembleDebug` failed during dependency resolution, before New Architecture linking was even reached —

```
A problem occurred configuring project ':react-native-pdf-page-image'.
> Could not resolve all artifacts for configuration 'classpath'.
   > Could not download kotlin-stdlib-1.3.50.jar (org.jetbrains.kotlin:kotlin-stdlib:1.3.50)
      > The server may not support the client's requested TLS protocol versions: (TLSv1.2, TLSv1.3).
         Remote host terminated the handshake
```

Root cause: the module's own `android/build.gradle` declares an isolated `buildscript {}` block pinning `com.android.tools.build:gradle:3.5.4` (Android Gradle Plugin from 2019/2020), resolved independently of the root project's toolchain. That old tooling's bundled HTTP client can't complete a modern TLS handshake against Maven Central under Gradle 9.x / JDK 17 — confirmed _not_ a transient network issue, since a plain `curl` to the same Maven Central URL succeeded instantly (TLS 1.3, HTTP 200) from the same machine at the same time. A direct, concrete consequence of the package's staleness, exactly the failure mode this section was written to anticipate.

**Resolution (ADR 0004): built the in-house fallback**, not a `patch-package` workaround — see ADR 0004 for the full reasoning. `modules/pdf-page-image` is a local Expo Module (Kotlin) wrapping `android.graphics.pdf.PdfRenderer` directly, exposing `getPageCount(uri)` and `renderPage(uri, page, scale)` — the same shape `pdfToImages.ts` always expected, so nothing above that wrapper layer changed. `react-native-pdf-page-image` was removed from `package.json` entirely.

**Verified in-session:** the module's source existed at one point without a `package.json`, so it was never actually resolvable by npm or discoverable by Expo's autolinking — a real gap, not just a documentation lag. Fixed by adding `modules/pdf-page-image/package.json` and wiring it into the root `package.json` as `"pdf-page-image": "file:./modules/pdf-page-image"` (Expo's documented local-module convention). Confirmed via `npx expo-modules-autolinking resolve -p android` that the module is now discovered, and via a clean, non-cached `./gradlew :pdf-page-image:assembleDebug` followed by `:app:assembleDebug` that both the module and the full app **compile successfully**.

**Runtime rasterization confirmed on a real physical device** (see Section 10 Phase 0): `getPageCount()` and `renderPage()` both work correctly against the repo's fixed test fixture — correct page count, correct pixel dimensions for the requested scale, and a visually correct, undistorted bitmap pulled off-device and inspected directly. This closes the last open Phase 0 checklist item; build success and runtime correctness are both now verified, not just the former.

### 4.3 Explicitly excluded

- Commercial PDF SDKs (Nutrient/PSPDFKit, Apryse) — hard requirement, zero budget.
- `harfbuzzjs` + `pdf-lib` low-level glyph placement — Phase 5 only, deferred; not part of this stack until Phases 0–4 ship and are in real use.
- `@pdf-lib/fontkit` — not needed; this app never draws text with pdf-lib/`@cantoo/pdf-lib`, only inspects existing documents read-only.
- Redux/MobX — zustand covers the state needs described in Sections 7–8.

## 5. Data flow (text description — implement exactly this shape)

```
[Existing Hindi PDF]
        |
        |  the in-house pdf-page-image module renders the page being edited
        v
[Background JPEG, 2-3x the page's point-dimensions]        [Live text edits]
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
    PdfPageViewer.tsx        // shows current page: JPEG background + live overlays
    EditableTextOverlay.tsx  // the tap-to-edit TextInput
    MaskOverlay.tsx          // drag-to-select mask rectangle for "replace text" edits
    LegacyFontWarning.tsx    // banner shown when a page uses a non-Unicode legacy font
  /lib
    pdfToImages.ts           // wraps the in-house pdf-page-image local Expo Module
    htmlCompositor.ts        // builds per-page HTML for export
    exportPdf.ts             // calls expo-print (or react-native-html-to-pdf)
    legacyFontDetector.ts    // flags Kruti Dev / Shivaji / Chanakya / DevLys etc. on load
    coordinateMath.ts        // dp <-> PDF points <-> background-image-px conversions
    fontAsset.ts             // loads and base64-encodes the bundled Devanagari font once
  /state
    editStore.ts             // DocumentState / PageState / Edit, see Section 8
  /assets/fonts
    NotoSansDevanagari-Variable.ttf   // wght 100-900, wdth axis
    NotoSerifDevanagari-Variable.ttf  // wght 100-900, wdth axis
    OFL.txt                           // license, ships with the fonts
App.tsx

/modules/pdf-page-image        // local Expo Module — see Section 4.2, ADR 0004
  package.json                 // "pdf-page-image": "file:./modules/pdf-page-image" in root package.json
  expo-module.config.json
  /android/src/main/java/expo/modules/pdfpageimage
    PdfPageImageModule.kt       // getPageCount(uri), renderPage(uri, page, scale) via android.graphics.pdf.PdfRenderer
    PageImageResult.kt
    PdfPageImageExceptions.kt
  /src
    index.ts, PdfPageImageModule.ts, PdfPageImage.types.ts   // JS/TS side of the Expo Module contract
```

## 7. Data model (TypeScript)

Canonical unit for every stored edit is **PDF points** (the page's real, resolution-independent size — from `getSize()`), not device pixels and not the background image's pixel dimensions. Convert to on-screen dp for display and to image pixels for HTML compositing, but always store and reason about edits in points, so re-rendering the background image at a different resolution never invalidates stored edit positions.

```typescript
type TextEdit = {
  type: 'text';
  id: string;
  page: number; // 0-indexed
  xPt: number; // top-left origin, page-relative, in PDF points
  yPt: number;
  fontSizePt: number;
  text: string;
  color: string; // hex
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
  color: string; // sampled background color to paint over old text
};

type Edit = TextEdit | MaskEdit;

type PageState = {
  pageIndex: number;
  widthPt: number;
  heightPt: number;
  backgroundImageUri: string; // local file:// path to the rendered JPEG
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
function dpToPt(
  xDp: number,
  yDp: number,
  viewWidthDp: number,
  pageWidthPt: number,
): { xPt: number; yPt: number };

// Points -> Screen (dp), to position stored edits back onto the live view
function ptToDp(
  xPt: number,
  yPt: number,
  viewWidthDp: number,
  pageWidthPt: number,
): { xDp: number; yDp: number };

// Points -> background-image pixels, for the HTML compositor at save time
function ptToImagePx(
  xPt: number,
  yPt: number,
  imagePxWidth: number,
  pageWidthPt: number,
): { x: number; y: number };
```

All three are simple linear scale conversions (`scale = target / pageWidthPt`, or its inverse) — no rotation, no baseline offset math is needed anywhere in Plan A, because nothing here writes directly to PDF content-stream coordinates.

### `pdfToImages.ts`

Wraps the in-house `pdf-page-image` local Expo Module (`modules/pdf-page-image` — see Section 4.2, ADR 0004; this is the only file that should import from `modules/pdf-page-image` directly). Renders the specific page being edited at 2–3× its point-dimensions (e.g. a 595×842pt A4 page → ~1190×1684px or higher) so text stays crisp through the print pipeline. Returns `{ uri, pxWidth, pxHeight }`.

### `htmlCompositor.ts`

Builds the full multi-page HTML string for export. One `<div>` per page in the document (even unedited pages need their background image, since export regenerates the whole document in one print call), sized to that page's background image pixel dimensions:

```typescript
function pageHtml(page: PageState): string {
  const layers = page.edits
    .map((e) => {
      const { x, y } = ptToImagePx(e.xPt, e.yPt, page.imagePxWidth, page.widthPt);
      if (e.type === 'mask') {
        const wPx = e.wPt * (page.imagePxWidth / page.widthPt);
        const hPx = e.hPt * (page.imagePxWidth / page.widthPt);
        return `<div style="position:absolute;left:${x}px;top:${y}px;width:${wPx}px;height:${hPx}px;background:${e.color}"></div>`;
      }
      const fontPx = e.fontSizePt * (page.imagePxWidth / page.widthPt);
      return `<span style="position:absolute;left:${x}px;top:${y}px;font-size:${fontPx}px;font-family:'${e.fontFamily}';color:${e.color}">${escapeHtml(e.text)}</span>`;
    })
    .join('');
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

Lets the user drag out a rectangle over existing burned-in text they want to replace. On release: sample the average color of the pixels just outside the selected rectangle (from the background image) to use as the mask fill color, then commit a `MaskEdit` to `editStore`, followed immediately by spawning an `EditableTextOverlay` in the same region for the replacement text.

## 9. Why the legacy-font check is not optional

Pre-Unicode Devanagari fonts (Kruti Dev, Shivaji, Chanakya, DevLys, and similar) work by mapping Latin keystrokes to Devanagari **shapes** purely visually — the underlying stored bytes are plain ASCII/Latin, not Unicode Devanagari code points. If a page is set in KrutiDev and the app masks over what visually looks like "क" without checking the font, the byte actually stored there is some Latin letter, and any _extraction_ of that region (search, copy, accessibility tools) will yield English gibberish, not "क". Detecting and warning before edit prevents building on top of a document whose text layer is already fundamentally mismatched with what's visually displayed.

## 10. Phased build plan (build and verify in this order)

### Phase 0 — Spike (must pass before any other phase starts) — ✅ PASSED, verified on a real device

Prove the core architectural assumption before writing app code. This phase validates two independent things — Devanagari shaping through the print pipeline, and whether the chosen native page-rasterization module actually works — and both are now confirmed, not just built/bundled.

- [x] Minimal Expo + custom dev client project with `expo-print` installed.
- [x] Hardcoded HTML string containing real Devanagari text with at least: one consonant conjunct (e.g. क्ष or ज्ञ), one reph, one matra above and one below the baseline. — `App.tsx`, same sentences as `fixtures/devanagari-fixture.html`.
- [x] Devanagari font embedded as base64 `@font-face` per Section 8. — `src/lib/fontAsset.ts` + `App.tsx`.
- [x] Export via `Print.printToFileAsync`. — wired up in `App.tsx`'s "Run spike" button.
- [x] **Ran on a real physical Android device** (adb-connected, MIUI, API level current at time of test), not an emulator. First run surfaced a real bug caught only by actual runtime execution, not by reading the code: `expo-file-system`'s top-level `readAsStringAsync`/`getInfoAsync` are unconditional-throw stubs in this installed SDK version (the real implementations moved to the `expo-file-system/legacy` subpath) — Jest's mocks (both the auto-mock and this repo's own hand-written mocks in `exportPdf.test.ts`) had silently papered over this, exactly the class of bug AGENTS.md's "don't report tests pass without running them" rule exists for. Fixed by switching `src/lib/fontAsset.ts` and `src/lib/exportPdf.ts` to `import * as FileSystem from 'expo-file-system/legacy'`. Re-ran after the fix — spike succeeded.
- [x] Opened/inspected the resulting PDF outside the device by pulling it directly off the device (`adb exec-out run-as <pkg> cat <cache-path>`) and validating it two independent ways rather than eyeballing a single viewer app: `pdftotext` (real, correct Unicode Devanagari extracted — not garbled, not empty) and `pdftoppm` (visual render at 150dpi). Both confirm the PDF is well-formed and matches the fixture exactly.
- [x] **Result, recorded**: conjuncts render as single joined glyphs — **PASS**. Specifically verified क्ष (क्षेत्र), ज्ञ (ज्ञान), द्य (विद्यालय), reph (धर्म, सूर्य), and matras both above and below the baseline (गुरुजी, रोशनी, सूर्य) all render correctly joined/positioned, not as disconnected pieces. Text is genuinely selectable/extractable Unicode, not a flattened image — confirmed via `pdftotext` returning the exact source string. Chromium's HarfBuzz-backed shaping (Section 3's core bet) holds on real hardware.
- [x] **Separately**, install `react-native-pdf-page-image` in the same custom dev client project and confirm it links, builds, and rasterizes a real PDF page on an actual Android build under Expo SDK 56's mandatory New Architecture (see Section 4.2 for why this isn't assumed to just work). **Result: FAILED at `./gradlew assembleDebug`**, before New Architecture linking is even reached — see Section 4.2 for the confirmed root cause (an isolated, ancient AGP/Kotlin buildscript block inside the package itself, incompatible with the current Gradle/JDK TLS stack).
- [x] **Resolved per ADR 0004**: built the in-house `pdf-page-image` local Expo Module instead of patching the broken dependency. Found and fixed a real linking gap (the module had no `package.json`, so it was never resolvable by npm or Expo's autolinking). **Confirmed in-session**: `npx expo-modules-autolinking resolve -p android` lists the module; a clean, non-cached `./gradlew :pdf-page-image:assembleDebug` and `:app:assembleDebug` both report `BUILD SUCCESSFUL`.
- [x] **Runtime rasterization confirmed on the same physical device**: pushed `fixtures/devanagari-fixture.pdf` into the app's sandboxed cache dir (`adb push` to `/data/local/tmp` + `run-as cp`), called `getPageCount()` (returned `1`, correct) and `renderPage(uri, 0, 2)` (returned `pxWidth=1224 pxHeight=1584` — exactly 2× the fixture's 612×792pt US Letter page, confirming the scale math) through a temporary, uncommitted test button, then pulled the produced PNG off-device and visually confirmed it's a correct, undistorted rasterization of the actual fixture content (same headline text, same footer URL/timestamp, same Devanagari rendering as the print-pipeline PDF). `PdfRenderer.Page.render()` works correctly end-to-end on real hardware, not just in the build graph.

### Phase 1 — MVP: single-page edit and export — ✅ PASSED, verified on a real device

- [x] Open an existing PDF from device storage. **Deviates from this checklist's original wording**: uses `expo-document-picker` + the in-house `pdf-page-image` rasterizer (`PdfPageViewer.tsx`), not `react-native-pdf`, for the actual edit canvas. Section 6's own module spec already defined `PdfPageViewer.tsx` as "PNG background + live overlays" - the Render & Print architecture needs the edit canvas to be the exact same rasterized image the export pipeline composites onto, not a second, independent PDF renderer that could disagree with it pixel-for-pixel. `react-native-pdf` stays installed for Phase 2's multi-page browsing, where its scrolling/navigation is the actual point - this was a stale checklist wording, not a build-time architecture change, so it's called out here rather than silently left inconsistent.
- [x] Display page 1; tapping anywhere spawns a `TextInput` at that location. — `App.tsx`'s `handleTap` + `EditableTextOverlay.tsx`.
- [x] Typing Hindi text shows correct live conjunct formation (native `TextInput` shaping). — confirmed on-device: typed via Gboard's Hindi transliteration layout, reph (धर्म) rendered correctly joined in the live overlay.
- [x] "Save" triggers the full Section 5 pipeline for that page. — `saveAndExport` in `App.tsx` calls `exportPdf.ts`.
- [x] Resulting PDF, opened in a viewer, shows the typed text in the correct position with correct shaping. — confirmed by pulling the exported PDF off-device and rendering it with `pdftoppm`: the "धर्म" edit appears at the tapped position with correct reph shaping, over the full-quality (2x scale) background.
- **On-device bug found and fixed during this phase**: exporting a page with a real Devanagari text edit (custom variable font) together with a 2x-scale background image hung the `expo-print` WebView indefinitely - reproducible only with all three of {Devanagari text, the embedded variable font, and a base64-inlined PNG background} present together; each pair alone exported fine. Root-caused to the background image's encoding rather than its pixel dimensions: switching `pdf-page-image`'s native output from PNG to JPEG (quality 92, no visible quality loss - see `PdfPageImageModule.kt`) fixed the hang while keeping the full 2-3x raster scale the spec requires. See CHANGELOG for details.

### Phase 2 — Multi-page support — ✅ PASSED, verified on a real device

- [x] Page navigation (next/previous). — `App.tsx`'s Prev/Next buttons + `goToPage`, shown only when the document has more than one page.
- [x] Edits tracked per-page in `DocumentState.pages[i].edits`, persisted when navigating away and back. — this was already true of `editStore.ts`'s data model and API (every action takes a `page` index) before this phase; the only real gap was that `App.tsx` only ever rasterized and displayed `pages[0]`. Closed by rasterizing every page up front at open time (not lazily per navigation - see that file's docstring for why) and rendering `pages[currentPageIndex]`.
- [x] Export produces every page of the document in one PDF, not only the page that was edited. — already true of `exportPdf.ts`/`htmlCompositor.ts` before this phase (both already looped over `doc.pages`); this checklist item was effectively completed as a side effect of Phase 1's export pipeline design, just unverified with more than one page until now.
- **Verified on-device** with a new, separate 3-page fixture (`fixtures/multipage-fixture.pdf` - see `fixtures/README.md`, kept separate from the canonical `devanagari-fixture.pdf` used for Phase 0/1/3): added a distinct text edit on each of the 3 pages, navigated 1→2→3→1 and confirmed each page still showed exactly its own edit (no leakage or loss), then exported and confirmed the resulting 3-page PDF has the correct background and correct edit text on every page, pulled off-device and inspected with `pdftoppm`.

### Phase 3 — Masking / replace-existing-text — ✅ PASSED, verified on a real device

- [x] Long-press or a dedicated "replace" mode triggers `MaskOverlay`. **Deviates from this checklist's "or" in a deliberate way**: implemented as a dedicated "Switch to replace text mode" toggle button in `App.tsx`, not a long-press. The spec explicitly allows either trigger; a toggle avoids `MaskOverlay`'s drag-to-select racing against `PdfPageViewer`'s own tap-to-add-text on the exact same gesture (a long-press-to-enter, drag-to-select sequence on one continuous touch is materially harder to disambiguate reliably from RN's gesture responder system than a separate mode switch).
- [x] User drags to define the region to mask. — `MaskOverlay.tsx`'s `PanResponder`, converting the drag rectangle's dp start point and dp size to PDF points via `coordinateMath.ts`'s `dpToPt`/`dpSizeToPt` (a size is a zero-offset scale, kept as separate named functions from the position converters specifically to avoid the position-vs-size unit confusion AGENTS.md calls out as this codebase's likeliest bug class). A `minDragDp` threshold (default 12dp) filters out accidental taps so replace mode doesn't fire on an ordinary tap.
- [x] Background color sampling implemented (see Section 8). — new native `sampleAverageColor` `AsyncFunction` on the existing `pdf-page-image` Expo Module (`PdfPageImageModule.kt`): decodes the page's already-rasterized background JPEG and averages the pixels in a band around (but excluding) the drawn rectangle, so the mask picks up the real page background color instead of a hardcoded white/gray. Fails closed to `#ffffff` on any decode error or on the degenerate case where there's no surrounding band left to sample (e.g. the rectangle fills the whole page) - same "never assume, warn/fail-safe instead" posture as the legacy-font check in Section 9, applied here to color sampling. Wrapped by `pdfToImages.ts`'s `sampleAverageColor` and called from `App.tsx`'s `handleMaskDrawn`, which falls back to `#ffffff` if the native call itself throws.
- [x] Masked region + replacement text renders correctly in the exported PDF. — `htmlCompositor.ts`'s existing `maskLayerHtml`/`pageHtml` (built ahead of schedule during Phase 1, unchanged this phase) already renders masks before text at the same coordinate, so the new `MaskEdit` + `TextEdit` pair `handleMaskDrawn` commits together needed no export-side changes.
- **Verified on-device** with the canonical `fixtures/devanagari-fixture.pdf` (kept identical across Phase 0/1/3 per AGENTS.md's testing guidance, for run-to-run comparability): enabled replace mode, dragged a rectangle over the fixture's first burned-in word ("धर्म"), confirmed the mask filled with a color visually indistinguishable from the page's white background (color sampling working, not just falling back to the white default) and that a text input auto-focused in the same spot, typed a replacement via Gboard's Hindi transliteration layout, confirmed the live preview showed the replacement rendered on top of the mask with correct shaping, then exported and pulled the resulting PDF off-device with `pdftoppm`: the exported page matches the live preview pixel-for-pixel in that region — masked-and-replaced text, not just overlaid text.
- **Native rebuild required**: `sampleAverageColor` is a new native `AsyncFunction`, so `:pdf-page-image:compileDebugKotlin` and `:app:assembleDebug` needed a real (non-incremental-stale) rebuild and device reinstall before this phase could be tested - confirmed both ran and the new function was callable from JS, not just present in source.
- **Post-verification fix — mask fill visibly mismatched non-white backgrounds**: real-world feedback after this phase "passed" against the all-white `devanagari-fixture.pdf` showed the masked rectangle as a visibly distinct box against a page with an off-white/cream background, rather than blending in - two compounding causes, both fixed:
  1. A user-drawn rectangle sized exactly to the visible text glyphs still leaves their anti-aliased edges (plus JPEG ringing right at the text/background boundary) just outside it, unmasked. `App.tsx`'s `handleMaskDrawn` now grows the drawn rectangle by a fixed `MASK_EXPAND_PT` (3pt) safety margin on all sides, clamped to the page bounds, before it's stored or sampled - the paired `TextEdit` stays anchored at the original (un-expanded) drag point.
  2. `sampleAverageColor`'s original _mean_ of the sampled border band is skewed by a minority of outlier pixels (exactly the anti-aliasing/ringing pixels margin (1) doesn't fully avoid). Switched to a per-channel _median_ (via a 256-bucket histogram, not a stored pixel list, to keep this O(1) extra space regardless of band size) in `PdfPageImageModule.kt`, which is unaffected by a minority of outliers as long as most of the sampled band is genuine background.
  - **Verified on-device** with a new synthetic off-white "aged paper" fixture (`@cantoo/pdf-lib`, solid `#EDE6D1`-ish background + burned-in text, generated on the fly and discarded after use - not added to the repo, since the canonical `devanagari-fixture.pdf` stays the one fixture reused for comparability per AGENTS.md): masked over the burned-in text, and both the live preview and the pulled exported PDF (`pdftoppm` + a pixel-level scan for color-value jumps along a line through the masked region) showed zero visible seam - the fill is indistinguishable from the surrounding page background, not just "close."

### Phase 4 — Legacy font detection — ✅ PASSED, verified on a real device

- [x] `legacyFontDetector.ts` runs on document load. — `App.tsx`'s `openPdf` reads the picked file as base64 (`expo-file-system/legacy`, same pattern `exportPdf.ts` already used for its own re-parse check) and calls `detectLegacyFonts` once pages are rasterized, storing the result in `DocumentState.legacyFontWarnings`. **Fails closed per AGENTS.md**: if the read or `PDFDocument.load`/parse itself throws, `detectLegacyFontWarnings` treats _every_ page as unknown-encoding (one warning per page with a sentinel `fontName`) rather than defaulting to "assume Unicode, proceed."
- [x] Matches implemented per Section 9's pattern list. — unchanged from the pure-logic module built ahead of schedule pre-Phase-0 (`isLegacyDevanagariFontName`, KrutiDev/Shivaji/Chanakya/DevLys/Walkman-Chanakya/Agra/Amar); `detectLegacyFonts`'s parameter type was widened from `Uint8Array` to `Uint8Array | string` (base64) to match `@cantoo/pdf-lib`'s own `PDFDocument.load` flexibility, so `App.tsx` doesn't need a separate decode step.
- [x] `LegacyFontWarning.tsx` blocks or warns before edits on an affected page. — new banner component, shown above the page viewer whenever the _current_ page (not the whole document) has any `legacyFontWarnings` entries; distinguishes a known legacy font name from the unknown-encoding fallback in its message. `App.tsx` derives a per-page `editingBlocked` flag from this and gates both edit paths: `handleTap` returns early, and `MaskOverlay`'s `active` prop is forced off (with the mode-toggle `Button` itself disabled) so a drag can't even start on a blocked page.
- **Verified on-device**: opening the canonical `devanagari-fixture.pdf` shows no warning and both edit modes remain enabled (no false positive on the real Unicode fixture). A synthetic fixture built with `@cantoo/pdf-lib` (plain Helvetica text with its `BaseFont` renamed to `ABCDEF+KrutiDev010`, mirroring `legacyFontDetector.test.ts`'s own positive-path test) was pushed to the device and opened: the banner rendered with the exact detected font name, the "Switch to replace text mode" button was visibly disabled, and tapping the page added no text edit.

### Phase 4.5 — OCR-assisted tap-to-edit (inline editing for scanned documents) — ✅ PASSED, verified on a real device

Added after Phase 4, driven by real use: on a scanned document (no text layer at all), Phase 3's drag-to-mask flow works but *feels* like patching, not editing — the user has to draw the box, and the replacement input starts empty. This phase makes editing existing text feel native/inline on exactly those documents: tap the text, it becomes an editable input in place, pre-filled with what it already says. Still 100% the Plan A "Render & Print" architecture — under the hood a tap produces the same `MaskEdit` + `TextEdit` pair as Phase 3; OCR just supplies the rectangle and the starting text that the user previously had to provide by hand. No Devanagari is ever *drawn* by anything new (ML Kit only reads pixels), so the Section 5 rendering pipeline is untouched.

- [x] In-house `modules/text-recognition` Expo Module (same pattern/rationale as `pdf-page-image`, ADR 0004): thin Kotlin wrapper over Google ML Kit Text Recognition v2 with the **bundled** Latin + Devanagari models (`com.google.mlkit:text-recognition{,-devanagari}:16.0.1`) — models ship in the APK (~2MB each), so OCR is fully offline from first launch, free, and no data leaves the device. `recognizeText(uri, script)` returns per-line text + bounding boxes in the input image's own px space; long-lived cached recognizer clients per script.
- [x] Dual-pass merge (`mergeOcrLines.ts`, pure, unit-tested): ML Kit needs one pass per script model and these documents mix Hindi/English on the same page, so both passes run concurrently over the page background JPEG. Hindi-bearing lines from the Devanagari pass always win their region; the dedicated Latin model wins pure-Latin regions; overlap = intersection > 0.5 of the smaller box.
- [x] `ocr.ts` is the only file importing the native module (same isolation rule as `pdfToImages.ts`): runs both passes, merges, converts boxes to PDF points via `coordinateMath.ts`'s new `imagePxToPt`/`imagePxSizeToPt` inverses (unit-tested against the existing forward conversions), returns `OcrLine[]` stored per-page in `editStore` (`PageState.ocrLines`, `setOcrLines`).
- [x] Lazy per-page trigger: OCR runs the first time a page is viewed (document open / page navigation, event-driven — not an effect, not eagerly for the whole document), skipped entirely on legacy-font-blocked pages. Status drives the hint text ("Detecting text…" / tap-to-edit instructions / failure notice). OCR failure fails open to manual editing but is surfaced, never silent.
- [x] `OcrHighlightLayer.tsx`: purely visual overlay (pointerEvents "none") marking detected lines as tappable; the actual tap stays on `PdfPageViewer`'s single existing tap pipeline, hit-tested in `App.tsx` via `ocrHitTest.ts` (`findOcrLineAt`, pure, unit-tested, smallest-containing-box-wins, 3pt finger tolerance).
- [x] Tap-to-edit: tapping a detected line consumes it (highlight gone, can't double-mask), masks its region via the same shared `maskAndReplaceRegion` path Phase 3's manual flow now also uses, and opens an auto-focused `TextInput` pre-filled with the OCR text, sized `0.75 ×` box height, width-constrained to the detected line (`TextEdit.widthPt`, new optional field) so live view and export wrap identically. Tap on empty page still adds new text (Phase 1 behavior); manual drag-to-mask remains the fallback for OCR misses.
- **Two on-device fixes found by verification, not code reading** (exactly why AGENTS.md mandates device verification for these modules): (1) live `TextInput` wrapped pre-filled text at a different point than the exported HTML span — fixed by the shared `widthPt` above; (2) ML Kit's Devanagari line boxes hug the shirorekha band and the mask cut through tall upper matras (ॉ) leaving a sliver of original ink — fixed with asymmetric upward-only mask padding (`OCR_MASK_PAD_TOP_RATIO` 0.35 × line height; padding below at the same ratio visibly ate the next line on the real form, so below keeps only the flat `MASK_EXPAND_PT`).
- **Verified end-to-end on-device** with a real scanned bilingual government leave form (`EARNED-LEAVE-FORM-*.pdf`, 2 pages, Hindi + English, no text layer): highlights appeared on both Hindi and English lines; tapping the Hindi title "छुट्टी की अर्जी का फॉर्म" masked the original scanned title seamlessly and opened a pre-filled editable input in its exact place with correct shaping; appended text via keyboard; exported; pulled the PDF off-device — parse-back check passed (2 pages, 612×792) and `pdftoppm` render shows the edited title with clean shaping (छुट्टी की अर्जी का फॉर्म2026) in place of the original scanned ink, indistinguishable background, no leftover slivers.
- [x] **Opt-in per-page "Enhance with AI" cloud OCR** (Gemini API free tier, `gemini-3-flash-preview` — the strongest model *with* an API free tier as of July 2026) for scans where on-device accuracy isn't enough. Strictly opt-in because this is the one code path in the app where document content leaves the device — it only ever runs from an explicit button press labeled "sends this page to Google", never automatically. `geminiOcr.ts` (fetch + a pure, unit-tested response parser that fails closed on malformed output; box_2d [ymin,xmin,ymax,xmax] 0-1000 descaled per axis) returns the same px-space `RecognizedLine[]` contract as the native module, so `ocr.ts`'s shared px→pt funnel and everything downstream is engine-agnostic. The user's own API key (free, no credit card) is prompted once with the privacy note spelled out, stored in Android Keystore-backed encrypted storage (`apiKeyStore.ts` wrapping `expo-secure-store` — first-party, SDK-pinned `~56.0.4`, vetted per AGENTS.md), and auto-cleared if the API rejects it so the next press re-prompts instead of failing forever.
- **Verified on-device (error path)**: button appears once on-device OCR settles; first press shows the key prompt with the privacy note; a deliberately invalid key was saved and run — the request hit the real Gemini endpoint, the API's "API key not valid" error surfaced in an alert (not swallowed), the stored key was auto-cleared, and the next press re-prompted. **The success path (real OCR results replacing ML Kit's) could not be verified in this environment — it requires the user's own API key.** Per AGENTS.md, this is stated rather than assumed: the request/response plumbing is confirmed live, the happy-path parsing is covered by unit tests only.

### Phase 5 — Optional, later, only if Phase 0–4 is in real use and you need it

A vector-preserving, smaller-diff alternative export path: `@cantoo/pdf-lib` (see Section 4.1 for why this fork over the unmaintained original `pdf-lib`) + `harfbuzzjs` (the actual HarfBuzz C++ project compiled to WASM by the HarfBuzz maintainers themselves, not a reimplementation — safer than `fontkit` for a script this edge-case-heavy). `harfbuzzjs.shape()` returns glyph IDs and x/y advances via `getGlyphInfosAndPositions()`; walk that array and call the library's low-level glyph-placement API (not its string-based `drawText()`) to place each shaped glyph at its exact coordinate, with font subsetting to keep file size down. This requires real, non-trivial plumbing (font-unit-to-point conversion, subsetting, no shortcuts) — do not attempt this before Phases 0–4 are working and validated in practice.

## 11. Testing / definition of done (per release, not just per phase)

- Devanagari text with at least 3 distinct conjuncts and one reph renders correctly in: the live editing view, and the exported PDF, opened in two different PDF viewers.
- A page detected as using a legacy font blocks/warns before edit, and does not silently corrupt the page.
- Export of a 10+ page document completes without an out-of-memory crash on a mid-range Android device.
- Every edit's position in the exported PDF visually matches its position in the live editing view (no drift from coordinate math errors).

## 12. Known risks and things this spec could not verify with certainty

Be aware of these; validate them yourself rather than assuming either outcome:

- **Text selectability of `expo-print` output: confirmed selectable**, not merely assumed — Phase 0's on-device run extracted the exact source Unicode string back out of the exported PDF via `pdftotext`, so this isn't a flattened image. (Still a bonus, not a hard requirement, per the original framing here — but now a confirmed bonus rather than an open question.)
- **Very large documents (100+ pages) exported in a single print call** may be slow or memory-heavy on low-end Android hardware. If this becomes a real problem, export in batches of a few pages and merge the resulting PDFs with `@cantoo/pdf-lib`'s page-copying (`copyPages`), which is cheap and doesn't touch text rendering at all — do this only if you actually hit the problem, not preemptively.
- **Versions are now pinned (Section 4.1, checked July 2026):** Expo SDK 56, `react-native-pdf` 7.0.4, `expo-print` matching SDK 56, `@cantoo/pdf-lib` 2.7.1. Re-check this table before starting a build far in the future.
- **`react-native-pdf-page-image` was confirmed broken on this toolchain, not just theoretically risky** — caught during initial project scaffolding, before Phase 1 began, exactly what Section 10's Phase 0 checklist item was written to catch. Resolved per ADR 0004 (in-house `PdfRenderer` Expo Module, see Section 4.2).
- **The in-house replacement module is confirmed to work at runtime, not just to build.** Phase 0's on-device run exercised `getPageCount()`/`renderPage()` against the repo's fixture PDF and pulled the resulting bitmap off-device for visual inspection — correct page count, correct pixel dimensions for the requested scale, correct visual content. Section 10's last open Phase 0 item is closed; Phase 1 is unblocked.
- **`expo-file-system`'s top-level legacy methods (`readAsStringAsync`, `getInfoAsync`, etc.) throw unconditionally in the installed SDK version** — a real runtime bug, only caught by running on a real device, that every unit test's mocking had silently hidden. Any _new_ code that needs these must import from `expo-file-system/legacy`, not the package root. Already fixed in `fontAsset.ts` and `exportPdf.ts`; grep for `from 'expo-file-system'` (without `/legacy`) before adding new file-system code.
- **A background PNG at 2x scale, combined with Devanagari text through an embedded variable font, hung `expo-print`'s WebView indefinitely** — only caught on a real device with a real conjunct-and-reph fixture; none of the individual factors alone reproduced it. Fixed by switching the rasterizer's output format to JPEG (quality 92) instead of reducing scale, so the 2-3x quality requirement in Section 4.1/AGENTS.md still holds. If this class of hang reappears on a different image or a larger document, re-check whether it's still specifically the {complex-script-shaping + large-inlined-image} combination, or something new.
