# Hindi PDF Editor

Monorepo for Hindi PDF Editor.

## Structure

- `mobile-app/` — Expo Android app for editing Hindi PDFs.
- `web-app/` — Cloudflare Pages static website for `hindipdfeditor.com`, including Play Store approval pages.

## Common Commands

```bash
cd mobile-app
npm install
npm run lint
npx tsc --noEmit
npx eas-cli@latest build --profile production --platform android
```

```bash
cd web-app
npx wrangler pages deploy . --project-name hindipdfeditor --branch main
```

Deploy the website only from the Cloudflare account for `localcode.ai@gmail.com`.
