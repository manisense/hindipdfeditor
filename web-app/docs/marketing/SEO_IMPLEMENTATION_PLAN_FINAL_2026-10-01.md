# Hindi PDF Editor — final SEO, design and web experience implementation plan

Date: 1 October 2026. Status: implementation brief; application changes and deployment have not been performed. This document supersedes the earlier plan's implementation sequencing; its analytics baseline remains in `SEO_PLAN_2026-10-01.md`.

## 1. Outcome and scope

Make `https://hindipdfeditor.com/` the strongest, most useful entry point for Hindi PDF editing, with a consistent bilingual brand and a reliable path from search result to a validated exported PDF. Preserve search signals from the former `/edit/` landing page. Improve the existing articles that already attract relevant impressions before increasing publication volume.

Primary business measure: successful exports from organic sessions. Supporting measures: relevant India search clicks, query visibility by device, tool starts, task completion, export failures and crawl/index consistency. #1 is the competitive target; delivery dates below are engineering milestones, not ranking guarantees.

Included: web design tokens, homepage, shared navigation and tool entry, routing/build metadata, selected articles, real localization, analytics and release verification. Preserve tool logic and the existing rendering/export architecture. No native/mobile feature implementation, new authentication, payments, bespoke shaping engine, or broad framework migration is part of this work. The mobile fixed/non-scrollable home rule applies to the native home; the mobile website remains vertically scrollable with intentional section spacing.

## 2. What the review changes

The user confirms the live landing redirect now leads to `/`. Treat that as the destination. The local checkout still contains the opposite root-to-editor 302, Vite `base: '/edit/'`, editor output under `web-app/edit`, a static root homepage, and dynamic SEO metadata identifying `/edit/`. Do not deploy this checkout until these disagreeing assumptions are reconciled against the live setup.

Verified source findings:

- `editor/src/brand.css` has `--brand-tint: #d7e7ff`, ink `#15172c`, cream `#fbf8f1`, line `#eceae2`, multiple colored shadows and off-system accents. These differ from the mandated design tokens.
- `lib/tools.ts` assigns translation `#01873e`, merge `#5b4bd6`, split green and compression yellow; required categories are green, purple, purple and orange respectively.
- `home/ui/button.tsx` offers green and dark primary-like variants; category accents must not drive principal actions.
- `Hero.tsx` cycles headline text and initializes fades at opacity zero. The SEO title and bilingual headline need stable, immediately visible treatment.
- ToolShell uses decorative ambient layers and colored tool states. Brand blue should identify navigation/action states; category colors should identify categories.
- DropZone filters rejected files silently. File-type validation and feedback need a clear, accessible failure path.
- The app starts with `createRoot`, reads tool selection from query state and changes head metadata after mount. Distinct initial HTML and rendered metadata need consistent ownership.
- Language preference uses query/localStorage state. Public landing-page language must instead be deterministically associated with a URL.

These are source observations, not results from a live visual audit. Before/after screenshots, actual network behavior, GSC selected canonicals, field performance, exact migration date and current product limits remain release evidence to collect.

## 3. Non-negotiable design contract

`design-system.md` and root `AGENTS.md` govern implementation. Do not rewrite them to legitimize current drift. Replace drift with the prescribed values. The design document's legacy blanket privacy examples must be scoped to core local operations; they must not override the product's actual AI-processing disclosure.

| Role | Required values |
|---|---|
| Primary / gradient end / selected surface | `#1843DD` / `#3226B8` / `#EEF2FF` |
| Edit category | `#1843DD` on `#E8EDFF` |
| Translation / privacy | `#16A34A` on `#E6F7EC` |
| Merge / split | `#7C3AED` on `#F1EAFE` |
| Compression / government-form category | `#F0700F` on `#FFF1E4` |
| OCR / detection | `#0D9488` on `#E3F6F4` |
| Primary / secondary / muted text | `#14161F` / `#5B6472` / `#94A0B2` |
| Border / white / page / cream | `#E7E8F1` / `#FFFFFF` / `#FBFBFE` / `#FAF6EC` |
| Success / warning-negative | `#16A34A` / `#EF6C4D` |

