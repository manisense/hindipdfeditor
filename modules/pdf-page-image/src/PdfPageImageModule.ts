import { NativeModule, requireNativeModule } from 'expo';

import { PageImageResult } from './PdfPageImage.types';

declare class PdfPageImageModule extends NativeModule<Record<never, never>> {
  /** Number of pages in the PDF at `uri`. */
  getPageCount(uri: string): Promise<number>;

  /**
   * Rasterizes one page of the PDF at `uri` to a PNG in the app's cache directory.
   *
   * @param uri `file://` or `content://` URI to the source PDF.
   * @param page Zero-based page index.
   * @param scale Output px per PDF point (unitless). Spec Section 4.1/AGENTS.md's performance
   *   constraint calls for 2-3x here, not an arbitrarily higher number.
   */
  renderPage(uri: string, page: number, scale: number): Promise<PageImageResult>;
}

export default requireNativeModule<PdfPageImageModule>('PdfPageImage');
