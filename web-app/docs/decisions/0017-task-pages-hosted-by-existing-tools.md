# 0017 — Task pages hosted by existing tools

Date: 23 November 2026

## Decision

A task that an existing tool already performs gets its own route in `tool-routes.json` and is rendered by that tool with its own heading, copy and guide, instead of a new tool:

- `organize` (`/tools/organize-pdf/`) renders `EditPdfTool` with `toolId="organize"`, which opens the Pages panel after the file loads.
- `krutidev` (`/tools/krutidev-to-unicode/`) renders `PdfToWordTool` with `toolId="krutidev"`.

Each route has an entry in `TOOL_GUIDES` (`editor/src/lib/toolGuides.ts`); the `Record<ToolId, …>` type makes a route without a guide fail the type check. The English guide is prerendered into the static page and feeds the FAQPage JSON-LD (`toolGraphJsonLd`).

## Reason

Both tasks are common searches with no landing page, and the code already did the work. The KrutiDev page uses PDF to Word, not Edit: Edit keeps the original KrutiDev text layer on lines the user does not change (ADR 0010), so its download is not a Unicode PDF. PDF to Word writes the converted Unicode text into the .docx.

## Rejected

- A KrutiDev page on the Edit tool: the page would promise Unicode output the export does not give.
- A plain-text KrutiDev converter box: new code, and the PDF route covers the PDF case users arrive with.
- Separate Hindi URLs for these pages: web ADR 0005 keeps tool language a UI toggle.
