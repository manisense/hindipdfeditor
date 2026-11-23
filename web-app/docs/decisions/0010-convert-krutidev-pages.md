# 0010 — Convert KrutiDev-family pages to Unicode on the web

Date: 22 November 2026

## Decision

The web editor no longer blocks pages set in a KrutiDev-family encoding. `isConvertibleLegacyFont` accepts warnings for KrutiDev, DevLys and text that reads as KrutiDev keystrokes (`looksLikeLegacyDevanagariText`). For those pages, `extractEmbeddedTextLines(..., { convertLegacy: true })` converts runs set in the legacy font, chosen per font so URLs and numbers in other fonts are untouched, with `krutiDevToUnicode` (`@anthro-ai/krutidev-unicode` 0.1.0, ISC, pinned; a JavaScript port of LTRC kru2uni). The converted lines then go through the OCR check (ADR 0008): a page whose conversion disagrees with the page image gets OCR text instead. Since ADR 0016 (23 November 2026), converted text is judged by overall agreement (rejected below 40 % of words) instead of the complex-to-plain ratio used for Unicode text, because OCR of small table text made right conversions look broken; ADR 0015 checks a band of lines when the page has enough text. A notice asks the user to read each line. Converted runs are replaced in Noto Sans.

Other legacy encodings (Chanakya, Shivaji, Walkman-Chanakya, Agra, Amar) and pages whose fonts cannot be inspected remain blocked. The Android app is unchanged.

## Reason

Government notices are often typed in Kruti Dev (the CISF notice in testing), and blocking them made the editor useless for exactly those users. Measured on whole CISF pages, the mapping agreed with OCR on 95–97 % of words; the misses were systematic and are fixed in `krutiDev.ts`: PDF extraction returns curly quotes where KrutiDev uses `'` (श) and `"` (ष), and the mapping leaves vowel-sign fragments (आॅ, ाॅ, ाें, ाे, ाै, ाा).

## Rejected

- Converting every legacy font: other encodings have different mappings and no measured accuracy.
- Converting whole pages: Latin text in other fonts (URLs) was mangled into Devanagari.
- Trusting conversion without the OCR check.

## Consequences

Lines the user does not change keep their original KrutiDev text layer. AGENTS.md, the spec, `llms*.txt` and three guides were updated in the same change.
