# Cloudflare Pages website deployment

The public site lives in `web-app/` and deploys as a Cloudflare Pages project for
`hindipdfeditor.com`. The browser PDF tools build from `web-app/editor/` into
`web-app/edit/`, then `npm run build` assembles a clean publish folder at
`web-app/dist/`. That step also prerenders the home page and every tool page, in
English and under `/hi/`, from the editor's SSR bundle (`editor/dist-ssr/`), so
each URL is served as complete HTML (see ADR 0010).

## Cloudflare dashboard settings (required)

Use these so Git builds do not fail:

| Setting | Value |
| --- | --- |
| Root directory | `web-app` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler pages deploy dist --project-name hindipdfeditor` |
| Build output directory | `dist` (if the UI asks for one instead of a deploy command) |

If the root directory is still `web-app/editor`, keep deploy as
`npx wrangler deploy` — the editor `wrangler.toml` publishes `../dist` as
static assets after `npm run build`.

`web-app/functions/` holds a Pages Function that 301-redirects the old `/edit/?tool=…` URLs; it is deployed automatically when the root directory is `web-app`.

Do **not** use bare `npx wrangler deploy` against the Pages project without an
`[assets]` directory (that is what caused the missing entry-point error).

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

Then smoke-test Hindi → English and English → Hindi from `/translate-hindi-pdf/` and the
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
| **URL Inspection** | Test a single URL (e.g. `/translate-hindi-pdf/`) |
| **Enhancements / rich results** | FAQ / SoftwareApplication structured data (when eligible) |

After each meaningful content deploy, use **URL Inspection → Request indexing** on `/`, `/hi/` and key tool URLs if they are new or heavily changed.

### 4. SEO / AEO / AISEO already in the site

- Every home and tool page is prerendered in English and Hindi (`/hi/`), with its own title, description, canonical and reciprocal hreflang. The build fails if these drift (`scripts/check-seo.mjs`).
- JSON-LD: Organization, WebSite, WebApplication, BreadcrumbList, FAQPage
- `llms.txt` for LLM / answer-engine discoverability (no measured effect; keep it accurate, don't invest more)
- `robots.txt` allows major search + AI crawlers, but Cloudflare can block them before robots.txt is read — see below

You cannot finish Search Console verification from this repo alone — the DNS TXT step must be done in Cloudflare + Search Console UI.

## AI crawler access (check in Cloudflare)

`robots.txt` allows AI search crawlers, but Cloudflare's bot settings apply first. Secondary reports say Cloudflare changed free-plan defaults on 15 September 2026 to block AI training crawlers and some user-triggered fetchers such as ChatGPT-User. This was not confirmed against Cloudflare's own docs, and it is unclear whether it applies to Pages sites. Check the dashboard rather than assuming. Menu names change, so search the dashboard for "AI" if these moved.

1. **Security → Bots** (or **AI Crawl Control**) for the `hindipdfeditor.com` zone:
   - Is "Block AI bots" / "Block AI scrapers and crawlers" on?
   - Which categories are blocked?
2. Allow at least the **AI search** crawlers and the **user-triggered fetchers**:
   - AI search: OAI-SearchBot, Claude-SearchBot, PerplexityBot.
   - User-triggered: ChatGPT-User, Claude-User, Perplexity-User.
   These are what get the site cited in ChatGPT, Claude and Perplexity answers. Blocking training-only crawlers (GPTBot, ClaudeBot, Google-Extended) is a separate choice. It does not remove the site from Google AI Overviews, which use Googlebot.
3. If **Managed robots.txt** is on, compare `https://hindipdfeditor.com/robots.txt` with `web-app/robots.txt`. Cloudflare can prepend its own rules.
4. In the AI crawler analytics view, check for requests from the bots above that are marked blocked or challenged.
5. Add the site to **Bing Webmaster Tools** (import from Search Console). ChatGPT search and Copilot rely on Bing's index. Its AI Performance report shows which pages Copilot cites.

Recheck after any Cloudflare plan or security-setting change.

## IndexNow (Bing and others)

The IndexNow key file `web-app/2cb0e0db8ff34e8eb3666ac4ec72525a.txt` is published at the site root. The key is public by design. The `Notify search engines (IndexNow)` GitHub Actions workflow does this automatically about 4 minutes after every push to `main` that touches `web-app/`, and can be run by hand from the Actions tab. To run it locally instead:

```
node web-app/scripts/indexnow.mjs
```

Needs Node 18 or newer. HTTP 200 or 202 means the URLs were accepted.

## Content-Security-Policy: deliberately not set (yet)

The site has no CSP header, on purpose. A policy that doesn't break the tools would need:
- `'unsafe-inline'` for styles, because every article and the prerendered pages use inline styles.
- A hash for the articles hub's inline script.
- `'wasm-unsafe-eval'`, plus `cdn.jsdelivr.net` in both `script-src` and `connect-src`, because Tesseract OCR fetches its worker, core and Hindi language data from there at run time.
- `challenges.cloudflare.com` for Turnstile, `api.hindipdfeditor.com` for AI features, and the Google Analytics and Fonts hosts.

The site serves no user-generated content, so such a policy would add little protection. A wrong one would silently break OCR or translation in production, and those can't be exercised offline. If a CSP is added later, ship it as `Content-Security-Policy-Report-Only` first and test OCR, translation and Turnstile on the live site before enforcing it.

