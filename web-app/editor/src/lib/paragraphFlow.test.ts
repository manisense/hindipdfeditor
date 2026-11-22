import { describe, expect, it } from 'vitest';

import { flowIntoParagraph, nextParagraphLine, wrappedLineCount } from './paragraphFlow';
import type { OcrLine } from '../state/editStore';

/** 1 pt per character, so widths are easy to reason about. */
const measure = (text: string) => text.length;
const line = (id: string, text: string, yPt: number, xPt = 50): OcrLine => ({
  id, text, xPt, yPt, wPt: text.length, hPt: 10, baselineYPt: yPt + 8,
});

describe('wrappedLineCount', () => {
  it('wraps greedily at word boundaries', () => {
    expect(wrappedLineCount('aaa bbb ccc', 7, measure)).toBe(2);
    expect(wrappedLineCount('aaa bbb', 7, measure)).toBe(1);
    expect(wrappedLineCount('', 7, measure)).toBe(1);
  });

  it('counts a word longer than the width as its own line', () => {
    expect(wrappedLineCount('aaaaaaaaaa b', 5, measure)).toBe(2);
  });
});

describe('nextParagraphLine', () => {
  // A 40-character column starting at x 50.
  const first = line('a', 'x'.repeat(38) + ' yy', 100);
  const second = line('b', 'next line of the same paragraph here', 114);
  const short = line('c', 'end.', 128);
  const nextParagraph = line('d', 'A new paragraph starts here and goes on', 150);

  it('finds the line directly below that continues a full line', () => {
    expect(nextParagraphLine([first, second, short], first, measure)?.id).toBe('b');
  });

  it('stops after a line that ended early (its next word would have fitted)', () => {
    expect(nextParagraphLine([first, second, short, nextParagraph], short, measure)).toBeNull();
  });

  it('ignores lines in another column, of another size, or too far below', () => {
    const indented = line('e', 'x'.repeat(30), 114, 120);
    const big = { ...line('f', 'x'.repeat(30), 114), hPt: 20 };
    const far = line('g', 'x'.repeat(30), 160);
    expect(nextParagraphLine([first, indented], first, measure)).toBeNull();
    expect(nextParagraphLine([first, big], first, measure)).toBeNull();
    expect(nextParagraphLine([first, far], first, measure)).toBeNull();
  });
});

describe('flowIntoParagraph', () => {
  const first = line('a', 'aaaa bbbb cccc dddd eeee ffff gggg hhh', 100);
  const second = line('b', 'iiii jjjj kkkk llll mmmm nnnn oooo ppp', 114);
  const third = line('c', 'qqqq rrrr.', 128);
  const lines = [second, third];

  it('does nothing while the edited text still fits its lines', () => {
    expect(flowIntoParagraph('aaaa bbbb', 50, [first], lines, measure)).toBeNull();
  });

  it('takes in the next line when the text no longer fits, joining its words on', () => {
    const closing = line('b2', 'iiii jjjj.', 114);
    const flow = flowIntoParagraph(`${first.text} zzzz`, 50, [first], [closing], measure);
    expect(flow?.absorbed.map((l) => l.id)).toEqual(['b2']);
    expect(flow?.text).toBe(`${first.text} zzzz iiii jjjj.`);
    // The column, plus the 3 % overflow allowed before a line flows on.
    expect(flow?.widthPt).toBeCloseTo(38 * 1.03);
    expect(flow?.lineHeightPt).toBe(14);
    // Cleared area: from the first line's top padding to the last taken line's bottom.
    expect(flow?.rect).toEqual({ xPt: 50, yPt: 96.5, wPt: 38, hPt: 27.5 });
  });

  it('keeps taking lines while the text overflows, and stops at the paragraph end', () => {
    const long = `${first.text} ${'z'.repeat(36)} ${'y'.repeat(36)} ${'w'.repeat(36)}`;
    const flow = flowIntoParagraph(long, 50, [first], lines, measure);
    expect(flow?.absorbed.map((l) => l.id)).toEqual(['b', 'c']);
  });
});

describe('paragraph lines read by OCR', () => {
  const first = line('a', 'aaaa bbbb cccc dddd eeee ffff gggg hhh', 100);

  it('accepts a next line whose detected left edge is off by most of a line height', () => {
    const next = line('b', 'iiii jjjj.', 114, 42);
    expect(nextParagraphLine([first, next], first, measure)?.id).toBe('b');
  });

  it('takes every box on the next row together, in reading order', () => {
    const left = line('b', 'iiii jjjj', 114);
    const right = line('c', 'kkkk.', 114, 61);
    const flow = flowIntoParagraph(`${first.text} zzzz`, 50, [first], [right, left], measure);
    expect(flow?.absorbed.map((l) => l.id)).toEqual(['b', 'c']);
    expect(flow?.text).toBe(`${first.text} zzzz iiii jjjj kkkk.`);
  });

  it('does not treat a box on the same row as the next line', () => {
    const sameRow = line('s', 'tail', 101, 90);
    expect(nextParagraphLine([first, sameRow], first, measure)).toBeNull();
  });
});

describe('flowIntoParagraph with a wider replacement font', () => {
  const first = line('a', 'aaaa bbbb cccc dddd eeee ffff gggg hhh', 100);
  const next = line('b', 'iiii jjjj.', 114);
  const wider = (text: string) => text.length * 1.1;

  it('does not flow when the text only measures wider because of the font', () => {
    expect(flowIntoParagraph(first.text.replace('hhh', 'hhx'), 50, [first], [next], wider)).toBeNull();
  });

  it('flows on real growth, with a wrap width that wraps the font as measured', () => {
    const flow = flowIntoParagraph(`${first.text} zzzz`, 50, [first], [next], wider);
    expect(flow?.absorbed.map((l) => l.id)).toEqual(['b']);
    expect(flow?.widthPt).toBeCloseTo(38 * 1.1 * 1.03);
  });
});
