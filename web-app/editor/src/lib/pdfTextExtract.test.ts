import { describe, expect, it } from 'vitest';

import {
  clusterRunsIntoLines,
  withUnmeasuredRunsJoined,
  withoutRepeatedRuns,
  isHorizontalTextTransform,
  isSafeEmbeddedText,
  sanitizeEmbeddedText,
  textItemWidthPt,
  type EmbeddedTextRun,
} from './pdfTextExtract';
import { CLUSTER_FILLER_MARK } from './pdfToUnicodeRepair';

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
  it('keeps runs of one baseline in one line when their fonts differ in height', () => {
    const lines = clusterRunsIntoLines([
      run('नाम', 0, 20, { yPt: 8, hPt: 14, baselineYPt: 20 }),
      run(',', 21, 3, { yPt: 12, hPt: 9, baselineYPt: 20 }),
    ]);
    expect(lines.map((line) => line.text)).toEqual(['नाम,']);
  });

  it('on a page that draws its spaces, keeps Hindi in drawing order and puts other runs by position', () => {
    // Chrome draws the Hindi runs first and the Latin comma after them; ि is drawn left of its
    // consonant, so left-to-right would read िश.
    const lines = clusterRunsIntoLines(
      [
        run('नाम', 0, 20, { order: 0 }),
        run('पता', 26, 20, { order: 1 }),
        run('शि', 50, 6, { order: 2, leadingSpace: true }),
        run(',', 20, 3, { order: 3, trailingSpace: true }),
      ],
      { spacesDrawn: true },
    );
    expect(lines.map((line) => line.text)).toEqual(['नाम, पता शि']);
  });

  it('on a page that draws its spaces, keeps a Hindi word whole across a ligature pdf.js measures too narrow', () => {
    // Chrome's Type 3 प्र glyph has almost no width in pdf.js, which leaves a 10 pt gap before बंधन.
    const lines = clusterRunsIntoLines(
      [
        run('विद्यालय प्र', 0, 50, { order: 0, hPt: 13 }),
        run('बंधन', 60.4, 25, { order: 1, hPt: 13 }),
        run('.', 96, 3, { order: 2, hPt: 13 }),
      ],
      { spacesDrawn: true },
    );
    expect(lines.map((line) => line.text)).toEqual(['विद्यालय प्रबंधन.']);
  });

  it('on a page that draws its spaces, still splits Hindi columns far apart', () => {
    const lines = clusterRunsIntoLines([run('नाम', 0, 20, { order: 0 }), run('पता', 60, 20, { order: 1 })], { spacesDrawn: true });
    expect(lines.map((line) => line.text)).toEqual(['नाम', 'पता']);
  });

  it('on a page that draws its spaces, does not break Hindi words at small gaps', () => {
    const [line] = clusterRunsIntoLines([run('शि', 0, 8, { order: 0 }), run('क्षा', 12, 12, { order: 1 })], { spacesDrawn: true });
    expect(line?.text).toBe('शिक्षा');
  });

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

  it('does not merge a later left-column run into an earlier right-column run', () => {
    const lines = clusterRunsIntoLines([
      run('$5.48', 519, 24, { yPt: 224.5, hPt: 9 }),
      run('41d8-b297-', 42, 44, { yPt: 229, hPt: 9 }),
    ]);

    expect(lines.map((line) => line.text)).toEqual(['41d8-b297-', '$5.48']);
  });

  it('splits nearby but distinct monetary columns on the same visual line', () => {
    const lines = clusterRunsIntoLines([
      run('$9.86', 482.6, 25.5),
      run('$5.48', 516.7, 26.8),
    ]);

    expect(lines.map((line) => line.text)).toEqual(['$9.86', '$5.48']);
  });
});

