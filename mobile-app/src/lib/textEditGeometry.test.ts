import { fontSizeForOcrLine, textBoxGeometry } from './textEditGeometry';

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

  it('keeps the minimum inset at the left edge', () => {
    expect(textBoxGeometry(600, -20, 120)).toEqual({ xPt: 4, widthPt: 120 });
  });
});

describe('fontSizeForOcrLine', () => {
  it('does not create the consistently undersized replacement produced by a sub-1 ratio', () => {
    expect(fontSizeForOcrLine(20)).toBeCloseTo(21.6);
  });

  it('keeps noisy short detections readable', () => {
    expect(fontSizeForOcrLine(2)).toBe(6);
  });
});
