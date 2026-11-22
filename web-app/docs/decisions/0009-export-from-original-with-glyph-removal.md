# 0009 — Export from the original file, removing replaced glyphs

Date: 21 November 2026

## Decision

The web export no longer rasterises pages. `exportPdf.ts` loads the original bytes into a new `pdf-lib` document (the source file is never modified) and changes only pages with edits:

- **Replacement masks** (`MaskEdit.kind === "replace"`): the original glyphs inside the box are deleted from the page content stream by our own remover (`contentStreamText.ts`, `pdfTextRemoval.ts`). It tracks the graphics and text state, walks glyphs with the font's `/Widths` or `/W`, and turns each removed glyph into a `TJ` spacing number, so glyphs outside the box keep their exact positions. Paths (table borders, underlines) and images are untouched.
- **Verification and fallback:** after removal the page is re-read with pdf.js. A box where nothing was removed (scans), a run the remover could not resolve (Type3, non-Identity CMaps, fonts without widths), or text still found inside the box (form XObjects) gets a raster patch: the page is rendered at 3 px/pt and `inkEraser.ts` removes text ink while keeping ruled lines (Devanagari headlines are recognised as text).
- **Whiteouts** (Whiteout tool) delete the text under them, like replacements, and are then filled vector rectangles in the surrounding paper colour; images and drawings under them are covered, not removed. **Highlights** are multiply-blended rectangles drawn after everything else, so the text they mark stays dark and selectable.
- **Inserted images and signatures** are embedded as they are (JPEG stays JPEG; PNG keeps transparency) and drawn with new text in the order they were added, below highlights.
- **New text** is rendered by the browser (HarfBuzz shaping; Plan A) at 4 px/pt into a transparent PNG and placed in editor space through the inverse pdf.js viewport transform, so rotated and offset pages map correctly.
- If `pdf-lib` cannot open the file even with an empty password, the export falls back to a new document built from the page backgrounds with the same overlays.

The editor previews replacement masks with the same eraser, so the screen matches the export.

## Reason

The old export captured every page with html2canvas and saved it as JPEG on top of a JPEG background: the no-op edit test on the Bank of Baroda notice produced erased table borders, blurred text, lost links/forms/selectable text on every page, and a 922 KB → 6.4 MB file. With this design the same test keeps every border, leaves pages 2–16 with identical text, keeps untouched lines on page 1 selectable, and produces 985 KB.

## Rejected

- MuPDF.js redaction: AGPL or commercial licence; our remover covers the needed operators.
- AI inpainting (LaMa/MI-GAN, 37–80 MB) as the default scan cleaner: not trained on documents; the rule-based eraser was proven on the scanned copy.
- Server-side Chromium `page.pdf()`: would send document content to a server and change the privacy claim.
- Writing Devanagari with pdf-lib `drawText()`: forbidden (no shaping). Searchable vector new text needs Plan B (Phase 5), which remains deferred.

## Consequences

New words are images and not searchable. Any edit invalidates a digital signature. Public copy, `llms*.txt`, articles and AGENTS.md were updated to say so.
