/**
 * Narrows a line replacement to the words that actually changed, so untouched words keep the
 * original glyphs (or scan pixels) instead of being redrawn from detected text. Detected text can
 * contain OCR slips; redrawing the whole line would copy them into words the user never edited.
 */

import type { Edit, MaskEdit, TextEdit } from '../state/editStore';

/** New text may be this much wider than the words it replaces before the rest of the line is redrawn. */
const GROWTH_TOLERANCE = 1.1;

export type ChangedSpan = {
  /** Left edge of the region to clear and redraw, in pt. */
  xPt: number;
  /** Width of that region, in pt. */
  wPt: number;
  /** Text to draw at `xPt`. */
  text: string;
};

function words(text: string): string[] {
  return text.split(/(\s+)/u).filter((part) => part.length > 0);
}

/**
 * The part of a line that has to change, or null when the text is unchanged.
 *
 * Word positions are found from widths measured in the replacement font, scaled to the original
 * line width, so they follow the original layout as closely as the font metrics allow.
 *
 * @param originalText Text of the detected line.
 * @param newText Text after editing.
 * @param lineXPt Left edge of the original line, in pt.
 * @param lineWPt Width of the original line, in pt.
 * @param measure Width of a string in the replacement font at the edit's size, in pt.
 */
export function changedSpan(
  originalText: string,
  newText: string,
  lineXPt: number,
  lineWPt: number,
  measure: (text: string) => number,
): ChangedSpan | null {
  if (originalText === newText) return null;
  const before = words(originalText);
  const after = words(newText);
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++;
  }

  const fullWidth = measure(originalText);
  if (!(fullWidth > 0) || !(lineWPt > 0)) return { xPt: lineXPt, wPt: lineWPt, text: newText };
  const scale = lineWPt / fullWidth;
  const prefixText = before.slice(0, prefix).join('');
  const startPt = lineXPt + measure(prefixText) * scale;
  const oldMiddle = before.slice(prefix, before.length - suffix).join('');
  const newMiddle = after.slice(prefix, after.length - suffix).join('');
  const suffixText = before.slice(before.length - suffix).join('');
  const oldMiddleWidth = measure(oldMiddle) * scale;
  const newMiddleWidth = measure(newMiddle) * scale;

  // The cleared span never reaches past the original words: anything after the line (another run
  // on the same visual line) must survive. New text that does not fit is shrunk by the caller.
  if (suffix === 0 || newMiddleWidth <= oldMiddleWidth * GROWTH_TOLERANCE) {
    // Only the changed words; a trailing change also takes the rest of the original line.
    const endPt = suffix === 0 ? lineXPt + lineWPt : startPt + oldMiddleWidth;
    return { xPt: startPt, wPt: endPt - startPt, text: newMiddle };
  }
  // The new words need more room: redraw from the first change to the end of the line.
  return { xPt: startPt, wPt: lineXPt + lineWPt - startPt, text: newMiddle + suffixText };
}

/** Clearance kept around a narrowed span so neighbouring glyphs are not clipped, in pt. */
const SPAN_PAD_PT = 0.5;
/** Largest reduction applied to new words that would otherwise run into the following text. */
const MAX_SPAN_SHRINK = 0.25;

/**
 * Narrows replacement edits on one page to their changed words: an unchanged replacement and its
 * mask are dropped (the original line is kept as is); a changed one keeps its mask height but
 * clears and redraws only the changed span. Edits that were moved or resized are left whole.
 *
 * When `gapNear` is given, a span edge inside the line moves to the middle of the nearest real
 * word gap on the page, and the new text starts where the original word began.
 *
 * @param edits Edits of one page; positions in pt.
 * @param measure Width of `text` in the edit's font at its size, in pt.
 * New words that are wider than the cleared span (a trailing edit followed by another run on the
 * same visual line) are shrunk to fit, by at most `MAX_SPAN_SHRINK`, keeping their baseline.
 *
 * @param gapNear Blank gap on the page image near `xPt` in the mask's band, in pt, or null.
 * @param baselineRatio Baseline offset of the edit's font as a fraction of its size (unitless).
 */
export function applyChangedSpans(
  edits: readonly Edit[],
  measure: (edit: TextEdit, text: string) => number,
  gapNear?: (mask: MaskEdit, xPt: number) => { startPt: number; endPt: number } | null,
  baselineRatio?: (edit: TextEdit) => number | undefined,
): Edit[] {
  const masks = new Map(edits.filter((e): e is MaskEdit => e.type === 'mask').map((m) => [m.id, m]));
  const dropped = new Set<string>();
  const replaced = new Map<string, Edit>();
  for (const edit of edits) {
    if (edit.type !== 'text' || !edit.original || !edit.maskId) continue;
    const mask = masks.get(edit.maskId);
    const { original } = edit;
    if (!mask || edit.xPt !== original.editXPt || edit.fontSizePt !== original.fontSizePt) continue;
    const span = changedSpan(original.text, edit.text, original.xPt, original.wPt, (text) => measure(edit, text));
    if (!span) {
      dropped.add(edit.id).add(mask.id);
      continue;
    }
    const lineEnd = original.xPt + original.wPt;
    let clearStart = span.xPt - SPAN_PAD_PT;
    let clearEnd = span.xPt + span.wPt + SPAN_PAD_PT;
    let textX = span.xPt;
    const startGap = span.xPt > original.xPt + SPAN_PAD_PT ? gapNear?.(mask, span.xPt) : null;
    if (startGap) {
      clearStart = (startGap.startPt + startGap.endPt) / 2;
      textX = startGap.endPt;
    }
    const spanEnd = span.xPt + span.wPt;
    const endGap = spanEnd < lineEnd - SPAN_PAD_PT ? gapNear?.(mask, spanEnd) : null;
    if (endGap) clearEnd = Math.max((endGap.startPt + endGap.endPt) / 2, textX + 1);
    replaced.set(mask.id, { ...mask, xPt: clearStart, wPt: clearEnd - clearStart });
    // A narrowed span is a single run of words: drop the wrap width so it is not re-wrapped.
    const narrowed: TextEdit = { ...edit, xPt: textX, text: span.text };
    delete narrowed.widthPt;
    const available = clearEnd - textX;
    const needed = measure(edit, span.text);
    if (needed > available && available > 0) {
      const scale = Math.max(1 - MAX_SPAN_SHRINK, available / needed);
      const ratio = baselineRatio?.(edit) ?? 1;
      narrowed.fontSizePt = edit.fontSizePt * scale;
      narrowed.yPt = edit.yPt + ratio * (edit.fontSizePt - narrowed.fontSizePt);
    }
    replaced.set(edit.id, narrowed);
  }
  return edits.filter((e) => !dropped.has(e.id)).map((e) => replaced.get(e.id) ?? e);
}
