# 0003 — `@cantoo/pdf-lib` fork over the original `pdf-lib`

**Status:** Accepted.

## Context

The spec needs a read-only PDF inspection library for two things: reading a page's real point-dimensions (`getSize()`, feeds `exportPdf.ts`) and enumerating embedded font names to detect legacy Devanagari fonts (`legacyFontDetector.ts`). `pdf-lib` (Hopding) was the original candidate — it's the well-known library for this. At verification time (July 2026), the original `pdf-lib` repository has had no meaningful maintainer response to issues or PRs since 2023–2024; multiple downstream projects (e.g. Stirling-PDF) have already migrated to a maintained fork.

## Decision

Use `@cantoo/pdf-lib` (maintained by Cantoo, a company with an active roadmap) instead of `pdf-lib` directly. It's a drop-in, API-compatible fork — same import shape, same methods used by this spec (`PDFDocument.load()`, `getPage(i).getSize()`, font-dictionary inspection). No code-shape change versus what the original spec assumed, only the package name.

## Rejected alternatives

- **Original `pdf-lib`:** effectively unmaintained. A dependency this project would otherwise be stuck on indefinitely if a bug surfaced in a version we depend on.
- **Reimplementing PDF metadata parsing in-house:** far more work than swapping a package name for a task (page size + font dictionary inspection) that isn't this project's hard problem.

## Consequences

- If Phase 5 (deferred, optional — see ADR 0001) is ever built, it also uses `@cantoo/pdf-lib`'s low-level glyph-placement API rather than the original, for the same reason.
- `@pdf-lib/fontkit` is not needed anywhere in Phases 0–4 — this project never draws text with pdf-lib/`@cantoo/pdf-lib`, only inspects existing documents read-only.
- Because this is a fork, it should be re-checked periodically for whether it has itself gone stale or been superseded by something else — the same vetting standard applied when it was chosen.

**Date:** 2026-07.
