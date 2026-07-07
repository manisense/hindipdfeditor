import PdfPageImage from '../../modules/pdf-page-image/src';

/**
 * Wraps the in-house `pdf-page-image` local Expo Module (see
 * hindi-pdf-editor-spec.md Section 4.2 / ADR 0004 for why this replaced the third-party
 * `react-native-pdf-page-image` package). This is the only file that should ever import
 * from `modules/pdf-page-image` directly - everything else in the app depends on this
 * module's shape, not the native module's, so the underlying implementation can be swapped
 * again later by editing only this file.
 */

export interface PageImage {
  /**
   * `file://` URI to the rendered background image, in the app's cache directory. JPEG, not
   * PNG - confirmed on a real device that a PNG this size, inlined as a base64 data URI
   * alongside real Devanagari shaping through an embedded variable font, hangs the print
   * WebView (see `PdfPageImageModule.kt`'s docstring and CHANGELOG for the on-device repro).
   */
  uri: string;
  /** Rendered bitmap width, in px. */
  pxWidth: number;
  /** Rendered bitmap height, in px. */
  pxHeight: number;
}

/** Number of pages in the PDF at `uri` (a `file://` or `content://` URI). */
export async function getPageCount(uri: string): Promise<number> {
  return PdfPageImage.getPageCount(uri);
}

/**
 * Rasterizes one page of the PDF at `uri` to a JPEG, at `scale` px per PDF point.
 *
 * @param uri `file://` or `content://` URI to the source PDF.
 * @param page Zero-based page index.
 * @param scale Output px per PDF point. Per AGENTS.md's performance constraint, callers
 *   should pass 2-3 here (a deliberate memory/quality tradeoff), not an arbitrarily higher number.
 */
export async function renderPage(uri: string, page: number, scale: number): Promise<PageImage> {
  const result = await PdfPageImage.renderPage(uri, page, scale);
  return { uri: result.uri, pxWidth: result.width, pxHeight: result.height };
}

/**
 * Samples the average background color in a band surrounding (but excluding) the given
 * rectangle of a page's rasterized background image - used to pick a `MaskEdit.color` that
 * matches the page instead of a hardcoded white/gray (Phase 3, spec Section 10).
 *
 * @param uri The page's `PageState.backgroundImageUri`.
 * @param xPx Left edge of the rectangle, in background-image px (see `coordinateMath.ts`'s
 *   `ptToImagePx`/`ptSizeToImagePx` for converting a stored `MaskEdit`'s pt rectangle here).
 * @param yPx Top edge of the rectangle, in background-image px.
 * @param wPx Width of the rectangle, in background-image px.
 * @param hPx Height of the rectangle, in background-image px.
 * @param marginPx Width of the surrounding band to sample, in background-image px.
 * @returns A `#rrggbb` hex color string.
 */
export async function sampleAverageColor(
  uri: string,
  xPx: number,
  yPx: number,
  wPx: number,
  hPx: number,
  marginPx: number,
): Promise<string> {
  return PdfPageImage.sampleAverageColor(uri, xPx, yPx, wPx, hPx, marginPx);
}

/**
 * Estimates the dominant ink color inside a text region on the page background image -
 * used to pre-fill replacement text with a color closer to the original burned-in text.
 */
export async function sampleTextColor(
  uri: string,
  xPx: number,
  yPx: number,
  wPx: number,
  hPx: number,
): Promise<string> {
  return PdfPageImage.sampleTextColor(uri, xPx, yPx, wPx, hPx);
}
