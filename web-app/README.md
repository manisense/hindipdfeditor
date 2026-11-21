# Hindi PDF Editor — website

Public site for `hindipdfeditor.com` plus the browser PDF tools: edit Hindi text, merge, split and compress. The React app lives in `editor/`; static pages, articles and SEO files live at this level.

## Development

**Requirements:** Node 20+.

```bash
cd editor
npm install
npm run dev        # Vite dev server
npm test           # Vitest
npm run lint
npm run build      # typecheck, build, prerender, prepare dist/
```

From `web-app/`:

```bash
npm run check:publish   # verify the publish output
npm run test:routing    # migration Worker redirects
npm run test:content    # articles and content checks
```

## Deployment

The site runs on the `hindipdfeditor` Cloudflare Worker. Deploy with `npm run deploy`, which uses the project-local Wrangler wrapper. See **[DEPLOYMENT.md](DEPLOYMENT.md)** and **[PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)**.

## How editing works

Edits are never written into the original file; export builds a new PDF from it (ADR 0009). Unedited pages are copied unchanged, so their text stays selectable and their links and forms survive. On edited pages, replaced text is deleted from the page content (`contentStreamText.ts`), or cleaned from scans with a line-preserving eraser (`inkEraser.ts`), and new words are shaped by the browser in Noto Sans Devanagari and placed as images. New words are therefore not searchable. Pages that use legacy Hindi fonts are detected and blocked, not converted.

## PDF libraries

| Job                                                | Library           | License    |
| -------------------------------------------------- | ----------------- | ---------- |
| Page → image, embedded text, legacy-font detection | `pdfjs-dist`      | Apache-2.0 |
| Capture composed HTML page                         | `html2canvas`     | MIT        |
| Assemble exported PDF                              | `jspdf`           | MIT        |
| Merge, split, output parse-back                    | `@cantoo/pdf-lib` | MIT        |
| In-browser OCR                                     | `tesseract.js`    | Apache-2.0 |

AI OCR and translation are optional and send page data to the AI service only after the user consents.

## Docs

- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Decisions: [docs/decisions/](docs/decisions/)
- Design system: [design-system.md](design-system.md)
