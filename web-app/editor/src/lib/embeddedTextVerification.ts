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

/** The Devanagari words of `text` (NFC, two letters or more), as compared with OCR. */
export function devanagariWords(text: string): string[] {
  return text
    .normalize("NFC")
    .split(WORD_SEPARATORS)
    .filter((word) => word.length >= 2 && DEVANAGARI.test(word));
}

/**
 * Whether `text` has enough Devanagari words of each kind (complex: with ि or a halant; plain:
 * without) for a comparison with OCR to give a verdict. Below that, the text is kept as it is
 * whatever OCR reads.
 */
export function canJudgeDevanagari(text: string): boolean {
  const words = devanagariWords(text);
  const complex = words.filter((word) => COMPLEX_WORD.test(word)).length;
  return complex >= MIN_WORDS_PER_GROUP && words.length - complex >= MIN_WORDS_PER_GROUP;
}

/** What a comparison with OCR says about embedded Devanagari text. */
export type DevanagariVerdict = "ok" | "corrupted" | "unknown";

/**
 * Below this share of words found in OCR, text converted from a legacy font (KrutiDev) is
 * treated as wrong. A wrong conversion (a font that is not really KrutiDev) matches almost no
 * words; a right one matches 70–100 % even where OCR struggles with small table text.
 */
const MIN_CONVERTED_AGREEMENT = 0.4;

/**
 * Judges embedded Devanagari text against OCR of the same page(s): "unknown" when there is too
 * little Devanagari to judge.
 *
 * Text from the PDF's own Unicode map is judged by how complex words agree compared with plain
 * ones, which is how a broken map shows (see the top of this file). Text converted from KrutiDev
 * with the pinned map (`converted`) is judged by overall agreement instead: a conversion is wrong
 * everywhere or nowhere. On such pages OCR misreads complex words in small text far more than
 * plain ones, which made right conversions look broken.
 */
export function embeddedDevanagariVerdict(
  embeddedText: string,
  ocrText: string,
  options: { converted?: boolean } = {},
): DevanagariVerdict {
  const ocrWords = new Set(devanagariWords(ocrText));
  if (!canJudgeDevanagari(embeddedText)) return "unknown";
  const words = devanagariWords(embeddedText);
  const complex = words.filter((word) => COMPLEX_WORD.test(word));
  const plain = words.filter((word) => !COMPLEX_WORD.test(word));
  const rate = (group: string[]) => group.filter((word) => ocrWords.has(word)).length / group.length;
  if (options.converted) return rate(words) < MIN_CONVERTED_AGREEMENT ? "corrupted" : "ok";
  const plainRate = rate(plain);
  if (plainRate === 0) return "corrupted";
  return rate(complex) / plainRate < MIN_COMPLEX_TO_PLAIN_RATIO ? "corrupted" : "ok";
}

/** Words a dictionary check needs before it may judge a page. */
const MIN_DICTIONARY_WORDS = 20;
/**
 * Share of dictionary words that text repaired from its own font must reach to be kept when OCR
 * disagrees. Measured on 27 Nov 2026: correct Hindi 85–87 % (sample notice, RRB contents page),
 * mis-mapped text layers 53–65 %.
 */
const MIN_REPAIRED_DICTIONARY_SHARE = 0.75;

/**
 * Whether text read through a ToUnicode map rebuilt from the embedded font (see
 * pdfToUnicodeRepair.ts) reads as real Hindi: enough of its words are dictionary words. Used only
 * for such text, when OCR of the page is too weak to confirm it (Tesseract misreads tables), and
 * false when there are too few words to judge.
 *
 * @param isKnown Dictionary lookup (with inflections), e.g. `HindiSpeller.isKnown`.
 */
export function readsAsHindi(text: string, isKnown: (word: string) => boolean): boolean {
  const words = devanagariWords(text);
  if (words.length < MIN_DICTIONARY_WORDS) return false;
  return words.filter((word) => isKnown(word)).length / words.length >= MIN_REPAIRED_DICTIONARY_SHARE;
}

/**
 * Whether embedded Devanagari text looks corrupted compared with OCR of the same page.
 * Returns false when there is too little Devanagari to judge, so plain pages keep their text.
 */
export function isEmbeddedDevanagariCorrupted(
  embeddedText: string,
  ocrText: string,
  options: { converted?: boolean } = {},
): boolean {
  return embeddedDevanagariVerdict(embeddedText, ocrText, options) === "corrupted";
}

/**
 * Builds the lines for a page whose embedded Devanagari is unreliable. Embedded lines with Latin
 * letters or digits and no Devanagari are kept (that text uses other fonts and its map is intact,
 * while Hindi OCR misreads it); OCR supplies the Devanagari lines that do not overlap them.
 * Embedded Devanagari lines are dropped because their text is known to be wrong, and stray
 * punctuation runs are dropped so they cannot hide the Hindi line around them. Each OCR line takes
 * its top and height from the embedded Devanagari run it covers best: OCR boxes are about 1.25×
 * the font size and grow further when a row number or border joins them, while the PDF run height
 * is the real font size. Every line is marked `embedded-degraded` so consented translation still
 * prefers cloud OCR.
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
  const embeddedHindi = embedded.filter((line) => hasDevanagari(line.text));
  const hindi = ocr
    .filter(
      (line) =>
        hasDevanagari(line.text) && !latin.some((kept) => boxesOverlap(kept, line)),
    )
    .map((line) => alignToEmbeddedRun(line, embeddedHindi));
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
 * text layer also splits runs and under-reports their widths. `crop` is padded by a fraction of the
 * row height so OCR sees whole glyphs; `line` keeps the row's real top and height (the PDF's font
 * size is right even when its text map is not) and the padded width. The caller OCRs each crop.
 *
 * @param embedded Lines from the PDF text layer, boxes in pt (top-left origin).
 * @param ocr Lines from Hindi OCR of the page image, boxes in pt (top-left origin).
 */