Implementation contract:

1. Create one web token stylesheet derived explicitly from the root design system. Both React UI and static article/legal templates consume it. Prefer `web-app/assets/brand-tokens.css`; import it through a verified build path and reference its production URL in static pages. Keep old variable aliases temporarily only where they map exactly to approved tokens; remove obsolete aliases after consumers migrate. Tailwind aliases and plain CSS must resolve to the same values.
2. Buttons: full pill, 48px minimum principal height, approved blue-to-deep gradient for primary actions; white secondary actions with subtle border. Category chips: 40 or 48px rounded squares, radius 12px, vector icon. Cards: 16 or 20px radius, 1px subtle border, shadow `0 8px 24px rgba(20,22,31,.06)`. Tags: full pill. Component geometry need not force the PDF content itself into rounded cards.
3. Layout spacing: 4/8/12/16/24/32/48/64px. Replace arbitrary Tailwind spacing in touched surfaces. Font sizes, content widths, positioning coordinates and responsive breakpoints are separate concerns; do not quantize PDF coordinates or typography as if they were margins.
4. Use Inter and Noto Sans Devanagari; reuse already verified assets where available. Hindi headline is equal in size, weight and emphasis to its English counterpart. Tune line-height to avoid matra/reph clipping; do not apply Latin tight letter-spacing blindly to Devanagari.
5. Zero emoji UI glyphs. Use Lucide or SVG, including language selection, article tags and success/error indicators. Use text labels in addition to status icons.
6. Page default is `#FBFBFE`; alternate white and cream sections intentionally. Reserve decorative pastel mesh for the final homepage CTA only. Use category tints in chips, not ornamental full-screen backgrounds or primary actions.
7. Visible focus uses brand blue and adequate separation from the component. Test text contrast; muted text and semantic color alone are not suitable for essential small text. Use approved primary/secondary text on tinted status panels when needed, retain the semantic icon, and do not invent new colors to solve contrast.

Definition of done: homepage, tool shells and priority article templates share the same token definitions; desktop/mobile screenshots show approved geometry and typography; no off-system category actions or raw emoji icons remain in touched scope.

## 4. URL and build architecture

### Landing page and compatibility

The primary SEO page is `/`, returning 200 with a self-canonical. Bare `/edit/` redirects permanently to `/` when retired. Keep the compatibility redirect for at least one year, ideally while useful old links remain. Never blindly apply the bare-path redirect to all old query tool states.

Preferred steady-state public routes:

| URL | Purpose | Indexing |
|---|---|---|
| `/` | English-led bilingual product landing page; broad editing cluster owner | Self-canonical, indexable |
| `/hi/` | Fully translated Hindi landing equivalent | Self-canonical, reciprocal `en`/`hi`, root `x-default` |
| `/tools/edit-hindi-pdf/` | Focused executable editor entry | Unique tool workflow page; self-canonical once substantive |
| `/tools/translate-hindi-pdf/` | Translation entry with direction and consent explanation | Self-canonical once complete |
| `/tools/merge-pdf/`, `/tools/split-pdf/`, `/tools/compress-pdf/` | Distinct working tools | Self-canonical once complete |
| Existing `/articles/<slug>/` | Intent-specific tutorials | Preserve URLs; self-canonical |

Root owns the broad commercial intent. The editor tool page owns the task interface: use a distinct title such as “Edit Hindi Text in Your PDF” and task-focused instructions rather than duplicating the entire homepage. Do not introduce the clean routes as empty placeholders. Ship the new tool URLs together with their useful initial HTML and working interfaces; retain existing query tools until equivalent routes are verified. If GSC later shows redundant core-page competition, evaluate consolidation using query-page evidence.

