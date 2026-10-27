import {
  fontSizeForOcrLine,
  ocrMaskRect,
  textBoxGeometry,
  textTopForOcrLine,
} from './textEditGeometry';

describe('textBoxGeometry', () => {
  it('uses a stable proportional width for a normal page', () => {
    expect(textBoxGeometry(600, 100)).toEqual({ xPt: 100, widthPt: 240 });
  });

  it('keeps a new box inside the right page edge', () => {
    expect(textBoxGeometry(600, 580)).toEqual({ xPt: 356, widthPt: 240 });
  });

  it('honors an OCR or mask-derived preferred width', () => {
    expect(textBoxGeometry(600, 40, 180)).toEqual({ xPt: 40, widthPt: 180 });
  });

  it('keeps a narrow OCR fragment wide enough to edit without per-character wrapping', () => {
    expect(textBoxGeometry(600, 40, 28)).toEqual({ xPt: 40, widthPt: 72 });
  });

  it('keeps the minimum inset at the left edge', () => {
    expect(textBoxGeometry(600, -20, 120)).toEqual({ xPt: 4, widthPt: 120 });
  });
});

describe('fontSizeForOcrLine', () => {
  it('matches the source size for a Devanagari word box', () => {
    // Device measurement: a 28pt Noto Sans Devanagari word in fixtures/devanagari-fixture.pdf
    // gives an ML Kit word box about 30.6pt tall (matras above and below the headline).
    expect(fontSizeForOcrLine(30.6)).toBeCloseTo(28, 0);
  });

  it('keeps noisy short detections readable', () => {
    expect(fontSizeForOcrLine(2)).toBe(6);
  });
});

describe('ocrMaskRect', () => {
  it('covers only the detected word, not a minimum-width box', () => {
    // A short word (25 pt wide) must not grow to cover its neighbours.
    const rect = ocrMaskRect(612, 792, { xPt: 100, yPt: 200, wPt: 25, hPt: 20 });
    expect(rect.xPt).toBeCloseTo(99);
    expect(rect.wPt).toBeCloseTo(27);
    expect(rect.yPt).toBeCloseTo(193);
    expect(rect.hPt).toBeCloseTo(27);
  });

  it('stays inside the page', () => {
    const rect = ocrMaskRect(612, 792, { xPt: 0, yPt: 0, wPt: 620, hPt: 10 });
    expect(rect.xPt).toBe(0);
    expect(rect.yPt).toBe(0);
    expect(rect.xPt + rect.wPt).toBeLessThanOrEqual(612);
    expect(rect.yPt + rect.hPt).toBeLessThanOrEqual(792);
  });
});

describe('textTopForOcrLine', () => {
  it('puts the replacement on the original line', () => {
    // Device measurement: with the text box at the OCR top, a 28pt word drew 6.3pt too high.
    expect(textTopForOcrLine(167.7, 28)).toBeCloseTo(174, 0);
  });
});
