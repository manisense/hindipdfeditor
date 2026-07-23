# 0008 — Server-side Gemini proxy for shared AI features

**Status:** Accepted for Phase 4.8; production secrets and live deployment remain release gates.

## Context

Android and web previously asked users to paste a Gemini key, and the browser translator supported
only Hindi → English through a large local model. Shipping the product owner's key in either client
would expose it immediately, prevent enforceable cost limits, and make revocation difficult.

## Decision

Use one Cloudflare Worker at `api.hindipdfeditor.com` for Android and web AI OCR and translation:

1. Store the Gemini key only as a Worker secret; clients receive anonymous signed sessions only.
2. Support Hindi → English and English → Hindi with one versioned, dependency-free shared contract.
3. Send stable line IDs and only source lines for translation; send page images only after explicit
   AI OCR consent. Keep the original PDF local and immutable.
4. Set Gemini interaction storage to false, protect identifiers/dates/amounts/URLs before prompting,
   validate target script and IDs after response, and fail closed on malformed output.
5. Apply Turnstile to web session creation, per-minute Worker rate limiting, D1 daily document/page
   quotas, feature kill switches, strict production CORS, and content-free operational metrics.
6. Continue to apply results as masks plus Unicode overlays through ADR 0001's Render & Print path.

## Rejected alternatives

- **Embed the production Gemini key in Android or web:** client secrets are extractable and cannot be
  protected by minification, obfuscation, or environment variables compiled into a bundle.
- **Keep bring-your-own-key UI:** creates user friction, credential-handling risk, and inconsistent
  Android/web behavior.
- **Call Gemini directly from clients with short-lived keys:** still weakens centralized quotas,
  output validation, observability, and immediate kill-switch control.
- **Replace Render & Print with direct PDF text drawing:** violates ADR 0001 and the Devanagari
  shaping invariant.

## Consequences

- AI features need network access and can be unavailable when the Worker, Turnstile, or Gemini is
  unavailable; offline editing and on-device OCR remain usable.
- The release now requires Cloudflare D1/Turnstile/DNS setup, three Worker secrets, a paid Gemini
  project with appropriate data terms, monitoring, and a tested rollback/kill-switch procedure.
- Unit tests and local bundle/migration checks do not replace a live smoke test or the separately
  deferred Android hardware pass.

**Date:** 2026-07-23.
