# Hindi PDF Editor AI API

Shared Cloudflare Worker for Android and web translation plus explicitly consented AI OCR.

## Security model

- The Gemini key exists only as the `GEMINI_API_KEY` Worker secret.
- Gemini Interactions requests are stateless (`store: false`).
- Translation sends recognized line text, not PDF files.
- OCR accepts one page image only when `consent: true`.
- No source text, translated text, PDF, or image is written to logs, D1, or Analytics Engine.
- Turnstile is validated server-side for web sessions.
- Anonymous burst limits use a Worker Rate Limiting binding; daily documents/pages use D1.
- D1 triggers enforce hard daily ceilings under concurrent requests; a daily cron removes quota
  rows older than eight days.

Do not put real secrets in `.dev.vars.example`, Wrangler `vars`, source control, Expo config, or web
environment variables.

## Local setup

1. Copy `.dev.vars.example` to `.dev.vars` and use staging-only secrets. The example also
   overrides production CORS and Turnstile hostnames for `http://localhost:5173`; never add those
   development hosts to the production `wrangler.jsonc` allowlists. Cloudflare's fixed dummy-key
   Siteverify response currently uses `example.com` and omits `action`, so local config explicitly
   allows that test hostname and uses the `none` policy; production remains an exact
   `hindipdfeditor.com`/`ai-session` check. Never use either local override in a deployed
   environment.
2. Apply D1 migrations locally with
   `npx wrangler d1 migrations apply hindipdfeditor-ai --local`.
3. Run the web editor with `VITE_AI_API_BASE_URL` pointing at the local Worker URL when testing the
   end-to-end AI flow.
4. Run `npm test`, `npm run typecheck`, and `npx wrangler deploy --dry-run`.

## Production prerequisites

- D1 database `hindipdfeditor-ai` is provisioned; `wrangler.jsonc` must use its real
  `database_id` (not the zero placeholder).
- Configure a stable Gemini Auth key on an actively billed project.
- Add `GEMINI_API_KEY`, `SESSION_SIGNING_SECRET`, and `TURNSTILE_SECRET_KEY` with
  `wrangler secret put`; never pass their values as command-line arguments.
- Custom domain: `api.hindipdfeditor.com` (Workers custom domain on this Worker).
- Build the web editor with `VITE_TURNSTILE_SITE_KEY` set to the production Turnstile
  site key before deploy. Never place the Turnstile secret or Gemini key in the web
  bundle.
- Configure production Turnstile hostnames (`hindipdfeditor.com`, `www.hindipdfeditor.com`),
  billing alerts, and the emergency feature flags before relying on live traffic.

## Limits

Each device gets 10 AI documents and 50 pages a day (`AI_LIMITS` in `packages/translation-contract`), enforced by D1 triggers. `GET /v1/capabilities` reports the live values.

## Deploy and migrations

Always use the project-token wrapper; the global Wrangler login belongs to another account.

```bash
cd services/ai-api
npm run check
node ../../web-app/scripts/wrangler-project.mjs deploy -c "$PWD/wrangler.jsonc"
```

The project token has no D1 permission. Apply a migration in the dashboard (**D1 → hindipdfeditor-ai → Console**, one statement at a time), or add **Account · D1 · Edit** to the token and run `d1 migrations apply hindipdfeditor-ai --remote -c "$PWD/wrangler.jsonc"` through the wrapper. Migration `0003` was applied through the console on 20 November 2026, so Wrangler's table does not record it; re-applying is safe.

### Put / rotate the Gemini key

```bash
cd services/ai-api
node ../../web-app/scripts/wrangler-project.mjs secret put GEMINI_API_KEY --name hindipdfeditor-ai-api
```

Paste the key when prompted (stdin). Then confirm:

```bash
curl -s https://api.hindipdfeditor.com/v1/capabilities
```