Migration map: `/edit/?tool=edit` → editor tool; translation/merge/split/compress query values → their matching tools; preserve supported `mode=addText|erase|edit` and necessary language state. Map old localized links explicitly. Unknown tool values must not silently receive a fake indexable tool page. Tracking parameters must not alter canonical ownership. Unknown public paths return an actual 404.

Cloudflare rule matching and query preservation must be tested on the actual deployment mechanism; do not assume a pathname-only `_redirects` rule can discriminate old query states. Use an explicitly verified hosting rule or small routing boundary if needed. Root homepage navigation and tool navigation must not form a loop.

### Build approach

Keep React/Vite and Cloudflare Pages. Add build-time rendering for public landing pages and initial tool-entry shells, using a shared route/content manifest and React server rendering where components are compatible. Each URL gets correct title, description, canonical, language, visible headings, useful text and links in its initial response. The PDF workspace loads on demand in the client.

Keep routing, content generation and PDF operations separate. Server-rendered public components receive route/locale explicitly; no window/localStorage reads during initial rendering. Hydrate shared markup with `hydrateRoot`; do not combine a second independent handwritten homepage with a divergent React copy. Existing browser-only effects remain client-side. Validate that animation wrappers do not hide prerendered content at initial load.

Reconcile `vite.config.ts`, `main.tsx`, `App.tsx`, `tools.ts`, `seo.ts`, `SeoHead.tsx`, `prepare-publish.mjs`, `_redirects` and output directory ownership as one reviewable build change. Decide the final asset base from the resulting deploy tree; avoid an untested search-and-replace from `/edit/` to `/`. Build output must not overwrite public assets or erase legal/article pages. Ensure both build entry scripts call the publish step once.

Initial and client canonical must be identical for a given route. Refresh metadata after navigation and before sending the page-view event; current page-view timing can otherwise capture the previous title. Structured data describes the visible product and scoped capabilities, using stable entity IDs. Keep FAQ markup only when accurate and visible; do not forecast rich-result visibility from it.

## 5. Homepage design and content specification

The homepage remains fast to understand and directly useful. SEO content belongs in readable sections below the main action rather than around every editor control.

| Order | Section | Required experience |
|---|---|---|
| 1 | Header | Brand link to `/`; Tools, How it works, Guides; English/हिन्दी selector. Mobile menu with clear close action and focus handling |
| 2 | Hero | Stable H1 “Hindi PDF Editor Online”; equal-weight Hindi line “हिंदी PDF ऑनलाइन संपादित करें”; short accurate subtitle; primary “Open Hindi PDF Editor”; secondary “Try a sample PDF” |
| 3 | Hindi editing evidence | Real sample preview showing conjuncts/matras; label source and exported result; link to a downloadable non-sensitive fixture |
| 4 | Tool grid | Edit, Translate, Merge, Split, Compress with correct category chips and concise limitations where material. OCR is a capability, not a separate promised tool unless a real route exists |
| 5 | How editing works | Open PDF → choose text/add replacement → review → export a new file; screenshots reflect actual controls |
| 6 | Capabilities and limitations | Unicode, detected text, scanned PDF handling, legacy replacement and source preservation; links to detailed troubleshooting |
| 7 | Guides | Four useful links: Hindi tutorial, font troubleshooting, translation, Parimarjan preparation |
| 8 | FAQ | Concise typing, font, scan, privacy, export and free-limit answers |
| 9 | Final CTA and footer | One decorative mesh section; editor CTA; support, policies, guides, developer/about identity and app link |

Use desktop two-column hero only when it improves comprehension; mobile stacks headline, explanation, action and example. At 320px widths the primary action must be readily reachable without horizontal scrolling; do not impose a brittle fixed first-screen height. Avoid duplicating the full tool grid inside the hero and immediately below it. Prefer a real static preview over an autoplay animation. Keep heading and CTA visible immediately; remove typewriter cycling from the main H1, honor reduced motion and avoid delayed reveal gates.

