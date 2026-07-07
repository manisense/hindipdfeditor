# 0004 — In-house `PdfRenderer` Expo Module over `react-native-pdf-page-image`

**Status:** Accepted. Supersedes the "primary" choice in spec Section 4.1; the risk and fallback plan were pre-documented in Section 4.2 before this decision was made.

## Context

Spec Section 4.2 flagged `react-native-pdf-page-image` as the least-maintained, least-replaceable dependency in the stack and required Phase 0 to validate it on a real Android build before trusting it. That validation ran: `./gradlew assembleDebug` failed because the package's own `android/build.gradle` pins an isolated, unmaintained Android Gradle Plugin (3.5.4, ~2019/2020) whose bundled HTTP client cannot complete a TLS handshake against Maven Central under this project's Gradle 9.x/JDK 17 toolchain — confirmed not a network fluke (`curl` reaches the same URL instantly). This is the exact risk Section 4.2 anticipated, now confirmed rather than theoretical.

Two paths existed at that point: patch the third-party package's build script (e.g. via `patch-package`), or build the in-house fallback Section 4.2 already specified.

## Decision

Build the in-house fallback: `modules/pdf-page-image`, a local Expo Module (Kotlin, Expo Modules API) wrapping `android.graphics.pdf.PdfRenderer` directly. It exposes exactly two functions — `getPageCount(uri)` and `renderPage(uri, page, scale)` — matching the shape `src/lib/pdfToImages.ts` already expected from the third-party package, so nothing above that wrapper layer needed to change.

`react-native-pdf-page-image` was removed from `package.json` entirely rather than kept alongside as a disabled option — a dependency that doesn't build has no value sitting in the manifest, and AGENTS.md's "no dead code" rule applies to dependency lists too.

**Why not `patch-package` instead:** patching a build script tied to a specific, ancient AGP version is a maintenance liability that resurfaces on every Gradle/AGP upgrade, and does nothing to address the package's own multi-year lack of maintenance — it would have "fixed" this one build error while leaving every other staleness risk from spec Section 4.2 in place. The in-house module trades roughly 80 lines of Kotlin (once) for zero third-party dependency on the single most fragile piece of the pipeline, matching what Section 4.2 called the more robust option.

**Linking gap found and fixed while validating this decision:** the module's source existed but had no `package.json`, so it was never actually resolvable by npm or by Expo's autolinking (`expoAutolinking.useExpoModules()` in `android/settings.gradle` discovers modules by scanning installed packages, not by scanning the `modules/` folder directly). Fixed by adding `modules/pdf-page-image/package.json` and referencing it from the root `package.json` as `"pdf-page-image": "file:./modules/pdf-page-image"`, per Expo's documented local-module convention (matching what `npx create-expo-module --local` generates). Confirmed via `npx expo-modules-autolinking resolve -p android` that the module is now discovered, and via a clean `./gradlew :pdf-page-image:assembleDebug` and `:app:assembleDebug` that both the module and the full app compile successfully in-session.

## Rejected alternatives

- **`patch-package` against `react-native-pdf-page-image`'s build script:** addresses only the immediate build failure, not the underlying multi-year staleness; ongoing maintenance burden on every toolchain upgrade. Rejected per the reasoning above.
- **`@dariyd/react-native-pdf-page-image` or `expo-pdf-to-image`:** both already rejected in spec Section 4.2 before this decision was reached — single-maintainer, zero-track-record packages published within months of the original evaluation. Falling back to one of these after the first package failed would have repeated the same unvetted-dependency mistake, not fixed it.

## Consequences

- Full control over the render scale matrix (the spec's 2–3× point-dimensions requirement) lives in code this project owns and can read line-by-line, not in a third-party package.
- One more native module (Kotlin) this project is now responsible for maintaining directly — a fair trade against a dependency that didn't build at all.
- `pdfToImages.ts`'s public shape (`getPageCount`, `renderPage` returning `{ uri, pxWidth, pxHeight }`) is unchanged from what the spec originally described, so every consumer above that layer required zero changes.
- Still only rasterizes an existing PDF page to a background PNG — does not draw any text, so this does not touch the non-negotiable rendering rule in AGENTS.md or ADR 0001.
- **Not yet verified:** actually rasterizing a real PDF page correctly at runtime on a physical or emulated Android device. This session confirmed the module *builds*; it did not confirm it *works*, because no Android device or emulator was available in this environment. That verification remains an open Phase 0 checklist item (spec Section 10) and must happen before Phase 1 is considered started.

**Date:** 2026-07.
