/**
 * "Faux bold": Word and other producers embolden a font that has no bold face by painting its
 * text filled and stroked (text render mode 2) with a line width of a few hundredths of the font
 * size. Matching that with a heavier font only approximates it; the stroke itself is read here so
 * replacement text can be painted the same way.
 */

/** pdf.js operator ids used here (`pdfjs.OPS`). */
export type TextOps = {
  save: number;
  restore: number;
  setTextRenderingMode: number;
  setLineWidth: number;
  setFont: number;
  setTextMatrix: number;
  showText: number;
  setGState: number;
};

/** Characters drawn by one show-text operator, and their stroke as a share of the font size. */
export type StrokeRun = { text: string; strokeEm: number };

/** Strokes thinner than this share of the font size are hairlines, not emboldening. */
const MIN_STROKE_EM = 0.005;
/** Render modes that fill and stroke glyphs (2; 6 also adds them to the clip). */
const FILL_AND_STROKE_MODES = new Set([2, 6]);

type State = { mode: number; lineWidth: number; fontSize: number; matrixScale: number };

/**
 * Walks a page's pdf.js operator list and reports, for every show-text operator, its characters
 * (whitespace removed) and the stroke added to them, as a share of the font size (0 when none).
 * The line width and font size are both in text space scaled by the same CTM, so the CTM cancels.
 *
 * @param fnArray `OperatorList.fnArray`.
 * @param argsArray `OperatorList.argsArray`.
 */
export function strokeRunsFromOperators(fnArray: number[], argsArray: unknown[], ops: TextOps): StrokeRun[] {
  const runs: StrokeRun[] = [];
  const stack: State[] = [];
  let state: State = { mode: 0, lineWidth: 1, fontSize: 1, matrixScale: 1 };
  fnArray.forEach((fn, i) => {
    const args = argsArray[i] as unknown[] | null;
    if (fn === ops.save) stack.push({ ...state });
    else if (fn === ops.restore) state = stack.pop() ?? state;
    else if (fn === ops.setTextRenderingMode) state.mode = Number(args?.[0]);
    else if (fn === ops.setLineWidth) state.lineWidth = Number(args?.[0]);
    else if (fn === ops.setFont) state.fontSize = Math.abs(Number(args?.[1]));
    else if (fn === ops.setTextMatrix) {
      const m = args?.[0] as ArrayLike<number> | undefined;
      if (m) state.matrixScale = Math.hypot(m[2], m[3]) || 1;
    } else if (fn === ops.setGState) {
      for (const [key, value] of (args?.[0] as [string, unknown][] | undefined) ?? []) {
        if (key === 'LW') state.lineWidth = Number(value);
      }
    } else if (fn === ops.showText) {
      const glyphs = (args?.[0] as ({ unicode?: string } | number | null)[] | undefined) ?? [];
      const text = glyphs
        .map((g) => (g && typeof g === 'object' ? (g.unicode ?? '') : ''))
        .join('')
        .replace(/\s+/gu, '');
      const em = state.lineWidth / (state.fontSize * state.matrixScale);
      const stroked = FILL_AND_STROKE_MODES.has(state.mode) && Number.isFinite(em) && em >= MIN_STROKE_EM;
      runs.push({ text, strokeEm: stroked ? em : 0 });
    }
  });
  return runs;
}

/** How far ahead, in characters, an item's text is looked for after the previous match. */
const RESYNC_WINDOW_CHARS = 400;

const comparable = (text: string) => text.normalize('NFKC').replace(/\s+/gu, '');

/**
 * Stroke of each text-content item (pdf.js `getTextContent`), found by looking each item's
 * characters up in the drawn runs, in order. An item takes the stroke most of its characters
 * have; an item that cannot be found gets 0, so a mismatch never invents bold.
 *
 * @param items Text-content item strings, in order.
 * @returns Stroke per item, as a share of the font size.
 */
export function strokeEmPerItem(items: string[], runs: StrokeRun[]): number[] {
  let stream = '';
  const strokes: number[] = [];
  for (const run of runs) {
    for (const char of comparable(run.text)) {
      stream += char;
      for (let k = 0; k < char.length; k++) strokes.push(run.strokeEm);
    }
  }
  let cursor = 0;
  return items.map((item) => {
    const text = comparable(item);
    if (text.length === 0) return 0;
    const at = stream.indexOf(text, cursor);
    if (at < 0 || at - cursor > RESYNC_WINDOW_CHARS) return 0;
    cursor = at + text.length;
    const counts = new Map<number, number>();
    for (const em of strokes.slice(at, at + text.length)) counts.set(em, (counts.get(em) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0][0];
  });
}
