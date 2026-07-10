# Cloudflare Pages website deployment

The public Play Store support site lives in `web-app/` and is designed to deploy as a static
Cloudflare Pages project for `hindipdfeditor.com`.

The browser PDF tools (edit / merge / split / compress) live under `web-app/editor/` and build
into `web-app/edit/`.

## Target account

Deploy this from the Cloudflare account for `localcode.ai@gmail.com`.

Current check on 7 July 2026 showed local Wrangler is logged in as `medikleapp@gmail.com`, so do not
deploy until Wrangler is authenticated to the target account or a target-account API token is set.

## First deploy

```bash
cd /Users/manish/Downloads/Projects/hindi-pdf-editor/web-app
npm run build:editor
npx wrangler logout
npx wrangler login
npx wrangler whoami
npx wrangler pages project create hindipdfeditor --production-branch main
npx wrangler pages deploy . --project-name hindipdfeditor --branch main
```

Confirm `wrangler whoami` shows `localcode.ai@gmail.com` before running the deploy command.

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

The website includes an inactive GA4 loader at `web-app/assets/analytics.js`. Add the real
measurement ID from Google Analytics before deploy:

```js
const GOOGLE_ANALYTICS_ID = "G-XXXXXXXXXX";
```
