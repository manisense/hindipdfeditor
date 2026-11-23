# 0016 — Reading text drawn as images, and judging KrutiDev conversions by agreement

Date: 23 November 2026

## Problem

Converting a 31-page Word-made KrutiDev PDF (a CISF recruitment notice) to Word showed two accuracy bugs that existed before the speed work (web ADR 0015).

1. **Text drawn as images was lost.** Word stored parts of the text as small images: 14 to 214 per page, about one line tall, at 600 ppi. These include headings with effects, text in shapes, and single words inside sentences. Pages read from their text layer dropped them. Page 1 lost the organisation name, the notice title, the application dates and the pay level, and sentence 1.1 lost "ऑनलाइन".
2. **A correct KrutiDev conversion was thrown away.** The OCR check judged converted text the way it judges a broken Unicode map: complex words against plain words. On a table of small text, OCR misread complex words (60 % agreement) far more than plain ones (100 %), so the right conversion was rejected. Full-page OCR then produced errors such as "मर्ती" for भर्ती and "यूरवॉत्तर" for पूर्वोत्तर.

## Decision

- **Text images (PDF to Word):**
  - **Finding them:** image boxes come from the page's operators (`pdfImageRects.ts`, following save/restore, `cm` and form XObjects). Line-height images (5–40 pt) are joined into rows. A row is dropped when the page's own text runs cover at least half of it: backgrounds, shadows and underlines behind real text.
  - **Reading them:** the page is rendered once at 4 px/pt. Each row is cut from that render and read on its own, spread over the OCR worker pool. Hindi is read first; a row with no Devanagari is read again in English. The English reading is kept only if it has Latin letters and at least the Hindi reading's confidence.
  - **Keeping readings:** a reading is kept when it has letters or digits and a confidence of at least 35 (60 for Latin-only, so signatures and logos do not become stray letters). The full-page noise rules are not used here, because they rejected good readings such as a quoted word at 54.
  - **Placing them:** each reading is added as a text run before lines are built, so a word drawn as an image lands inside its sentence.
  - At most 40 rows per page.
- **KrutiDev check:** converted text is judged by overall agreement. The conversion is rejected only when fewer than 40 % of its words appear in OCR. A wrong conversion, from a font that is not really KrutiDev, matches almost nothing; right ones match 70–100 %. Unicode text keeps the complex/plain test, which matches how broken maps fail. Every converted page is still checked against OCR (web ADR 0010).

## Result

On the 31-page file:

- Page 1 now has its header block, dates, pay level and "ऑनलाइन".
- Page 4's table keeps the exact converted text, and the title and column headings drawn as images are added.
- Page 2's table header now appears.

Conversion takes about 46 s, against 32 s without reading images and 184 s before ADR 0015. The 31-page fixture mix, which has no text images, gives a byte-identical Word file in the same time.

New gate cases:

- `TEXT_IMAGE_OK`: a Hindi heading drawn as an image beside real text. It fails on the previous build.
- `KRUTIDEV_MIXED_OK`: a KrutiDev line converted while the English in its own font is kept.

## Trade-offs

- Text from images is OCR, so it can carry OCR slips (a stray apostrophe, "/-2)" for "/-)"). The rest of the page keeps the PDF's exact text.
- Edit PDF does not read text images yet. Editing such a word needs export support for erasing an image region on a digital page.
- Reading images adds about half again to conversion time on image-heavy Word exports, and nothing on other files.

## Not done

**Unicode mis-mapping repair:** learning which glyphs a broken Unicode map gets wrong, and repairing them as unmapped glyphs are repaired, is still open. It needs a real sample file. Such pages still fall back to OCR.
