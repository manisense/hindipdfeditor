import type { OcrLine } from '../state/editStore';

/**
 * Left edges of lines in one paragraph differ by at most this share of the line height (OCR
 * boxes start at the first ink, so a bracket or matra moves them).
 */
const LEFT_ALIGN_TOLERANCE = 1;
/** Boxes whose baselines differ by at most this share of the line height are on one row. */
const SAME_ROW_TOLERANCE = 0.5;
/** Lines in one paragraph differ in height by at most this share. */
const HEIGHT_TOLERANCE = 0.2;
/** Baseline step between paragraph lines, as a share of the line height: tighter is overlap, looser a gap. */
const MIN_STEP = 0.9;
const MAX_STEP = 2.2;

/**
 * How many lines `text` takes when wrapped greedily at spaces within `widthPt`, as the browser
 * wraps the edit box. A word wider than the width takes a line of its own.
 *
 * @param widthPt Wrap width, in PDF points.
 * @param measure Width of a run of text, in PDF points.
 */
export function wrappedLineCount(text: string, widthPt: number, measure: (text: string) => number): number {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  let lines = 1;
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measure(candidate) > widthPt) {
      lines += 1;
      current = word;
    } else {
      current = candidate;
    }
  }
  return lines;
}

const baselineOf = (line: OcrLine) => line.baselineYPt ?? line.yPt + line.hPt;

/**
 * The detected line that continues `previous`'s paragraph: directly below it, left-aligned with
 * it, the same size, and following a full line. `previous` counts as full when the next line's
 * first word would not have fitted after it within the column, as a typesetter would have put it
 * there otherwise; a shorter line ends its paragraph.
 *
 * @param lines Detected lines on the page; positions in PDF points.
 * @param measure Width of a run of text in the line's font, in PDF points.
 * @returns The next line of the paragraph, or null at the paragraph's end.
 */
export function nextParagraphLine(
  lines: readonly OcrLine[],
  previous: OcrLine,
  measure: (text: string) => number,
): OcrLine | null {
  const h = previous.hPt;
  const below = lines
    .filter((l) => l.id !== previous.id && baselineOf(l) > baselineOf(previous) + SAME_ROW_TOLERANCE * h)
    .sort((a, b) => baselineOf(a) - baselineOf(b));
  if (below.length === 0) return null;
  // The next row's leftmost box: OCR may list a split row's boxes in any order.
  const rowBaseline = baselineOf(below[0]);
  const next = below
    .filter((l) => baselineOf(l) - rowBaseline <= SAME_ROW_TOLERANCE * l.hPt)
    .reduce((a, b) => (b.xPt < a.xPt ? b : a));
  const step = baselineOf(next) - baselineOf(previous);
  if (step < MIN_STEP * h || step > MAX_STEP * h) return null;
  if (Math.abs(next.hPt - h) > HEIGHT_TOLERANCE * h) return null;
  if (Math.abs(next.xPt - previous.xPt) > LEFT_ALIGN_TOLERANCE * h) return null;
  const columnRight = Math.max(previous.xPt + previous.wPt, next.xPt + next.wPt);
  const firstWord = next.text.trim().split(/\s+/u)[0] ?? '';
  const roomLeft = columnRight - (previous.xPt + previous.wPt);
  if (roomLeft >= measure(` ${firstWord}`)) return null;
  return next;
}

/**
 * Overflow allowed before a line flows on, as a share of the column width: kerning of the new
 * words and rounding in the edit box's position must not move a word to the next line.
 */
const OVERFLOW_TOLERANCE = 0.03;

/** Space cleared above a line's box, as a share of its height (matches tap-to-edit's mask). */
const MASK_PAD_TOP_RATIO = 0.35;

export type ParagraphFlow = {
  /** The edit's text with the taken lines' words joined on. */
  text: string;
  /** Detected lines taken into the edit, in order. */
  absorbed: OcrLine[];
  /** Wrap width of the edit: from its left edge to the column's right edge, in PDF points. */
  widthPt: number;
  /** Baseline-to-baseline distance of the paragraph, in PDF points. */
  lineHeightPt: number;
  /** Area to clear: every covered line, in PDF points (editor space). */
  rect: { xPt: number; yPt: number; wPt: number; hPt: number };
};

