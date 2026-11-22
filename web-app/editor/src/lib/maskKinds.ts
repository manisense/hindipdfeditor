import type { Edit, MaskEdit, OcrLine } from '../state/editStore';

/** Fill colour of the Highlight tool, painted with a multiply blend so text under it stays dark. */
export const HIGHLIGHT_COLOR = '#ffe066';

/** Whether a mask is a highlight (a translucent mark; the content under it is kept). */
export function isHighlight(mask: MaskEdit): boolean {
  return mask.kind === 'highlight';
}

/** Whether a mask is a whiteout (the default kind): text under it is deleted and it is filled. */
export function isWhiteout(mask: MaskEdit): boolean {
  return mask.kind === undefined || mask.kind === 'whiteout';
}

/**
 * Whether export deletes the original text under a mask. Replacements and whiteouts do, so hidden
 * words cannot be copied or searched afterwards; highlights keep the text they mark.
 */
export function removesTextUnder(mask: MaskEdit): boolean {
  return mask.kind !== 'highlight';
}

/**
 * Whether export patches the background where text could not be deleted (scans, unreachable
 * text). Only replacements need it: a whiteout is painted over with its fill colour.
 */
export function patchesBackground(mask: MaskEdit): boolean {
  return mask.kind === 'replace';
}

/**
 * Detected lines that no whiteout hides (a line is hidden when its centre is under one), so text
 * the user covered cannot be tapped and edited again. Positions are PDF points.
 */
export function linesOutsideWhiteouts(lines: OcrLine[], edits: Edit[]): OcrLine[] {
  const whiteouts = edits.filter((e): e is MaskEdit => e.type === 'mask' && isWhiteout(e));
  if (whiteouts.length === 0) return lines;
  return lines.filter((line) => {
    const cx = line.xPt + line.wPt / 2;
    const cy = line.yPt + line.hPt / 2;
    return !whiteouts.some((w) => cx >= w.xPt && cx <= w.xPt + w.wPt && cy >= w.yPt && cy <= w.yPt + w.hPt);
  });
}
