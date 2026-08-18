/** A `file://` URI to a PDF, or a `content://` URI as returned by expo-document-picker on Android. */
export type PdfUri = string;

export interface PageImageResult {
  /** `file://` URI to the rendered JPEG, in the app's cache directory. */
  uri: string;
  /** Rendered bitmap width, in px. */
  width: number;
  /** Rendered bitmap height, in px. */
  height: number;
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
