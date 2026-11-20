# Hindi PDF Editor

Monorepo for Hindi PDF Editor.

## Structure

- `mobile-app/` — Expo Android app for editing Hindi PDFs.
- `web-app/` — website for `hindipdfeditor.com` on a Cloudflare Worker, including Play Store approval pages and browser PDF tools under `/tools/` (edit Hindi text, merge, split, compress).
- `services/ai-api/` — Cloudflare Worker behind `api.hindipdfeditor.com` for consent-gated AI OCR and translation.
- `packages/translation-contract/` — types shared by the apps and the AI API.

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
npm run build
npm run deploy          # project-local Wrangler wrapper; see web-app/DEPLOYMENT.md
```

```bash
cd services/ai-api
npm run check           # tests, typecheck, dry-run deploy
```

Local editor development:

```bash
cd web-app/editor
npm install
npm run dev
```

Deploy the website only from the Cloudflare account for `localcode.ai@gmail.com`.