The sample action opens the existing supported editor workflow with a bundled fixture only if the client can hand it off reliably. Otherwise show a straightforward sample-download-and-open flow. Do not force the user to choose a PDF on the homepage and again in the tool. A future direct homepage picker requires an in-memory handoff and explicit navigation-loss handling; it is not part of the initial release.

Privacy microcopy: “Core PDF editing stays on your device. AI OCR and translation send the content you approve for processing.” Keep the first clause near the editor CTA; show complete consent before AI processing. Free claims include actual current limits; do not invent quotas. Replace unsupported “first,” “flawless,” “lossless,” universal competitor failures and vector/export assertions with results validated against the current web export.

## 6. Tool user experience contract

Improve shared shells and entry states before touching individual editor internals. Once a document is open, prioritize the workspace and hide lengthy marketing sections. Contextual help is brief and collapsible; it does not obscure the page.

| State | Required behavior |
|---|---|
| Empty | One clear H1, select-PDF action, keyboard-accessible picker, desktop drop area, supported file-type guidance and sample option |
| Invalid input | Explain invalid type, corrupt PDF, password protection or unsupported behavior as applicable; no silent rejection; keep retry available |
| Loading | Named operation and useful progress if measurable; no fabricated percentage; disable conflicting actions; indicate cancellation only where supported |
| Ready | Page navigation, zoom and editing controls remain accessible; selected filename stays local UI only; clear distinction between overlay replacement and underlying-source modification |
| Legacy/unknown encoding | Preserve existing fail-closed behavior; identified legacy replacement requires explicit warning/confirmation; unknown remains blocked |
| Translation | Direction is explicit; disclose outbound text/image fallback as applicable before sending; show quota/network failures; retain the original document and user edits |
| Export | Show progress; announce success only after non-empty parseable output validation; make download reachable and allow retry without losing edits |
| Navigation | Warn before abandoning unsaved work when relevant; language changes should not discard the open document; switching tools must have predictable document/state behavior |

All main actions remain brand blue, including translate/export. Category color is confined to chips and contextual category labels. On mobile, compact persistent controls may be used only if they do not cover the PDF, browser keyboard, consent dialogs or primary actions. No sticky download bar advertising an action before a valid export exists.

Use existing components: ToolShell, DropZone, AppButton, SelectedFileSummary, AppStatus, AppPopup, LegacyFontWarning and ErrorBoundary. Preserve boundaries: shared shells do not absorb PDF rendering or export logic. Do not introduce client-side document persistence merely to smooth routing; any persistence proposal requires an explicit data-lifecycle design.

## 7. Accessibility and responsive acceptance

Test at 320, 360, 390, 768, 1024 and 1440px widths, plus a short mobile viewport, landscape and 200% zoom. These are test viewports, not new spacing tokens. Marketing content must reflow without horizontal scroll; intentional PDF canvas panning remains available. Essential controls stay visible when long Hindi labels wrap.

- Use semantic header/nav/main/footer, one principal H1 per page, ordered headings and a skip link. Set document language from the public URL; use `lang="hi"` for Hindi spans on the English page.
- Use true buttons for actions and links for navigation. Visible focus, keyboard file selection, logical tab order and accessible names are mandatory.
- Standard primary controls are 48px high; icon controls should have generous hit areas. Check WCAG target-size requirements and exceptions instead of assuming an icon’s visual size equals its tap area.
- Dialogs move focus inside, contain it while open, support a clear dismiss action when safe, and return focus to the trigger. Announce loading/errors/export states through appropriate live regions without reading the entire PDF repeatedly.
- Do not use color alone for current tool, validation or status. Test ordinary text contrast ≥4.5:1, large text ≥3:1 and important non-text boundaries/focus ≥3:1 where applicable.
- Respect reduced motion. No automatic carousel or moving headline required to understand the product.

Capture representative screenshots of homepage, article, each tool empty state, editor with Hindi sample, consent, error and export success. Inspect actual Hindi clipping and line breaks; CSS token compliance alone is insufficient visual QA.

