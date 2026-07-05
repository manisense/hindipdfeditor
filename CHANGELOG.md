# Changelog

All notable changes to this project are documented here, grouped by phase (see `hindi-pdf-editor-spec.md` Section 10 for the phase definitions). Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — Pre-Phase 0

### Docs
- Wrote `hindi-pdf-editor-spec.md`: architecture ("Render & Print" via WebView/Chromium print pipeline), data model, module specs, and phased build plan (Phase 0–5).
- Wrote `AGENTS.md`: non-negotiable architecture rules, code quality bar, security/safety checks, performance constraints, testing approach, and this documentation practice itself.
- Finalized and version-pinned the tech stack (spec Section 4): Expo SDK 56, `react-native-pdf` 7.0.4, `expo-print`, `@cantoo/pdf-lib` 2.7.1, `zustand` 5.0.14, plus supporting first-party Expo modules. See `docs/decisions/` for the reasoning behind the non-obvious swaps.

### Chore — initial project scaffold
- Fixed a broken local Homebrew `watchman` install (stale `libfmt` dylib link).
- Scaffolded the Expo project (TypeScript template), pinned down from the default SDK 57 to **SDK 56** per ADR 0002.
- Installed the full pinned dependency set from spec Section 4.1; corrected `app.json`'s Android package identity (was auto-generated as `com.medikle.hpescaffold`, now `com.manisense.hindipdfeditor`).
- Set up ESLint (flat config, `eslint-config-expo`), Prettier, and Jest (`jest-expo`) — had to pin `eslint` to `^9.18.0` (the `eslint-config-expo`-bundled `eslint-plugin-react` isn't compatible with ESLint 10's removal of the deprecated `context.getFilename()` API) and add the `@react-native/jest-preset` peer dependency `jest-expo` now requires separately.
- Ran `expo prebuild -p android` to generate the native Android project; confirmed `newArchEnabled=true` (New Architecture is mandatory on this SDK, matching ADR 0002).
- Downloaded Noto Sans/Serif Devanagari fonts — first attempt from `notofonts/devanagari`'s assumed raw path silently downloaded HTML error pages instead of font binaries (caught by checking `file` output, not by trusting the download succeeded). Switched to the `google/fonts` repo, which ships these two families as **variable fonts** (`wght`/`wdth` axes) rather than separate static Regular/Bold files — spec Section 4.1/6 updated to match.

