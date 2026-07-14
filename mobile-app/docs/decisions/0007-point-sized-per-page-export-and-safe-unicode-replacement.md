# 0007 — Point-sized per-page export and safe Unicode replacement

**Status:** Accepted for Phase 4.7; physical Android verification remains an acceptance gate.

## Context

Real use exposed several coupled failures: Export could sit beneath Android system navigation, multi-page printing could insert alternating blank sheets, raster detail degraded after save, and narrow replacement boxes could stack Devanagari clusters vertically. The authoring flow also lacked redo, persistent File Manager saving, blank-page creation, curated font installation, and a useful—but safe—path for positively identified legacy-font pages.

## Decision

Keep ADR 0001's Render & Print architecture, with these mechanics:

1. Rasterize PDF pages at 3× point dimensions with `PdfRenderer` print mode and opaque JPEG quality 97.
2. Compose each page in canonical CSS points, using a base64 `<img>` content layer and escaped, explicitly horizontal text.
3. Print one page per WebView call at its exact point dimensions. Validate each result, copy the already-shaped page with `@cantoo/pdf-lib`, and validate the merged PDF. `@cantoo/pdf-lib` never draws text.
4. Save a validated copy to a user-selected Android Storage Access Framework directory; never move or overwrite the source.
5. Keep unknown/inconclusive font inspection blocked. A positively identified legacy page may enter explicit raster-only Unicode replacement mode after warning and confirmation. The old page remains a flattened immutable image; new text uses verified Unicode fonts. The app never interprets legacy bytes as Unicode.
6. Bundle Noto Sans as the offline default. Offer only curated downloadable families pinned to immutable official files and validated before use. Mukta is the first admitted family.
7. Declare every embedded font with the weight descriptor its file actually contains and embed only families used on the isolated page. Noto Sans is variable (`100 900`); Mukta Regular is static (`400`). Mixing the unused variable face with the static face in one print document produced broken transparency masks in Cairo-based PDF rendering even though another renderer looked correct.

## Rejected alternatives

- **One multi-page HTML print:** reintroduced WebView page-break rounding, extra-sheet behavior, and all-page resource coupling.
- **Direct `pdf-lib` string drawing:** violates the shaping architecture and AGENTS.md.
- **Downloading the detected legacy font and editing its bytes:** a font file cannot convert non-Unicode character encoding into correct Unicode text.
- **Unpinned runtime font URLs:** mutable supply-chain input and no deterministic export fixture.
- **Noto Serif, Hind, or Tiro as current catalog entries:** desktop cross-renderer fixture checks produced black compositing regions in at least one PDF rasterizer. They stay excluded until their specific print interaction is resolved.

## Consequences

- Multi-page export makes more print calls and can take longer, but each call has bounded memory and deterministic dimensions.
- Inserted blank pages and source pages share one export contract without mutating the original.
- Downloaded font files consume small persistent storage and require network access once; bundled Noto Sans remains available offline.
- Unit, Chromium, and independent Poppler rendering checks cover the deterministic layers. Native print mode, JPEG quality, safe areas, font installation, and Storage Access Framework still require the production-build physical-device pass.

**Date:** 2026-07-14.
