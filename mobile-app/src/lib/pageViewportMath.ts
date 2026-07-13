export type PageScrollOffset = { x: number; y: number };

/**
 * Clamps two-axis page scroll offsets to the real zoomed content bounds.
 *
 * @param scrollXDp Requested horizontal content offset in dp.
 * @param scrollYDp Requested vertical content offset in dp.
 * @param zoom Unitless page zoom factor (1 is fit width).
 * @param viewportWidthDp Visible viewport width in dp.
 * @param viewportHeightDp Visible viewport height in dp.
 * @param pageBaseWidthDp Unzoomed rendered page width in dp.
 * @param pageBaseHeightDp Unzoomed rendered page height in dp.
 */
export function clampPageScroll(
  scrollXDp: number,
  scrollYDp: number,
  zoom: number,
  viewportWidthDp: number,
  viewportHeightDp: number,
  pageBaseWidthDp: number,
  pageBaseHeightDp: number,
): PageScrollOffset {
  const maxX = Math.max(0, pageBaseWidthDp * zoom - viewportWidthDp);
  const maxY = Math.max(0, pageBaseHeightDp * zoom - viewportHeightDp);
  return {
    x: Math.min(maxX, Math.max(0, scrollXDp)),
    y: Math.min(maxY, Math.max(0, scrollYDp)),
  };
}
