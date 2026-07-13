const OCR_FONT_SIZE_RATIO = 1.08;
const MIN_OCR_FONT_SIZE_PT = 6;
const DEFAULT_TEXT_WIDTH_RATIO = 0.42;
const MIN_TEXT_WIDTH_PT = 72;
const MAX_TEXT_WIDTH_PT = 240;

export type TextBoxGeometry = {
  /** Left edge in PDF points, clamped inside the page. */
  xPt: number;
  /** Stable text-box width in PDF points. */
  widthPt: number;
};

/**
 * Returns a stable text-box width and clamped horizontal origin.
 *
 * @param pageWidthPt Source page width in PDF points.
 * @param requestedXPt Requested left edge in PDF points.
 * @param preferredWidthPt Optional desired box width in PDF points.
 */
export function textBoxGeometry(
  pageWidthPt: number,
  requestedXPt: number,
  preferredWidthPt?: number,
): TextBoxGeometry {
  const preferred = Math.max(
    MIN_TEXT_WIDTH_PT,
    preferredWidthPt ?? Math.min(MAX_TEXT_WIDTH_PT, pageWidthPt * DEFAULT_TEXT_WIDTH_RATIO),
  );
  const widthPt = Math.min(preferred, Math.max(MIN_TEXT_WIDTH_PT, pageWidthPt - 8));
  const xPt = Math.min(Math.max(4, requestedXPt), Math.max(4, pageWidthPt - widthPt - 4));
  return { xPt, widthPt };
}

/**
 * Converts an OCR-detected visible glyph-box height into a replacement font size that matches
 * the source ink more closely than a sub-1:1 ratio.
 *
 * @param lineHeightPt OCR line bounding-box height in PDF points.
 */
export function fontSizeForOcrLine(lineHeightPt: number): number {
  return Math.max(MIN_OCR_FONT_SIZE_PT, lineHeightPt * OCR_FONT_SIZE_RATIO);
}
