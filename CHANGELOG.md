# Changelog

All notable changes to this project are documented here, grouped by phase (see `hindi-pdf-editor-spec.md` Section 10 for the phase definitions). Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — Pre-Phase 0

### Docs
- Wrote `hindi-pdf-editor-spec.md`: architecture ("Render & Print" via WebView/Chromium print pipeline), data model, module specs, and phased build plan (Phase 0–5).
- Wrote `AGENTS.md`: non-negotiable architecture rules, code quality bar, security/safety checks, performance constraints, testing approach, and this documentation practice itself.
- Finalized and version-pinned the tech stack (spec Section 4): Expo SDK 56, `react-native-pdf` 7.0.4, `react-native-pdf-page-image` 0.1.5, `expo-print`, `@cantoo/pdf-lib` 2.7.1, `zustand` 5.0.14, plus supporting first-party Expo modules. See `docs/decisions/` for the reasoning behind the non-obvious swaps.
- Recorded one open risk in spec Section 4.2 / 12: `react-native-pdf-page-image`'s behavior under React Native's now-mandatory New Architecture is unverified until Phase 0's expanded checklist runs on a real Android build.

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
