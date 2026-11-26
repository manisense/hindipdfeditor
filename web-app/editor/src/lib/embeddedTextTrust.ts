/**
 * Which fonts' embedded Devanagari can be trusted without OCR, per document.
 *
 * A broken text map belongs to a font (its ToUnicode table), not to a page. Once a font's
 * Devanagari has matched OCR on enough pages, later pages that draw Devanagari only in trusted
 * fonts keep their embedded text without the full-page OCR check. That check takes seconds per
 * page, so this makes long digital Hindi documents read many times faster. Safeguards:
 * - a font is trusted only after its own text, gathered over at least
 *   {@link TRUST_AFTER_PAGES} pages, passes the same complex/plain comparison as a single page;
 * - a font whose text ever fails is never trusted again;
 * - a page that passed the quick band check counts only for the fonts whose words are in the band
 *   (see {@link recordVerifiedBand});
 * - every {@link SPOT_CHECK_EVERY}th page that would be skipped is checked anyway.
 * Pages with unmapped glyphs and KrutiDev conversions are always checked by the caller.
 */

import { canJudgeDevanagari, devanagariWords, embeddedDevanagariVerdict } from './embeddedTextVerification';

/** Pages a font must appear on, with a passing verdict, before it is trusted. */
export const TRUST_AFTER_PAGES = 2;
/** Every this many skippable pages, one is checked against OCR anyway. */
export const SPOT_CHECK_EVERY = 8;
/**
 * Pages after which a font whose Devanagari is still too little to judge (a heading font) no
 * longer makes pages need a check: OCR cannot change its text (an unknown verdict keeps the PDF's
 * text), so checking would only cost time.
 */
export const SPARSE_AFTER_PAGES = 3;

type FontEvidence = { embedded: string; ocr: string; pages: number };

export type FontTrust = {
  evidence: Map<string, FontEvidence>;
  trusted: Set<string>;
  failed: Set<string>;
  /** Pages skipped since the last check. */
  skipped: number;
  /** Each font's whole Devanagari text over the checked pages it appeared on, and their count. */
  seen: Map<string, { text: string; pages: number }>;
};

/** A fresh record for one document. */
export function newFontTrust(): FontTrust {
  return { evidence: new Map(), trusted: new Set(), failed: new Set(), skipped: 0, seen: new Map() };
}

/**
 * Whether a page must be checked against OCR.
 *
 * @param fonts Fonts (pdf.js loaded names) that draw Devanagari on the page.
 * @param spotCheckEvery Every this many skippable pages, one is checked anyway.
 */
export function mustVerifyPage(trust: FontTrust, fonts: Iterable<string>, spotCheckEvery = SPOT_CHECK_EVERY): boolean {
  const list = [...fonts];
  if (list.length === 0) return false;
  const settled = (font: string) => {
    if (trust.failed.has(font)) return false;
    if (trust.trusted.has(font)) return true;
    const seen = trust.seen.get(font);
    return seen !== undefined && seen.pages >= SPARSE_AFTER_PAGES && !canJudgeDevanagari(seen.text);
  };
  if (!list.every(settled)) return true;
  return trust.skipped + 1 >= spotCheckEvery;
}

/** Notes that a page was read without the OCR check. */
export function noteSkippedPage(trust: FontTrust): void {
  trust.skipped += 1;
}

/**
 * Records a page that was checked: each font's Devanagari is judged with the OCR text of every
 * page it appeared on.
 *
 * @param textByFont Embedded Devanagari text on the page, by font.
 * @param ocrText Hindi OCR text of the whole page.
 */
export function recordVerifiedPage(trust: FontTrust, textByFont: ReadonlyMap<string, string>, ocrText: string): void {
  noteSeen(trust, textByFont);
  recordJudged(trust, textByFont, ocrText);
}

/** Judges each font's text gathered so far, with this check's OCR added. */
function recordJudged(trust: FontTrust, textByFont: ReadonlyMap<string, string>, ocrText: string): void {
  trust.skipped = 0;
  for (const [font, text] of textByFont) {
    const before = trust.evidence.get(font) ?? { embedded: '', ocr: '', pages: 0 };
    const evidence = { embedded: `${before.embedded} ${text}`, ocr: `${before.ocr} ${ocrText}`, pages: before.pages + 1 };
    trust.evidence.set(font, evidence);
    const verdict = embeddedDevanagariVerdict(evidence.embedded, evidence.ocr);
    if (verdict === 'corrupted') {
      trust.failed.add(font);
      trust.trusted.delete(font);
    } else if (verdict === 'ok' && evidence.pages >= TRUST_AFTER_PAGES && !trust.failed.has(font)) {
      trust.trusted.add(font);
    }
  }
}

/**
 * Records a page that passed the quick check of one band of its lines: each font is judged with
 * only its own words inside the band, against OCR of the band. Fonts with no words in the band
 * gain no evidence. Without this, a document whose bands always pass never builds trust, and every
 * page of a long document is OCR'd.
 *
 * @param textByFont Embedded Devanagari text on the page, by font.
 * @param bandText Embedded text of the band's lines.
 * @param bandOcrText Hindi OCR text of the band.
 */
export function recordVerifiedBand(
  trust: FontTrust,
  textByFont: ReadonlyMap<string, string>,
  bandText: string,
  bandOcrText: string,
): void {
  noteSeen(trust, textByFont);
  const inBand = new Set(devanagariWords(bandText));
  const bandByFont = new Map<string, string>();
  for (const [font, text] of textByFont) {
    const words = devanagariWords(text).filter((word) => inBand.has(word));
    if (words.length > 0) bandByFont.set(font, words.join(' '));
  }
  recordJudged(trust, bandByFont, bandOcrText);
}

/** Adds a checked page's text to what has been seen of each font. */
function noteSeen(trust: FontTrust, textByFont: ReadonlyMap<string, string>): void {
  for (const [font, text] of textByFont) {
    const before = trust.seen.get(font) ?? { text: '', pages: 0 };
    trust.seen.set(font, { text: `${before.text} ${text}`, pages: before.pages + 1 });
  }
}
