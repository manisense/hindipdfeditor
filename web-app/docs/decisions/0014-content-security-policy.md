# 0014 — Content-Security-Policy for the website

Date: 23 November 2026

## Decision

Every response carries an enforced `Content-Security-Policy` (set in `_headers`):

- `default-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests`.
- **Scripts:** `'self'`, Google Tag Manager (GA4, loaded by `/assets/analytics.js` on the live hostname only) and Cloudflare Turnstile. `'wasm-unsafe-eval'` lets the self-hosted Tesseract OCR compile its WebAssembly. There is no `'unsafe-inline'` and no `'unsafe-eval'`; the built HTML has no inline scripts or inline event handlers (JSON-LD blocks are data, not script).
- **Workers:** `'self'` and `blob:` (pdf.js and the OCR worker).
- **Styles:** `'self'`, `'unsafe-inline'` (React style props, docx-preview's generated styles, the print frame) and Google Fonts CSS. **Fonts:** `'self'`, `data:`, Google Fonts files.
- **Images:** `'self'`, `data:`, `blob:` and the analytics pixels.
- **Connections:** `'self'`, `data:`, `blob:`, `api.hindipdfeditor.com` (consented AI), GA4, Google Fonts (html-to-image inlines font files) and Turnstile.
- **Frames:** `'self'`, `blob:` and Turnstile.

## Why

The editor opens untrusted PDFs and Word files and renders user text as HTML. A policy that only allows our own scripts limits what an injection could do. Every PDF tool also runs on the user's device, so this policy also stops a script from sending document data to another origin.

## Verified

- With the policy served by the local Workers preview: edit-quality gate 16/16 and browser smoke `BROWSER_ERRORS []`.
- A sweep recorded `securitypolicyviolation` events on the home pages, articles, every tool, an OCR run on a scanned PDF, PDF to Word and Fill form. It found zero violations.
- After deploy, the same sweep runs on hindipdfeditor.com, where analytics loads.

## Rejected

- **Report-only first:** there is no report endpoint, so it would only log in the browser. The sweep covers the same ground before release.
- **Nonces or hashes for styles:** React and docx-preview set inline styles at run time. A style injection cannot run script.

## Changing it

A new third-party origin (a CDN, an API, an embed) must be added here and in `_headers`. Run the sweep before release.
