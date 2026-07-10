/**
 * Pure coordinate conversions between the three coexisting unit systems in this app
 * (see hindi-pdf-editor-spec.md Sections 7-8):
 *
 * - dp:  device-independent pixels, the unit React Native views/TextInputs are laid out in.
 * - pt:  PDF points, the canonical unit every stored `Edit` is persisted in, taken from the
 *        source document's real page size (`@cantoo/pdf-lib`'s `getSize()`).
 * - px:  pixels of the rasterized background image for a page (`pdfToImages.ts`'s output),
 *        rendered at 2-3x the page's point-dimensions.
 *
 * All three share a top-left origin (no Y-flip anywhere in this pipeline - only raw PDF
 * content-stream drawing operations use a bottom-left origin, and this architecture never
 * writes to a content stream directly, per ADR 0001). Every conversion here is therefore a
 * single uniform linear scale derived from the width ratio between the two unit systems,
 * applied identically to both axes - there is no rotation or baseline-offset math anywhere
 * in Plan A.
 */

/**
 * Converts a point tapped/typed in the live on-screen overlay (dp) to PDF points.
 *
 * @param xDp Horizontal position, in dp, relative to the page view's left edge.
 * @param yDp Vertical position, in dp, relative to the page view's top edge.
 * @param viewWidthDp Width of the on-screen page view, in dp.
 * @param pageWidthPt Width of the source PDF page, in points.
 */
export function dpToPt(
  xDp: number,
  yDp: number,
  viewWidthDp: number,
  pageWidthPt: number,
): { xPt: number; yPt: number } {
  const scale = pageWidthPt / viewWidthDp;
  return { xPt: xDp * scale, yPt: yDp * scale };
}

/**
 * Converts a stored edit's position (PDF points) back to dp, to place it on the live
 * on-screen overlay.
 *
 * @param xPt Horizontal position, in PDF points, relative to the page's left edge.
 * @param yPt Vertical position, in PDF points, relative to the page's top edge.
 * @param viewWidthDp Width of the on-screen page view, in dp.
 * @param pageWidthPt Width of the source PDF page, in points.
 */
export function ptToDp(
  xPt: number,
  yPt: number,
  viewWidthDp: number,
  pageWidthPt: number,
): { xDp: number; yDp: number } {
  const scale = viewWidthDp / pageWidthPt;
  return { xDp: xPt * scale, yDp: yPt * scale };
}

/**
 * Converts a stored edit's position (PDF points) to background-image pixels, for
 * `htmlCompositor.ts` to position an absolutely-positioned layer at export time.
 *
 * @param xPt Horizontal position, in PDF points, relative to the page's left edge.
 * @param yPt Vertical position, in PDF points, relative to the page's top edge.
 * @param imagePxWidth Width of the rendered background image, in px.
 * @param pageWidthPt Width of the source PDF page, in points.
 */
export function ptToImagePx(
  xPt: number,
  yPt: number,
  imagePxWidth: number,
  pageWidthPt: number,
): { x: number; y: number } {
  const scale = imagePxWidth / pageWidthPt;
  return { x: xPt * scale, y: yPt * scale };
}

/**
 * Converts a background-image pixel position back to PDF points - the inverse of
 * `ptToImagePx`, needed because OCR (`text-recognition` module) runs directly on the
 * rasterized background image and reports bounding boxes in that image's pixel space, but
 * every stored `Edit`-adjacent value in this app (including `OcrLine`) is kept in PDF points
 * like everything else, converting to dp/px only at the point of use (see this file's
 * module docstring).
 *
 * @param xPx Horizontal position, in background-image px, relative to the image's left edge.
 * @param yPx Vertical position, in background-image px, relative to the image's top edge.
 * @param imagePxWidth Width of the rendered background image, in px.
 * @param pageWidthPt Width of the source PDF page, in points.
 */
export function imagePxToPt(
  xPx: number,
  yPx: number,
  imagePxWidth: number,
  pageWidthPt: number,
): { xPt: number; yPt: number } {
  const scale = pageWidthPt / imagePxWidth;
  return { xPt: xPx * scale, yPt: yPx * scale };
}

/**
 * Converts a background-image pixel size (width/height) back to PDF points - the inverse of
 * `ptSizeToImagePx`. See `imagePxToPt`'s docstring for why OCR needs this conversion.
 *
 * @param wPx Width, in background-image px.
 * @param hPx Height, in background-image px.
 * @param imagePxWidth Width of the rendered background image, in px.
 * @param pageWidthPt Width of the source PDF page, in points.
 */
export function imagePxSizeToPt(
  wPx: number,
  hPx: number,
  imagePxWidth: number,
  pageWidthPt: number,
): { wPt: number; hPt: number } {
  const { xPt: wPt, yPt: hPt } = imagePxToPt(wPx, hPx, imagePxWidth, pageWidthPt);
  return { wPt, hPt };
}

/**
 * Converts a drawn selection's size (dp) to PDF points - `MaskOverlay.tsx`'s drag-to-select
 * gesture reports a rectangle's width/height in dp, which must be stored in points like every
 * other `Edit` field (spec Section 7). A size has no origin to offset against, unlike a
 * position, but the scale factor is identical to `dpToPt`'s - kept as a separate, clearly-named
 * function rather than reusing `dpToPt` at call sites, since AGENTS.md flags unit confusion
 * (here, specifically position-vs-size confusion) as this codebase's most likely bug class.
 *
 * @param wDp Width, in dp.
 * @param hDp Height, in dp.
 * @param viewWidthDp Width of the on-screen page view, in dp.
 * @param pageWidthPt Width of the source PDF page, in points.
 */
export function dpSizeToPt(
  wDp: number,
  hDp: number,
  viewWidthDp: number,
  pageWidthPt: number,
): { wPt: number; hPt: number } {
  const { xPt: wPt, yPt: hPt } = dpToPt(wDp, hDp, viewWidthDp, pageWidthPt);
  return { wPt, hPt };
}

/**
 * Converts a stored `MaskEdit`'s size (PDF points) back to dp, to render the mask rectangle
 * on the live on-screen overlay (`MaskOverlay.tsx`).
 *
 * @param wPt Width, in PDF points.
 * @param hPt Height, in PDF points.
 * @param viewWidthDp Width of the on-screen page view, in dp.
 * @param pageWidthPt Width of the source PDF page, in points.
 */
export function ptSizeToDp(
  wPt: number,
  hPt: number,
  viewWidthDp: number,
  pageWidthPt: number,
): { wDp: number; hDp: number } {
  const { xDp: wDp, yDp: hDp } = ptToDp(wPt, hPt, viewWidthDp, pageWidthPt);
  return { wDp, hDp };
}

/**
 * Converts a stored `MaskEdit`'s size (PDF points) to background-image pixels, so
 * `App.tsx` can ask the native module to sample the average color around the masked
 * region in the same pixel space the region will actually be painted in at export time.
 *
 * @param wPt Width, in PDF points.
 * @param hPt Height, in PDF points.
 * @param imagePxWidth Width of the rendered background image, in px.
 * @param pageWidthPt Width of the source PDF page, in points.
 */
export function ptSizeToImagePx(
  wPt: number,
  hPt: number,
  imagePxWidth: number,
  pageWidthPt: number,
): { wPx: number; hPx: number } {
  const { x: wPx, y: hPx } = ptToImagePx(wPt, hPt, imagePxWidth, pageWidthPt);
  return { wPx, hPx };
}
