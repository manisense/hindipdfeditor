# Hindi PDF Editor

Monorepo for Hindi PDF Editor.

## Structure

- `mobile-app/` — Expo Android app for editing Hindi PDFs.
- `web-app/` — website for `hindipdfeditor.com` on a Cloudflare Worker, including Play Store approval pages and browser PDF tools under `/tools/` (edit Hindi text, merge, split, compress).
- `services/ai-api/` — Cloudflare Worker behind `api.hindipdfeditor.com` for consent-gated AI OCR and translation.
- `packages/translation-contract/` — types shared by the apps and the AI API.

Each app has its own README: [mobile-app](mobile-app/README.md), [web-app](web-app/README.md), [services/ai-api](services/ai-api/README.md).

## Common Commands

Node 22 (the version CI uses). Every command runs from its own folder.

```bash
cd mobile-app
npm install
npm run check           # lint, typecheck, tests, Prettier
npx eas-cli@latest build --profile production --platform android
```

```bash
cd web-app/editor
npm install
npm run lint && npm test
cd ..
npm run build           # editor build, prerender, dist/ checks
npm run deploy          # project-local Wrangler wrapper; see web-app/DEPLOYMENT.md
```

```bash
cd services/ai-api
npm run check           # tests, typecheck, dry-run deploy
```

Local editor development: `cd web-app/editor && npm run dev`.

Deploy the website and AI API only from the Cloudflare account for `localcode.ai@gmail.com`, through `web-app/scripts/wrangler-project.mjs`; the global Wrangler login belongs to another account. Merging to `main` deploys the website through Cloudflare Workers Builds.
