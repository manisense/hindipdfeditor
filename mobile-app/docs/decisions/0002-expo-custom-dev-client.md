# 0002 — Expo with a custom dev client, not Expo Go, not bare RN CLI

**Status:** Accepted.

## Context

The app needs `expo-print` (first-party Expo module, WebView-based print-to-PDF) alongside third-party native modules for PDF viewing and page rasterization (`react-native-pdf`, `react-native-pdf-page-image`). Expo Go's managed sandbox can only load first-party Expo modules — it cannot load arbitrary third-party native modules. Bare React Native CLI can load anything, but gives up Expo's tooling (prebuild, EAS, first-party module ecosystem) for no benefit here.

## Decision

Use Expo with a custom dev client (`expo prebuild` + `expo-dev-client`). This gets both: `expo-print` as a first-party module, and the ability to autolink `react-native-pdf` / `react-native-pdf-page-image` as native dependencies, all through one build.

Pinned to **Expo SDK 56** (React Native 0.85, React 19.2) rather than the newer SDK 57 at time of writing — SDK 57 was released within days of this decision being made; SDK 56 has more field time and this is a zero-budget solo build with no bandwidth to firefight bleeding-edge SDK issues. Re-evaluate this pin if starting a build long after the decision date below.

## Rejected alternatives

- **Expo Go (managed workflow):** cannot load `react-native-pdf` or `react-native-pdf-page-image` — a hard blocker, not a preference.
- **Bare React Native CLI:** can load any native module, but forfeits Expo's prebuild/EAS tooling and first-party module ecosystem (`expo-print`, `expo-document-picker`, `expo-file-system`, `expo-sharing`, `expo-crypto`) for zero corresponding benefit in this project.
- **Expo SDK 57 (latest at decision time):** rejected for now purely on maturity/stability grounds, not a technical incompatibility — see above.

## Consequences

- Every native dependency added later must be re-verified for New Architecture compatibility, since Expo SDK 55+ mandates it (Legacy Architecture was removed from React Native entirely as of 0.82) — there is no opt-out toggle to fall back on if a module doesn't support it.
- Development requires a real build step (`expo prebuild` + a dev client build) before running — cannot iterate purely inside the Expo Go app.

**Date:** 2026-07.
