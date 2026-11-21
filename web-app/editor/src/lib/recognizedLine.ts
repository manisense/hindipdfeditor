/** OCR engine output in background-image pixel space — shared contract for Tesseract and Gemini. */
export type RecognizedLine = {
  text: string;
  /** Left edge, in background-image px. */
  x: number;
  /** Top edge, in background-image px. */
  y: number;
  /** Width, in background-image px. */
  width: number;
  /** Height, in background-image px. */
  height: number;
  /** Engine confidence, 0–100, when the engine reports one (Tesseract does). */
  confidence?: number;
};
