/** A box on the page in editor space: PDF points, top-left origin. */
export type PageRect = { xPt: number; yPt: number; wPt: number; hPt: number };

/** Largest share of the page width or height a newly placed image takes. */
const MAX_PAGE_SHARE = 0.4;
/** Smallest width an image can be resized to, in PDF points. */
const MIN_IMAGE_WIDTH_PT = 12;

/**
 * Where a newly inserted image goes: centred, keeping its shape, at most 40 % of the page width
 * and height, and never enlarged past 1 pt per image px (so small images stay crisp).
 *
 * @param pxWidth Image width, in image px.
 * @param pxHeight Image height, in image px.
 * @param pageWidthPt Page width, in PDF points.
 * @param pageHeightPt Page height, in PDF points.
 */
export function placeImage(pxWidth: number, pxHeight: number, pageWidthPt: number, pageHeightPt: number): PageRect {
  const scale = Math.min(
    1,
    (pageWidthPt * MAX_PAGE_SHARE) / pxWidth,
    (pageHeightPt * MAX_PAGE_SHARE) / pxHeight,
  );
  const wPt = pxWidth * scale;
  const hPt = pxHeight * scale;
  return { xPt: (pageWidthPt - wPt) / 2, yPt: (pageHeightPt - hPt) / 2, wPt, hPt };
}

/**
 * Moves a box the least amount needed to keep it fully on the page.
 *
 * @param rect Box, in PDF points.
 * @param pageWidthPt Page width, in PDF points.
 * @param pageHeightPt Page height, in PDF points.
 */
export function clampToPage(rect: PageRect, pageWidthPt: number, pageHeightPt: number): PageRect {
  return {
    ...rect,
    xPt: Math.min(Math.max(0, rect.xPt), Math.max(0, pageWidthPt - rect.wPt)),
    yPt: Math.min(Math.max(0, rect.yPt), Math.max(0, pageHeightPt - rect.hPt)),
  };
}

/**
 * Resizes a box from its bottom-right corner to `widthPt`, keeping its shape and its top-left
 * corner, within the page and no narrower than 12 pt.
 *
 * @param rect Box, in PDF points.
 * @param widthPt Wanted width, in PDF points.
 * @param pageWidthPt Page width, in PDF points.
 * @param pageHeightPt Page height, in PDF points.
 */
export function resizeKeepingAspect(
  rect: PageRect,
  widthPt: number,
  pageWidthPt: number,
  pageHeightPt: number,
): PageRect {
  const aspect = rect.hPt / rect.wPt;
  const maxWidth = Math.min(pageWidthPt - rect.xPt, (pageHeightPt - rect.yPt) / aspect);
  const wPt = Math.max(MIN_IMAGE_WIDTH_PT, Math.min(widthPt, maxWidth));
  return { ...rect, wPt, hPt: wPt * aspect };
}

/**
 * Bounding box of the pixels that are not fully transparent, so a drawn signature can be cropped
 * to its ink.
 *
 * @param rgba RGBA bytes, row-major.
 * @param width Image width, in px.
 * @param height Image height, in px.
 * @returns The box in px, or null when nothing was drawn.
 */
export function inkBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Centre of the part of the page that is on screen, so an inserted image appears where the user
 * is looking. Falls back to the page centre when no part of the page is visible.
 *
 * @param pagePx The page's drawn box, in screen px (as from getBoundingClientRect).
 * @param screenPx The visible area, in screen px.
 * @param pageWidthPt Page width, in PDF points.
 * @returns The centre, in PDF points.
 */
export function visiblePageCentre(
  pagePx: { left: number; top: number; width: number; height: number },
  screenPx: { width: number; height: number },
  pageWidthPt: number,
): { xPt: number; yPt: number } {
  const ptPerPx = pageWidthPt / pagePx.width;
  const left = Math.max(0, pagePx.left);
  const right = Math.min(screenPx.width, pagePx.left + pagePx.width);
  const top = Math.max(0, pagePx.top);
  const bottom = Math.min(screenPx.height, pagePx.top + pagePx.height);
  if (right <= left || bottom <= top) {
    return { xPt: (pagePx.width / 2) * ptPerPx, yPt: (pagePx.height / 2) * ptPerPx };
  }
  return {
    xPt: ((left + right) / 2 - pagePx.left) * ptPerPx,
    yPt: ((top + bottom) / 2 - pagePx.top) * ptPerPx,
  };
}