## 8. Content and localization deliverables

| Priority | Existing page | Exact deliverable |
|---|---|---|
| P0 | Global copy/templates | Consistent local-edit versus consented-AI claims; actual limits; truthful export capability; remove fake competitor/first claims |
| P1 | Parimarjan | Verified current official links; distinguish application preparation from official-record correction; sample fields with fictitious data; actual downloadable form only when provenance is verified; source/review date; application-process limitations |
| P1 | Affidavit/name correction | Preparation and authority process; verified example and official references; no implication that changing an admit card validates a correction |
| P1 | Hindi editing tutorial | Original mobile/desktop screenshots; actual menu labels; keyboard instructions; sample PDF and output; troubleshooting; direct task CTA |
| P1 | Broken-font article | Unicode/legacy/scan distinction; actual fixture examples; replacement limitations and recovery path |
| P1 | Kruti Dev guides | Title/meta/body consistently explain Unicode replacement, not unsupported conversion; real English/Hindi equivalents if pairing them |
| P2 | Translation guide | Source/translated example, consent/limits, layout and overflow limitations, review of translation accuracy, scanned-PDF behavior |

One article template supplies breadcrumbs, category chip, title, summary, byline/reviewer, real updated date, optional table of contents for long articles, screenshots with captions, official sources, relevant tool CTA and related guides. Reading column roughly 65–75 characters for Latin text, visually checked for Hindi; comfortable body size around 16px and line-height around 1.6. Avoid repeated intrusive CTAs and unsupported “download” buttons. Download links identify format and verified file size when available.

Fix templates and `seo-keyword-queue.json`/`seo-worker.mjs` inputs together; do not manually patch generated pages while retaining stale generator claims. Track provenance and review status; generation is not publication approval. Pause quantity-based scheduled publishing until these checks are enforced. Publish at most one or two reviewed updates weekly initially.

Public `/hi/` contains complete Hindi content and metadata, with reciprocal hreflang to `/`; it must not merely relabel English navigation. Public URL determines initial language. Explicit language navigation preserves equivalent page intent. Tool UI may retain a non-destructive language toggle and user preference; it must not change public landing metadata unpredictably after load. Pair article locales only when they are genuine equivalents; remove false alternates when no translated counterpart exists.

## 9. Analytics and performance implementation

Suggested events: `tool_open`, `pdf_open_success`, `edit_started`, `export_success`, `export_failed`, `translation_started`, `translation_complete`, `translation_failed`, `sample_open`. Parameters: tool ID, public locale, coarse error category and supported workflow type only. No document text, filenames, names, page images or raw error payloads. Use a small typed analytics boundary; tool components call it at actual state transitions. React StrictMode must not duplicate completion events.

An export event means a validated artifact was produced, not that a button was clicked. Browser download initiation is distinct from proof the file was saved to disk. Use this distinction in metrics. Inspect current consent/analytics implementation and add events within its policy; do not claim anonymous processing merely because a document is not sent. Search Console query data cannot be directly joined to individual GA4 users.

Performance acceptance: preserve lazy PDF/OCR/translation loading; initial marketing must not eagerly load those vendors. Asset sizes are measured before setting budgets. Specify dimensions for screenshots, lazy-load below-fold media, optimize previews and avoid shipping redundant font families/weights. Keep actual editor/export fonts intact; any display-font optimization must not alter PDF shaping. No third-party video player on initial hero load.

Use matched lab runs and available mobile field data. Target good field CWV at the 75th percentile: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1. With insufficient field data, state that and use lab diagnostics; a Lighthouse score alone is not field verification or a #1 guarantee. Record first-load homepage and tool-open timing under the same network/device conditions before/after each major build change.

## 10. Ordered implementation backlog

Owners are roles for one developer/product owner if needed; this plan does not assume a staffed team. Estimates are planning ranges and depend on live access and existing test failures.

