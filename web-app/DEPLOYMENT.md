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

If the root directory is still `web-app/editor`, keep deploy as
`npx wrangler deploy` — the editor `wrangler.toml` publishes `../dist` as
static assets after `npm run build`.

Do **not** use bare `npx wrangler deploy` against the Pages project without an
`[assets]` directory (that is what caused the missing entry-point error).

## Target account

Deploy this from the Cloudflare account for `localcode.ai@gmail.com`.

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

GA4 is enabled via `web-app/assets/analytics.js` (measurement ID `G-1K5ZEEBHE5`).
Every public HTML page and the editor SPA load that script once, immediately after
`<head>`. Do not paste a second Google tag into those pages.