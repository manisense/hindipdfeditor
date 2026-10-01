# 0007 — Preserve the existing homepage during SEO work

Date: 1 October 2026

## Decision

Restore the original homepage UI from remote main `a4d15967`, before the concurrent SEO merge. Preserve its component hierarchy, section order, floating navigation, card layout, typography and interactions. Keep the verified prerendering, canonical metadata, route compatibility and PDF reliability fixes. Translation-label and link adapters let the existing components use the current routing/context without redesign.

## Reason

The user explicitly rejected the replacement homepage and clarified that UI/UX must not change during SEO work. The earlier redesign exceeded that scope. Future SEO work must preserve the existing interface unless a design change is explicitly requested.

## Rejected

Do not roll back the whole repository or discard remote mobile/SEO/reliability fixes to restore a homepage. Do not introduce another design while restoring the original.
