---
name: verify
description: Build the hindipdfeditor website exactly as Cloudflare Workers Builds does, serve it with the production Worker and assets, and drive it in Chrome to verify a change.
---

# Verify the website (`web-app/`)

## Build (same command as Workers Builds)
```bash
cd web-app && npm run build   # ends with "prepare-publish: wrote .../dist"
npm run check:publish && npm run test:routing && npm run test:content
```

## Serve with Worker semantics (migration Worker + ASSETS, 404 page)
```bash
cd web-app && npx wrangler dev --port 8817 --ip 127.0.0.1   # run in the background
```
Restart it after rebuilding.

## Drive
- `scripts/browser-smoke.cjs` drives the main flows: responsive home, `/edit/?tool=` redirects, `/tools/edit-hindi-pdf/` export of `mobile-app/fixtures/devanagari-fixture.pdf`, merge, split, compress, translation consent, articles and fonts. It needs Playwright and system Chrome; install Playwright in the scratchpad, not the repo:
  ```bash
  NODE_PATH=<scratchpad>/pw/node_modules SMOKE_BASE_URL=http://127.0.0.1:8817 SMOKE_OUTPUT_DIR=<scratchpad>/smoke node web-app/scripts/browser-smoke.cjs
  ```
  It must end with `BROWSER_ERRORS []`. Point `SMOKE_BASE_URL` at `https://hindipdfeditor.com` to check production after a deploy.
- `scripts/edit-quality-gate.mjs` (`npm run test:edit-quality`, same `NODE_PATH`/`SMOKE_BASE_URL`): replacing lines with their own text must change 0 % of pixels and no text; a one-word edit must keep the line's other words as original text.
- Render exported pages with pdf.js and view them to check shaping (conjuncts, pre-base ि, reph); edited words are PNG images, the rest stays original PDF content.

## Gotchas
- `pkill -f <pattern>` in the same Bash call kills the shell (the pattern matches itself). Stop the server through the task tool, or start a new one on a fresh port.
- pdf.js is imported from its **legacy** build (`pdfjs-dist/legacy/build/…`), which polyfills newer JS APIs such as `Map.prototype.getOrInsertComputed`. Do not switch back to `pdfjs-dist` / `build/`: Edit, Translate, Split and Compress then fail on older browsers with "getOrInsertComputed is not a function".
- The smoke script blocks Google Fonts and analytics requests; ignore those network errors.
