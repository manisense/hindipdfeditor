import { describe, expect, it } from 'vitest';

import { linesToCheck } from './linesToCheck';
import type { OcrLine } from '../state/editStore';

const line = (id: string, yPt: number, extra: Partial<OcrLine>): OcrLine => ({ id, text: id, xPt: 10, yPt, wPt: 100, hPt: 10, ...extra });

describe('linesToCheck', () => {
  it('lists OCR and unconfirmed lines top to bottom, with why; font-repaired text is exact', () => {
    const lines = [
      line('pdf', 10, { source: 'embedded' }),
      line('fixed', 50, { source: 'embedded', repaired: true }),
      line('ocr', 30, { source: 'ocr' }),
      line('unsure', 70, { source: 'embedded-degraded' }),
    ];
    expect(linesToCheck(lines).map((l) => [l.line.id, l.reason])).toEqual([
      ['ocr', 'ocr'],
      ['unsure', 'degraded'],
    ]);
  });

  it('skips lines without letters and lines already replaced by an edit', () => {
    const lines = [line('१२', 10, { source: 'ocr', text: '— 12 —' }), line('edited', 20, { source: 'ocr' })];
    expect(linesToCheck(lines, new Set(['edited']))).toEqual([]);
  });
});
