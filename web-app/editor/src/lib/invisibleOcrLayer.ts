/**
 * Detects scanned pages that carry an invisible (`3 Tr`) English-only OCR text layer over a Hindi
 * page image. Office MFPs and mobile scanners (OmniPage, Canon, HP Smart Document Scan, Adobe Scan)
 * often run English OCR by default on Hindi scans, embedding invisible gibberish like `6Rqlull` or
 * `tluNeII;T`. Without this check, the editor and PDF to Word trust that text layer and never run
 * Hindi OCR. Real English invisible OCR layers (scanned English documents) are kept.
 */

import { hasDevanagari } from './embeddedTextVerification';
import { imageRectsFromOperators, type ImageOps } from './pdfImageRects';

/** pdf.js operator codes read by this module (`pdfjs.OPS`). */
export type InvisibleTextOps = ImageOps & {
  setTextRenderingMode: number;
  showText: number;
  showSpacedText: number;
  nextLineShowText: number;
  nextLineSetSpacingShowText: number;
};

/** Minimal viewport interface needed to map PDF user-space image rects to page pt. */
export type PageViewportLike = {
  width: number;
  height: number;
  convertToViewportRectangle: (rect: [number, number, number, number]) => number[];
};

/** Breakdown of word plausibility for an invisible Latin-script text layer. */
export type EnglishOcrScore = {
  /** Non-numeric multi-character tokens evaluated. */
  scored: number;
  /** Tokens matching plausible English word structure. */
  plausible: number;
  /** Tokens with OCR-junk patterns (mixed digits/letters, internal symbols, broken case, un-English clusters). */
  junk: number;
  /** Pure numbers, dates, times, currency figures and ordinals (ignored in plausibility share). */
  numeric: number;
  /** Share of scored word tokens that look like plausible English (`1` when `scored === 0`). */
  plausibleShare: number;
};

/** Text render mode 3: neither fill nor stroke (invisible OCR layer). */
const INVISIBLE_RENDER_MODE = 3;
/** Minimum share of the page area covered by painted image(s) for a page to count as a scan. */
const MIN_SCAN_IMAGE_COVERAGE = 0.6;
/** Minimum scored word tokens needed to judge an invisible layer; fewer keeps today's behaviour. */
const MIN_SCORED_WORDS = 12;
/** Below this plausible-English share (strictly fewer than half), the invisible layer is junk. */
const MAX_JUNK_PLAUSIBLE_SHARE = 0.5;
/** Ignore tiny image masks smaller than this share of the page when computing scan coverage. */
const MIN_IMAGE_RECT_SHARE = 0.005;

/** Common English / Indian official abbreviations without vowels. */
const VOWELLESS_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'st', 'sr', 'jr', 'ltd', 'pvt', 'rs', 'cr', 'km', 'cm', 'mm', 'kg',
  'ml', 'mg', 'hr', 'wk', 'yr', 'sl', 'sq', 'dt', 'sh', 'smt', 'ch', 'pdf', 'jpg', 'png', 'txt',
  'xml', 'csv', 'html', 'http', 'https', 'www', 'llp', 'llb', 'bsc', 'msc', 'phd', 'pwd', 'qty',
  'qtr', 'sc', 'bc', 'mp', 'up', 'hp', 'cg', 'rj', 'uk', 'br', 'jh', 'dl', 'tn', 'kl', 'mh', 'gj',
  'wb', 'ap', 'ts', 'pb', 'jk', 'pm', 'am', 'vs', 'cf', 'pp', 'pg', 'no', 'nos', 'inc', 'corp',
]);

/** Legitimate English words / abbreviations where `q` is not followed by `u`. */
const Q_WITHOUT_U_EXCEPTIONS = new Set(['faq', 'faqs', 'iraq', 'iraqi', 'qatar', 'qatari', 'sq', 'qty', 'qtr']);

