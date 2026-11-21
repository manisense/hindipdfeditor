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
 * When the line reports its baseline and the caller knows where the replacement font's baseline
 * sits inside its text box, the box is placed so both baselines coincide; otherwise the box top
 * is the detected top.
 *
 * @param line Detected line whose position and size are in PDF points.
 * @param pageWidthPt Source page width, in PDF points.
 * @param widthSlackRatio Unitless multiplier applied to the detected line width before clamping.
 * @param baselineOffsetRatio Distance from the replacement text box top to its baseline, as a
 *   fraction of the font size (unitless), measured in the browser for the chosen font.
 */
export function textGeometryForDetectedLine(
  line: OcrLine,
  pageWidthPt: number,
  widthSlackRatio: number,
  baselineOffsetRatio?: number,
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
  const yPt =
    line.baselineYPt !== undefined &&
    Number.isFinite(line.baselineYPt) &&
    baselineOffsetRatio !== undefined &&
    Number.isFinite(baselineOffsetRatio)
      ? line.baselineYPt - baselineOffsetRatio * fontSizePt
      : Number.isFinite(line.yPt)
        ? line.yPt
        : 0;

  return { xPt, yPt, fontSizePt, widthPt };
}

/** Measured text may exceed the detected width by this much before it is shrunk: OCR widths
 * cover ink only and omit side bearings, so an exact-metric font measures a few percent wider. */
const FIT_WIDTH_TOLERANCE = 1.04;

/**
 * Font size at which unchanged replacement text fits the original line width, never larger than
 * `fontSizePt` and never smaller than `(1 - maxShrink)` of it.
 *
 * @param fontSizePt Detected font size, in pt.
 * @param measuredWidthPt Width of the text set at `fontSizePt` in the replacement font, in pt.
 * @param availableWidthPt Width of the original line, in pt.
 * @param maxShrink Largest allowed reduction, as a fraction (unitless).
 */
export function fitFontSizeToLineWidth(
  fontSizePt: number,
  measuredWidthPt: number,
  availableWidthPt: number,
  maxShrink: number,
): number {
  if (!(measuredWidthPt > 0) || !(availableWidthPt > 0)) return fontSizePt;
  const scale = Math.min(1, (availableWidthPt * FIT_WIDTH_TOLERANCE) / measuredWidthPt);
  return fontSizePt * Math.max(1 - maxShrink, scale);
}
