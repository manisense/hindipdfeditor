import type { OcrLine } from '../state/editStore';

const EMBEDDED_FONT_HEIGHT_RATIO = 1;
const OCR_INK_HEIGHT_TO_FONT_SIZE_RATIO = 1.08;
const MIN_DETECTED_LINE_FONT_SIZE_PT = 6;

export type DetectedLineTextGeometry = {
  /** Left edge of the editable text box, in PDF points. */
  xPt: number;
  /** Top edge of the editable text box, in PDF points. */
  yPt: number;
  /** Replacement font size, in PDF points. */
  fontSizePt: number;
  /** Editable text-box width, in PDF points and clamped to the page. */
  widthPt: number;
};

/**
 * Converts one detected source-line box into replacement-text geometry.
 *
 * Embedded PDF lines report the extracted font height, so that height is already the most
 * faithful font size. Raster OCR reports a tighter visible-ink box; its replacement needs a
 * slightly larger font size to avoid the consistently undersized result from a sub-1 ratio.
 * Lines without source metadata are treated as OCR for backward compatibility and safer sizing.
 *
 * @param line Detected line whose position and size are in PDF points.
 * @param pageWidthPt Source page width, in PDF points.
 * @param widthSlackRatio Unitless multiplier applied to the detected line width before clamping.
 */
export function textGeometryForDetectedLine(
  line: OcrLine,
  pageWidthPt: number,
  widthSlackRatio: number,
): DetectedLineTextGeometry {
  if (!Number.isFinite(pageWidthPt) || pageWidthPt <= 0) {
    throw new RangeError('pageWidthPt must be a positive finite number');
  }
  if (!Number.isFinite(widthSlackRatio) || widthSlackRatio <= 0) {
    throw new RangeError('widthSlackRatio must be a positive finite number');
  }

  const detectedHeightPt =
    Number.isFinite(line.hPt) && line.hPt > 0 ? line.hPt : MIN_DETECTED_LINE_FONT_SIZE_PT;
  const fontSizeRatio =
    line.source === 'embedded' || line.source === 'embedded-degraded'
      ? EMBEDDED_FONT_HEIGHT_RATIO
      : OCR_INK_HEIGHT_TO_FONT_SIZE_RATIO;
  const fontSizePt = Math.max(
    MIN_DETECTED_LINE_FONT_SIZE_PT,
    detectedHeightPt * fontSizeRatio,
  );

  const requestedXPt = Number.isFinite(line.xPt) ? line.xPt : 0;
  const xPt = Math.min(pageWidthPt, Math.max(0, requestedXPt));
  const detectedWidthPt = Number.isFinite(line.wPt) ? Math.max(0, line.wPt) : 0;
  const widthPt = Math.min(pageWidthPt - xPt, detectedWidthPt * widthSlackRatio);
  const yPt = Number.isFinite(line.yPt) ? line.yPt : 0;

  return { xPt, yPt, fontSizePt, widthPt };
}