| ID / sequence | Work and files | Dependency | Acceptance evidence |
|---|---|---|---|
| I01 / 1 | Reconcile deployed root behavior with `_redirects`, Vite, publish script; inventory old/new URLs; capture exact GSC and screenshots | None | Documented actual deployment date, status chains, working query tools, baseline and route map |
| I02 / 2 | Introduce shared token source; migrate `brand.css`, `home.css`, static `site.css`, button/chip/card styles and tools accents | I01 | Approved palette/geometry; visual screenshots; no category-primary-action drift |
| I03 / 3 | Correct global EN/HI copy, FAQ, schema, article generator inputs and dangerous official-record guidance | I01 | Copy inventory checked against current capability/privacy; no unsupported promises |
| I04 / 4 | Route manifest, prerendered root/locale/tool shells, hydration, metadata and publish output | I01–I03 | Correct initial/rendered HTML; unique route ownership; no hydration errors, asset 404s, redirect loops or lost tool state |
| I05 / 5 | Homepage section redesign using existing components, stable bilingual hero, real preview and four priority guide links | I02–I04 | Responsive/a11y screenshots; immediately visible content and reachable main CTA; working sample flow |
| I06 / 6 | ToolShell/DropZone/status/consent/navigation polish and task-focused initial instructions | I02–I04 | Keyboard/mobile open→edit→export; invalid input feedback; no unsaved-work surprises; AI consent intact |
| I07 / 7 | Verified Parimarjan/affidavit/tutorial/font updates and article template | I03, I05 | Real sources and fictitious examples; reviewed export evidence; generator and output agree |
| I08 / 8 | Analytics boundary and route/event timing | I04, I06 | DebugView or equivalent runtime checks; single validated-success event; no sensitive parameters |
| I09 / 9 | Complete Hindi root/article pairing and rendered structured-data checks | I04, I07 | Genuine translated initial HTML; reciprocal hreflang; no canonical contradiction |
| I10 / 10 | Performance tuning, focused regression run, production route checks and GSC submission | I05–I09 | Release checklist passes; performance compared; actual exports inspected; manual checks recorded |

Suggested release sequence: first release I01–I06 plus essential analytics and claims corrections; next release reviewed priority articles/localization; final stabilization release performance and remaining evidence. Do not hold essential trust fixes for the entire 90-day campaign. Do not deploy half of a route migration.

Indicative effort: investigation 1–2 days; token/copy work 2–4 days; build/routing 3–5 days; homepage/shared UX 3–5 days; article/localization 4–7 days; measurement/QA 2–4 days. Allow roughly 3–5 working weeks for the initial implementation, followed by 60–90 days of observation and incremental improvement. External official-source verification may extend editorial work.

## 11. Verification, delivery and rollback

Run formatter and scoped linter before marking each item complete. Existing editor commands include `npm --prefix web-app/editor run lint`, `test`, and `build`; choose relevant tests for changes and investigate pre-existing failures separately. The build already runs TypeScript checking. Configure/check the existing formatter before inventing a new dependency.

Meaningful tests: route resolution and old-query migration; static/client canonical equality; locale mapping; metadata generation; invalid-file feedback; event deduplication; export-success only after validation. Avoid tests that merely repeat CSS declarations. Screenshot and browser interaction checks verify layout and workflow.

Release matrix:

| Area | Required check |
|---|---|
| Routing | Root 200; old landing permanent redirect; each old query reaches equivalent working tool; HTTP/www normalization; unknown URL 404 |
| SEO | Correct initial title/H1/canonical/lang; hydrated head agrees; sitemap contains final indexable URLs; robots allows necessary public assets; GSC inspection and rendered schema validation |
| UI | Representative responsive screenshots; strict tokens; equal Hindi weight; no emoji icons; no clipping or essential controls hidden by menus/banners |
| Accessibility | Keyboard, focus, dialogs, reduced motion, zoom, contrast and meaningful live-region feedback |
| Product | Canonical Devanagari sample open→edit→export, non-empty parse-back and actual viewer/rasterizer inspection; original unchanged; merge/split/compress smoke checks |
| AI | Consent, direction, network/quota failures and disclosed OCR fallback; no silent transmission |
| Analytics | Correct new route/title, one event per real outcome, privacy-safe payloads |
| Performance | Equivalent before/after lab conditions; field data when available; heavy tools stay lazy |

