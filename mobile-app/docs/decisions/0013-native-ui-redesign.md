# 0013 — Native UI redesign

**Status:** Accepted.

## Decision

Rebuild the Android UI on native Material patterns: blue brand band with an overlapping white sheet on tab screens, dark #14161F chrome for the reader and editor, flat bottom navigation, bottom sheets for choices, Android dialogs for errors, snackbars for quick confirmations, solid #1843DD primary pills, coloured icons without tinted boxes, and one language per screen through `tx(en, hi)`.

## Why

User testing of earlier rounds called the custom chips, gradient buttons and doubled English + Hindi labels "artificial, not native". The locked designs follow iLovePDF, Files by Google and Google Drive.

## Rejected

- Keeping bilingual labels on every element: doubles text, breaks layout at 360dp.
- Floating rounded dock navigation: looks web-made on Android.
- Gradient primary buttons and tinted icon squares: read as decoration, not native.
