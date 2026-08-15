import type { OcrLine } from '../state/editStore';
import { textGeometryForDetectedLine } from './detectedLineTextGeometry';

const MASK_EXPAND_PT = 3;
const OCR_MASK_PAD_TOP_RATIO = 0.35;
const TRANSLATED_TEXT_WIDTH_SLACK_RATIO = 1.85;
const MIN_TRANSLATED_FONT_SIZE_PT = 6;
const TEXT_MEASUREMENT_SAFETY_RATIO = 1.08;

export type TranslationGeometry = {
  mask: { xPt: number; yPt: number; wPt: number; hPt: number };
  text: {
    xPt: number;
    yPt: number;
    fontSizePt: number;
    widthPt: number;
    fontWeight: 'normal' | 'bold';
  };
};

/** Shrinks a translated line to its available single-line width, never enlarging it. */
export function fitFontSizeToMeasuredWidth(
  baseFontSizePt: number,
  availableWidthPt: number,
  measuredWidthAtBaseSizePt: number,
): number {
  if (
    !Number.isFinite(measuredWidthAtBaseSizePt) ||
    measuredWidthAtBaseSizePt <= 0 ||
    availableWidthPt <= 0
  ) {
    return baseFontSizePt;
  }
  const scale = Math.min(
    1,
    availableWidthPt /
      (measuredWidthAtBaseSizePt * TEXT_MEASUREMENT_SAFETY_RATIO),
  );
  return Math.max(MIN_TRANSLATED_FONT_SIZE_PT, baseFontSizePt * scale);
}

function measuredTextWidthPt(text: string, fontSizePt: number): number {
  if (typeof document === 'undefined') return 0;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return 0;
  context.font = `400 ${fontSizePt}px 'NotoSansDevanagari', system-ui, sans-serif`;
  return context.measureText(text).width;
}

/**
 * Computes mask + translated-text overlay geometry for one detected source line, in PDF points.
 * Matches the OCR tap-to-edit padding used by Edit PDF so export alignment stays consistent.
 * Width slack is wider than edit-mode (1.85×) because translated output often expands.
 * When target text is provided, its shaped width is measured and its font is reduced enough
 * to remain on one line where possible, avoiding hidden wraps or overlap with the next line.
 *
 * @param line Detected line box, in PDF points.
 * @param pageWidthPt Page width, in PDF points.
 * @param pageHeightPt Page height, in PDF points.
 * @param targetText Translated target text to fit, or omitted for source-only geometry checks.
 */
export function geometryForTranslatedLine(
  line: OcrLine,
  pageWidthPt: number,
  pageHeightPt: number,
  targetText?: string,
): TranslationGeometry {
  const textGeometry = textGeometryForDetectedLine(
    line,
    pageWidthPt,
    TRANSLATED_TEXT_WIDTH_SLACK_RATIO,
  );
  const padTop = line.hPt * OCR_MASK_PAD_TOP_RATIO;

  const raw = {
    xPt: line.xPt,
    yPt: line.yPt - padTop,
    wPt: line.wPt,
    hPt: line.hPt + padTop,
  };
  const xPt = Math.max(0, raw.xPt - MASK_EXPAND_PT);
  const yPt = Math.max(0, raw.yPt - MASK_EXPAND_PT);
  const wPt = Math.min(pageWidthPt, raw.xPt + raw.wPt + MASK_EXPAND_PT) - xPt;
  const hPt = Math.min(pageHeightPt, raw.yPt + raw.hPt + MASK_EXPAND_PT) - yPt;
  const fittedFontSizePt = targetText
    ? fitFontSizeToMeasuredWidth(
        textGeometry.fontSizePt,
        textGeometry.widthPt,
        measuredTextWidthPt(targetText, textGeometry.fontSizePt),
      )
    : textGeometry.fontSizePt;

  return {
    mask: { xPt, yPt, wPt, hPt },
    text: {
      ...textGeometry,
      fontSizePt: fittedFontSizePt,
      // Prefer normal weight for translated body text (size-based bold was a false heuristic).
      fontWeight: 'normal',
    },
  };
}
