# Site Audit: hindipdfeditor.com (SEO / GEO / AEO), repo-based, as of 2026-09-25

Scope and method: read-only audit of `/home/user/hindipdfeditor/web-app` (static Cloudflare Pages site + Vite/React editor at `web-app/editor`). Per-page signals were extracted with a script over every static HTML file. File citations are repo-relative paths (line numbers where useful). **The live site could not be fetched**: the sandbox egress proxy returned 403 / EGRESS_BLOCKED for `hindipdfeditor.com`, so every "live behavior" statement below is inferred from repo config plus Cloudflare/Google documentation. External doc URLs are cited from prior knowledge and were **not re-fetched in this session**.

---

## 1. Page inventory, targeting, and the EN / HI split (hreflang)

### Takeaway
The site has 1 redirect-only root, 1 client-rendered SPA hub (`/edit/`) with 5 query-string tool "pages", 17 static article pages (16 guides + hub), 4 English legal/support pages and 4 Hindi (`/hi/`) legal/support pages. No Hindi homepage or Hindi tool URL exists. Hreflang is broken almost everywhere: most pages self-declare as both `en` and `hi`, and the few real EN/HI pairs are not reciprocal. Google will ignore most of these annotations.

### Cited Findings
**Inventory (sitemap.xml has 34 `<loc>` entries; file tree agrees):**
- `/`: `index.html` is a redirect stub. `_redirects` line 1 is `/ /edit/ 302`, the HTML also has `<meta http-equiv="refresh" content="0; url=/edit/">` (line 47) and `location.replace('/edit/')` (line 215), yet it declares `<link rel="canonical" href="https://hindipdfeditor.com/">` (line 16). [web-app/_redirects](web-app/_redirects); [web-app/index.html](web-app/index.html)
- `/edit/`: the React SPA shell whose marketing homepage (Nav, Hero, Features, HowItWorks, ComparisonSection, UseCases, Articles, WorkYourWay, FAQ, CTA, Footer) renders client-side. [web-app/editor/src/home/HomePage.tsx](web-app/editor/src/home/HomePage.tsx)
- `/edit/?tool=edit|translate|merge|split|compress`: the tools, chosen with a `?tool=` query param. [web-app/editor/src/lib/tools.ts](web-app/editor/src/lib/tools.ts)
- The 16 articles (all in the sitemap), by language and target:

| Slug | Lang | Target |
|---|---|---|
| hindi-pdf-kaise-edit-kare | hi | head term "हिंदी पीडीएफ कैसे एडिट करें" |
| kruti-dev-pdf-unicode-converter-hindi | hi | Kruti Dev to Unicode |
| sarkari-admit-card-name-correction-affidavit-hindi | hi | name-correction affidavit |
| khasra-khatauni-bhulekh-sudhar-hindi-pdf | hi | Bhulekh land-record correction |
| swapramanit-ghoshna-patra-edistrict-hindi-pdf | hi | UP e-District self-declaration |
| bihar-bhumi-parimarjan-plus-shapath-patra-pdf | hi | Bihar Parimarjan Plus affidavit |
| pdf-size-kam-kaise-kare-100kb-sarkari-form | hi | compress PDF to 100KB/200KB |
| e-stamp-paper-par-hindi-matter-print-margin-guide | hi | e-stamp paper print margins |
| fix-broken-hindi-fonts-in-pdf | en | why matras break |
| edit-sarkari-admit-card-hindi-pdf | en | admit card editing |
| translate-hindi-pdf-to-english | en | translation |
| kruti-dev-to-unicode-hindi-pdf-editor | en | Kruti Dev |
| khasra-khatauni-land-record-hindi-pdf-edit | en | land records |
| up-police-bharti-admit-card-hindi-pdf-edit | en | UP Police admit card |
| merge-multiple-hindi-pdf-files-online | en | merge |
| compress-scanned-hindi-pdf-without-blur | en | compress |

  Sources: [web-app/sitemap.xml](web-app/sitemap.xml); [web-app/scripts/seo-keyword-queue.json](web-app/scripts/seo-keyword-queue.json)
- Legal and support pages: `/privacy/`, `/support/`, `/terms/`, `/data-safety/` (lang=en) and `/hi/privacy/`, `/hi/support/`, `/hi/terms/`, `/hi/data-safety/` (lang=hi). There is no `/hi/` index, no `/hi/edit/`, and no `/hi/articles/`. [web-app/hi/](web-app/hi/)

**The Hindi UI exists only as client state, never as a URL:**
- `LanguageProvider` picks the language from `?lang=`, then `localStorage('preferred_language')`, then `navigator.language.startsWith('hi')`. The toggle (`setLang`) updates state, localStorage and `document.documentElement.lang`, but never changes the URL. [web-app/editor/src/lib/i18n.tsx](web-app/editor/src/lib/i18n.tsx) (~lines 310–331)
- Hindi FAQ copy (`SITE_FAQS_HI`) and full Hindi translations exist in the bundle. [web-app/editor/src/home/faqData.ts](web-app/editor/src/home/faqData.ts)

**Hreflang defects:**
- `/` and `/edit/` declare `en`, `hi`, `en-IN` and `x-default`, all pointing to the same `https://hindipdfeditor.com/edit/`. `?lang=hi` is never declared. [web-app/index.html:17-20](web-app/index.html); [web-app/editor/index.html:21-24](web-app/editor/index.html)
- 12 of 16 articles and the articles hub declare `hreflang="en"`, `"hi"` and `"x-default"` all pointing to themselves. So English pages claim to be the Hindi version too, and Hindi pages (bihar, e-stamp, pdf-size, swapramanit) claim `hreflang="en"` for Devanagari content. Example: [web-app/articles/fix-broken-hindi-fonts-in-pdf/index.html:13-15](web-app/articles/fix-broken-hindi-fonts-in-pdf/index.html)
- Four Hindi articles point `en` to an English counterpart, but the English page doesn't point back, so every pair is non-reciprocal:

