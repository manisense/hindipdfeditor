# 0004 — Explicit lazy chunks and pinned local UI fonts

Date: 1 October 2026

## Decision

Enable Rollup `onlyExplicitManualChunks` for the existing named PDF vendor chunks. Serve the design system's existing Inter and Noto Sans Devanagari UI families as versioned local WOFF2 assets with official-source provenance, exact byte sizes, SHA-256 checks and OFL licenses. Keep font faces directly in the shared token stylesheet so Vite resolves and hashes client assets correctly while static pages resolve the same local files.

## Reason

Implicit dependency capture moved shared loader/CommonJS helpers into heavy PDF chunks; the initial homepage then loaded those libraries despite lazy tool components. Explicit chunk ownership removes this eager dependency path. Remote Google font CSS remained render-blocking and fetched an unused family. Local pinned subsets remove that network dependency and preserve equal Latin/Hindi weights.

## Rejected

Do not disable lazy tools, duplicate font definitions or replace editor/export font binaries with UI subsets. These changes concern public display only. Do not claim Lighthouse results demonstrate field Core Web Vitals. The final local mobile audit scored 89 performance, 100 accessibility and 100 SEO, with 3.3-second LCP, zero blocking time and zero layout shift; field LCP still needs measurement.

## Verification

Artifact and browser checks reject eager homepage PDF loading and missing deployed font URLs. Font signatures, byte counts and hashes are checked. The actual Chromium-printed Hindi fixture at weights 400/700/800 was inspected using both Poppler and MuPDF: conjuncts, matras and reph were visible without clipping. Poppler emitted Type 3 glyph bounding-box warnings from Chromium's print output; both independent rasterizers displayed the same correct text. This fixture does not validate a new PDF export font catalog.
