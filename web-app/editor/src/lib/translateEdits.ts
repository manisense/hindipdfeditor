import type { OcrLine } from '../state/editStore';

const MASK_EXPAND_PT = 3;
const OCR_FONT_SIZE_RATIO = 0.82;
const MIN_OCR_FONT_SIZE_PT = 6;
const OCR_MASK_PAD_TOP_RATIO = 0.35;
const OCR_TEXT_WIDTH_SLACK_RATIO = 1.25;
const OCR_TEXT_BASELINE_NUDGE_RATIO = 0.06;

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

/**
 * Computes mask + English overlay geometry for one detected Hindi line, in PDF points.
 * Matches the OCR tap-to-edit padding used by Edit PDF so export alignment stays consistent.
 *
 * @param line Detected line box, in PDF points.
 * @param pageWidthPt Page width, in PDF points.
 * @param pageHeightPt Page height, in PDF points.
 */
export function geometryForTranslatedLine(
  line: OcrLine,
  pageWidthPt: number,
  pageHeightPt: number,
): TranslationGeometry {
  const fontSizePt = Math.max(MIN_OCR_FONT_SIZE_PT, line.hPt * OCR_FONT_SIZE_RATIO);
  const padTop = line.hPt * OCR_MASK_PAD_TOP_RATIO;
  const textY = line.yPt + line.hPt * OCR_TEXT_BASELINE_NUDGE_RATIO;

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

  return {
    mask: { xPt, yPt, wPt, hPt },
    text: {
      xPt: line.xPt,
      yPt: textY,
      fontSizePt,
      widthPt: line.wPt * OCR_TEXT_WIDTH_SLACK_RATIO,
      fontWeight: fontSizePt >= 13 ? 'bold' : 'normal',
    },
  };
}
