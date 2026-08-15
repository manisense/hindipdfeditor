import type { OcrLine } from '../state/editStore';

/**
 * Pure hit-testing for OCR-assisted tap-to-edit: given where the user tapped (PDF points,
 * same space `PdfPageViewer`'s `onTap` reports in), find the detected text they meant.
 *
 * Kept separate from `mergeOcrLines.ts` deliberately: that module works entirely in image px
 * (the native module's space), this one entirely in PDF points (the store's space) - one unit
 * system per file, per AGENTS.md's unit-confusion warning.
 */

/** Default padding around every box before a direct hit counts, in PDF points. */
const DEFAULT_TOLERANCE_PT = 8;
/** When no box contains the tap, snap to the nearest box within this distance, in PDF points. */
const DEFAULT_NEAREST_PT = 28;

/**
 * Returns the detected line intended by the tapped point, or `null` if the tap landed on empty
 * page. Exact, unpadded containment wins first. Only then is tolerance applied, using distance to
 * the real box edge before area, so padding from a neighboring box cannot steal a precise click.
 *
 * @param lines Detected lines for the page, boxes in PDF points.
 * @param xPt Tapped X, page-relative, in PDF points.
 * @param yPt Tapped Y, page-relative, in PDF points.
 * @param tolerancePt Padding added around every box before testing, in PDF points - fingers
 *   are imprecise and OCR boxes hug glyphs tightly, so slack makes short words tappable.
 */
export function findOcrLineAt(
  lines: OcrLine[],
  xPt: number,
  yPt: number,
  tolerancePt = DEFAULT_TOLERANCE_PT,
): OcrLine | null {
  const exact = findSmallestContainingLine(lines, xPt, yPt, 0);
  if (exact || tolerancePt <= 0) return exact;

  let best: OcrLine | null = null;
  let bestDistance = Infinity;
  let bestArea = Infinity;
  for (const line of lines) {
    const within =
      xPt >= line.xPt - tolerancePt &&
      xPt <= line.xPt + line.wPt + tolerancePt &&
      yPt >= line.yPt - tolerancePt &&
      yPt <= line.yPt + line.hPt + tolerancePt;
    if (!within) continue;
    const distance = distanceToRectEdge(xPt, yPt, line.xPt, line.yPt, line.wPt, line.hPt);
    const area = line.wPt * line.hPt;
    if (distance < bestDistance || (distance === bestDistance && area < bestArea)) {
      best = line;
      bestDistance = distance;
      bestArea = area;
    }
  }
  return best;
}

function findSmallestContainingLine(
  lines: OcrLine[],
  xPt: number,
  yPt: number,
  tolerancePt: number,
): OcrLine | null {
  let best: OcrLine | null = null;
  let bestArea = Infinity;
  for (const line of lines) {
    const within =
      xPt >= line.xPt - tolerancePt &&
      xPt <= line.xPt + line.wPt + tolerancePt &&
      yPt >= line.yPt - tolerancePt &&
      yPt <= line.yPt + line.hPt + tolerancePt;
    const area = line.wPt * line.hPt;
    if (within && area < bestArea) {
      best = line;
      bestArea = area;
    }
  }
  return best;
}

/**
 * Distance from a point to a rectangle's edge (0 when inside), in PDF points.
 * Used for nearest-neighbor snapping when the finger lands just outside a tight OCR box.
 */
function distanceToRectEdge(
  xPt: number,
  yPt: number,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const dx = Math.max(x - xPt, 0, xPt - (x + w));
  const dy = Math.max(y - yPt, 0, yPt - (y + h));
  return Math.hypot(dx, dy);
}

/**
 * Canva-style tap target resolution: try a direct hit first (with generous tolerance), then
 * snap to the nearest detected text within `nearestPt` so imperfect OCR boxes or imprecise
 * taps still land on the intended word/line instead of creating a stray new-text edit.
 *
 * @param lines Detected text regions for the page, boxes in PDF points.
 * @param xPt Tapped X, page-relative, in PDF points.
 * @param yPt Tapped Y, page-relative, in PDF points.
 * @param tolerancePt Direct-hit padding, in PDF points.
 * @param nearestPt Max snap distance when no direct hit, in PDF points.
 */
export function findOcrTargetAt(
  lines: OcrLine[],
  xPt: number,
  yPt: number,
  tolerancePt = DEFAULT_TOLERANCE_PT,
  nearestPt = DEFAULT_NEAREST_PT,
): OcrLine | null {
  const direct = findOcrLineAt(lines, xPt, yPt, tolerancePt);
  if (direct) return direct;

  let best: OcrLine | null = null;
  let bestDist = Infinity;
  for (const line of lines) {
    const dist = distanceToRectEdge(xPt, yPt, line.xPt, line.yPt, line.wPt, line.hPt);
    if (dist <= nearestPt && dist < bestDist) {
      best = line;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Returns the `TextEdit` whose box contains the tap, if any. Exact containment wins before padded
 * proximity, so adjacent small and large edits can each be selected reliably.
 *
 * @param edits Text edits on the page, positions/sizes in PDF points.
 * @param xPt Tapped X, page-relative, in PDF points.
 * @param yPt Tapped Y, page-relative, in PDF points.
 * @param tolerancePt Hit padding, in PDF points.
 */
export function findTextEditAt<
  T extends {
    id: string;
    xPt: number;
    yPt: number;
    widthPt?: number;
    fontSizePt: number;
    text: string;
  },
>(edits: T[], xPt: number, yPt: number, tolerancePt = DEFAULT_TOLERANCE_PT): T | null {
  const candidates = edits.map((edit) => ({
    edit,
    wPt: edit.widthPt ?? edit.fontSizePt * Math.max(edit.text.length, 4) * 0.55,
    hPt: edit.fontSizePt * 1.4,
  }));
  const exactCandidates = candidates.filter(
    ({ edit, wPt, hPt }) =>
      xPt >= edit.xPt &&
      xPt <= edit.xPt + wPt &&
      yPt >= edit.yPt &&
      yPt <= edit.yPt + hPt,
  );
  if (exactCandidates.length > 0) {
    return exactCandidates.reduce((smallest, candidate) =>
      candidate.wPt * candidate.hPt < smallest.wPt * smallest.hPt ? candidate : smallest,
    ).edit;
  }

  let best: T | null = null;
  let bestDistance = Infinity;
  let bestArea = Infinity;
  for (const { edit, wPt, hPt } of candidates) {
    const within =
      xPt >= edit.xPt - tolerancePt &&
      xPt <= edit.xPt + wPt + tolerancePt &&
      yPt >= edit.yPt - tolerancePt &&
      yPt <= edit.yPt + hPt + tolerancePt;
    if (!within) continue;
    const distance = distanceToRectEdge(xPt, yPt, edit.xPt, edit.yPt, wPt, hPt);
    const area = wPt * hPt;
    if (distance < bestDistance || (distance === bestDistance && area < bestArea)) {
      best = edit;
      bestDistance = distance;
      bestArea = area;
    }
  }
  return best;
}