### Known issue found during scaffolding, and its resolution
- **`react-native-pdf-page-image@0.2.1` failed to build** (`./gradlew assembleDebug`) — its own `android/build.gradle` pins an isolated, ancient Android Gradle Plugin (3.5.4, ~2019/2020) whose bundled HTTP client can't complete a TLS handshake against Maven Central under the current Gradle 9.x/JDK 17 toolchain. Confirmed not a network fluke (`curl` reaches the same URL instantly). This is the exact risk spec Section 4.2 flagged before any code was written — now confirmed rather than theoretical.
- **Resolved (ADR 0004):** built `modules/pdf-page-image`, an in-house local Expo Module (Kotlin) wrapping `android.graphics.pdf.PdfRenderer` directly, instead of patching the broken dependency. Removed `react-native-pdf-page-image` from `package.json` entirely.
- **Found and fixed a real linking gap** while validating the above: the module's source existed with no `package.json`, so npm and Expo's autolinking could never actually resolve it — it was unreferenced code, not a working module. Added `modules/pdf-page-image/package.json` and wired it into the root `package.json` as `"pdf-page-image": "file:./modules/pdf-page-image"` (Expo's documented local-module convention), then re-ran `expo prebuild -p android`.
- **Verified in this session:** `npx expo-modules-autolinking resolve -p android` now lists `pdf-page-image`; a clean (non-cached) `./gradlew :pdf-page-image:assembleDebug` and `:app:assembleDebug` both report `BUILD SUCCESSFUL`. This is the first time the full app has actually compiled end-to-end.
- **Corroborated by a second, fully-clean rebuild** after freeing local disk space: `./gradlew assembleDebug` from a cold state (517 actionable tasks, 327 actually executed — not just cache hits, including all four ABIs' CMake/C++ compilation) completed with `BUILD SUCCESSFUL` in ~15 minutes, producing `android/app/build/outputs/apk/debug/app-debug.apk` (~186MB). Same conclusion as the scoped check above, now confirmed from a true cold cache rather than a partially-warm one.
- **Not yet verified:** whether the module correctly rasterizes a real PDF page at runtime — no Android emulator or physical device was available in this environment. Build success proves compilation and linking, not runtime correctness. This remains an open Phase 0 checklist item (spec Section 10) and gates the start of Phase 1.

### Added — Phase 0 spike code
- `src/lib/fontAsset.ts`: loads a bundled Devanagari variable font via `expo-asset` + `expo-file-system` and returns it base64-encoded, memoized per session (spec Section 8).
- `App.tsx`: the actual Phase 0 spike screen — hardcoded Devanagari HTML (same sentences as `fixtures/devanagari-fixture.html`: conjuncts क्ष/ज्ञ/त्र/द्य, a reph, matras above and below baseline), base64 `@font-face` embedding, `Print.printToFileAsync` export, and `expo-sharing` to hand the result to an external viewer.
- Verified in this session: `tsc --noEmit`, `eslint .`, and `prettier --check` all pass; `npx expo export --platform android` bundles cleanly (592 modules, both font assets included at their expected sizes) — confirms Metro resolves every import, including the local `pdf-page-image` module's JS side and the `.ttf` asset `require()`s.
- **Not yet verified:** whether running this on a device actually produces a correctly-shaped Devanagari PDF, and whether the exported file opens correctly in two independent PDF viewers — no Android emulator or physical device was available in this environment. This is the actual point of Phase 0 and is unfinished until someone runs it on real hardware and records the result per spec Section 10.

### Added — `coordinateMath.ts` (pure, device-independent groundwork done ahead of Phase 1)
- Implemented `dpToPt`, `ptToDp`, `ptToImagePx` exactly per spec Section 8: three linear scale conversions between dp/pt/px, top-left origin throughout, single width-derived scale applied to both axes.
- Added 11 unit tests covering identity cases, the dp↔pt round trip, the spec's own A4-at-2x worked example, and that both axes scale uniformly (no accidental Y-flip or independent axis scaling) — this is the module AGENTS.md flags as having "no excuse" to ship untested, since a sign/scale error here silently misplaces every edit without a compile error.
- **Fixed a pre-existing gap found while adding the first test file in this repo:** `@types/jest` was installed but never actually loaded by `tsc` (`describe`/`it`/`expect` resolved as unknown globals despite the package being present) — root `tsconfig.json` had no `types` array, and this project's `moduleResolution: "bundler"` setup wasn't implicitly picking up ambient `@types/*` packages the way a default `node`-style resolution would. Added `"types": ["jest"]` to `tsconfig.json`. Confirmed fix with a full-project `tsc --noEmit`, `eslint .`, and `jest` run, all clean.
- This work does not touch anything requiring a device and does not start Phase 1 — it's pure-function groundwork the Phase 1 checklist items (`EditableTextOverlay.tsx`, `htmlCompositor.ts`) will import once Phase 0's device-verification gate (see above) is cleared.

### Added — `editStore.ts` (zustand, spec Section 7/8 data model + store)
- Implemented `DocumentState`/`PageState`/`TextEdit`/`MaskEdit` exactly per spec Section 7, plus a `zustand` store (`createEditStore()` factory + `useEditStore` app-wide singleton) with `loadDocument`, `closeDocument`, `addTextEdit`, `addMaskEdit`, `updateTextEdit`, `updateMaskEdit`, `removeEdit`, `setLegacyFontWarnings`.
- Id generation is injectable (defaults to `expo-crypto`'s `randomUUID`), which matters in practice, not just in theory: `expo-crypto` is a native module and its jest auto-mock returns `undefined` from `randomUUID()` with no error, which would have made every edit collide on the same `id`. Making it injectable let the test suite catch this in the first run instead of shipping a store where `removeEdit` silently deletes every edit on a page.
- 15 unit tests: load/close, add/update/remove for both edit types, out-of-range-page and wrong-edit-type error paths, and that two `createEditStore()` instances never share state (so tests can't leak into each other, and so this store could later be scoped per-document instead of being a single app-wide singleton without a rewrite).
- Like `coordinateMath.ts` above, this is pure-logic groundwork with no device dependency — it does not start Phase 1's UI work (`EditableTextOverlay.tsx`, `PdfPageViewer.tsx`) and remains unused by any screen until Phase 0's device-verification gate clears.

### Added — `legacyFontDetector.ts` (Phase 4 module, built early — no device dependency, pure `@cantoo/pdf-lib` parsing)
- Implemented per spec Section 9: `detectLegacyFonts(pdfBytes)` loads a PDF read-only via `@cantoo/pdf-lib`, walks every page's font resources, and flags any font name matching the known legacy Devanagari prefixes (KrutiDev, Shivaji, Chanakya, DevLys, Walkman-Chanakya, Agra, Amar).
- Real-world font-structure finding while building this: our own `devanagari-fixture.pdf` (produced by `expo-print`/Chromium) embeds every font as **Type3**, and the PDF's `BaseFont` key is absent on most of them — the true font name only shows up in `FontDescriptor.FontName`. A naive `BaseFont`-only check would have silently detected nothing on our own fixture. `readFontName()` checks `BaseFont`, then `FontDescriptor.FontName`, then recurses into `DescendantFonts` for Type0/CID fonts, so it works across the font structures actually seen in the wild, not just the simplest case.
- 22 unit tests: the full legacy-prefix list, case-insensitivity, prefix-vs-substring correctness (`Amar` must not false-positive on an unrelated name that merely contains it), a real negative-path check against `fixtures/devanagari-fixture.pdf` (confirms zero false positives on our actual Unicode fixture), and a positive-path check against a real PDF built with `@cantoo/pdf-lib` whose embedded font was renamed to a legacy pattern.
- This is nominally Phase 4 scope, built ahead of order because it needs no device and no other unbuilt module — same rationale as `coordinateMath.ts`/`editStore.ts`. `LegacyFontWarning.tsx` (the UI banner that surfaces this) is not built yet.
- Also fixed a related tsconfig gap this surfaced: the previous `"types": ["jest"]` (added when `coordinateMath.test.ts` was written) excluded `@types/node`'s ambient globals, so a Node-based test file (`fs`, `path`, `__dirname`) failed to typecheck. Added `@types/node` as an explicit devDependency (previously only present transitively) and `"node"` to `tsconfig.json`'s `types` array; confirmed no ambient-type conflicts with the RN/DOM globals already in use via a full `tsc --noEmit`.

### Added — `htmlCompositor.ts`, `exportPdf.ts` (remaining device-independent groundwork)
- **`htmlCompositor.ts`**: `escapeHtml`, `pageHtml`, `documentHtml` exactly per spec Section 8. Masks are always partitioned to render before text in DOM order regardless of `editStore` insertion order (not relied on by convention), and every `TextEdit.text` is passed through `escapeHtml` before interpolation, per AGENTS.md's HTML-injection rule. 13 unit tests, including one that fires a real `onerror`-image-injection string through the full `pageHtml` output (not just `escapeHtml` in isolation) and asserts it's neutralized.
- **`exportPdf.ts`**: thin wrapper calling `Print.printToFileAsync` with the source PDF's *real* page size in points (via `@cantoo/pdf-lib`'s `getSize()` — the spec explicitly warns against hardcoding A4/Letter). Implements both non-negotiable safety checks from AGENTS.md: never touches `sourceUri` as an output path (always trusts `expo-print`'s own fresh temp file), and validates the exported file is non-empty and re-parses as a real PDF (via `@cantoo/pdf-lib`) before returning success — a silently corrupt export is treated as a thrown error, not a false "it worked." 5 tests using `jest.mock` for the two native-module boundaries (`expo-file-system`, `expo-print`) while using the *real* `@cantoo/pdf-lib` to generate valid fixture PDF bytes — covers the not-hardcoded-page-size case, the never-mutate-source case, and both silent-corruption guards (missing/empty file, unparseable file).
- **Discovered and resolved mid-session:** while writing these, a parallel Cursor session had independently built and pushed its own `legacyFontDetector.ts` (a more thorough implementation than a first draft written locally in this session, correctly handling Type3/CID font structures found in `expo-print`'s own output — see the entry above). Pulled and kept that version; discarded the local duplicate rather than overwriting better, already-tested work. Worth noting as a real instance of "verify against git state before trusting local assumptions," not just a hypothetical risk.
- Deliberately **not** built yet, and staying off the list until Phase 0's device gate clears: `PdfPageViewer.tsx`, `EditableTextOverlay.tsx`, `MaskOverlay.tsx`, `LegacyFontWarning.tsx`. These are real Phase 1 UI screens whose correctness depends on the still-unverified rendering pipeline (native `TextInput` shaping, WebView print output) — writing them now would mean building UI on top of an assumption nobody has looked at yet, the exact mistake `react-native-pdf-page-image` already demonstrated the cost of.
- Full project state after this entry: `tsc --noEmit`, `eslint .`, `prettier --check`, and `jest` (66/66 tests, 5 suites) all clean.

### Fixed — real bug found only by running on a physical device
- **`expo-file-system`'s top-level `readAsStringAsync`/`getInfoAsync`/etc. throw unconditionally** in the SDK version actually installed (`node_modules/expo-file-system/src/legacyWarnings.ts`) — they are not "deprecated but working," they are hard-broken stubs whose sole job is to `console.warn` a migration message and then throw an `Error` with that same message text. Every unit test written so far mocked this boundary directly (both `exportPdf.test.ts`'s hand-written mock and Jest's auto-mock elsewhere), so this was invisible until code ran for real. Caught immediately on the very first tap of the Phase 0 spike's "Run spike" button on a real device: `getFontBase64()` failed with the deprecation text as its error message instead of returning font bytes.
- **Fixed** by importing from the `expo-file-system/legacy` subpath (confirmed present and fully functional in `node_modules`) instead of the package root, in both `src/lib/fontAsset.ts` and `src/lib/exportPdf.ts`. Updated `exportPdf.test.ts`'s `jest.mock()` target to match. Re-ran the full suite (`tsc`, `eslint`, `jest` — still 66/66) and re-tested on-device: the spike now succeeds end-to-end.
- Recorded as a standing risk in spec Section 12 with a grep-before-adding-new-code reminder, since nothing about this failure mode is visible from reading the import line itself — it looks identical to a normal, working import.

### Verified — Phase 0 passed on a real physical Android device (spec Section 10)
This is the actual point of Phase 0, and the reason it gated everything else. Both previously-open checklist items are now closed, on a real adb-connected device, not an emulator:
- **Devanagari shaping through the print pipeline: PASS.** Ran the spike, pulled the exported PDF directly off the device (`adb exec-out run-as <pkg> cat <cache-path>` — no dependency on which viewer apps happen to be installed on the test device), and verified it two independent ways: `pdftotext` extracted the exact original Unicode Devanagari string (not garbled, confirming real selectable text, not a flattened image), and `pdftoppm` produced a visual render confirming क्ष/ज्ञ/द्य conjuncts, reph (धर्म/सूर्य), and matras above/below baseline (गुरुजी/रोशनी) all render as correctly joined single glyphs, not disconnected pieces.
- **`pdf-page-image` native module runtime rasterization: PASS.** Pushed `fixtures/devanagari-fixture.pdf` into the app's own sandboxed cache directory via `adb push` + `run-as cp`, exercised `getPageCount()` (returned `1`, correct) and `renderPage(uri, 0, 2)` (returned `pxWidth=1224 pxHeight=1584`, exactly 2× the fixture's 612×792pt page) through a temporary, uncommitted test button in `App.tsx` (reverted before committing — never part of the shipped app), then pulled the resulting PNG off-device and visually confirmed it's an undistorted, correct rasterization matching the source PDF's actual content.
- Both results, plus the bug fix above, recorded in `hindi-pdf-editor-spec.md` Section 10's Phase 0 checklist and Section 12's risk list — Phase 0 is marked passed, and Phase 1 is unblocked.

## [Phase 1] — MVP: single-page edit and export

### Changed — `exportPdf.ts` single-source-of-truth for page size
- Removed the second, independent read of the source PDF's page size via `@cantoo/pdf-lib`'s `getSize()`. `exportPdf` now reuses `doc.pages[0].widthPt/heightPt`, already computed once when the page was rasterized (`pdfToImages.ts`) — one source of truth for page dimensions, not two reads that could theoretically disagree by rounding. Updated `exportPdf.test.ts` to match.

### Added — Phase 1 UI
- `src/components/PdfPageViewer.tsx`: displays a page's rasterized background image scaled to the view's width, converts tap coordinates to PDF points via `coordinateMath.ts`, and accepts a `renderOverlays` render-prop so callers can layer live edit components on top without this component knowing what an "edit" is.
- `src/components/EditableTextOverlay.tsx`: an absolutely-positioned, live `TextInput` bound to a `TextEdit`, using `ptToDp` for position/size and `expo-font`-loaded Devanagari fonts so the live view matches the exported PDF (WYSIWYG).
- `App.tsx` rewritten from the Phase 0 spike into the real Phase 1 editor: `expo-document-picker` to open a PDF, `pdfToImages.ts` to rasterize page 1, tap-to-add-text-edit, live editing via the components above, and save/export/share via `exportPdf.ts` + `expo-sharing`.

### Fixed — real bugs found only by running Phase 1 on a physical device
- **Background image never appeared in the exported PDF.** `expo-print`'s WebView does not reliably resolve a local `file://` URL used as a CSS `background-image` (silently renders blank) — the same class of failure the font already had to work around in Phase 0, just not caught until an actual exported PDF was inspected rather than just the HTML string. Fixed by having `exportPdf.ts` read and base64-encode each page's background image and inline it as a `data:` URI, same as the font. `htmlCompositor.ts`'s `pageHtml`/`documentHtml` now take a ready-made data URL per page instead of a raw path.
- **Export hung indefinitely (not just slow — multiple minutes with no completion) when a real Devanagari text edit was present together with the 2x-scale background image.** Reproduced and isolated on-device: background image alone (no text edits) exported in ~18s; ASCII text with the custom font and background exported in ~20s; Devanagari text with the custom font and background never completed. All three factors together were required to reproduce it - no pair alone did. Root-caused to the background image's *encoding*, not its pixel dimensions: switching the native rasterizer's output from PNG to JPEG (quality 92) in `PdfPageImageModule.kt` fixed the hang while keeping the full 2x raster scale — confirmed by re-running the same Devanagari export at full scale after the fix, completing in a few seconds. The bitmap has no meaningful alpha channel (already flattened to opaque white for transparent PDF regions before encoding), so JPEG loses nothing here. `pdfToImages.ts`, `exportPdf.ts`, `htmlCompositor.ts`, and all affected tests updated to reflect JPEG rather than PNG as the background format.

### Verified — Phase 1 passed on a real physical Android device (spec Section 10)
- Opened `fixtures/devanagari-fixture.pdf` via the document picker; page rendered correctly at full 2x scale.
- Tapped the page to add a text edit; typed via Gboard's Hindi transliteration keyboard; the live `EditableTextOverlay` showed "धर्म" with correct reph shaping in real time.
- Tapped Save; export completed in a few seconds (previously hung indefinitely at this same scale before the JPEG fix above).
- Pulled the exported PDF off-device (`adb exec-out run-as <pkg> cat <cache-path>`) and rendered it with `pdftoppm` at both 150dpi and 300dpi: the background page (full quality, no visible JPEG artifacts even on the fixture's smallest annotation text under magnification) and the "धर्म" overlay both render correctly, with the overlay positioned exactly where it was tapped and shaped correctly.
- Full suite clean after all changes: `tsc --noEmit`, `eslint .`, `jest` (67/67 tests, 5 suites).

## [Phase 2] — Multi-page support

### Added
- `fixtures/multipage-fixture.html`/`.pdf`: a new, separate 3-page test fixture, each page carrying distinct identifying text, used only for this phase's page-navigation/persistence/export verification. Kept separate from the canonical `devanagari-fixture.pdf` since AGENTS.md requires that one to stay fixed across every Phase 0/1/3 pass.

### Changed — `App.tsx`
- `openPdf` now rasterizes every page of the document up front (looping `getPageCount()`'s result through `renderPage`), not just page 0, and stores them all in `DocumentState.pages`.
- Added `currentPageIndex` state, a `goToPage` handler, and Prev/Next buttons (shown only when the document has more than one page) with a "Page X of N" label.
- All edit actions (`handleTap`, `handleBlur`, `updateTextEdit`) now target `currentPageIndex` instead of a hardcoded `0`.
- `PdfPageViewer` is now keyed on `page.pageIndex` so it remounts cleanly on page change instead of a single instance silently switching the image it displays underneath any transient gesture state.

### Notes
- `editStore.ts` and `exportPdf.ts`/`htmlCompositor.ts` needed **no changes** for this phase - both already modeled `DocumentState.pages` as a full per-page array and already looped over every page at export time (built ahead of order during Phase 1, since neither needed a device to write or test). The only real gap was `App.tsx` only ever using page 0.
- **Scope clarification surfaced this phase, not a code change**: confirmed with the user that Phase 1/2's "tap to add text" is intentionally an *add new text* feature, not an *edit existing text* feature - it cannot change what's already printed on a page, since the Render & Print architecture treats each page as a flattened image. Replacing existing text is Phase 3 (mask + overlay), not built yet. Recorded in spec Section 10/Status to avoid re-litigating this later.

### Verified — Phase 2 passed on a real physical Android device (spec Section 10)
- Opened `fixtures/multipage-fixture.pdf` (3 pages); all 3 rasterized correctly at full 2x scale.
- Added a distinct text edit on each page; navigated 1→2→3→1 and confirmed each page showed exactly its own edit, with no leakage from or loss between pages.
- Exported; pulled the resulting PDF off-device and confirmed with `pdftoppm` that all 3 pages have the correct background and the correct edit text, each in the position it was added.
- Full suite clean: `tsc --noEmit`, `eslint .`, `jest` (67/67 tests, 5 suites) - no test changes were needed since the underlying store/export logic didn't change.

<!--
Template for each future phase, add above this line as phases complete:

## [Phase N] — <short phase name from spec Section 10>

### Added
-

### Changed
-

### Fixed
-
-->
