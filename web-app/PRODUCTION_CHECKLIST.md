# Production readiness checklist — hindipdfeditor.com

Target Cloudflare account: `localcode.ai@gmail.com`.
Historical verification below: 2026-07-24. The 1 October 2026 SEO migration is locally verified but not deployed; do not treat historical checked boxes as current production checks.

## Cloudflare account & auth

- [x] Wrangler logged in as `localcode.ai@gmail.com` (not a personal/unrelated account)
- [x] Website Worker/Pages project: `hindipdfeditor`
- [x] AI API Worker: `hindipdfeditor-ai-api`

## Domains

- [x] `hindipdfeditor.com` → `hindipdfeditor` (custom domain enabled)
- [x] `www.hindipdfeditor.com` → `hindipdfeditor` (custom domain enabled)
- [x] `api.hindipdfeditor.com` → `hindipdfeditor-ai-api` (custom domain enabled)
- [x] Public pages respond: `/` (302→`/edit/`), `/edit/`, `/privacy/`, `/support/`

## AI API

- [x] D1 `hindipdfeditor-ai` created; real `database_id` in `services/ai-api/wrangler.jsonc`
- [x] D1 migrations applied remotely
- [x] Secrets set: `GEMINI_API_KEY`, `SESSION_SIGNING_SECRET`, `TURNSTILE_SECRET_KEY`
- [x] Vars: translation + OCR enabled; CORS/Turnstile hostnames for apex + www
- [x] `GET https://api.hindipdfeditor.com/v1/capabilities` returns both directions
- [x] Live smoke: Hindi → English and English → Hindi return `status: "translated"`

## Web editor build

- [x] Turnstile widget for `hindipdfeditor.com` + `www.hindipdfeditor.com`
- [x] `web-app/editor/.env` holds **public** `VITE_TURNSTILE_SITE_KEY` only (gitignored)
- [x] Gemini / Turnstile secrets never committed
- [x] Editor lint + unit tests + `tsc --noEmit` pass
- [x] Production build embeds Turnstile site key; Edit PDF has Translate (hi↔en)

## Security / ops notes

- Rotate `GEMINI_API_KEY` if it was ever pasted into chat or tickets
- Do not commit `web-app/editor/.env` or `services/ai-api/.turnstile-created.json`
- After secret rotation: `cd services/ai-api && npx wrangler secret put GEMINI_API_KEY`
- Redeploy site only after `VITE_TURNSTILE_SITE_KEY` is present for the build

## Ship commands

```bash
# AI API
cd services/ai-api && npx wrangler deploy

# Website (requires editor/.env)
cd web-app
npm run build
npx wrangler pages deploy dist --project-name hindipdfeditor --branch main
```

## Pending production SEO migration checks

- [ ] Root `/` returns 200; bare `/edit/` permanently redirects to root without a loop.
- [ ] Old query tools preserve task, mode and language on their `/tools/` destinations.
- [ ] Root and `/hi/` have matching initial/client canonicals and reciprocal language links.
- [ ] Each tool and hashed asset loads; unknown paths return 404.
- [ ] Updated sitemap accepted and priority URLs inspected in GSC.
- [ ] Consented AI completion tested against production API.
- [ ] Analytics events and existing GA4 enhanced-measurement settings reviewed for privacy.

## 1 October 2026 local release evidence

- [x] 85 editor tests, 7 article/analytics/routing tests, lint and TypeScript/build passed.
- [x] Twenty reviewed guides pass source/output, canonical, language-pair and link checks.
- [x] Actual edit, merge, split and compression exports re-opened; Hindi export and pinned display fonts visually inspected.
- [x] Expanded responsive browser acceptance passes with zero application errors.
- [x] UI font provenance/hash checks and deployment font-URL checks pass.
- [x] Dependency audit reports zero findings.
- [x] Local mobile Lighthouse: performance 89, accessibility 100, SEO 100; LCP 3.3 seconds, TBT 0, CLS 0.
- [ ] Current session authenticated to the owning Cloudflare account: current authenticated account lists no website project.
- [ ] Normalize the live www host (currently a separate 200) in the owning zone.
- [ ] Run current production checks above after release; historical July results do not substitute.
