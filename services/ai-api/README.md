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

1. Copy `.dev.vars.example` to `.dev.vars` and use staging-only secrets.
2. Apply D1 migrations locally with
   `npx wrangler d1 migrations apply hindipdfeditor-ai --local`.
3. Run `npm test`, `npm run typecheck`, and `npx wrangler deploy --dry-run`.

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

### Put / rotate the Gemini key

```bash
cd services/ai-api
npx wrangler secret put GEMINI_API_KEY
```

Paste the key when prompted (stdin). Then confirm:

```bash
curl -s https://api.hindipdfeditor.com/v1/capabilities
```
