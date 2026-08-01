import type { OcrLine } from '../state/editStore';
import { fontSizeForOcrLine, textBoxGeometry } from './textEditGeometry';

const MASK_EXPAND_PT = 3;
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

export type SuccessfulTranslation = { line: OcrLine; translated: string };

/**
 * Pairs OCR source lines (whose boxes are stored in PDF points) with non-empty translated text.
 * Failed/skipped/missing results stay tappable and must not be consumed from page OCR state.
 */
export function successfulTranslations(
  sourceLines: OcrLine[],
  translatedById: ReadonlyMap<string, string>,
): SuccessfulTranslation[] {
  return sourceLines.flatMap((line) => {
    const translated = translatedById.get(line.id)?.trim();
    return translated ? [{ line, translated }] : [];
  });
}

/**
 * Computes mask + English overlay geometry for one detected Hindi line, in PDF points.
 * Matches the OCR tap-to-edit padding used by the editor so export alignment stays consistent.
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
  const fontSizePt = fontSizeForOcrLine(line.hPt);
  const padTop = line.hPt * OCR_MASK_PAD_TOP_RATIO;
  const requestedTextY = line.yPt + line.hPt * OCR_TEXT_BASELINE_NUDGE_RATIO;
  const textY = Math.min(Math.max(0, requestedTextY), Math.max(0, pageHeightPt - fontSizePt * 1.6));
  const textGeometry = textBoxGeometry(
    pageWidthPt,
    line.xPt,
    line.wPt * OCR_TEXT_WIDTH_SLACK_RATIO,
  );

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
      xPt: textGeometry.xPt,
      yPt: textY,
      fontSizePt,
      widthPt: textGeometry.widthPt,
      fontWeight: fontSizePt >= 13 ? 'bold' : 'normal',
    },
  };
}
