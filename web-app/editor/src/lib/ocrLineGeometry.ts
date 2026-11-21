/** A Tesseract bounding box in background-image px. */
export type PxBBox = { x0: number; y0: number; x1: number; y1: number };

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
}

/**
 * The vertical text band of an OCR line: median word top and median word height, keeping the
 * line's horizontal extent. Tesseract line boxes run about 1.25× the font size and stretch to
 * twice that when a row number or table border joins the line; the median word is unaffected,
 * so replacement text sized from it matches the original. Falls back to the line box when the
 * line has no words.
 *
 * @param line Line box, in background-image px.
 * @param words Word boxes on that line, in background-image px.
 */
export function textBandOfLine(line: PxBBox, words: readonly PxBBox[]): PxBBox {
  if (words.length === 0) return line;
  const y0 = median(words.map((word) => word.y0));
  const height = median(words.map((word) => word.y1 - word.y0));
  return { x0: line.x0, y0, x1: line.x1, y1: y0 + height };
}
