/** Smallest and largest Reader zoom, as a multiple of the fitted page size. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/**
 * Largest page size that fits the view at the page's aspect ratio.
 *
 * @param viewWidth Available width in dp.
 * @param viewHeight Available height in dp.
 * @param aspect Page width / height.
 * @returns Page size in dp.
 */
export function fitPage(
  viewWidth: number,
  viewHeight: number,
  aspect: number,
): { width: number; height: number } {
  const width = Math.min(viewWidth, viewHeight * aspect);
  return { width, height: width / aspect };
}

/**
 * Clamps a pan so a page zoomed by `scale` never shows a gap past its edges. The page is scaled
 * about its centre, so at scale s it overhangs by (s - 1) / 2 of its size on each side.
 *
 * @param x Horizontal translation in dp.
 * @param y Vertical translation in dp.
 * @param scale Current zoom.
 * @param width Fitted page width in dp.
 * @param height Fitted page height in dp.
 */
export function clampPan(
  x: number,
  y: number,
  scale: number,
  width: number,
  height: number,
): { x: number; y: number } {
  'worklet';
  const maxX = Math.max(0, (width * (scale - 1)) / 2);
  const maxY = Math.max(0, (height * (scale - 1)) / 2);
  return { x: Math.min(maxX, Math.max(-maxX, x)) || 0, y: Math.min(maxY, Math.max(-maxY, y)) || 0 };
}

/**
 * Translation that keeps the page point under `focal` still while the zoom goes from `fromScale`
 * to `toScale`. All points are in dp relative to the page centre.
 *
 * @param pan Translation at `fromScale`, in dp.
 * @param fromScale Zoom before.
 * @param toScale Zoom after.
 * @param focal Focal point in dp from the page centre.
 */
export function zoomAround(
  pan: { x: number; y: number },
  fromScale: number,
  toScale: number,
  focal: { x: number; y: number },
): { x: number; y: number } {
  'worklet';
  const ratio = toScale / fromScale;
  return {
    x: focal.x - (focal.x - pan.x) * ratio || 0,
    y: focal.y - (focal.y - pan.y) * ratio || 0,
  };
}