describe('embedded text safety and geometry', () => {
  it('keeps italic (sheared) text and rejects only rotated text', () => {
    expect(isHorizontalTextTransform([8.04, 0, 0, 8.04, 92, 649])).toBe(true);
    expect(isHorizontalTextTransform([8.04, 0, 2.68, 8.04, 92, 649])).toBe(true);
    expect(isHorizontalTextTransform([0, 8.04, -8.04, 0, 92, 649])).toBe(false);
    expect(isHorizontalTextTransform([5.69, 5.69, -5.69, 5.69, 92, 649])).toBe(false);
  });

  it('keeps PDF.js device-space width instead of multiplying by font size', () => {
    expect(textItemWidthPt(91.346, 10.995)).toBeCloseTo(91.346, 3);
    expect(textItemWidthPt(0, 10)).toBe(2);
  });

  it('identifies and strips NUL, control, and replacement characters', () => {
    expect(isSafeEmbeddedText('स्वच्छ Unicode text')).toBe(true);
    expect(isSafeEmbeddedText('म\u0000')).toBe(false);
    expect(isSafeEmbeddedText('bad\ufffdtext')).toBe(false);
    expect(isSafeEmbeddedText('\uf11c')).toBe(false);
    expect(sanitizeEmbeddedText('\u0000म\ufffd')).toEqual({
      text: 'म',
      removedCodePoints: 2,
      removedPrivateUseCodePoints: 0,
    });
    expect(sanitizeEmbeddedText('\uf11c pruninglabs.com')).toEqual({
      text: ' pruninglabs.com',
      removedCodePoints: 1,
      removedPrivateUseCodePoints: 1,
    });
    expect(isSafeEmbeddedText(`स${CLUSTER_FILLER_MARK}िंह`)).toBe(true);
    expect(sanitizeEmbeddedText(`स${CLUSTER_FILLER_MARK}िंह`)).toEqual({
      text: 'सिंह',
      removedCodePoints: 0,
      removedPrivateUseCodePoints: 0,
    });
  });
});

describe('withoutRepeatedRuns', () => {
  it('drops a run painted again at the same place (fill pass then stroke pass)', () => {
    const runs = [run('Bold', 0, 20), run('words', 23, 24), run('Bold', 0.2, 20.1), run('words', 23, 24)];
    expect(withoutRepeatedRuns(runs).map((r) => r.text)).toEqual(['Bold', 'words']);
  });

  it('keeps the same word written in two places', () => {
    const runs = [run('the', 0, 12), run('the', 40, 12), run('the', 0, 12, { yPt: 30 })];
    expect(withoutRepeatedRuns(runs)).toHaveLength(3);
  });
});

describe('withUnmeasuredRunsJoined', () => {
  const run = (text: string, xPt: number, wPt: number, unmeasured = false) => ({
    text, xPt, yPt: 10, wPt, hPt: 11, baselineYPt: 19, hasEol: false, leadingSpace: false, trailingSpace: false, unmeasured,
  });

  it('joins a zero-width Hindi run to the run drawn right after it', () => {
    const joined = withUnmeasuredRunsJoined([run('प्र', 147.43, 2.2, true), run('माण', 147.5, 18.3)]);
    expect(joined.map((r) => r.text)).toEqual(['प्रमाण']);
    expect(clusterRunsIntoLines(joined)[0].text).toBe('प्रमाण');
  });

  it('keeps runs apart when the next one starts far away or a space is drawn', () => {
    expect(withUnmeasuredRunsJoined([run('प्र', 100, 2.2, true), run('माण', 130, 18)]).length).toBe(2);
    expect(withUnmeasuredRunsJoined([{ ...run('प्र', 100, 2.2, true), trailingSpace: true }, run('माण', 100.1, 18)]).length).toBe(2);
  });

  it('keeps a run that starts with a vowel sign on the line of the word before it', () => {
    expect(clusterRunsIntoLines([run('(गैर-क्र', 295.9, 68.1), run('ीमी लेयर)', 373.2, 59.7)]).map((l) => l.text)).toEqual(['(गैर-क्रीमी लेयर)']);
  });

  it('keeps the run after a pre-base ि mark on the same line, without a space', () => {
    expect(clusterRunsIntoLines([run('में उल्लि\uE0F1', 100, 40), run('खत आरआरबी', 160, 50)]).map((l) => l.text)).toEqual(['में उल्लिखित आरआरबी']);
  });

  it('drops a space measured before a vowel sign', () => {
    expect(clusterRunsIntoLines([run('राष्ट्र', 100, 20), run('ीयता', 125, 14)])[0].text).toBe('राष्ट्रीयता');
  });
});