/**
 * Lets an edited line flow into the rest of its paragraph. While `text` wraps to more lines than
 * the edit covers, the next line of the paragraph (see {@link nextParagraphLine}) is taken in: its
 * words are joined onto the end of the text and its area is cleared, so the paragraph reflows as
 * in a word processor. Stops at the paragraph's end.
 *
 * @param editXPt Left edge of the edit's text, in PDF points.
 * @param lines Detected lines still on the page (not taken by any edit).
 * @param covered Lines the edit already covers, first to last; the first is the line it replaced,
 *   whose original text and box width calibrate `measure`.
 * @param measure Width of a run of text in the edit's font, in PDF points.
 * @returns The new text, taken lines and geometry, or null when no line was taken.
 */
export function flowIntoParagraph(
  text: string,
  editXPt: number,
  covered: readonly OcrLine[],
  lines: readonly OcrLine[],
  measure: (text: string) => number,
): ParagraphFlow | null {
  // Widths are compared in the original's terms: the replacement font may set the same text a
  // little wider or narrower, which alone must not make a line flow.
  const original = covered[0];
  const scale = original.wPt / Math.max(1e-6, measure(original.text));
  const measured = (run: string) => measure(run) * scale;
  const taken = [...covered];
  const absorbed: OcrLine[] = [];
  let rows = countRows(covered);
  const columnLeft = Math.min(editXPt, ...covered.map((l) => l.xPt));
  const fits = (text: string, right: number, lineCount: number) =>
    wrappedLineCount(text, (right - columnLeft) * (1 + OVERFLOW_TOLERANCE), measured) <= lineCount;
  let remaining = [...lines];
  let flowed = text;
  let columnRight = Math.max(...taken.map((l) => l.xPt + l.wPt));
  for (;;) {
    const next = nextParagraphLine(remaining, rowStart(taken), measured);
    if (!next) break;
    // OCR can split one row into several boxes: the whole row is taken, in reading order.
    const row = remaining
      .filter((l) => Math.abs(baselineOf(l) - baselineOf(next)) <= SAME_ROW_TOLERANCE * next.hPt && l.xPt >= next.xPt)
      .sort((a, b) => a.xPt - b.xPt);
    const right = Math.max(columnRight, ...row.map((l) => l.xPt + l.wPt));
    if (fits(flowed, right, rows)) break;
    columnRight = right;
    flowed = `${flowed.trimEnd()} ${row.map((l) => l.text.trim()).join(' ')}`;
    taken.push(...row);
    absorbed.push(...row);
    rows += 1;
    const takenIds = new Set(row.map((l) => l.id));
    remaining = remaining.filter((l) => !takenIds.has(l.id));
  }
  if (absorbed.length === 0) return null;
  const first = taken[0];
  const last = taken.reduce((a, b) => (baselineOf(b) > baselineOf(a) ? b : a));
  const left = Math.min(...taken.map((l) => l.xPt));
  const top = first.yPt - first.hPt * MASK_PAD_TOP_RATIO;
  const bottom = Math.max(...taken.map((l) => l.yPt + l.hPt));
  return {
    text: flowed,
    absorbed,
    // In the replacement font's terms, so the browser wraps where the line count was taken.
    widthPt: ((columnRight - columnLeft) * (1 + OVERFLOW_TOLERANCE)) / scale,
    lineHeightPt: (baselineOf(last) - baselineOf(first)) / (rows - 1),
    rect: { xPt: left, yPt: top, wPt: columnRight - left, hPt: bottom - top },
  };
}

/** Number of rows (distinct baselines) among lines. */
function countRows(lines: readonly OcrLine[]): number {
  const baselines: number[] = [];
  for (const line of lines) {
    if (!baselines.some((b) => Math.abs(b - baselineOf(line)) <= SAME_ROW_TOLERANCE * line.hPt)) baselines.push(baselineOf(line));
  }
  return baselines.length;
}

/** The leftmost box of the lowest row among lines: where the next row is looked for from. */
function rowStart(lines: readonly OcrLine[]): OcrLine {
  const lowest = lines.reduce((a, b) => (baselineOf(b) > baselineOf(a) ? b : a));
  const row = lines.filter((l) => Math.abs(baselineOf(l) - baselineOf(lowest)) <= SAME_ROW_TOLERANCE * lowest.hPt);
  const start = row.reduce((a, b) => (b.xPt < a.xPt ? b : a));
  // The row is judged full by where its last box ends.
  const end = Math.max(...row.map((l) => l.xPt + l.wPt));
  return { ...start, wPt: end - start.xPt };
}
