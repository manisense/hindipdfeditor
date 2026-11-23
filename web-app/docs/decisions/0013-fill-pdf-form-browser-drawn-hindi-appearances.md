# 0013 — Fill PDF form: Hindi answers get browser-drawn field appearances

Date: 23 November 2026 (list boxes and turned widgets added the same day)

## Decision

The Fill PDF form tool (`/tools/fill-pdf-form/`) fills a PDF's own AcroForm fields: text (one line and multi-line), check boxes, radio groups, dropdowns and list boxes (single- and multi-select).

- **Reading:** pdf.js reads the fields, so positions match the rendered page, rotation included. pdf-lib adds what pdf.js leaves out: tooltips on parent fields and radio choice names from `/Opt`.
- **Writing:** pdf-lib writes the values into a copy; the source bytes are never changed. Every value keeps the text the user typed as the field's Unicode value (`/V`).
- **Latin answers** (WinAnsi-encodable) use pdf-lib's own appearance in Helvetica, which stays vector and selectable.
- **Every other answer, Hindi above all,** gets an appearance stream that draws a PNG of the answer:
  - The PNG is rendered by the browser through the same rasteriser as Edit PDF (Plan A), so pdf-lib never shapes Devanagari.
  - It is drawn over the widget's own background and border (`/MK`, `/BS`).
  - Answers shrink to fit their field.
- **Viewer redraws:** `NeedAppearances` is set to false, so viewers keep the drawn appearance instead of regenerating it without Devanagari shaping.
- **XFA:** XFA data is deleted so viewers show the filled AcroForm.
- **Flatten (optional):** pdf-lib draws the appearances into the page and removes the fields.
- **List boxes:** the selected export values go into `/V` and their row numbers into `/I`. All-Latin lists keep pdf-lib's list appearance. Any other list gets a browser-drawn appearance listing the selected choices.
- **Turned widgets (`/MK /R`):** the browser draws the answer in the widget's turned box (width and height swapped for quarter turns), and the appearance stream turns it back, the same transform pdf-lib uses (`rotateInPlace`). The on-page control is turned by page rotation minus field rotation.
- **Unsupported fields:** signature fields point to Sign PDF; push buttons are ignored; anything else is left unchanged and counted.
- **Preview:** the page preview leaves out field appearances (pdf.js `ENABLE_FORMS`), so a saved value doesn't show under its control.
- **PDFs with no fields:** the tool sends the user to Edit PDF's Add text.

## Why

- Government and bank forms are often fillable PDFs, and users want to answer them in Hindi.
- pdf-lib's own appearance generation can only use standard or embedded fonts and does no shaping. Hindi drawn that way would have broken conjuncts and matras, which is the failure AGENTS.md forbids.
- A browser-drawn appearance looks correct in every viewer, and the typed text stays in the field value. Form-processing systems that read field values therefore still get real Unicode.

## Trade-offs

- The Hindi appearance is an image. Its text is not selectable in the page, though the field value holds it.
- If a viewer lets the user edit the field again, the viewer replaces the appearance with its own rendering.
- A non-Latin list box shows only its selected choices, not the whole list with a highlight.

## Rejected

- **Embedding Noto Sans Devanagari and letting viewers regenerate appearances (`NeedAppearances` true):** viewers without Indic shaping for form fields show broken text, and the result differs from viewer to viewer.
- **pdf-lib `drawText` with an embedded Devanagari font:** no shaping, so it is forbidden by AGENTS.md.
- **Flattening always:** users often need to submit a form that can still be edited.
