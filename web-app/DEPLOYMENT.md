# Cloudflare Workers deployment

The production site is the existing `hindipdfeditor` Worker in account `4fa19d6815eb757bda0b564476970849` (localcode.ai@gmail.com). GitHub's Workers Builds check confirms this hosting path. The public React site and PDF tools build into `web-app/dist/`; a small migration Worker delegates static content to the `ASSETS` binding.

## Build and deploy

Cloudflare Workers Builds can use root directory `web-app`, build command `npm run build`, and deploy command `npm run deploy` (or its managed `npx wrangler deploy`). The equivalent `web-app/editor` root uses its own `npm run build` and `npm run deploy`. Both Wrangler configurations target the same Worker and artifact. The project-local wrapper explicitly supplies a token and never falls back to global OAuth.

For local deployment from the repository root:

```bash
npm --prefix web-app/editor run build
node web-app/scripts/wrangler-project.mjs whoami
npm --prefix web-app run deploy
```

Project credentials live only in root `.env.cloudflare`, ignored by Git with owner-only permissions. Copy `.env.cloudflare.example` when setting up another checkout and supply the token privately. CI may explicitly supply `CLOUDFLARE_API_TOKEN`; no secret is embedded in the bundle or tracked files. The wrapper uses `web-app/node_modules/wrangler`, leaving global authentication unchanged.

## Routing and assets

`web-app/scripts/migration-worker.mjs` handles retired `/edit/?tool=` links, root-level/Hindi tool aliases and www-to-apex normalization, preserving task/mode/language/tracking state. Other requests go to `env.ASSETS.fetch`; real missing pages stay 404. Root and Hindi homepages have build-time HTML. Task assets remain `/edit/assets/`.

Workers must invoke the migration script before assets so query redirects and host normalization cannot be bypassed by a matching static file. `dist/.assetsignore` excludes the Pages compatibility `_worker.js` and `_routes.json` from Workers asset upload. Keep migration URLs available for at least one year. The former Pages-only deploy configuration is superseded by the verified live Workers hosting path.

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
npm run deploy
```

## Domain wiring

In the existing Cloudflare Worker custom domains:

1. Open the `hindipdfeditor` Worker.
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
