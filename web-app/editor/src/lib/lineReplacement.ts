import { ptSizeToImagePx, ptToImagePx } from './coordinateMath';
import { fitFontSizeToLineWidth, textGeometryForDetectedLine } from './detectedLineTextGeometry';
import { baselineOffsetRatio, measureTextWidthPt, type EditFontFamily } from './fontAsset';
import { replacementFontFor } from './fontMatch';
import { sampleTextColor } from './pdfToImages';
import type { OcrLine, PageState } from '../state/editStore';

/** Editable width as a multiple of the detected line width, so a slightly longer edit does not wrap. */
const EDIT_TEXT_WIDTH_SLACK_RATIO = 1.25;
/** Extra height above a detected line covered by its mask, for matras above the headline. */
const MASK_PAD_TOP_RATIO = 0.35;
/** Largest share by which unchanged replacement text is shrunk to fit the original width. */
const MAX_FIT_SHRINK = 0.12;

export type LineReplacement = {
  /** Area that the replacement clears, in pt (editor space). */
  rect: { xPt: number; yPt: number; wPt: number; hPt: number };
  /** Text box geometry and style, in pt, matching the original line. */
  text: {
    xPt: number;
    yPt: number;
    fontSizePt: number;
    widthPt: number;
    color: string;
    fontFamily: EditFontFamily;
    fontWeight: 'normal' | 'bold';
    fontStyle?: 'italic';
  };
};

/**
 * Geometry and style for replacing one detected line: the original's typeface (or a metric match),
 * its baseline, its ink colour, and a size shrunk at most `MAX_FIT_SHRINK` when the substitute font
 * is wider. Shared by tap-to-edit and find-and-replace so both produce the same result.
 *
 * @param page Page holding the line; sizes in pt and background-image px.
 * @param line Detected line, in pt.
 */
export async function lineReplacementFor(page: PageState, line: OcrLine): Promise<LineReplacement> {
  const font = replacementFontFor(line.font);
  const ratio = await baselineOffsetRatio(font.fontFamily, font.fontWeight, font.fontStyle, line.text);
  const detected = textGeometryForDetectedLine(line, page.widthPt, EDIT_TEXT_WIDTH_SLACK_RATIO, ratio);
  const fittedSizePt = fitFontSizeToLineWidth(
    detected.fontSizePt,
    measureTextWidthPt(line.text, font.fontFamily, font.fontWeight, detected.fontSizePt),
    line.wPt,
    MAX_FIT_SHRINK,
  );
  const geometry =
    fittedSizePt < detected.fontSizePt
      ? textGeometryForDetectedLine(
          { ...line, hPt: line.hPt * (fittedSizePt / detected.fontSizePt) },
          page.widthPt,
          EDIT_TEXT_WIDTH_SLACK_RATIO,
          ratio,
        )
      : detected;

  const { x, y } = ptToImagePx(line.xPt, line.yPt, page.imagePxWidth, page.widthPt);
  const { wPx, hPx } = ptSizeToImagePx(line.wPt, line.hPt, page.imagePxWidth, page.widthPt);
  let color = '#111111';
  try {
    color = await sampleTextColor(page.backgroundImageUri, Math.round(x), Math.round(y), Math.round(wPx), Math.round(hPx));
  } catch (error) {
    console.warn('sampleTextColor failed, falling back to black', error);
  }

  const padTop = line.hPt * MASK_PAD_TOP_RATIO;
  return {
    rect: { xPt: line.xPt, yPt: line.yPt - padTop, wPt: line.wPt, hPt: line.hPt + padTop },
    text: {
      xPt: geometry.xPt,
      yPt: geometry.yPt,
      fontSizePt: geometry.fontSizePt,
      widthPt: geometry.widthPt,
      color,
      ...font,
    },
  };
}
