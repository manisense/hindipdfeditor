---
name: verify
description: Build the hindipdfeditor website exactly as Cloudflare does, serve it with Pages semantics, and drive it in Chromium to verify a change.
---

# Verify the website (`web-app/`)

## Build (same command as Cloudflare Pages)
```bash
cd web-app && rm -rf edit dist editor/dist-ssr && npm run build   # ends with "check-seo: N pages ... consistent"
```

## Serve with Pages semantics (_headers, _redirects, functions/)
```bash
cd web-app && (setsid npx wrangler pages dev dist --port 8811 > /tmp/wr.log 2>&1 &)
```
`python3 -m http.server` works for static pages, but it ignores redirects, headers, the `/edit/` Function and 404 handling.
Wrangler reads `_redirects` only at startup, so restart it (or use a new port) after rebuilding.

## Drive
- Playwright is global: `require($(npm root -g)/playwright)`; Chromium is at /opt/pw-browsers (141).
- Fixtures: `mobile-app/fixtures/devanagari-fixture.pdf`, `multipage-fixture.pdf`.
- Flows worth driving:
  - `/` and `/hi/`: H1 and the language toggle.
  - `/merge-pdf/`: upload 2 fixtures, then "Merge & download".
  - `/hi/edit-hindi-pdf/`: open the fixture, "टेक्स्ट जोड़ें", click the page, type Hindi, download.
  - Old URLs: `/edit/?tool=translate` should 301 to `/translate-hindi-pdf/`.
- The exported web PDF is one JPEG per page. Extract the `/DCTDecode` stream and view it to check shaping; no pdftoppm or PIL is installed.

## Gotchas
- `pkill -f <pattern>` in the same Bash call kills the shell (the pattern matches itself). Start servers on a fresh port instead.
- **pdf.js 5.7 needs `Map.prototype.getOrInsertComputed`.** Chromium 141 lacks it, so Edit and Translate fail with "getOrInsertComputed is not a function". To exercise those tools, inject a polyfill with `context.addInitScript`. Treat this as a real production risk too (see the verify report).
- The sandbox blocks Google Fonts and analytics; ignore those console errors.
