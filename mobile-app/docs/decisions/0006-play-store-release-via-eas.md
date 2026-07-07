# ADR 0006: Play Store release via EAS production AAB

## Status

Accepted — July 2026

## Context

The app uses custom native modules (`pdf-page-image`, `text-recognition`) and cannot ship as Expo Go. Local `assembleDebug` APKs use the debug keystore and include dev-oriented permissions — unsuitable for Google Play.

## Decision

1. **`app.config.ts`** is the single source for version, permissions (`blockedPermissions` for overlay/storage), splash, and release optimizations via `expo-build-properties` (R8 minify + shrink resources + ML Kit ProGuard keeps).
2. **`eas.json`** defines `production` profile building an **Android App Bundle** (`.aab`) with `autoIncrement` for `versionCode`.
3. **`expo-dev-client`** stays in **devDependencies** only — production EAS builds use `developmentClient: false` (default for production profile).
4. Remove unused **`react-native-pdf`** and **`react-native-blob-util`** from dependencies (never imported; reduced APK size and permission surface).
5. In-app **About** modal links to a public **privacy policy** (required for optional Gemini cloud OCR).
6. Play Console metadata lives in `docs/PLAY_STORE.md`, `docs/DATA_SAFETY.md`, `docs/STORE_LISTING.md`.

## Rejected

- **Shipping local debug APK to Play** — wrong signing key, `SYSTEM_ALERT_WINDOW`, no minify.
- **Keeping broad storage permissions** — document picker uses SAF; Play policy favors minimal permissions.
- **Bundling analytics/ads SDKs** — not needed; complicates Data safety form.

## Consequences

- First publish requires `eas init`, Play Console account ($25 one-time), and a hosted privacy policy URL.
- Developers still use `expo run:android` + dev client for daily work; store builds are CI/EAS-only.
