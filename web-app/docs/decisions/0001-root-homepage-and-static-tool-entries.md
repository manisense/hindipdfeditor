# Root homepage and static tool entry documents

## Decision

Render the React homepage at build time into `/` and `/hi/`, hydrate the same component tree, and generate distinct initial tool documents from a shared route manifest. Keep hashed application assets under `/edit/assets/` for this migration. A small advanced-mode Cloudflare Pages worker maps the retired landing/query URLs to their exact destinations; all other pages remain static assets.

## Reason

The previous root file was a JavaScript redirect stub and the hosting rules also redirected it. Reversing one rule would leave a loop. Shared rendering avoids maintaining divergent HTML and React homepages, while path-specific tool documents prevent the initial canonical from disagreeing with the client. Query-aware handling preserves editing mode and language.

## Rejected

- A blanket `/edit/` redirect would collapse different tool intents.
- Client-only redirects and metadata updates leave incorrect initial crawl signals.
- Moving assets and all tools at once adds unnecessary deployment risk.
- A framework migration adds scope without solving a problem the existing Vite/React stack can handle.

## Delivery constraint

Publish through Cloudflare Pages. The former Workers-static-assets deployment configuration is replaced by Pages output configuration so the migration worker is compiled and executed.
