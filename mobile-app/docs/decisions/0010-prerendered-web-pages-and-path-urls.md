# 10. Prerendered web pages with one URL per tool and language

Date: 2026-09-25

## Status

Accepted and Implemented

## Context

The website's home and tools lived in one client-rendered React page at `/edit/`. `/` redirected there with a 302, tools were `/edit/?tool=merge`, and Hindi was a localStorage switch on the same URL. The HTML crawlers received was an empty `<div id="root">`: most AI crawlers do not run JavaScript, so they saw no headings, copy or links. There was also no URL that could rank for a Hindi query, and hreflang tags pointed every language at the same page.

## Decision

1. **Prerender at build time.** `vite build --ssr src/entry-server.tsx` renders every public route with `react-dom/server`. `web-app/scripts/prepare-publish.mjs` writes each one to `dist/<path>/index.html`, with its own `<title>`, description, canonical URL, reciprocal hreflang and JSON-LD. The client hydrates that HTML.
2. **One path per tool and language.** English pages are `/`, `/edit-hindi-pdf/`, `/translate-hindi-pdf/`, `/merge-pdf/`, `/split-pdf/` and `/compress-pdf/`. Hindi pages are the same paths under `/hi/`. The URL decides the language; the language toggle navigates to the other page and remembers the choice.
3. **Tools stay client-only.** The interactive tools use browser APIs, so each tool page prerenders its shell, H1, intro, steps and FAQ, then mounts the tool after hydration.
4. **Old URLs keep working.** `/edit/` returns a 301 to `/`. `?tool=` and `?lang=` on any page are rewritten client-side to the new path.

## Rejected

- **Keep the SPA and rely on Google's JavaScript rendering.** Google renders JavaScript, but ChatGPT, Perplexity and Claude crawlers generally do not, and rendering delays indexing.
- **Server-render the tools themselves.** pdf.js, canvas and tesseract need a browser; stubbing them for Node would add risk for no crawlable benefit.
- **A framework migration (Next.js, Astro).** It would be a larger change than the need, and would couple the editor to a hosting model.
