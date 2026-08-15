import { describe, expect, it } from 'vitest';

import {
  clusterRunsIntoLines,
  isSafeEmbeddedText,
  sanitizeEmbeddedText,
  textItemWidthPt,
  type EmbeddedTextRun,
} from './pdfTextExtract';

function run(
  text: string,
  xPt: number,
  wPt: number,
  overrides: Partial<EmbeddedTextRun> = {},
): EmbeddedTextRun {
  return {
    text,
    xPt,
    yPt: 10,
    wPt,
    hPt: 10,
    hasEol: false,
    leadingSpace: false,
    trailingSpace: false,
    ...overrides,
  };
}

describe('clusterRunsIntoLines', () => {
  it('joins adjacent glyph fragments without inventing spaces', () => {
    const [line] = clusterRunsIntoLines([run('fi', 0, 6), run('xed', 6, 15)]);
    expect(line?.text).toBe('fixed');
    expect(line?.wPt).toBe(21);
  });

  it('inserts one space for a real geometric word gap', () => {
    const [line] = clusterRunsIntoLines([run('hello', 0, 20), run('world', 23, 24)]);
    expect(line?.text).toBe('hello world');
  });

  it('keeps separate columns and explicit end-of-line runs separate', () => {
    const columns = clusterRunsIntoLines([run('left', 0, 20), run('right', 80, 25)]);
    expect(columns.map((line) => line.text)).toEqual(['left', 'right']);

    const explicitBreak = clusterRunsIntoLines([
      run('first', 0, 20, { hasEol: true }),
      run('second', 22, 30),
    ]);
    expect(explicitBreak.map((line) => line.text)).toEqual(['first', 'second']);
  });
});

describe('embedded text safety and geometry', () => {
  it('keeps PDF.js device-space width instead of multiplying by font size', () => {
    expect(textItemWidthPt(91.346, 10.995)).toBeCloseTo(91.346, 3);
    expect(textItemWidthPt(0, 10)).toBe(2);
  });

  it('identifies and strips NUL, control, and replacement characters', () => {
    expect(isSafeEmbeddedText('स्वच्छ Unicode text')).toBe(true);
    expect(isSafeEmbeddedText('म\u0000')).toBe(false);
    expect(isSafeEmbeddedText('bad\ufffdtext')).toBe(false);
    expect(sanitizeEmbeddedText('\u0000म\ufffd')).toEqual({
      text: 'म',
      removedCodePoints: 2,
    });
  });
});