const OUTER_PUNCT_START = /^["'“”‘’([{<]+/;
const OUTER_PUNCT_END = /[.,;:!?)\]}>"'“”‘’]+$/;
const CLEAN_JOINED_WORDS = /^[A-Za-z]{2,}(?:[/,][A-Za-z]{2,})+$/;
const PURE_NUMBER_OR_DATE = /^[₹$€£+]?\d+(?:[.,:/\-–—]\d+)*(?:\/-|%)?$/;
const ORDINAL = /^\d+(?:st|nd|rd|th)$/i;
const PUNCT_ONLY = /^[^A-Za-z0-9\u00C0-\u024F]+$/;
const EMAIL = /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/;
const URL_TOKEN = /^(?:https?:\/\/|www\.)\S+$/i;
const ENGLISH_WORD_SHAPE = /^[A-Za-z]+(?:['’][A-Za-z]+)?(?:-[A-Za-z]+(?:['’][A-Za-z]+)?)*$/;
const ENGLISH_PART_SHAPE = /^[A-Za-z]+(?:['’][A-Za-z]+)?$/;

function isPlausibleEnglishPart(part: string): boolean {
  if (!ENGLISH_PART_SHAPE.test(part)) return false;
  const letters = part.replace(/['’]/g, '');
  if (letters.length === 0) return false;
  const normalCase = /^[a-z]+$/.test(letters) || /^[A-Z][a-z]+$/.test(letters) || /^[A-Z]+$/.test(letters);
  if (!normalCase) return false;
  const lower = letters.toLowerCase();
  if (VOWELLESS_ABBREVIATIONS.has(lower)) return true;
  if (!/[aeiouy]/.test(lower)) return false;
  if (/(.)\1\1/.test(lower)) return false;
  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(lower)) return false;
  if (/q(?!u)/.test(lower) && !Q_WITHOUT_U_EXCEPTIONS.has(lower)) return false;
  return true;
}

function isPlausibleEnglishWord(token: string): boolean {
  if (token.length < 2 || !ENGLISH_WORD_SHAPE.test(token)) return false;
  const parts = token.split('-');
  if (parts.length > 1) {
    // Reject trailing single-character fragments ("gfu-s", "rial-t", "d-o") and multi-fragment junk.
    if (parts[parts.length - 1].length < 2) return false;
    const shortParts = parts.filter((part) => part.length < 2).length;
    if (shortParts > 1 || (shortParts === 1 && parts[0].length >= 2)) return false;
  }
  return parts.every((part, idx) =>
    idx === 0 && parts.length > 1 && part.length === 1 ? /^[A-Za-z]$/.test(part) : isPlausibleEnglishPart(part),
  );
}

/**
 * Scores a page's Latin-script text for English-OCR plausibility. Pure numbers, dates, and
 * single-character tokens are excluded from the denominator so numeric calendars and tables do not
 * mask junk words.
 */
export function scoreEnglishOcrText(text: string): EnglishOcrScore {
  let plausible = 0;
  let junk = 0;
  let numeric = 0;

  for (const raw of text.split(/\s+/)) {
    if (!raw) continue;
    const cleaned = raw.replace(OUTER_PUNCT_START, '').replace(OUTER_PUNCT_END, '');
    if (!cleaned) continue;
    // Expand clean slash/comma pairs ("Secretary/Principal", "Department,Uttarakhand") while keeping
    // garbled fragments ("q-,TArT", "l/?7o564/") intact as junk.
    const tokens = CLEAN_JOINED_WORDS.test(cleaned) ? cleaned.split(/[/,]/) : [cleaned];
    for (const token of tokens) {
      if (token.length <= 1) continue;
      if (PURE_NUMBER_OR_DATE.test(token) || ORDINAL.test(token)) {
        numeric += 1;
        continue;
      }
      if (PUNCT_ONLY.test(token)) continue;
      if (EMAIL.test(token) || URL_TOKEN.test(token)) {
        plausible += 1;
        continue;
      }
      if (isPlausibleEnglishWord(token)) plausible += 1;
      else junk += 1;
    }
  }

  const scored = plausible + junk;
  return {
    scored,
    plausible,
    junk,
    numeric,
    plausibleShare: scored > 0 ? plausible / scored : 1,
  };
}

/**
 * Whether `text` looks like English-only OCR junk of a non-English (Hindi) scan rather than real
 * English text. Conservative: any Devanagari text or too few word tokens returns `false`.
 */
export function isEnglishOcrJunk(text: string): boolean {
  if (hasDevanagari(text)) return false;
  const { scored, plausibleShare } = scoreEnglishOcrText(text);
  return scored >= MIN_SCORED_WORDS && plausibleShare < MAX_JUNK_PLAUSIBLE_SHARE;
}

/**
 * True when the page draws at least one non-whitespace glyph and every drawn non-whitespace glyph
 * uses PDF text rendering mode 3 (invisible). Tracks `save`/`restore` and Form XObject state.
 */
export function hasOnlyInvisibleText(
  fnArray: readonly number[],
  argsArray: readonly unknown[],
  ops: Pick<
    InvisibleTextOps,
    | 'save'
    | 'restore'
    | 'paintFormXObjectBegin'
    | 'paintFormXObjectEnd'
    | 'setTextRenderingMode'
    | 'showText'
    | 'showSpacedText'
    | 'nextLineShowText'
    | 'nextLineSetSpacingShowText'
  >,
): boolean {
  const stack: number[] = [];
  let mode = 0;
  let invisibleChars = 0;
  let visibleChars = 0;

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const args = argsArray[i] as unknown[] | null | undefined;
    if (fn === ops.save || fn === ops.paintFormXObjectBegin) {
      stack.push(mode);
    } else if (fn === ops.restore || fn === ops.paintFormXObjectEnd) {
      mode = stack.pop() ?? mode;
    } else if (fn === ops.setTextRenderingMode) {
      mode = Number(args?.[0]);
    } else if (
      fn === ops.showText ||
      fn === ops.showSpacedText ||
      fn === ops.nextLineShowText ||
      fn === ops.nextLineSetSpacingShowText
    ) {
      const glyphs = (args?.[0] as ({ unicode?: string } | number | null)[] | undefined) ?? [];
      let chars = 0;
      for (const glyph of glyphs) {
        if (glyph && typeof glyph === 'object' && glyph.unicode) {
          const trimmed = glyph.unicode.trim();
          if (trimmed.length > 0) chars += trimmed.length;
        }
      }
      if (chars === 0) continue;
      if (mode === INVISIBLE_RENDER_MODE) invisibleChars += chars;
      else visibleChars += chars;
    }
  }

  return invisibleChars > 0 && visibleChars === 0;
}

type ClippedBox = [number, number, number, number];

/** Exact union area of axis-aligned rectangles, so stripped and overlapping MRC scans score cleanly. */
function unionArea(boxes: readonly ClippedBox[]): number {
  if (boxes.length === 0) return 0;
  if (boxes.length === 1) return (boxes[0][2] - boxes[0][0]) * (boxes[0][3] - boxes[0][1]);
  const xs = [...new Set(boxes.flatMap((box) => [box[0], box[2]]))].sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i + 1 < xs.length; i += 1) {
    const x1 = xs[i];
    const x2 = xs[i + 1];
    if (x2 <= x1) continue;
    const intervals = boxes
      .filter((box) => box[0] <= x1 && box[2] >= x2)
      .map((box): [number, number] => [box[1], box[3]])
      .sort((a, b) => a[0] - b[0]);
    let curStart = -Infinity;
    let curEnd = -Infinity;
    for (const [y1, y2] of intervals) {
      if (y1 > curEnd) {
        if (curEnd > curStart) total += (x2 - x1) * (curEnd - curStart);
        curStart = y1;
        curEnd = y2;
      } else if (y2 > curEnd) {
        curEnd = y2;
      }
    }
    if (curEnd > curStart) total += (x2 - x1) * (curEnd - curStart);
  }
  return total;
}

/**
 * Fraction of the page area (`0..1`) covered by painted images (exact union, clipped to the page).
 * Handles single full-page scans, multi-strip scans, and overlapping MRC foreground/background layers.
 */
export function scanImageCoverage(
  fnArray: readonly number[],
  argsArray: readonly unknown[],
  viewport: PageViewportLike,
  ops: ImageOps,
): number {
  const pageArea = viewport.width * viewport.height;
  if (!(pageArea > 0)) return 0;
  const rects = imageRectsFromOperators(fnArray, argsArray, ops);
  if (rects.length === 0) return 0;
  const clipped: ClippedBox[] = [];
  for (const rect of rects) {
    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);
    const bx1 = Math.max(0, Math.min(x1, x2));
    const by1 = Math.max(0, Math.min(y1, y2));
    const bx2 = Math.min(viewport.width, Math.max(x1, x2));
    const by2 = Math.min(viewport.height, Math.max(y1, y2));
    if (bx2 <= bx1 || by2 <= by1) continue;
    const area = (bx2 - bx1) * (by2 - by1);
    if (area / pageArea < MIN_IMAGE_RECT_SHARE) continue;
    // Fast path: a single full-page image already covers the whole page.
    if (area / pageArea >= 0.999) return 1;
    clipped.push([bx1, by1, bx2, by2]);
  }
  return Math.min(1, unionArea(clipped) / pageArea);
}

/**
 * True when the page's text is drawn only in invisible mode (`3 Tr`) over a scan image covering
 * most of the page.
 */
export function isInvisibleTextOverScanImage(
  fnArray: readonly number[],
  argsArray: readonly unknown[],
  viewport: PageViewportLike,
  ops: InvisibleTextOps,
): boolean {
  return (
    hasOnlyInvisibleText(fnArray, argsArray, ops) &&
    scanImageCoverage(fnArray, argsArray, viewport, ops) >= MIN_SCAN_IMAGE_COVERAGE
  );
}

/**
 * True when a page carries an invisible (`3 Tr`) OCR text layer over a full-page scan image whose
 * text scores as English-OCR junk rather than real English (or Devanagari).
 */
export function isJunkInvisibleOcrPage(
  fnArray: readonly number[],
  argsArray: readonly unknown[],
  text: string,
  viewport: PageViewportLike,
  ops: InvisibleTextOps,
): boolean {
  return isEnglishOcrJunk(text) && isInvisibleTextOverScanImage(fnArray, argsArray, viewport, ops);
}
