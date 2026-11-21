/**
 * Checks a PDF's embedded Devanagari text against OCR of the same page.
 *
 * Some PDFs (typically Word exports) carry a broken ToUnicode map: the page shows कर्मचारी but
 * the text layer says कममचारी, because the pre-base ि and the reph glyphs map to the wrong code
 * points. The words such a map corrupts are the ones with ि, a halant, a nasal sign or a doubled
 * letter. On a correct page OCR reads those "complex" words about as reliably as plain words; on
 * a corrupted page the embedded complex words rarely match OCR at all. Comparing the two rates
 * cancels out how good OCR happens to be on that page.
 */

import type { OcrLine } from "../state/editStore";

const DEVANAGARI = /[\u0900-\u097F]/u;
const WORD_SEPARATORS = /[\s,.;:!?।॥|()[\]{}"'“”‘’/\\-]+/u;
const COMPLEX_WORD = /[\u093F\u094D\u0901\u0902]|(.)\1/u;
/** Below this complex/plain agreement ratio the embedded text is treated as corrupted. */
const MIN_COMPLEX_TO_PLAIN_RATIO = 0.7;
/** Fewer words than this in either group is too little evidence to judge. */
const MIN_WORDS_PER_GROUP = 15;

/** True when `text` contains any Devanagari code point. */
export function hasDevanagari(text: string): boolean {
  return DEVANAGARI.test(text);
}

function devanagariWords(text: string): string[] {
  return text
    .normalize("NFC")
    .split(WORD_SEPARATORS)
    .filter((word) => word.length >= 2 && DEVANAGARI.test(word));
}

/**
 * Whether embedded Devanagari text looks corrupted compared with OCR of the same page.
 * Returns false when there is too little Devanagari to judge, so plain pages keep their text.
 */
export function isEmbeddedDevanagariCorrupted(
  embeddedText: string,
  ocrText: string,
): boolean {
  const ocrWords = new Set(devanagariWords(ocrText));
  const words = devanagariWords(embeddedText);
  const complex = words.filter((word) => COMPLEX_WORD.test(word));
  const plain = words.filter((word) => !COMPLEX_WORD.test(word));
  if (complex.length < MIN_WORDS_PER_GROUP || plain.length < MIN_WORDS_PER_GROUP) {
    return false;
  }
  const rate = (group: string[]) =>
    group.filter((word) => ocrWords.has(word)).length / group.length;
  const plainRate = rate(plain);
  if (plainRate === 0) return true;
  return rate(complex) / plainRate < MIN_COMPLEX_TO_PLAIN_RATIO;
}

/**
 * Builds the lines for a page whose embedded Devanagari is unreliable. Embedded lines with Latin
 * letters or digits and no Devanagari are kept (that text uses other fonts and its map is intact,
 * while Hindi OCR misreads it); OCR supplies the Devanagari lines that do not overlap them.
 * Embedded Devanagari lines are dropped because their text is known to be wrong, and stray
 * punctuation runs are dropped so they cannot hide the Hindi line around them. Every line is
 * marked `embedded-degraded` so consented translation still prefers cloud OCR.
 *
 * @param embedded Lines from the PDF text layer, boxes in pt (top-left origin).
 * @param ocr Lines from Hindi OCR of the page image, boxes in pt (top-left origin).
 */
export function combineEmbeddedLatinWithOcr(
  embedded: readonly OcrLine[],
  ocr: readonly OcrLine[],
): OcrLine[] {
  const latin = embedded.filter(
    (line) => !hasDevanagari(line.text) && /[A-Za-z0-9]/u.test(line.text),
  );
  const hindi = ocr.filter(
    (line) =>
      hasDevanagari(line.text) && !latin.some((kept) => boxesOverlap(kept, line)),
  );
  return [...latin, ...hindi]
    .map((line) => ({ ...line, source: "embedded-degraded" as const }))
    .sort((a, b) => a.yPt - b.yPt || a.xPt - b.xPt);
}

/**
 * Whether an OCR line is probably noise from a logo, seal or table border rather than text: very
 * low confidence, or low confidence with fewer than three real Hindi words. Real headings in bold
 * table cells can score around 40, so confidence alone is not enough.
 *
 * @param confidence Engine confidence, 0–100; unknown counts as confident.
 */
export function isLikelyOcrNoise(text: string, confidence = 100): boolean {
  if (confidence < 30) return true;
  const words = devanagariWords(text).filter((word) => word.length >= 3);
  return confidence < 60 && words.length < 3;
}

/**
 * Strips table-border and quote marks OCR reads at the ends of a line (`* | पत्र/ …`, `'ध्यान`).
 * Digits, brackets and full stops are kept because they are often real.
 */
export function trimOcrBorderNoise(text: string): string {
  return text.replace(/^[\s|*'"`~_•·]+|[\s|*'"`~_•·]+$/gu, "");
}

/** A rectangle in PDF points, top-left origin. */
export type PtBox = { xPt: number; yPt: number; wPt: number; hPt: number };

/**
 * Rows of embedded Devanagari text that page OCR found nothing for (Tesseract often skips bold or
 * italic rows inside table cells). Fragments on one visual row are joined, because a corrupted
 * text layer also splits runs and under-reports their widths; each box is padded by a fraction of
 * its height so the crop covers the glyphs. The caller OCRs each box on its own.
 *
 * @param embedded Lines from the PDF text layer, boxes in pt (top-left origin).
 * @param ocr Lines from Hindi OCR of the page image, boxes in pt (top-left origin).
 */
export function missedDevanagariRows(
  embedded: readonly OcrLine[],
  ocr: readonly OcrLine[],
): PtBox[] {
  const missed = embedded
    .filter(
      (line) =>
        hasDevanagari(line.text) && !ocr.some((found) => boxesOverlap(found, line)),
    )
    .sort((a, b) => a.yPt - b.yPt || a.xPt - b.xPt);
  const rows: PtBox[] = [];
  for (const line of missed) {
    const row = rows.find(
      (box) =>
        Math.abs(box.yPt + box.hPt / 2 - (line.yPt + line.hPt / 2)) <= line.hPt / 2 &&
        line.xPt - (box.xPt + box.wPt) <= line.hPt * 3,
    );
    if (!row) {
      rows.push({ xPt: line.xPt, yPt: line.yPt, wPt: line.wPt, hPt: line.hPt });
      continue;
    }
    const right = Math.max(row.xPt + row.wPt, line.xPt + line.wPt);
    const bottom = Math.max(row.yPt + row.hPt, line.yPt + line.hPt);
    row.xPt = Math.min(row.xPt, line.xPt);
    row.yPt = Math.min(row.yPt, line.yPt);
    row.wPt = right - row.xPt;
    row.hPt = bottom - row.yPt;
  }
  return rows.map((box) => {
    const padX = box.hPt * 0.6;
    const padY = box.hPt * 0.3;
    const xPt = Math.max(0, box.xPt - padX);
    const yPt = Math.max(0, box.yPt - padY);
    return {
      xPt,
      yPt,
      wPt: box.xPt + box.wPt + padX - xPt,
      hPt: box.yPt + box.hPt + padY - yPt,
    };
  });
}

/** True when the centre of either box lies inside the other. */
function boxesOverlap(a: PtBox, b: PtBox): boolean {
  const contains = (outer: PtBox, inner: PtBox) => {
    const cx = inner.xPt + inner.wPt / 2;
    const cy = inner.yPt + inner.hPt / 2;
    return (
      cx >= outer.xPt &&
      cx <= outer.xPt + outer.wPt &&
      cy >= outer.yPt &&
      cy <= outer.yPt + outer.hPt
    );
  };
  return contains(a, b) || contains(b, a);
}
