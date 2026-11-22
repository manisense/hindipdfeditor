import { ptSizeToImagePx, ptToImagePx } from './coordinateMath';
import { fitFontSizeToLineWidth, textGeometryForDetectedLine } from './detectedLineTextGeometry';
import {
  availableWeights,
  baselineOffsetRatio,
  cssFontStack,
  loadFontFor,
  measureTextWidthPt,
  type EditFontFamily,
} from './fontAsset';
import { replacementFontFor } from './fontMatch';
import { readImageRegion } from './imageColor';
import { sampleTextColor } from './pdfToImages';
import { closestWeight, fauxBoldWeight, medianInkRunPx, type WeightSample } from './strokeWeight';
import type { OcrLine, PageState } from '../state/editStore';
import { cssWeight, type FontWeight } from './fontWeight';

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
    fontWeight: FontWeight;
    fontStyle?: 'italic';
    /** Faux-bold stroke of the original, as a share of the font size. */
    strokeEm?: number;
  };
};

/** Longest stretch of a line rendered per candidate weight; enough strokes to judge. */
const WEIGHT_SAMPLE_CHARS = 60;

/** Median stroke width of `text` drawn black on white at `fontPx`, in px, or null. */
async function renderedStemPx(
  text: string,
  family: string,
  weight: number,
  fontStyle: 'italic' | undefined,
  fontPx: number,
): Promise<number | null> {
  await loadFontFor(text, family, weight, fontStyle);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(measureTextWidthPt(text, family, weight, fontPx) + fontPx);
  canvas.height = Math.ceil(fontPx * 2);
  const context = canvas.getContext('2d');
  if (!context || canvas.width < 2) return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000';
  context.textBaseline = 'middle';
  context.font = `${fontStyle ?? 'normal'} ${weight} ${fontPx}px ${cssFontStack(family)}`;
  context.fillText(text, fontPx / 2, canvas.height / 2);
  return medianInkRunPx(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
}

/**
 * The weight, among those the replacement family offers, whose strokes best match the original
 * line on the page image, and for a faux-bold original (`strokeEm`) the stroke to repaint it with
 * (see {@link fauxBoldWeight}). Keeps `fallback` and the PDF's stroke when the line cannot be
 * measured, or when the family matches the original's (then the PDF's stroke is exact).
 *
 * @param fontSizePt Size the replacement will be drawn at, in pt.
 * @param strokeEm Faux-bold stroke of the original, as a share of the font size.
 */
async function matchedFace(
  page: PageState,
  line: OcrLine,
  family: string,
  fontStyle: 'italic' | undefined,
  fontSizePt: number,
  fallback: FontWeight,
  strokeEm: number | undefined,
): Promise<{ fontWeight: FontWeight; strokeEm?: number }> {
  const unmeasured = { fontWeight: fallback, ...(strokeEm ? { strokeEm } : {}) };
  // With the original face itself or a metric match, the PDF's own stroke is exact; measuring the
  // page image (2 px per pt) would only add rounding.
  if (strokeEm && line.font?.match) return unmeasured;
  try {
    const pxPerPt = page.imagePxWidth / page.widthPt;
    const band = await readImageRegion(
      page.backgroundImageUri,
      line.xPt * pxPerPt,
      line.yPt * pxPerPt,
      line.wPt * pxPerPt,
      line.hPt * pxPerPt,
    );
    const originalStem = medianInkRunPx(band.data, band.width, band.height);
    if (originalStem === null) return unmeasured;
    const sample = line.text.slice(0, WEIGHT_SAMPLE_CHARS);
    const fontPx = fontSizePt * pxPerPt;
    const samples: WeightSample[] = [];
    for (const weight of availableWeights(family)) {
      const stemPx = await renderedStemPx(sample, family, weight, fontStyle, fontPx);
      if (stemPx !== null) samples.push({ weight, stemPx });
    }
    if (strokeEm) {
      const face = fauxBoldWeight(originalStem, samples, strokeEm * fontPx);
      if (!face) return unmeasured;
      return { fontWeight: face.weight, ...(face.strokePx > 0 ? { strokeEm: face.strokePx / fontPx } : {}) };
    }
    const weight = closestWeight(originalStem, samples, cssWeight(fallback));
    return { fontWeight: weight === cssWeight(fallback) ? fallback : weight };
  } catch (error) {
    console.warn('Stroke weight matching failed; keeping the detected weight', error);
    return unmeasured;
  }
}

/**
 * Geometry and style for replacing one detected line: the original's typeface (or a metric match),
 * its stroke weight (measured on the page image), its baseline, its ink colour, and a size shrunk at most `MAX_FIT_SHRINK` when the substitute font
 * is wider. Shared by tap-to-edit and find-and-replace so both produce the same result.
 *
 * @param page Page holding the line; sizes in pt and background-image px.
 * @param line Detected line, in pt.
 */
export async function lineReplacementFor(page: PageState, line: OcrLine): Promise<LineReplacement> {
  const hinted = replacementFontFor(line.font);
  const hintedRatio = await baselineOffsetRatio(hinted.fontFamily, hinted.fontWeight, hinted.fontStyle, line.text);
  const hintedSizePt = textGeometryForDetectedLine(line, page.widthPt, EDIT_TEXT_WIDTH_SLACK_RATIO, hintedRatio).fontSizePt;
  // A faux-bold original is a face plus a stroke: it is repainted as a face plus a stroke too,
  // rather than approximated with a heavier face.
  const { strokeEm, ...face } = await matchedFace(
    page,
    line,
    hinted.fontFamily,
    hinted.fontStyle,
    hintedSizePt,
    hinted.fontWeight,
    line.font?.strokeEm,
  );
  const font = { ...hinted, ...face };
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
      ...(strokeEm ? { strokeEm } : {}),
    },
  };
}