| Hindi page | Declared `en` | English page's `hi` |
|---|---|---|
| hindi-pdf-kaise-edit-kare | fix-broken-hindi-fonts-in-pdf | points to itself |
| kruti-dev-pdf-unicode-converter-hindi | kruti-dev-to-unicode-hindi-pdf-editor | points to itself |
| khasra-khatauni-bhulekh-sudhar-hindi-pdf | khasra-khatauni-land-record-hindi-pdf-edit | points to itself |
| sarkari-admit-card-name-correction-affidavit-hindi | edit-sarkari-admit-card-hindi-pdf | points to itself |

  The pairs also aren't true translations. For example, "how to edit Hindi PDF" is paired with "why fonts break". [web-app/articles/hindi-pdf-kaise-edit-kare/index.html:13-15](web-app/articles/hindi-pdf-kaise-edit-kare/index.html)
- `/hi/*` legal pages carry correct hi/en/x-default sets. The English legal pages (`/privacy/`, `/support/`, `/terms/`, `/data-safety/`) have no hreflang tags, so those pairs are also non-reciprocal. They do have one visible link to the Hindi version.
- The article generator hard-codes the self-referencing en/hi/x-default block, so every future article inherits the bug. [web-app/scripts/seo-worker.mjs:143-145](web-app/scripts/seo-worker.mjs) (also ~line 64 in the template section)
- Google requires hreflang annotations to be bidirectional, or they may be ignored. — [Google Search Central: Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions) (not re-fetched)

### Inferences
- In effect the site has zero working hreflang clusters. Hindi searchers can only land on the 8 Devanagari articles and the 4 `/hi/` legal pages. The core product and marketing homepage is indexable only in English, because Googlebot renders with no localStorage and a non-Hindi locale.
- The biggest structural gap is the missing crawlable Hindi homepage and Hindi tool landing pages (e.g., `/hi/` and `/hi/edit-hindi-pdf/`), given that the target audience is Hindi-first.

### Gaps
- Search Console data (indexed URLs, which language versions Google chose as canonical) isn't in the repo. Actual indexation is unknown.

---

## 2. Per-page on-page signals (title, description, canonical, headings, OG/Twitter, JSON-LD, lang)

### Takeaway
The static articles have a solid baseline: unique titles and descriptions, self-canonicals, one H1 each, OG and Twitter tags, and an Article + BreadcrumbList + FAQPage graph. But they are thin, templated, lack images in schema and named authors, and several titles are too long. The SPA hub and tool pages have conflicting static-vs-JS metadata and duplicated or mis-scoped JSON-LD.

### Cited Findings
**Articles (17 static pages):**
- All have `<html lang>` matching their content: 8 `hi`, 8 `en`, and the hub is `en` even though it contains much Devanagari. There's one H1 per page, a self-referencing canonical, `robots index,follow,max-image-preview:large,max-snippet:-1`, 6 OG tags and 4 Twitter tags, and the same OG image (`/assets/play-store/hindi-pdf-editor-tablet.png`). (Script extraction over `web-app/articles/*/index.html`.)
- Title lengths run 71–103 characters. The longest is `swapramanit-ghoshna-patra-edistrict-hindi-pdf` at 103; `merge-multiple-hindi-pdf-files-online` is 98. Three English titles lack the "— Hindi PDF Editor" suffix (fix-broken, edit-sarkari, translate). Description lengths are 134–188 characters; `sarkari-admit-card-name-correction-affidavit-hindi` is 188.
- Heading structure is shallow: 2–4 H2s per article. Steps and FAQ questions use `<h4>` directly under `<h2>` (skipping H3), and the answer-first block is an `<h4>` labelled literally "Direct Answer: …". [web-app/articles/kruti-dev-to-unicode-hindi-pdf-editor/index.html](web-app/articles/kruti-dev-to-unicode-hindi-pdf-editor/index.html) (body ~lines 125–170)
- JSON-LD on every article is `Article` + `BreadcrumbList` + `FAQPage`. The `Article` node has no `image` property on any of the 16 articles (grep count 0). The author is `Organization` "Hindi PDF Editor Team" (one article says "Editorial Team"). The publisher is an inline Organization, not an `@id` link to `#organization`. The 5 oldest English articles lack `inLanguage`.
- The articles hub uses `CollectionPage` + `BreadcrumbList` with no `ItemList` or `hasPart` enumerating the articles. [web-app/articles/index.html:~608-640](web-app/articles/index.html)
- Legal and support pages have no JSON-LD, use `twitter:card=summary` with the app icon as OG image, and have short titles and descriptions (Terms description is 34 characters). [web-app/terms/index.html](web-app/terms/index.html)
- The decorative emoji "✨" appears in the eyebrow tag of all 17 article pages (the hub also has "➔"). That violates the repo's own "Zero Emojis in UI" rule. [AGENTS.md](AGENTS.md); e.g. [web-app/articles/kruti-dev-to-unicode-hindi-pdf-editor/index.html](web-app/articles/kruti-dev-to-unicode-hindi-pdf-editor/index.html) (hero eyebrow)

