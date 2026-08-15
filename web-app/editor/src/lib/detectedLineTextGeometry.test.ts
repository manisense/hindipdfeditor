import type { OcrLine } from '../state/editStore';
import { textGeometryForDetectedLine } from './detectedLineTextGeometry';

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
