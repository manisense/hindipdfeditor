import { describe, expect, it } from 'vitest';

import { strokeEmPerItem, strokeRunsFromOperators, type TextOps } from './textStroke';

const OPS: TextOps = {
  save: 10, restore: 11, setTextRenderingMode: 20, setLineWidth: 21, setFont: 22, setTextMatrix: 23,
  showText: 24, setGState: 25,
};
const glyphs = (text: string) => [...text].map((unicode) => ({ unicode }));

describe('strokeRunsFromOperators', () => {
  it('reports the stroke of fill-and-stroke text as a share of the font size', () => {
    const fn = [OPS.save, OPS.setTextRenderingMode, OPS.setLineWidth, OPS.setFont, OPS.setTextMatrix, OPS.showText, OPS.restore, OPS.setFont, OPS.showText];
    const args = [null, [2], [0.4], ['f1', 16], [[1, 0, 0, 1, 60, 700]], [glyphs('Bold')], null, ['f1', 16], [glyphs('Plain')]];
    expect(strokeRunsFromOperators(fn, args, OPS)).toEqual([
      { text: 'Bold', strokeEm: 0.025 },
      { text: 'Plain', strokeEm: 0 },
    ]);
  });

  it('scales by the text matrix and reads the line width from a graphics state', () => {
    const fn = [OPS.setGState, OPS.setTextRenderingMode, OPS.setFont, OPS.setTextMatrix, OPS.showText];
    const args = [[[['LW', 0.5]]], [2], ['f1', 1], [[10, 0, 0, 10, 0, 0]], [glyphs('Big')]];
    expect(strokeRunsFromOperators(fn, args, OPS)[0].strokeEm).toBeCloseTo(0.05);
  });

  it('ignores outline-only text and hairline strokes', () => {
    const fn = [OPS.setTextRenderingMode, OPS.setLineWidth, OPS.setFont, OPS.showText, OPS.setTextRenderingMode, OPS.setLineWidth, OPS.showText];
    const args = [[1], [1], ['f1', 10], [glyphs('Outline')], [2], [0], [glyphs('Hair')]];
    expect(strokeRunsFromOperators(fn, args, OPS).map((r) => r.strokeEm)).toEqual([0, 0]);
  });
});

describe('strokeEmPerItem', () => {
  it('lines text items up with drawn runs by their characters, ignoring spaces', () => {
    const runs = [
      { text: 'Regularline', strokeEm: 0 },
      { text: 'Fauxbold', strokeEm: 0.03 },
      { text: 'line', strokeEm: 0.03 },
    ];
    expect(strokeEmPerItem(['Regular line', 'Faux bold line'], runs)).toEqual([0, 0.03]);
  });

  it('gives no stroke to an item it cannot find, and carries on after it', () => {
    const runs = [{ text: 'Firstﬁne', strokeEm: 0.03 }, { text: 'Last', strokeEm: 0.02 }];
    expect(strokeEmPerItem(['Other text', 'First fine', 'Last'], runs)).toEqual([0, 0.03, 0.02]);
  });
});
