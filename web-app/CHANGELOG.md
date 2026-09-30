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