Do not conflate an HTML overlay with PDF selectability/vector output. Verify the actual current web export before describing it. Any modifications to compositor/coordinate/legacy detection require actual PDF or screenshot verification; no shaping claims from code review alone. Preserve Render & Print/HTML shaping and original-source immutability; unknown encoding remains blocked.

Deliver each item as a small Conventional Commit. Record web implementation changes in a web changelog/release note and this plan's execution checklist. Add an ADR for shared prerender/routing or token architecture decisions. Update the product spec and AGENTS in the same commit if behavior changes what they describe; do not create unrelated mobile changelog entries for a web-only styling change. Keep the existing mobile phase status unchanged.

Stage the complete deploy artifact for review. Keep the previous artifact/revision and route manifest. Before deploying, test on a preview URL with public production canonicals preserved and preview indexing explicitly disabled by the preview host response policy. Roll back UI/build regressions to a known working root-compatible artifact; do not resurrect stale root→editor redirects. Retest asset URLs and query compatibility after rollback. No deployment is included in this planning request.

## 12. Post-release decision rules

Weekly: inspect migration canonicals, errors, organic exports and India device-specific query/page performance. Compare equal completed periods around the actual migration date. Combined old/new landing visibility is more useful than interpreting the old URL's decline alone; use the property/query totals rather than presenting summed page impressions as deduplicated reach.

After recrawl and adequate samples: relevant impressions at positions 4–15 → improve evidence and contextual links; strong positions with weak CTR → inspect real result title/intent; traffic increases without completed exports → fix the workflow; valid pages not indexed → inspect status/canonical/content; new tool pages overlapping root → assess query-page ownership before consolidating.

Create a public shaping fixture and original walkthrough that educators and relevant software writers can cite. Prepare targeted outreach after proof is available; send only when explicitly authorized. New articles need distinct supported intent and original evidence, not a daily keyword quota. No link purchases or manufactured reviews.

## 13. Execution checklist

- [ ] I01: live/local reconciliation, baseline and route map
- [ ] I02: shared design tokens and component audit
- [ ] I03: accurate privacy/capability/official-process copy
- [ ] I04: crawlable root, tool shells, build and canonical consistency
- [ ] I05: homepage UI and sample evidence
- [ ] I06: tool entry, feedback, navigation and consent UX
- [ ] I07: priority article deliverables and template
- [ ] I08: validated conversion analytics
- [ ] I09: genuine localization and rendered schema
- [ ] I10: performance, actual exports, release checks and indexing follow-up

None are marked complete by writing this plan.

## Primary references

- Repository: root `AGENTS.md`, `design-system.md`, complete `mobile-app/hindi-pdf-editor-spec.md`, earlier SEO audit and the source paths cited above.
- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): initial HTML, rendering, metadata and canonical consistency.
- [Google URL migrations](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes): URL mapping, permanent redirects and monitoring.
- [Google localized pages](https://developers.google.com/search/docs/specialty/international/localized-versions): real locale equivalents and reciprocal annotations.
- [Google Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals): performance targets and limits of ranking inference.
- [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): interactive target sizing and exceptions.
- [Google helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content): original evidence and user benefit.


## Implementation status — 1 October 2026

The first local batch implements root/locale prerendering, dedicated tool routes and legacy migration, shared design tokens, the homepage redesign and editor-only outcome events. This does not mark the complete plan finished. See [the execution record](SEO_EXECUTION_RECORD_2026-10-01.md) for acceptance evidence, release limits and remaining work.
