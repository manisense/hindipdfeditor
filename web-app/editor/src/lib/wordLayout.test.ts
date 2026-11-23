import { describe, expect, it } from 'vitest';

import { paragraphsFromLines } from './wordLayout';
import type { OcrLine } from '../state/editStore';

const line = (text: string, xPt: number, yPt: number, wPt: number, hPt = 12, bold = false): OcrLine => ({
  id: text, text, xPt, yPt, wPt, hPt, baselineYPt: yPt + hPt * 0.8, font: { serif: false, bold, italic: false },
});

describe('paragraphsFromLines', () => {
  it('joins the lines of one paragraph and starts a new one after a gap', () => {
    const paragraphs = paragraphsFromLines(
      [
        line('पहली पंक्ति जो पूरी चौड़ाई', 72, 100, 450),
        line('तक जाती है।', 72, 116, 120),
        line('नया अनुच्छेद', 72, 160, 140),
      ],
      600,
    );
    expect(paragraphs.map((p) => p.text)).toEqual(['पहली पंक्ति जो पूरी चौड़ाई तक जाती है।', 'नया अनुच्छेद']);
    expect(paragraphs[1].spaceBeforePt).toBeGreaterThan(10);
  });

  it('keeps headings separate, with their size and weight', () => {
    const [heading, body] = paragraphsFromLines([line('Title', 72, 60, 120, 24, true), line('Body text', 72, 100, 300)], 600);
    expect(heading).toMatchObject({ text: 'Title', bold: true });
    expect(heading.fontSizePt).toBeGreaterThan(body.fontSizePt);
  });

  it('centres a short line in the middle of the page', () => {
    const [centred] = paragraphsFromLines([line('शीर्षक', 250, 60, 100)], 600);
    expect(centred.align).toBe('center');
  });

  it('reads lines top to bottom, left to right', () => {
    const paragraphs = paragraphsFromLines([line('दूसरी', 72, 200, 100), line('पहली', 72, 100, 100)], 600);
    expect(paragraphs.map((p) => p.text)).toEqual(['पहली', 'दूसरी']);
  });
});

describe('paragraphsFromLines with a row split into pieces', () => {
  it('joins pieces of one visual row, left to right, before grouping', () => {
    const paragraphs = paragraphsFromLines([line('conjunct + े', 300, 100, 200), line('धर्म → reph', 72, 101, 200)], 600);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].text).toBe('धर्म → reph conjunct + े');
  });
});
