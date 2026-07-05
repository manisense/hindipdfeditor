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
  /** `file://` URI to the rendered PNG, in the app's cache directory. */
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
 * Rasterizes one page of the PDF at `uri` to a PNG, at `scale` px per PDF point.
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
