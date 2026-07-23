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

Do not put real secrets in `.dev.vars.example`, Wrangler `vars`, source control, Expo config, or web
environment variables.

## Local setup

1. Copy `.dev.vars.example` to `.dev.vars` and use staging-only secrets.
2. Apply D1 migrations locally with
   `npx wrangler d1 migrations apply hindipdfeditor-ai --local`.
3. Run `npm test`, `npm run typecheck`, and `npx wrangler deploy --dry-run`.

## Production prerequisites

- Replace the zero D1 ID in `wrangler.jsonc` with the production database ID.
- Configure a stable Gemini Auth key on an actively billed project.
- Add `GEMINI_API_KEY`, `SESSION_SIGNING_SECRET`, and `TURNSTILE_SECRET_KEY` with
  `wrangler secret put`; never pass their values as command-line arguments.
- Configure `api.hindipdfeditor.com`, production Turnstile hostnames, billing alerts, and the
  emergency feature flags before deployment.
