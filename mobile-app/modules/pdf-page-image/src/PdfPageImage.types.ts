/** A `file://` URI to a PDF, or a `content://` URI as returned by expo-document-picker on Android. */
export type PdfUri = string;

export interface PageImageResult {
  /** `file://` URI to the rendered JPEG, in the app's cache directory. */
  uri: string;
  /**
   * Rendered bitmap width, in px. Normally page width in pt * the requested scale, but lower for
   * very large pages (the native side caps the bitmap's pixel count), so never divide by scale.
   */
  width: number;
  /** Rendered bitmap height, in px (same caveat as `width`). */
  height: number;
  /** Page width, in PDF points. */
  widthPt: number;
  /** Page height, in PDF points. */
  heightPt: number;
}

export interface DevicePdfFile {
  name: string;
  uri: string;
  sizeBytes: number;
  dateModified?: number;
  folder?: string;
  path?: string;
  pageCount?: number;
}
