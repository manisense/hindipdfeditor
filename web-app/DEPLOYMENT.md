# Cloudflare Pages website deployment

The public site lives in `web-app/` and deploys as a Cloudflare Pages project for
`hindipdfeditor.com`. The browser PDF tools build from `web-app/editor/` into
`web-app/edit/`, then `npm run build` assembles a clean publish folder at
`web-app/dist/`.

## Cloudflare dashboard settings (required)

Use these so Git builds do not fail:

| Setting | Value |
| --- | --- |
| Root directory | `web-app` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler pages deploy dist --project-name hindipdfeditor` |
| Build output directory | `dist` (if the UI asks for one instead of a deploy command) |

If the root directory is `web-app/editor`, build with `npm run build` and deploy with
`npx wrangler pages deploy ../dist --project-name hindipdfeditor`. Both configurations
publish the same Pages artifact. Do not use the former Workers-only `wrangler deploy`
path: it does not run the Pages migration worker.

## Root and tool migration

The build prerenders `/` and `/hi/` from React and generates `/tools/` task entries.
It includes `_worker.js` and `_routes.json` for query-aware permanent redirects from
`/edit/` and root tool-query links. The worker preserves mode/language parameters.
Hashed application assets still live under `/edit/assets/`; do not redirect that prefix.
The homepage has no root-to-editor redirect. Verify using the local Pages preview before
publishing and keep migration redirects for at least a year.

## Target account

Deploy this from the Cloudflare account for `localcode.ai@gmail.com`.

See `PRODUCTION_CHECKLIST.md` for the live production verification checklist.

## AI production prerequisites

Before building the site, create a Cloudflare Turnstile widget for `hindipdfeditor.com` and
`www.hindipdfeditor.com`, then expose its **public site key** to the editor build as
`VITE_TURNSTILE_SITE_KEY` in `web-app/editor/.env` (gitignored). Never place the Turnstile
secret or Gemini key in the web bundle.

Deploy `services/ai-api` first (D1 + secrets + custom domain `api.hindipdfeditor.com`), then
confirm `https://api.hindipdfeditor.com/v1/capabilities` before publishing the updated client.

Put the Gemini key yourself (never commit it):

```bash
cd services/ai-api
npx wrangler secret put GEMINI_API_KEY
```

Then smoke-test Hindi → English and English → Hindi from `/edit/?tool=translate` and the
Edit PDF **Translate** button. Keep Worker translation/OCR flags off until that smoke test is
ready if the site deploy must happen first.

## First / manual deploy

```bash
cd /Users/manish/Downloads/Projects/hindi-pdf-editor/web-app
npm install
npm run build
npx wrangler pages deploy dist --project-name hindipdfeditor --branch main
```

## Domain wiring

In Cloudflare Pages:

1. Open the `hindipdfeditor` Pages project.
2. Add custom domain `hindipdfeditor.com`.
3. Add custom domain `www.hindipdfeditor.com`.
4. Configure `www` to redirect to the apex domain if desired.
5. Enable Cloudflare Email Routing for `support@hindipdfeditor.com`.
6. Add the Google Search Console TXT verification record in Cloudflare DNS after creating the Search
   Console Domain property.

## Play Store URLs

Use these in Play Console:

- Privacy policy: `https://hindipdfeditor.com/privacy/`
- Support URL: `https://hindipdfeditor.com/support/`
- Website: `https://hindipdfeditor.com/`

## Google Analytics

GA4 stream **hindipdfeditor** (`https://hindipdfeditor.com`):

| Field | Value |
| --- | --- |
| Measurement ID | `G-1K5ZEEBHE5` |
| Stream ID | `11532595788` |

Enabled via `web-app/assets/analytics.js`. Every public HTML page and the editor SPA
load that script once, immediately after `<head>`. Do not paste a second Google tag
into those pages.

## Google Search Console (get started)

### 1. Verify ownership (Domain property — recommended)

1. Open [Google Search Console](https://search.google.com/search-console).
2. Add property → **Domain** → `hindipdfeditor.com` (covers `www`, HTTP, and HTTPS).
3. Copy the DNS TXT record Google shows (looks like `google-site-verification=…`).
4. In Cloudflare → DNS → Add record:
   - Type: `TXT`
   - Name: `@` (or `hindipdfeditor.com`)
   - Content: paste Google’s value
   - Proxy: DNS only is fine for TXT
5. Wait a few minutes (sometimes up to 48h), then click **Verify** in Search Console.

Prefer Domain verification over URL-prefix so one property covers the whole site.

### 2. Submit the sitemap

1. In Search Console open the `hindipdfeditor.com` property.
2. Go to **Sitemaps**.
3. Submit: `https://hindipdfeditor.com/sitemap.xml`
4. Confirm it shows **Success** after Google fetches it.

Also publicly available:

- `https://hindipdfeditor.com/robots.txt`
- `https://hindipdfeditor.com/llms.txt` (AI / answer-engine summary)

### 3. What to monitor (beginner → developer)

| Report | Why |
| --- | --- |
| **Performance** | Queries, clicks, impressions, average position |
| **Page indexing** | Crawl/index errors after deploy |
| **URL Inspection** | Test a single URL (e.g. `/edit/?tool=translate`) |
| **Enhancements / rich results** | FAQ / SoftwareApplication structured data (when eligible) |

After each meaningful content deploy, use **URL Inspection → Request indexing** on `/` and key `/tools/` URLs if they are new or heavily changed.

### 4. SEO / AEO / AISEO already in the site

- Titles, descriptions, canonicals, Open Graph, Twitter cards
- JSON-LD: Organization, WebSite, SoftwareApplication, FAQPage
- SPA head updates when switching tools (`SeoHead`)
- `llms.txt` for LLM / answer-engine discoverability
- `robots.txt` allows major search + AI crawlers

You cannot finish Search Console verification from this repo alone — the DNS TXT step must be done in Cloudflare + Search Console UI.

## Merged release compatibility

The shared tool manifest and Pages migration worker own routing. The former root-level tool URLs and `/hi/<tool>/` URLs permanently redirect to `/tools/<tool>/`, retaining mode, tracking and Hindi UI preference. The superseded parallel SSR/Pages Function implementation is removed so there is one canonical owner. Remote mobile changes, PDF.js legacy browser compatibility, bilingual labels/recovery, public About pages, paused content schedule and IndexNow integration are retained.

Use the project-local Wrangler binary with project credentials explicitly supplied; do not rely on a different account's global OAuth configuration. No Cloudflare API token was located in this checkout during the merge; `.wrangler/cache` files hold account metadata only.
