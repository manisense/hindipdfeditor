import type { OcrLine } from '../state/editStore';
import {
  fitFontSizeToMeasuredWidth,
  geometryForTranslatedLine,
} from './translateEdits';

function detectedLine(source: OcrLine['source']): OcrLine {
  return {
    id: 'line-1',
    text: 'आवेदन पत्र',
    xPt: 570,
    yPt: 80,
    wPt: 50,
    hPt: 20,
    source,
  };
}

describe('geometryForTranslatedLine', () => {
  it('uses shared source-aware text geometry without a baseline nudge', () => {
    const embedded = geometryForTranslatedLine(detectedLine('embedded'), 600, 800);
    const ocr = geometryForTranslatedLine(detectedLine('ocr'), 600, 800);

    expect(embedded.text).toEqual({
      xPt: 570,
      yPt: 80,
      fontSizePt: 20,
      widthPt: 30,
      fontWeight: 'normal',
    });
    expect(ocr.text.yPt).toBe(80);
    expect(ocr.text.fontSizePt).toBeCloseTo(21.6);
    expect(ocr.text.widthPt).toBe(30);
  });

  it('shrinks an expanded translation to its measured single-line width', () => {
    expect(fitFontSizeToMeasuredWidth(20, 100, 200)).toBeCloseTo(9.259, 3);
    expect(fitFontSizeToMeasuredWidth(20, 100, 50)).toBe(20);
    expect(fitFontSizeToMeasuredWidth(20, 10, 1_000)).toBe(6);
  });
});