export function missedDevanagariRows(
  embedded: readonly OcrLine[],
  ocr: readonly OcrLine[],
): { crop: PtBox; line: PtBox & Pick<OcrLine, 'baselineYPt' | 'font'> }[] {
  const missed = embedded
    .filter(
      (line) =>
        hasDevanagari(line.text) && !ocr.some((found) => boxesOverlap(found, line)),
    )
    .sort((a, b) => a.yPt - b.yPt || a.xPt - b.xPt);
  const rows: (PtBox & { widest: OcrLine })[] = [];
  for (const line of missed) {
    const row = rows.find(
      (box) =>
        Math.abs(box.yPt + box.hPt / 2 - (line.yPt + line.hPt / 2)) <= line.hPt / 2 &&
        line.xPt - (box.xPt + box.wPt) <= line.hPt * 3,
    );
    if (!row) {
      rows.push({ xPt: line.xPt, yPt: line.yPt, wPt: line.wPt, hPt: line.hPt, widest: line });
      continue;
    }
    if (line.wPt > row.widest.wPt) row.widest = line;
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
    const wPt = box.xPt + box.wPt + padX - xPt;
    const { baselineYPt, font } = box.widest;
    return {
      crop: { xPt, yPt, wPt, hPt: box.yPt + box.hPt + padY - yPt },
      line: {
        xPt,
        yPt: box.yPt,
        wPt,
        hPt: box.hPt,
        ...(baselineYPt !== undefined ? { baselineYPt } : {}),
        ...(font ? { font } : {}),
      },
    };
  });
}

/**
 * Returns `line` with the top and height of the embedded run whose vertical centre lies inside it
 * and that overlaps it most horizontally; unchanged when no run qualifies.
 */
function alignToEmbeddedRun(line: OcrLine, runs: readonly OcrLine[]): OcrLine {
  let best: OcrLine | undefined;
  let bestOverlap = 0;
  for (const run of runs) {
    const cy = run.yPt + run.hPt / 2;
    if (cy < line.yPt || cy > line.yPt + line.hPt) continue;
    const overlap =
      Math.min(line.xPt + line.wPt, run.xPt + run.wPt) - Math.max(line.xPt, run.xPt);
    if (overlap > bestOverlap) {
      best = run;
      bestOverlap = overlap;
    }
  }
  if (!best) return line;
  return {
    ...line,
    yPt: best.yPt,
    hPt: best.hPt,
    ...(best.baselineYPt !== undefined ? { baselineYPt: best.baselineYPt } : {}),
    ...(best.font ? { font: best.font } : {}),
  };
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

/** Words of each kind (complex, plain) a verification sample aims for: twice the minimum. */
const SAMPLE_WORDS_PER_GROUP = 2 * MIN_WORDS_PER_GROUP;

/**
 * A band of consecutive Devanagari lines with enough words to judge the page, so OCR can read
 * that band instead of the whole page. Lines are taken in reading order from the top.
 *
 * @param lines The page's embedded lines, boxes in pt (top-left origin).
 * @returns The band's text and its box in pt, or null when the whole page is needed (too little
 *   text, or the band would cover most of the page anyway).
 */
export function verificationSample(
  lines: readonly OcrLine[],
): { text: string; xPt: number; yPt: number; wPt: number; hPt: number } | null {
  const hindi = lines.filter((line) => DEVANAGARI.test(line.text)).sort((a, b) => a.yPt - b.yPt || a.xPt - b.xPt);
  if (hindi.length === 0) return null;
  let complex = 0;
  let plain = 0;
  let end = 0;
  while (end < hindi.length && (complex < SAMPLE_WORDS_PER_GROUP || plain < SAMPLE_WORDS_PER_GROUP)) {
    for (const word of devanagariWords(hindi[end].text)) {
      if (COMPLEX_WORD.test(word)) complex += 1;
      else plain += 1;
    }
    end += 1;
  }
  if (complex < SAMPLE_WORDS_PER_GROUP || plain < SAMPLE_WORDS_PER_GROUP) return null;
  const band = hindi.slice(0, end);
  // Lines at the band's height in other columns are read too, so OCR sees whole rows.
  const top = Math.min(...band.map((line) => line.yPt));
  const bottom = Math.max(...band.map((line) => line.yPt + line.hPt));
  const inBand = hindi.filter((line) => line.yPt < bottom && line.yPt + line.hPt > top);
  const left = Math.min(...inBand.map((line) => line.xPt));
  const right = Math.max(...inBand.map((line) => line.xPt + line.wPt));
  const lastBottom = Math.max(...hindi.map((line) => line.yPt + line.hPt));
  const firstTop = hindi[0].yPt;
  if (bottom - top > 0.6 * (lastBottom - firstTop)) return null;
  return { text: inBand.map((line) => line.text).join(" "), xPt: left, yPt: top, wPt: right - left, hPt: bottom - top };
}
