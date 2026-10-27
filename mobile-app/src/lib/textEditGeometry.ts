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

/** Extra cover above the OCR box, as a share of its height, for matras and reph. */
const OCR_MASK_PAD_TOP_RATIO = 0.35;
/** Extra cover on each side of the OCR box, as a share of its height. */
const OCR_MASK_PAD_SIDE_RATIO = 0.05;

export type MaskRect = { xPt: number; yPt: number; wPt: number; hPt: number };

/**
 * Returns the rectangle that hides an OCR-detected word, sized to that word only, so
 * neighbouring words stay visible. Pads the top for matras and reph above the headline.
 *
 * @param pageWidthPt Page width in PDF points.
 * @param pageHeightPt Page height in PDF points.
 * @param box OCR box (x, y, width, height) in PDF points.
 */
export function ocrMaskRect(pageWidthPt: number, pageHeightPt: number, box: MaskRect): MaskRect {
  const topPadPt = box.hPt * OCR_MASK_PAD_TOP_RATIO;
  const sidePadPt = box.hPt * OCR_MASK_PAD_SIDE_RATIO;
  const xPt = Math.max(0, box.xPt - sidePadPt);
  const yPt = Math.max(0, box.yPt - topPadPt);
  const wPt = Math.min(pageWidthPt - xPt, box.wPt + 2 * sidePadPt);
  const hPt = Math.min(pageHeightPt - yPt, box.hPt + topPadPt);
  return { xPt, yPt, wPt, hPt };
}
