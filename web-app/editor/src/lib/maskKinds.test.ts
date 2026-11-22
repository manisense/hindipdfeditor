import { describe, expect, it } from 'vitest';

import { HIGHLIGHT_COLOR, isHighlight, isWhiteout, linesOutsideWhiteouts, patchesBackground, removesTextUnder } from './maskKinds';
import type { MaskEdit, OcrLine } from '../state/editStore';

const mask = (kind?: MaskEdit['kind']): MaskEdit => ({
  type: 'mask', id: 'm', page: 0, xPt: 0, yPt: 0, wPt: 10, hPt: 10, color: '#fff', kind,
});

describe('mask kinds', () => {
  it('removes the text under replacements and whiteouts, never under highlights', () => {
    expect(removesTextUnder(mask('replace'))).toBe(true);
    expect(removesTextUnder(mask('whiteout'))).toBe(true);
    expect(removesTextUnder(mask(undefined))).toBe(true);
    expect(removesTextUnder(mask('highlight'))).toBe(false);
  });

  it('patches the background only for replacements; a whiteout is painted over', () => {
    expect(patchesBackground(mask('replace'))).toBe(true);
    expect(patchesBackground(mask('whiteout'))).toBe(false);
    expect(patchesBackground(mask('highlight'))).toBe(false);
  });

  it('recognises highlights and has a light highlight colour', () => {
    expect(isHighlight(mask('highlight'))).toBe(true);
    expect(isHighlight(mask('whiteout'))).toBe(false);
    expect(isWhiteout(mask(undefined))).toBe(true);
    expect(isWhiteout(mask('replace'))).toBe(false);
    expect(HIGHLIGHT_COLOR).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('linesOutsideWhiteouts', () => {
  const line = (id: string, xPt: number): OcrLine => ({ id, text: id, xPt, yPt: 0, wPt: 10, hPt: 10 });
  it('drops lines a whiteout hides, keeping lines under highlights and replacements', () => {
    const lines = [line('hidden', 0), line('marked', 100), line('free', 200)];
    const edits: MaskEdit[] = [
      { ...mask('whiteout'), xPt: -2, wPt: 20 },
      { ...mask('highlight'), xPt: 98, wPt: 20 },
    ];
    expect(linesOutsideWhiteouts(lines, edits).map((l) => l.id)).toEqual(['marked', 'free']);
  });
});
