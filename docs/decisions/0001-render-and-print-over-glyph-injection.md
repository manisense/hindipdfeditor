# 0001 — "Render & Print" over direct glyph injection

**Status:** Accepted. Committed for Phases 0–4; not to be re-litigated mid-build (see spec Section 3).

## Context

PDF stores text as absolute-positioned glyph paint instructions, not semantic content. Devanagari is an abugida — conjuncts, matras, and reph require real OpenType (GSUB/GPOS) shaping, which is exactly what naive PDF-generation libraries get wrong, producing disconnected base characters instead of joined conjuncts. We need a way to edit an *existing* PDF and guarantee correct Devanagari shaping at every stage, on zero budget.

## Decision

Never compute PDF glyph coordinates ourselves. Instead:
1. Rasterize the specific page being edited to a high-res PNG via the OS's native PDF renderer.
2. Track edits as positioned data (text/mask), never as PDF drawing instructions.
3. At export time, assemble one HTML `<div>` per page (PNG as `background-image`, edits as absolutely-positioned `<span>`/`<div>` layers with an embedded Devanagari font).
4. Load that HTML into a WebView and export via Android's native print pipeline (`WebView.createPrintDocumentAdapter()` / `expo-print`).
5. Chromium's own HarfBuzz-backed renderer does all Devanagari shaping — the same shaping engine Android already trusts system-wide.

Full detail: spec Section 3–5.

## Rejected alternatives

- **`android.graphics.pdf.PdfDocument` / `Canvas.drawText()`:** risks silently rasterizing text into an unselectable bitmap; designed for generating new documents, not editing existing ones. Also explicitly banned by AGENTS.md's non-negotiable rules.
- **`pdf-lib` + `@pdf-lib/fontkit` (hand-rolled glyph placement):** fontkit has real Indic-shaping infrastructure, but this path requires hand-writing all PDF coordinate/baseline/Y-flip math ourselves, with no strong independent evidence of reliability across arbitrary real-world Devanagari text. More moving parts, more ways to get it subtly wrong. (This is Plan B / Phase 5 — see ADR 0003 for why we don't use `pdf-lib` directly even read-only.)
- **`pdfnative` (npm):** genuinely good Devanagari OpenType shaping, but its API is built around generating new documents from structured `blocks`, not placing text at arbitrary coordinates on an existing page. Wrong shape for this task.

## Consequences

- 100% of Devanagari shaping is delegated to production-grade code (Chromium/HarfBuzz) instead of hand-rolled or third-party glyph math — this is the single decision the whole project's correctness depends on.
- Live editing (native `<TextInput>`, HarfBuzz-backed since Android O) and export (Chromium/HarfBuzz) use *different* renderers, but both are HarfBuzz-based, which is what keeps "what you see while editing" consistent with "what you get in the file."
- Text selectability of the exported PDF is not guaranteed (varies by `expo-print` version/platform) — this is an accepted tradeoff, not a defect, since selectability was never a hard requirement (spec Section 12).
- A vector-preserving alternative (`harfbuzzjs` + low-level `pdf-lib` glyph placement) remains available as Phase 5, deferred, only after Phases 0–4 are working and validated in real use.
