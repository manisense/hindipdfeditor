import type { RecognizedLine } from './recognizedLine';

/**
 * Pure merge logic for the two on-device OCR passes (`text-recognition` module) that run over
 * the same page image - ML Kit needs one pass per script model, and this app's documents mix
 * Hindi and English on the same page (often the same line, e.g. a form's "विभाग/ Department"
 * label), so both passes run and their outputs overlap.
 *
 * Merge rules, in order:
 * 1. Every Devanagari-pass line that actually contains Devanagari characters is kept - that
 *    model is the only one that can read Hindi, and it also reads embedded Latin well enough
 *    for a mixed line to stay one coherent unit (matching the line-granularity editing model).
 *    Exception: when both engines report confidence and an overlapping Latin-pass line is more
 *    confident, the Latin line wins. Tesseract's Hindi model invents Devanagari when it reads an
 *    English line, with low confidence, while the English model reads it with high confidence.
 * 2. A Devanagari-pass line with NO Devanagari characters is a pure-Latin region the weaker
 *    model happened to read; it's kept only if the Latin pass found nothing overlapping it,
 *    otherwise the dedicated Latin model's version wins.
 * 3. A Latin-pass line is added only if it doesn't significantly overlap a line already kept -
 *    it's either a Latin-only region the Devanagari pass missed entirely (kept), or a partial
 *    re-read of a mixed line already covered by rule 1 (dropped).
 *
 * "Significantly overlap" = intersection area > `OVERLAP_RATIO` of the smaller box's area -
 * ratio-of-smaller so a short Latin fragment inside a long mixed line still counts as covered.
 *
 * All boxes are in the input image's own pixel space throughout (the same space the native
 * module reports in); output order is top-to-bottom, then left-to-right, so downstream hit
 * testing and any future list UI see reading order.
 */

const OVERLAP_RATIO = 0.5;

/** Matches any codepoint in the Unicode Devanagari block (U+0900-U+097F). */
const DEVANAGARI_RE = /[\u0900-\u097f]/;

export function containsDevanagari(text: string): boolean {
  return DEVANAGARI_RE.test(text);
}

/** Intersection area of two boxes as a fraction of the smaller box's area (0 when disjoint). */
function overlapOfSmaller(a: RecognizedLine, b: RecognizedLine): number {
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = ix * iy;
  if (intersection === 0) return 0;
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller === 0 ? 0 : intersection / smaller;
}

function overlapsAny(line: RecognizedLine, kept: RecognizedLine[]): boolean {
  return kept.some((k) => overlapOfSmaller(line, k) > OVERLAP_RATIO);
}

/**
 * Merges the Devanagari-pass and Latin-pass line lists for one page image into a single,
 * de-duplicated list - see the module docstring for the exact rules.
 *
 * @param devanagariLines Lines from the Devanagari-model pass, boxes in input-image px.
 * @param latinLines Lines from the Latin-model pass, boxes in input-image px.
 */
export function mergeOcrLines(
  devanagariLines: RecognizedLine[],
  latinLines: RecognizedLine[],
): RecognizedLine[] {
  const kept: RecognizedLine[] = [];

  // Rule 1: Hindi-bearing lines from the Devanagari pass win their region, unless a more
  // confident Latin reading of the same region exists.
  const hindiLines = devanagariLines.filter(
    (l) =>
      containsDevanagari(l.text) &&
      !latinLines.some(
        (latin) =>
          l.confidence !== undefined &&
          latin.confidence !== undefined &&
          latin.confidence > l.confidence &&
          overlapOfSmaller(l, latin) > OVERLAP_RATIO,
      ),
  );
  kept.push(...hindiLines);

  // Rule 3 first for pure-Latin regions: dedicated Latin model beats the Devanagari model's
  // incidental Latin reading, so Latin-pass lines claim their (non-Hindi) regions next.
  for (const line of latinLines) {
    if (!overlapsAny(line, kept)) kept.push(line);
  }

  // Rule 2: whatever pure-Latin text the Devanagari pass found that neither the Hindi lines
  // nor the Latin pass covered (rare, but costs nothing to keep).
  for (const line of devanagariLines) {
    if (containsDevanagari(line.text)) continue;
    if (!overlapsAny(line, kept)) kept.push(line);
  }

  return kept.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** One OCR word, boxes in background-image px. */
export type RecognizedWord = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

/**
 * Text of one Hindi-model line with its English words read by the English model. The Hindi model
 * mangles English names, IDs and dates inside a Hindi line; where a confident English-model word
 * (letters or digits, no Devanagari) covers a Hindi-model word that is less confident, the English
 * reading replaces it. Devanagari words keep the Hindi reading.
 *
 * @param hindiWords Words of the line from the Hindi model, boxes in px.
 * @param latinWords Words of the page from the English model, boxes in px.
 */
export function mergeWordReadings(
  hindiWords: readonly RecognizedWord[],
  latinWords: readonly RecognizedWord[],
): string {
  return hindiWords
    .map((word) => {
      const latin = latinWords
        .filter(
          (candidate) =>
            /[A-Za-z0-9]/.test(candidate.text) &&
            !containsDevanagari(candidate.text) &&
            candidate.confidence > word.confidence &&
            overlapOfSmaller(word, candidate) > OVERLAP_RATIO,
        )
        .sort((a, b) => b.confidence - a.confidence)[0];
      return latin ? latin.text : word.text;
    })
    .join(' ');
}
