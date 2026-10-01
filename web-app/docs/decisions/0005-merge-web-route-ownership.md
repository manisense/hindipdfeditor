# 0005 — Reconcile concurrent public web implementations

Date: 1 October 2026

## Decision

Retain the locally verified shared route manifest and prerendered homepage/static task-entry build as the single owner. Keep root and Hindi homepages and genuine article equivalents. Redirect the concurrent implementation's root-level and Hindi tool URLs to equivalent `/tools/` entries, preserving mode, tracking and Hindi UI choice. Remove its parallel SSR entry, route parser, metadata checker and Pages Function; advanced-mode Pages migration handles compatibility.

## Reason

Remote main advanced while the reviewed SEO release was implemented. Both architectures supplied root rendering and tool URLs; combining both creates conflicting canonicals, hydration assumptions and deployment behavior. The verified manifest has artifact/routing checks, safe outcome analytics, actual export acceptance and one publication path. Task language toggles retain the document; no unverified translated tool SEO page is advertised.

## Retained work

Remote mobile renderer, rotation, release and CI changes are retained. Preserve PDF.js legacy browser compatibility, bilingual UI/recovery, author About pages, paused automated publication and IndexNow. Articles remain researched/reviewed source content; the renderer only supplies a consistent layout. Author metadata follows the remote Manish profile.

## Rejected

Do not force-push over remote work or run two build/route systems. The older URLs remain redirect aliases instead of becoming 404s. GSC selected canonicals and production redirect verification still follow deployment.
