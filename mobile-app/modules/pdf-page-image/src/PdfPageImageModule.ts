import { NativeModule, requireNativeModule } from 'expo';

import { PageImageResult } from './PdfPageImage.types';

declare class PdfPageImageModule extends NativeModule<Record<never, never>> {
  /** Number of pages in the PDF at `uri`. */
  getPageCount(uri: string): Promise<number>;

  /**
   * Rasterizes one page of the PDF at `uri` to a JPEG in the app's cache directory.
   *
   * @param uri `file://` or `content://` URI to the source PDF.
   * @param page Zero-based page index.
   * @param scale Output px per PDF point (unitless). Spec Section 4.1/AGENTS.md's performance
   *   constraint calls for 2-3x here, not an arbitrarily higher number.
   */
  renderPage(uri: string, page: number, scale: number): Promise<PageImageResult>;

  /**
   * Averages the pixel colors in a band around (but excluding) the given rectangle, to pick a
   * mask fill color that matches the page background around a region of text being masked out
   * (Phase 3, spec Section 10). Returns a `#rrggbb` hex string.
   *
   * @param uri `file://` URI to the rasterized background JPEG (`PageState.backgroundImageUri`).
   * @param xPx Left edge of the rectangle, in background-image px.
   * @param yPx Top edge of the rectangle, in background-image px.
   * @param wPx Width of the rectangle, in background-image px.
   * @param hPx Height of the rectangle, in background-image px.
   * @param marginPx Width of the surrounding band to sample, in background-image px.
   */
  sampleAverageColor(
    uri: string,
    xPx: number,
    yPx: number,
    wPx: number,
    hPx: number,
    marginPx: number,
  ): Promise<string>;

  /**
   * Estimates the dominant ink color inside a text bounding box on the rasterized page
   * background. Returns a `#rrggbb` hex string.
   */
  sampleTextColor(uri: string, xPx: number, yPx: number, wPx: number, hPx: number): Promise<string>;
}

export default requireNativeModule<PdfPageImageModule>('PdfPageImage');
