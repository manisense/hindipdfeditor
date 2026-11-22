import { describe, expect, it } from 'vitest';
import type { OcrLine } from '../state/editStore';
import { fitFontSizeToLineWidth, fitToOriginalWidth, textGeometryForDetectedLine } from './detectedLineTextGeometry';

function detectedLine(overrides: Partial<OcrLine> = {}): OcrLine {
  return {
    id: 'line-1',
    text: 'धर्म',
    xPt: 40,
    yPt: 75,
    wPt: 100,
    hPt: 20,
    ...overrides,
  };
}

describe('textGeometryForDetectedLine', () => {
  it('uses an embedded PDF line font height directly and preserves its detected top', () => {
    expect(
      textGeometryForDetectedLine(detectedLine({ source: 'embedded' }), 600, 1.25),
    ).toEqual({
      xPt: 40,
      yPt: 75,
      fontSizePt: 20,
      widthPt: 125,
    });
  });

  it('uses embedded font geometry for a text-map-degraded page', () => {
    expect(
      textGeometryForDetectedLine(
        detectedLine({ source: 'embedded-degraded' }),
        600,
        1,
      ).fontSizePt,
    ).toBe(20);
  });

  it('sizes a raster OCR ink box above 1:1 so replacement text is not undersized', () => {
    const geometry = textGeometryForDetectedLine(detectedLine({ source: 'ocr' }), 600, 1.25);

    expect(geometry.fontSizePt).toBeCloseTo(21.6);
    expect(geometry.yPt).toBe(75);
  });

  it('treats a line without source metadata as OCR for backward compatibility', () => {
    expect(textGeometryForDetectedLine(detectedLine(), 600, 1).fontSizePt).toBeCloseTo(21.6);
  });

  it('keeps a noisy short OCR detection readable', () => {
    expect(
      textGeometryForDetectedLine(detectedLine({ source: 'ocr', hPt: 2 }), 600, 1)
        .fontSizePt,
    ).toBe(6);
  });

  it('clamps expanded text width and horizontal origin inside the page', () => {
    expect(
      textGeometryForDetectedLine(
        detectedLine({ source: 'embedded', xPt: 580, wPt: 100 }),
        600,
        1.85,
      ),
    ).toMatchObject({ xPt: 580, widthPt: 20 });

    expect(
      textGeometryForDetectedLine(
        detectedLine({ source: 'ocr', xPt: -10, wPt: 100 }),
        600,
        1,
      ),
    ).toMatchObject({ xPt: 0, widthPt: 100 });
  });

  it('rejects invalid page widths and width multipliers', () => {
    expect(() => textGeometryForDetectedLine(detectedLine(), 0, 1)).toThrow(RangeError);
    expect(() => textGeometryForDetectedLine(detectedLine(), 600, 0)).toThrow(RangeError);
  });
});

it('places the replacement box so its baseline lands on the detected baseline', () => {
  const line = { id: 'l', text: 'नमस्ते', xPt: 50, yPt: 100, wPt: 200, hPt: 10, source: 'embedded' as const, baselineYPt: 110 };
  // Font size 10 pt, baseline 1.3 em below the box top: top = 110 - 13.
  expect(textGeometryForDetectedLine(line, 600, 1, 1.3).yPt).toBeCloseTo(97);
  expect(textGeometryForDetectedLine(line, 600, 1).yPt).toBe(100);
});

it('keeps an exact-metric font at full size and shrinks a wider substitute within limits', () => {
  expect(fitFontSizeToLineWidth(9, 101, 100, 0.12)).toBe(9);
  expect(fitFontSizeToLineWidth(10, 115.556, 100, 0.12)).toBeCloseTo(9, 2);
  expect(fitFontSizeToLineWidth(10, 200, 100, 0.12)).toBeCloseTo(8.8);
});

describe('fitToOriginalWidth', () => {
  it('squeezes a wider replacement to the original width, keeping its size', () => {
    expect(fitToOriginalWidth(10, 110, 100, 0.12)).toEqual({ scaleX: 0.909, fontSizePt: 10 });
  });

  it('stretches a narrower one a little', () => {
    expect(fitToOriginalWidth(10, 95, 100, 0.12).scaleX).toBe(1.053);
  });

  it('shrinks the size only for what squeezing cannot cover', () => {
    const fit = fitToOriginalWidth(10, 130, 100, 0.12);
    expect(fit.scaleX).toBe(0.85);
    expect(fit.fontSizePt).toBeCloseTo(10 * (100 / 130 / 0.85), 3);
  });

  it('leaves text alone when it cannot be measured', () => {
    expect(fitToOriginalWidth(10, 0, 100, 0.12)).toEqual({ scaleX: 1, fontSizePt: 10 });
  });
});
