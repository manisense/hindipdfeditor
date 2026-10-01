# Changelog

## Unreleased — SEO implementation, 1 October 2026

### Changed
- The public homepage is rendered at build time at `/`, with a real Hindi equivalent at `/hi/` and stable reciprocal language links.
- Tool URLs now use `/tools/`; retired `/edit/?tool=` links permanently redirect to the equivalent task while preserving mode, language and tracking state.
- React and static pages share design-system tokens. The homepage uses equal-weight English/Hindi headlines, restrained category chips, pill actions and accessible native disclosures.
- Homepage privacy, legacy-font and image-based export descriptions now match the implemented behavior. Unsupported comparisons and animated headline components were removed.
- Invalid or mixed file selections produce actionable feedback instead of silent rejection.
- The editor records only coarse file-open and validated-export events, without document content or filenames.

### Verification
- TypeScript/build, full ESLint, and unit tests run during implementation; see the execution record for final counts.
- Local Cloudflare preview verified root/tool routing, initial and hydrated canonicals, responsive pages and a real Hindi fixture export.
- Production deployment, GSC selected canonicals, authenticated AI completion and field Core Web Vitals remain unverified.

### Release follow-up
- Final checks: 80 editor tests, 3 routing tests, lint, production build and artifact validation passed; responsive browser smoke and actual Devanagari export passed.
- Existing dependency audit warnings and production-only checks are recorded in `docs/marketing/SEO_EXECUTION_RECORD_2026-10-01.md`.

### Dependency security follow-up
- Compatible lockfile updates clear all 9 reported audit findings: PDF.js 5.5.207, DOMPurify 3.4.16 and Vitest 4.1.11 among the updates. Audit returned zero findings; 80 tests, lint, production build and real Hindi browser export passed.

### Editor navigation safeguard
- Unexported authoring edits trigger browser navigation protection and a focused discard confirmation when opening another file. OCR cache and viewport changes do not trigger it. Export snapshots preserve protection for edits made while an export is running.
- Lint, 81 tests, build and browser keep-editing/export regression passed.

### Validated utilities, consent and analytics
- Merge, split and compression outputs are parsed back and checked against expected page counts before download success. Busy operations disable conflicting file/settings changes; changing inputs clears stale completion state.
- Translation requires explicit text/image-processing consent. Font inspection failures and nameless referenced fonts block processing instead of silently assuming a safe encoding. Compact Turnstile layout and script-load errors are handled.
- Tool outcome events use coarse payloads. Page analytics excludes query strings and raw referrers; analytics runs only on production hostnames. English/Hindi privacy disclosures now describe actual AI and analytics processing.
- Final editor verification: 85 tests across 21 files, lint and TypeScript/build passed. Additional article, analytics and routing tests: 7 passed.

### Reviewed article system
- Replaced legacy generated layouts and unsupported claims with a shared design-system article template and reviewed source data for twenty guides, including four new translated counterparts.
- Five genuine article language pairs use reciprocal hreflang. Unpaired articles have no invented alternate URLs. Government guides link official sources and distinguish preparing an application from changing an issued record.
- Publication requires review metadata; regenerated source/output parity, visible FAQ/schema correspondence, internal links, sitemap dates and article hub are checked. Machine-readable site summaries now match product limitations.
