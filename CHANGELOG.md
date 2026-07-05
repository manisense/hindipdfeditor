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
