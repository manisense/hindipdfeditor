/** Script model to run OCR with. Each maps to a separate bundled ML Kit model on Android;
 * Devanagari's model also recognizes embedded Latin text, but with weaker accuracy than the
 * dedicated Latin model, which is why callers run both and merge (see `mergeOcrLines.ts`). */
export type OcrScript = 'latin' | 'devanagari';

export interface RecognizedLine {
  text: string;
  /** Left edge of the line's bounding box, in input-image px. */
  x: number;
  /** Top edge of the line's bounding box, in input-image px. */
  y: number;
  /** Bounding box width, in input-image px. */
  width: number;
  /** Bounding box height, in input-image px. */
  height: number;
}
