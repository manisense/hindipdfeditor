/** Where a signature goes on each page when it is placed automatically. */
export type SignPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export const SIGN_POSITIONS: readonly SignPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

/**
 * The signature's box on a page for a preset position: `widthPt` wide (narrowed to fit inside
 * the margins), keeping the signature's shape, `marginPt` from the page edges.
 *
 * @param page Page size, in PDF points (editor space, rotation applied).
 * @param aspect Signature height divided by its width (unitless).
 * @param widthPt Wanted width, in PDF points.
 * @param marginPt Distance from the page edges, in PDF points.
 * @returns The box, in PDF points (top-left origin).
 */
export function presetRect(
  page: { widthPt: number; heightPt: number },
  aspect: number,
  position: SignPosition,
  widthPt: number,
  marginPt: number,
): { xPt: number; yPt: number; wPt: number; hPt: number } {
  const maxWidth = Math.min(page.widthPt - 2 * marginPt, (page.heightPt - 2 * marginPt) / aspect);
  const wPt = Math.max(1, Math.min(widthPt, maxWidth));
  const hPt = wPt * aspect;
  const [vertical, horizontal] = position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
  const xPt =
    horizontal === 'left' ? marginPt : horizontal === 'right' ? page.widthPt - marginPt - wPt : (page.widthPt - wPt) / 2;
  const yPt = vertical === 'top' ? marginPt : page.heightPt - marginPt - hPt;
  return { xPt, yPt, wPt, hPt };
}

/** A box on a page, in PDF points (editor space, top-left origin). */
export type SignRect = { xPt: number; yPt: number; wPt: number; hPt: number };

/**
 * Where an automatically placed signature goes on every page: a preset corner or edge, or a spot
 * the user dragged it to, kept as the signature centre's share of the page width and height (so it
 * lands on the same spot on pages of other sizes).
 */
export type SignAnchor = { kind: 'preset'; position: SignPosition } | { kind: 'custom'; cx: number; cy: number };

/** A page whose signature was moved or resized on that page alone, in PDF points. */
export type SignOverride = { xPt: number; yPt: number; wPt: number };

function fitInside(page: { widthPt: number; heightPt: number }, aspect: number, xPt: number, yPt: number, widthPt: number): SignRect {
  const wPt = Math.max(1, Math.min(widthPt, page.widthPt, page.heightPt / aspect));
  const hPt = wPt * aspect;
  return {
    xPt: Math.min(Math.max(0, xPt), page.widthPt - wPt),
    yPt: Math.min(Math.max(0, yPt), page.heightPt - hPt),
    wPt,
    hPt,
  };
}

/**
 * The custom anchor for a box the user placed: its centre as a share (0–1) of the page size.
 *
 * @param page Page size, in PDF points (rotation applied).
 * @param rect The placed box, in PDF points.
 */
export function anchorFromRect(page: { widthPt: number; heightPt: number }, rect: SignRect): SignAnchor {
  return { kind: 'custom', cx: (rect.xPt + rect.wPt / 2) / page.widthPt, cy: (rect.yPt + rect.hPt / 2) / page.heightPt };
}

/**
 * The signature's box on one page: its own adjusted box when it has one, else the shared anchor.
 * Boxes keep the signature's shape and stay inside the page.
 *
 * @param page Page size, in PDF points (rotation applied).
 * @param aspect Signature height divided by its width (unitless).
 * @param widthPt Shared signature width, in PDF points.
 * @param marginPt Distance from the page edges for presets, in PDF points.
 * @param override This page's own box, if the user adjusted it.
 */
export function placementRect(
  page: { widthPt: number; heightPt: number },
  aspect: number,
  anchor: SignAnchor,
  widthPt: number,
  marginPt: number,
  override?: SignOverride,
): SignRect {
  if (override) return fitInside(page, aspect, override.xPt, override.yPt, override.wPt);
  if (anchor.kind === 'preset') return presetRect(page, aspect, anchor.position, widthPt, marginPt);
  const wPt = Math.max(1, Math.min(widthPt, page.widthPt, page.heightPt / aspect));
  return fitInside(page, aspect, anchor.cx * page.widthPt - wPt / 2, anchor.cy * page.heightPt - (wPt * aspect) / 2, wPt);
}
