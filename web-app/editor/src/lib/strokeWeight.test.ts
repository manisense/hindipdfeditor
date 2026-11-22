import { describe, expect, it } from 'vitest';

import { closestWeight, fauxBoldWeight, medianInkRunPx } from './strokeWeight';

/** White band with vertical black stems `stem` px wide, every 10 px. */
function stems(stem: number, width = 200, height = 20): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 4; y < height - 4; y++) {
    for (let x = 0; x < width; x++) {
      if (x % 10 < stem) rgba.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
    }
  }
  return rgba;
}

describe('medianInkRunPx', () => {
  it('measures stem width', () => {
    expect(medianInkRunPx(stems(2), 200, 20)).toBe(2);
    expect(medianInkRunPx(stems(4), 200, 20)).toBe(4);
  });

  it('counts a half-covered edge pixel as half a pixel', () => {
    const rgba = stems(2);
    for (let y = 4; y < 16; y++) for (let x = 2; x < 200; x += 10) rgba.fill(128, (y * 200 + x) * 4, (y * 200 + x) * 4 + 3);
    expect(medianInkRunPx(rgba, 200, 20)).toBeCloseTo(2.5, 1);
  });

  it('gives up on a blank band', () => {
    expect(medianInkRunPx(new Uint8ClampedArray(200 * 20 * 4).fill(255), 200, 20)).toBeNull();
  });
});

describe('closestWeight', () => {
  const samples = [
    { weight: 300, stemPx: 2 },
    { weight: 400, stemPx: 2.6 },
    { weight: 700, stemPx: 4 },
  ];

  it('picks a lighter weight for thin originals', () => {
    expect(closestWeight(2.05, samples, 400)).toBe(300);
  });

  it('picks bold for heavy originals', () => {
    expect(closestWeight(3.9, samples, 400)).toBe(700);
  });

  it('keeps the current weight when it is close enough', () => {
    expect(closestWeight(2.4, samples, 400)).toBe(400);
  });
});

describe('fauxBoldWeight', () => {
  const samples = [
    { weight: 300, stemPx: 3 },
    { weight: 400, stemPx: 4 },
    { weight: 700, stemPx: 6 },
  ];

  it('keeps the face whose stems plus the PDF stroke make the original stem', () => {
    // Original 5 px = 400 (4 px) + the 1 px stroke the PDF used.
    expect(fauxBoldWeight(5, samples, 1)).toEqual({ weight: 400, strokePx: 1 });
  });

  it('sets the stroke to make up the exact difference when the face is heavier than the original', () => {
    // A heavier replacement face: 400 + 1 px would be 5 px, the original is 4.5 px.
    expect(fauxBoldWeight(4.5, samples, 1)).toEqual({ weight: 400, strokePx: 0.5 });
  });

  it('never strokes a face that is already heavier than the original', () => {
    expect(fauxBoldWeight(2.5, samples, 1)).toEqual({ weight: 300, strokePx: 0 });
  });
});