**The SPA hub `/edit/` and the tool URLs:**
- Static `editor/index.html` has the title "Hindi PDF Editor — Edit, Translate & Manage Hindi PDFs Online", canonical `/edit/`, full OG and Twitter tags (tablet image, 2560×1440, `summary_large_image`), and a static JSON-LD graph (Organization, WebSite, SoftwareApplication, HowTo, BreadcrumbList, FAQPage with 7 Qs) **without an element id**. [web-app/editor/index.html:7-246](web-app/editor/index.html)
- At runtime, `SeoHead` calls `applySeo` and `applyHomeJsonLd`, which inject a second graph with id `seo-site-graph`. It has the same `@id`s and a 9-question FAQ from `SITE_FAQS`. So the rendered hub carries two Organization, WebSite, SoftwareApplication, HowTo and FAQPage blocks with the same `@id`s and different content (7 vs 9 FAQs). [web-app/editor/src/lib/seo.ts:95-224](web-app/editor/src/lib/seo.ts); [web-app/editor/src/components/SeoHead.tsx](web-app/editor/src/components/SeoHead.tsx)
- On tool routes, `clearHomeJsonLd()` removes only the injected `#seo-site-graph`. The static hub FAQPage and HowTo in `index.html` stay in the head of every `?tool=` page, even though that FAQ content isn't visible there. [web-app/editor/src/lib/seo.ts:227-229](web-app/editor/src/lib/seo.ts)
- `applySeo` overwrites `og:image` and `twitter:image` with `/assets/app-icon.png` and sets `twitter:card=summary`. The static `og:image:width=2560` / `height=1440` meta tags are left behind, so the rendered DOM has mismatched image dimensions. [web-app/editor/src/lib/seo.ts:86-91](web-app/editor/src/lib/seo.ts)
- Tool-page title template: "`{tool.title} — Free Online | Hindi PDF Editor`". The canonical `/edit/?tool=<id>` is set only by JS. The raw HTML canonical for every tool URL is `/edit/`. [web-app/editor/src/lib/seo.ts:28-38](web-app/editor/src/lib/seo.ts)
- SoftwareApplication: `priceCurrency: "USD"` (the playbook recommends INR), `operatingSystem: "Android, Web, Windows, macOS, Linux, iOS"`, and no `aggregateRating` or `review`. [web-app/editor/index.html:100-131](web-app/editor/index.html)
- Google's software-app rich result requires `offers.price` plus `aggregateRating` or `review`, so the current markup isn't eligible. — [Google: Software app structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app) (not re-fetched)
- Since August 2023, Google shows FAQ rich results only for well-known government and health sites, and it deprecated HowTo rich results. — [Google Search Central blog, Aug 2023: Changes to HowTo and FAQ rich results](https://developers.google.com/search/blog/2023/08/howto-faq-changes) (not re-fetched)
- Headings on the home page (CSR only): one H1 in Hero, H2s in Features, HowItWorks, Comparison, UseCases, Articles, WorkYourWay, FAQ and CTA. [web-app/editor/src/home/Hero.tsx:96](web-app/editor/src/home/Hero.tsx) etc.

### Inferences
- FAQPage and HowTo markup won't produce rich results for this site. It still gives answer engines machine-readable Q&A, but duplicated and mis-scoped blocks send conflicting signals. Recommendation: one graph per page, with FAQ only where the Q&A is visible.
- Titles over ~60–70 characters will be truncated in the SERP, and the brand suffix eats space on long Hindi titles.

### Gaps
- Rich Results Test and Schema validator runs couldn't be done (no network to the site).

---

## 3. Crawlability of editor/tool content, rendering and Core Web Vitals risks

### Takeaway
The core product and marketing homepage (`/edit/`) is a pure client-rendered React SPA with an empty `<div id="root">`. Crawlers that don't run JavaScript (most AI crawlers) see only head metadata and JSON-LD: no H1, no body copy, no internal links. Performance risks are moderate: heavy JS for tools, Google Fonts with `display=swap`, and a ~1 MB OG PNG.

### Cited Findings
- The `/edit/` body is `<div id="root"></div><script type="module" src="/src/main.tsx">`. There is no prerender, SSR or `<noscript>` fallback. [web-app/editor/index.html:248-251](web-app/editor/index.html)
- The build is plain `vite build`. No SSG or prerender plugin is configured. [web-app/editor/vite.config.ts](web-app/editor/vite.config.ts); [web-app/editor/package.json](web-app/editor/package.json)
- A study of major AI crawlers (GPTBot, ClaudeBot, PerplexityBot and others) found they fetch JS files but don't execute them, so client-rendered content is invisible to them. — [Vercel: The rise of the AI crawler (Dec 2024)](https://vercel.com/blog/the-rise-of-the-ai-crawler) (not re-fetched)
- Google advises against using JavaScript to change a canonical to something different from the one in the raw HTML. Here the raw canonical is `/edit/` and the JS canonical is `/edit/?tool=x`. — [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) (not re-fetched)
- Tool pages are lazy-loaded (`React.lazy`) with the fallback "Loading PDF tool…". Heavy dependencies: `pdfjs-dist`, `tesseract.js`, `@cantoo/pdf-lib` (the config comments it as a 595 kB chunk), `html2canvas`, `jspdf`. Every home section imports `motion/react`. [web-app/editor/src/App.tsx](web-app/editor/src/App.tsx); [web-app/editor/vite.config.ts:56-66](web-app/editor/vite.config.ts); grep of `web-app/editor/src/home/*.tsx`
- Fonts: Google Fonts CSS loads Inter, Noto Sans Devanagari and Plus Jakarta Sans at 3–4 weights each, with `display=swap` and preconnect, on both articles and the SPA. The SPA also ships local variable TTFs (NotoSansDevanagari 647 KB, NotoSerifDevanagari 758 KB), used for export. [web-app/editor/index.html:63-68](web-app/editor/index.html); [web-app/editor/public/fonts/](web-app/editor/public/fonts/)
- Images: every static page's `<img>` (the logo) lacks `width` and `height` attributes. CSS sets 32×32 in the header, so the CLS risk is low. The OG image is a 2560×1440 PNG of 997 KB; `app-icon.png` (logo, 1024×1024) is 182 KB and is displayed at 32 px. (Local file inspection of `web-app/assets/`.)
- Every page loads GA4 (`G-1K5ZEEBHE5`) through `/assets/analytics.js`, which also classifies AI referrers (ChatGPT, Perplexity, Claude, Gemini, Copilot). [web-app/assets/analytics.js](web-app/assets/analytics.js)
- Articles inline ~400+ lines of CSS per page plus `/assets/site.css`. The article bytes (19–28 KB) are mostly CSS and JSON-LD; visible text is 289–623 words.

### Inferences
- For GEO (ChatGPT, Claude, Perplexity), the homepage's comparison table, feature copy and FAQ are effectively invisible. Only the static articles, llms.txt and the JSON-LD in the `/edit/` head are readable. Prerendering `/edit/` and each tool route to static HTML (or making `/` a real static landing page) is the top technical fix.
- Serving a 182 KB 1024 px PNG as a 32 px logo, plus a ~1 MB OG image, is wasteful on low-end Indian mobile connections. The OG image is also likely too large for reliable WhatsApp link previews (commonly reported limit around 300 KB; unverified here).

### Gaps
- No built `edit/` output exists in the repo, so actual bundle sizes and CWV field data (CrUX / Search Console) couldn't be measured.

---

## 4. robots.txt, sitemap.xml, _headers, _redirects, llms.txt and llms-full.txt

### Takeaway
robots.txt is permissive and correct. The sitemap is complete for articles, but it lists a redirecting URL, text files, and query-param SPA URLs. `_headers` has a serious caching bug (year-long `immutable` on non-fingerprinted CSS/JS). `_redirects` uses a 302 for the homepage, and the missing `404.html` probably makes every unknown URL a soft-404. The internal SEO playbook is published publicly. llms.txt is good; llms-full.txt is stale.

### Cited Findings
**robots.txt**
- `User-agent: * Allow: /`, plus explicit Allow for GPTBot, ChatGPT-User, OAI-SearchBot, Google-Extended, anthropic-ai, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Applebot-Extended, Bytespider, cohere-ai and Meta-ExternalAgent. Sitemap declared. There's no Bingbot-specific or `Perplexity-User` entry; the wildcard covers them. [web-app/robots.txt](web-app/robots.txt)

**sitemap.xml**
- Lists `https://hindipdfeditor.com/`, which 302-redirects to `/edit/`. [web-app/sitemap.xml](web-app/sitemap.xml); [web-app/_redirects:1](web-app/_redirects)
- Lists `/llms.txt` and `/llms-full.txt` as URLs, and the 5 `?tool=` query URLs, whose raw HTML canonical is `/edit/`.
- All 16 articles and the 4 `/hi/` pages are included. lastmod values are batch dates (2026-08-16 to 2026-08-25). No `xhtml:link` hreflang is in the sitemap. `changefreq` and `priority` are present; Google ignores them.
- The worker appends new URLs with today's lastmod but never refreshes lastmod on edits. [web-app/scripts/seo-worker.mjs:596-605](web-app/scripts/seo-worker.mjs)

**_redirects**
- Contents: `/ /edit/ 302`, plus 301s for `/privacy-policy`, `/legal/privacy`, `/contact`, `/help`, `/terms-of-use`. There's no www-to-apex or http-to-https rule; on Pages those are handled in the dashboard, so current behavior is unknown. [web-app/_redirects](web-app/_redirects)
- Cloudflare Pages applies `_redirects` rules even when a static asset matches, so `/` never serves `index.html` to users or crawlers (except via meta-refresh/JS fallback). — [Cloudflare Pages: Redirects](https://developers.cloudflare.com/pages/configuration/redirects/) (not re-fetched)
- All static pages link the logo and breadcrumb "Home" to `/`, so every internal "home" link and the BreadcrumbList item hit a 302. E.g. [web-app/articles/kruti-dev-to-unicode-hindi-pdf-editor/index.html](web-app/articles/kruti-dev-to-unicode-hindi-pdf-editor/index.html) (`<a class="brand-logo" href="/">`)

**404 handling**
- There's no `404.html` in `web-app/`, and `prepare-publish.mjs` doesn't create one. `editor/wrangler.toml` sets `not_found_handling = "404-page"`, which only applies in Workers-assets mode. [web-app/scripts/prepare-publish.mjs](web-app/scripts/prepare-publish.mjs); [web-app/editor/wrangler.toml](web-app/editor/wrangler.toml)
- Cloudflare Pages treats a project with no top-level `404.html` as a SPA and serves the root `index.html` with 200 for unmatched paths. — [Cloudflare Pages: Serving pages / Not Found behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/) (not re-fetched)

**_headers**
- `/*`: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`. There's no HSTS, no CSP, and no `X-Robots-Tag` anywhere (e.g., for `.md` or text files). [web-app/_headers](web-app/_headers)
- `/assets/*` gets `Cache-Control: public, max-age=31536000, immutable`, but files under `/assets/` are not content-hashed (`site.css`, `site.js`, `analytics.js`, `app-icon.png`, `brand-logo.png`, Play Store screenshots). Only favicons have an exception. `/edit/assets/*` also includes unhashed copies from `editor/public/assets/`. [web-app/_headers](web-app/_headers); [web-app/assets/](web-app/assets/)

**Published internal document**
- `prepare-publish.mjs` copies `SEO_GEO_AEO_PLAYBOOK.md` into `dist/`, so the internal marketing playbook is publicly served at `/SEO_GEO_AEO_PLAYBOOK.md`. [web-app/scripts/prepare-publish.mjs:16](web-app/scripts/prepare-publish.mjs)

**llms.txt and llms-full.txt**
- llms.txt (5.9 KB) has a one-line summary, core URLs (hub, 5 tools, hub plus all 16 guides, legal EN/HI pairs, Play Store), key facts and a short FAQ. It is kept in sync by the worker. [web-app/llms.txt](web-app/llms.txt)
- llms-full.txt (7.7 KB) has an architecture explanation ("Render & Print", HarfBuzz), privacy guarantees, a tool table and a FAQ. Its guide table lists only 8 of the 16 articles, and the 8 newest are missing. [web-app/llms-full.txt](web-app/llms-full.txt)
- Both files contain claims that contradict the code (see Section 7): "vector-accurate PDF", "embedded Unicode fonts (Mangal, Noto Sans Devanagari)", and "Acrobat and Canva frequently fail…".
- Google has said it doesn't use llms.txt. The repo's own ultimate playbook rates llms.txt as "contested / largely unproven". [web-app/seo-geo-aeo-ultimate-playbook.md §7.4](web-app/seo-geo-aeo-ultimate-playbook.md)

### Inferences
- The combination "`/` 302 to `/edit/`, canonical `/` on the redirect stub, and sitemap listing `/`" gives Google contradictory homepage signals. Choose one homepage URL: either make `/` the real static landing page, or 301 `/` to `/edit/` and make `/edit/` self-canonical everywhere, including sitemap, breadcrumbs and Organization `url`.
- The missing `404.html` likely turns any mistyped or removed URL (including the `/hi/` root) into a 200 response that meta-refreshes to `/edit/`. That's a soft-404 pattern Search Console flags. Adding `web-app/404.html` fixes it.
- The immutable cache on unhashed `/assets/site.css` and `analytics.js` means returning visitors can see stale CSS/JS for up to a year after a deploy. That's a UX risk and a risk of silent analytics breakage.

### Gaps
- Live headers, the www/http behavior, and whether Cloudflare's dashboard "Always Use HTTPS" or Bulk Redirects are configured couldn't be verified (egress blocked).

---

## 5. Articles: count, topics, length, internal linking, E-E-A-T, dates

### Takeaway
There are 16 guides (8 Hindi, 8 English), all published 2026-08-18 to 2026-08-25. A daily GitHub Action produced them from a fixed template. The queue is now exhausted and nothing has been published since. They are thin (about 290–620 words), formulaic, authored by a generic "Team", mostly unlinked to each other, and several instruct users to alter official government documents. That's a YMYL and spam-policy liability.

### Cited Findings
- `.github/workflows/seo-worker.yml` runs `node web-app/scripts/seo-worker.mjs --publish-next` daily at 04:00 UTC and auto-commits "chore(seo): daily 24h automated seo audit and article publication [skip ci]". [.github/workflows/seo-worker.yml](.github/workflows/seo-worker.yml); `git log` shows 8+ such commits.
- All 16 queue items have `"status": "published"`. The last one was published 2026-08-25, so the worker now logs "No new articles pending publication today." [web-app/scripts/seo-keyword-queue.json](web-app/scripts/seo-keyword-queue.json); [web-app/scripts/seo-worker.mjs:~713](web-app/scripts/seo-worker.mjs)
- Visible word counts (body text, including nav and footer): Hindi 289–623 (the flagship hindi-pdf-kaise-edit-kare has 623), English 313–580. Every generated article follows the same template: direct answer, 1–2 H2 sections, 4 "Step" cards, 1–2 FAQs, CTA. (Script extraction.)
- Dates: `datePublished` equals `dateModified` on every article, and the worker sets `dateModified: today` at generation. There's no "last updated" shown on the page. [web-app/scripts/seo-worker.mjs:~80-83](web-app/scripts/seo-worker.mjs)
- Authorship: the author is always an `Organization` ("Hindi PDF Editor Team"). There is no named person, no `Person` schema, no author bio, no About page, and Organization `sameAs` lists only the Play Store URL. Support links to `github.com/manisense/hindipdfeditor/issues`. [web-app/support/index.html:83-84](web-app/support/index.html); [web-app/editor/index.html:82-84](web-app/editor/index.html)
- Internal linking:
  - 10 of 16 articles contain no in-body links to any other article; they link only to the 5 tool URLs.
  - The 3 original English articles link to each other through a footer "Resources & Guides" block. The 3 original Hindi articles each link to hindi-pdf-kaise-edit-kare.
  - The hub links all 16.
  - The CSR homepage `ArticlesSection` links 6 articles, invisible to non-JS crawlers.
  - No article links to `/hi/` pages or to its hreflang pair.

  Sources: script extraction; [web-app/editor/src/home/ArticlesSection.tsx](web-app/editor/src/home/ArticlesSection.tsx)
- Risky framing on government documents:
  - The UP Police article says "Select the candidate name, roll number, or exam date line to mask and type the corrected text… Export the vector PDF immediately." [web-app/articles/up-police-bharti-admit-card-hindi-pdf-edit/index.html](web-app/articles/up-police-bharti-admit-card-hindi-pdf-edit/index.html)
  - The land-record article says "Mask the outdated plot number, farmer name, or acreage field, and type the updated details… crisp text suitable for printing and submission." [web-app/articles/khasra-khatauni-land-record-hindi-pdf-edit/index.html](web-app/articles/khasra-khatauni-land-record-hindi-pdf-edit/index.html)
  - The hub FAQ says the tool is "designed for official Hindi documents including Sarkari admit cards…, land records (Khasra-Khatauni), legal affidavits, marks sheets". [web-app/editor/src/home/faqData.ts:21-22](web-app/editor/src/home/faqData.ts)
- Google's spam policies define "scaled content abuse" as generating many pages mainly to manipulate rankings rather than help users, regardless of how they were produced. — [Google Search spam policies](https://developers.google.com/search/docs/essentials/spam-policies) (not re-fetched)
- Positive differentiators in the content: Hinglish slugs (`hindi-pdf-kaise-edit-kare`, `pdf-size-kam-kaise-kare-100kb-sarkari-form`), and state-specific long-tail topics (UP e-District, Bihar Parimarjan Plus, e-stamp margins, 100 KB portal limits) that generic PDF tools don't cover.

### Inferences
- The niche topic selection is strong and differentiated. Execution (thin, templated, unattributed, auto-published) is weak for YMYL-adjacent civic and legal topics. The strategy should favor fewer, deeper, human-reviewed guides with real screenshots, named reviewers, and sourced portal rules (e.g., actual upload limits cited from official notices).
- The admit-card and land-record "edit the official document" framing should be rewritten toward "prepare a correction application or affidavit, and get the official correction from the issuing authority". Otherwise the site risks being read as facilitating document forgery (Google quality raters, app-store policy, and legal exposure). This is an inference; no legal review was done.

### Gaps
- Search performance per article (impressions, clicks) and whether any article is indexed are unknown without Search Console.

---

## 6. What the two playbooks recommend vs what is implemented

### Takeaway
`SEO_GEO_AEO_PLAYBOOK.md` (site-specific) is mostly implemented on the surface: robots, llms.txt, JSON-LD, comparison table, direct answers, Hindi articles. Its geo/hreflang and regional-content items are not. `seo-geo-aeo-ultimate-playbook.md` (generic 2026 template) is largely unimplemented where it matters most: indexability, SSR, reciprocal hreflang, named authors, non-scaled content, and FAQ markup only where visible. Its intake section was never filled in.

### Cited Findings
**SEO_GEO_AEO_PLAYBOOK.md** ([web-app/SEO_GEO_AEO_PLAYBOOK.md](web-app/SEO_GEO_AEO_PLAYBOOK.md)):

| Recommendation | Status |
|---|---|
| "Claim-Evidence" structure (Rule 1) | Partial. Technical explanations exist, but competitor claims are unsourced (see Section 7). |
| Multilingual coverage in English, Hinglish and Devanagari (Rule 3) | Partial. English and Devanagari articles exist and some slugs are Hinglish, but there's no Hinglish body copy and no Hindi homepage or tool URLs. |
| Privacy message in every CTA (Rule 4) | Implemented. "Zero server uploads · 100% Client-Side Private" appears in every article CTA. |
| Keep sitemap and llms.txt in sync (Rule 5) | Implemented by the worker for sitemap and llms.txt. llms-full.txt is not updated (8 guides missing). |
| 40–60-word direct answer under **every** H2 (§4) | Partial. One "Direct Answer" block per article, not per H2. |
| "Embed hard statistics", including the example "~70% character detachment rate… 100% fidelity across all 11 vowel signs" (§5.1) | Not implemented. The stat is unsourced and should not be used. |
| Comparison tables (§5.2) | Implemented in `fix-broken-hindi-fonts-in-pdf` and in the CSR `ComparisonSection.tsx`. |
| Entity-graph JSON-LD: SoftwareApplication + FAQPage (§5.3) | Implemented, with duplication and scoping bugs. `priceCurrency` is USD, not the INR the playbook recommends. |
| llms.txt rules (§6) | Implemented. |
| `hreflang="hi"` to `/edit/?lang=hi`, `en-IN`, x-default (§7.1) | Not implemented. `hi` points to `/edit/` (Section 1). |
| Regional content for UP, Bihar, MP, Rajasthan and Delhi (§7.2) | Partial. UP and Bihar are covered; MP/Rajasthan boards and Delhi rent agreements/legal notices are not. Land records mention MP and Rajasthan only in passing. |
| Reddit, Quora and YouTube distribution (§8) | Drafts only, in [web-app/docs/marketing/COMMUNITY_LAUNCH_KIT.md](web-app/docs/marketing/COMMUNITY_LAUNCH_KIT.md) and `QUORA_AND_FORUM_ANSWERS.md`. Whether they were posted is unknown. |
| Monthly audit: GSC, AI-citation checks (§9) | Robots integrity: done. AI-referral analytics: done (`analytics.js`). GSC and citation checks: no evidence in repo. |

**seo-geo-aeo-ultimate-playbook.md** ([web-app/seo-geo-aeo-ultimate-playbook.md](web-app/seo-geo-aeo-ultimate-playbook.md)):

| Recommendation | Status |
|---|---|
| §3 Site Intake variables ({{NICHE}}, {{IS_YMYL}}, competitors, AI crawler stance) | No filled-in intake found in the repo. |
| §4.1 indexability gates (200 status, no redirect chains) | Failing for `/` (302) and likely for unknown URLs (soft-404). |
| §4.3 "If JavaScript-rendered, confirm Google can render" | Not addressed. No SSR or prerender. |
| §4.3 hreflang "self-referencing and reciprocal" | Failing (Section 1). |
| §5.2 E-E-A-T: named authors, Person schema, About page, honest update dates | None implemented. |
| §5.4 "Never mass-publish AI output as-is… scaled content abuse" | Tension with the daily auto-publish worker. |
| §6.1/6.3 "Never mark up content not visible"; "one canonical @id per entity site-wide" | Violated: hub FAQ on tool pages, duplicate graphs. |
| §7.2 cite sources, real statistics, named expert quotes, original data | Not implemented. |
| §7.3 separate training-bot vs search-bot policy | Implicitly "allow all". Works for visibility, but not a documented decision. |
| §7.4 llms.txt "optional, low priority" | Already shipped (fine, low cost). |
| §9.2 AI-visibility KPIs | Partially: GA4 AI-referrer classification in `analytics.js`. |

### Inferences
- The team has invested in the lowest-leverage GEO items (llms.txt, AI-bot allow lists, FAQ schema) while the highest-leverage fundamentals are broken or missing: crawlable homepage/tool HTML, a single homepage URL, working hreflang, real authorship, and deeper content.

### Gaps
- No record of whether the ultimate playbook's intake or measurement loop was ever run outside the repo.

---

## 7. Domain, product claims, differentiators, and claim-accuracy risks

### Takeaway
The domain is `https://hindipdfeditor.com` (apex, HTTPS) on Cloudflare Pages project `hindipdfeditor`, with an Android app `com.hindipdfeditor.app`. The genuine differentiators are strong. Several published claims overstate or contradict the implementation, and AI engines may repeat those claims verbatim.

### Cited Findings
**Domain and hosting**
- `SITE_ORIGIN = 'https://hindipdfeditor.com'` [web-app/editor/src/lib/seo.ts:5](web-app/editor/src/lib/seo.ts). Pages project `hindipdfeditor`, `pages_build_output_dir = "dist"` [web-app/wrangler.toml](web-app/wrangler.toml). Play Store ID `com.hindipdfeditor.app` [web-app/editor/src/home/links.ts](web-app/editor/src/home/links.ts). README calls the web-app "Cloudflare Pages static website for `hindipdfeditor.com`" [README.md](README.md).

**Real, code-backed differentiators**
- Local-first processing: merge, split and compress use pdf-lib and pdfjs in the browser, and OCR uses `tesseract.js` locally. [web-app/editor/src/lib/ocr.ts](web-app/editor/src/lib/ocr.ts); [web-app/editor/package.json](web-app/editor/package.json)
- Devanagari shaping via the browser HTML compositor ("Render & Print"). The architecture rule forbids drawing Devanagari with pdf-lib `drawText`. [web-app/editor/src/lib/exportPdf.ts](web-app/editor/src/lib/exportPdf.ts); [AGENTS.md](AGENTS.md)
- Non-destructive: every export is a new file. [AGENTS.md](AGENTS.md); [web-app/editor/src/lib/exportPdf.ts](web-app/editor/src/lib/exportPdf.ts) docstring
- Legacy-font detection for KrutiDev, Shivaji, Chanakya, DevLys, Walkman-Chanakya, Agra and Amar, including subset-prefixed names. It fails closed, with an explicit raster-only Unicode replacement mode. [web-app/editor/src/lib/legacyFontDetector.ts:4-26](web-app/editor/src/lib/legacyFontDetector.ts); [AGENTS.md](AGENTS.md)
- Hindi to English translation in both directions through a Gemini proxy, only after explicit consent (disclosed). [web-app/editor/src/home/faqData.ts](web-app/editor/src/home/faqData.ts); [web-app/privacy/index.html](web-app/privacy/index.html)
- Free, no account, no watermark. Android app plus web.

**Claims that contradict or overstate the code**

| Published claim | Where | What the code does |
|---|---|---|
| "vector PDF" / "vector-sharp" / "vector-accurate" | llms-full.txt §2; llms.txt; HowTo step 4 in `editor/index.html:160`; article step 4s | Web `exportPdf` rasterizes each page with `html2canvas` and embeds it as a JPEG via `jsPDF.addImage(imgData, 'JPEG', …)` ([web-app/editor/src/lib/exportPdf.ts:67-78](web-app/editor/src/lib/exportPdf.ts)). Web exports are image-only (not vector, not text-searchable). |
| "Convert to Unicode" | Kruti Dev article titles ("…Convert to Unicode Online", "…यूनिकोड में कैसे बदलें") and the llms-full.txt table ("Convert legacy Kruti Dev to Unicode Devanagari") | The product explicitly doesn't decode or convert legacy text. It detects and warns, then allows raster-only replacement of edited spans ([AGENTS.md](AGENTS.md) "Font/encoding inspection fails closed"). The English article's body describes this mode correctly, which contradicts its own title. |
| Embedded "Mangal" fonts | llms-full.txt; several articles | Only Noto Sans/Serif Devanagari variable fonts are bundled ([web-app/editor/public/fonts/](web-app/editor/public/fonts/)). |
| "100%" / "guaranteeing 100% correct ligature shaping" | FAQ, llms files, articles | Absolute claims with no published test evidence. The repo's own testing rules call for fixture-based verification. |
| Acrobat, Canva, Smallpdf and iLovePDF "use naive 1:1 character mapping"; Acrobat "Cloud Sync Required"; iLovePDF "Detached Raw Characters"; "naive PDF.js" | Competitor claims in [web-app/articles/fix-broken-hindi-fonts-in-pdf/index.html](web-app/articles/fix-broken-hindi-fonts-in-pdf/index.html) (comparison table), [web-app/editor/src/home/faqData.ts:14](web-app/editor/src/home/faqData.ts), [web-app/editor/src/home/ComparisonSection.tsx](web-app/editor/src/home/ComparisonSection.tsx), llms files and marketing drafts | No citations or test evidence anywhere. |
| "Operating system … iOS, Windows, macOS, Linux" | SoftwareApplication JSON-LD | Only Android and web are documented in README. |

### Inferences
- The highest-value GEO assets would be claims the product can actually prove: a published, reproducible shaping test (the repo's fixture PDF with conjuncts, matras and reph, rendered through Hindi PDF Editor vs named tools, with screenshots and dates), a clear "what we do and don't do with Kruti Dev" explainer, and an honest privacy architecture page. These are original, citable, non-commodity content, which both playbooks rank as the top lever.
- Correcting the "vector" and "convert to Unicode" claims is urgent. Once answer engines ingest them from llms.txt and the articles, users will arrive expecting searchable vector output or Kruti Dev conversion, and trust and reviews will suffer.

### Gaps
- Whether the Android export (expo-print) yields vector text over a raster background wasn't verified in this audit. The claims might hold on Android but not on web. No Play Store rating or review data was checked.

---

## 8. Consolidated bug and gap list (file:line)

### Takeaway
Ordered by estimated SEO impact.

### Cited Findings
1. The homepage URL conflict: `/` 302s to `/edit/` while declaring itself canonical and appearing in the sitemap. Every internal "Home" link and breadcrumb points at the redirect. — [web-app/_redirects:1](web-app/_redirects); [web-app/index.html:16,47,215](web-app/index.html); [web-app/sitemap.xml](web-app/sitemap.xml) (first `<url>`); [web-app/editor/src/lib/seo.ts:195,258](web-app/editor/src/lib/seo.ts)
2. `/edit/` and all tool pages are client-rendered with an empty body, so homepage copy, H1, comparison and FAQ are invisible to non-JS AI crawlers, and the tool canonical exists only in JS. — [web-app/editor/index.html:20,248-251](web-app/editor/index.html); [web-app/editor/src/lib/seo.ts:28-38,72-92](web-app/editor/src/lib/seo.ts)
3. There's no `404.html`, so the likely Pages SPA fallback turns unknown URLs into soft-404s (200 plus redirect to `/edit/`). — [web-app/scripts/prepare-publish.mjs:9-26](web-app/scripts/prepare-publish.mjs)
4. Hreflang is broken site-wide: self-referencing en and hi on single-language pages, non-reciprocal pairs, and a generator template that perpetuates it. — [web-app/scripts/seo-worker.mjs:143-145](web-app/scripts/seo-worker.mjs); [web-app/articles/*/index.html:13-15](web-app/articles/); [web-app/editor/index.html:21-24](web-app/editor/index.html); English legal pages have no hreflang ([web-app/privacy/index.html](web-app/privacy/index.html) etc.)
5. There's no crawlable Hindi homepage or Hindi tool pages. Hindi UI is available only via localStorage, `navigator.language` or `?lang=hi`. — [web-app/editor/src/lib/i18n.tsx:~310-331](web-app/editor/src/lib/i18n.tsx)
6. The rendered hub has duplicate JSON-LD graphs (static plus injected, same `@id`s, 7 vs 9 FAQs). Tool pages keep the hub FAQPage and HowTo. — [web-app/editor/index.html:69-246](web-app/editor/index.html); [web-app/editor/src/lib/seo.ts:222-229](web-app/editor/src/lib/seo.ts)
7. Inaccurate product claims: "vector PDF", "convert Kruti Dev to Unicode", "Mangal", "100%", and unsourced competitor claims. — [web-app/editor/src/lib/exportPdf.ts:67-78](web-app/editor/src/lib/exportPdf.ts) vs [web-app/llms-full.txt](web-app/llms-full.txt), [web-app/editor/index.html:160](web-app/editor/index.html), articles
8. YMYL and forgery-adjacent instructions (editing roll numbers, exam dates, plot numbers and acreage "for submission"). — [web-app/articles/up-police-bharti-admit-card-hindi-pdf-edit/index.html](web-app/articles/up-police-bharti-admit-card-hindi-pdf-edit/index.html); [web-app/articles/khasra-khatauni-land-record-hindi-pdf-edit/index.html](web-app/articles/khasra-khatauni-land-record-hindi-pdf-edit/index.html)
9. Thin, templated, auto-published articles with no named author, identical published and modified dates, and no Article `image`. — [.github/workflows/seo-worker.yml](.github/workflows/seo-worker.yml); [web-app/scripts/seo-worker.mjs](web-app/scripts/seo-worker.mjs)
10. Weak internal linking: 10 of 16 articles have no links to other articles, and hreflang pairs don't link to each other. — script extraction over `web-app/articles/`
11. `/assets/*` has an immutable one-year cache on unhashed files. — [web-app/_headers](web-app/_headers) (`/assets/*` block)
12. The internal playbook is publicly deployed. — [web-app/scripts/prepare-publish.mjs:16](web-app/scripts/prepare-publish.mjs)
13. llms-full.txt is missing 8 guides. — [web-app/llms-full.txt](web-app/llms-full.txt) §4 table
14. The sitemap includes the redirecting `/`, text files, and query URLs whose raw canonical differs; there's no hreflang in the sitemap. — [web-app/sitemap.xml](web-app/sitemap.xml)
15. Runtime OG image swaps to the square app icon with `summary` card, conflicting with the static 2560×1440 dimension tags. The static OG image is a 997 KB PNG. — [web-app/editor/src/lib/seo.ts:6,86-91](web-app/editor/src/lib/seo.ts); [web-app/assets/play-store/hindi-pdf-editor-tablet.png](web-app/assets/play-store/hindi-pdf-editor-tablet.png)
16. Titles are over 70 characters on about 12 of 16 articles, and brand suffixes are inconsistent. The Terms page description is 34 characters. — script extraction
17. SoftwareApplication has no `aggregateRating` or `review` (not rich-result eligible), uses `priceCurrency` USD, and overclaims OS support. — [web-app/editor/index.html:100-131](web-app/editor/index.html)
18. The "✨" emoji in all article eyebrows violates the design system (not SEO, but a brand-rule breach). — [AGENTS.md](AGENTS.md); `web-app/articles/*/index.html`
19. There's no About page, no Person or author entity, and Organization `sameAs` has only the Play Store (could add the GitHub repo and any social profiles). — [web-app/editor/index.html:74-90](web-app/editor/index.html)
20. No HSTS or CSP headers. — [web-app/_headers](web-app/_headers)

### Inferences
- A strategy report should sequence the fixes as: (1) homepage URL, 404 page and prerender or static HTML for `/` or `/edit/` and the tool pages; (2) real `/hi/` locale URLs with reciprocal hreflang; (3) claim corrections plus reframing of the government-document articles; (4) consolidate the JSON-LD; (5) rebuild the content engine around fewer, deeper, human-reviewed bilingual guides with named authorship and original shaping-test data; (6) cache and header hygiene.

### Gaps
- Live verification (HTTP status codes, rendered DOM, Search Console coverage, CWV field data, backlink profile, AI-citation presence) wasn't possible from this sandbox, and should be done before finalizing priorities.
