import { describe, expect, it } from 'vitest';

import type { OcrLine } from '../state/editStore';
import { findOcrLineAt, findTextEditAt } from './ocrHitTest';

function line(id: string, xPt: number, wPt: number): OcrLine {
  return { id, text: id, xPt, yPt: 10, wPt, hPt: 12, source: 'embedded' };
}

describe('OCR hit testing', () => {
  const large = line('large', 10, 90);
  const small = line('small', 104, 8);

  it('prefers the exact small box over a padded nearby large box', () => {
    expect(findOcrLineAt([large, small], 108, 16)?.id).toBe('small');
  });

  it('prefers the exact large box over padding from a nearby small box', () => {
    expect(findOcrLineAt([large, small], 98, 16)?.id).toBe('large');
  });

  it('uses the nearest real edge when a tap needs padding', () => {
    expect(findOcrLineAt([large, small], 101, 16)?.id).toBe('large');
    expect(findOcrLineAt([large, small], 103, 16)?.id).toBe('small');
  });
});

describe('existing-edit hit testing', () => {
  const edits = [
    { id: 'large', text: 'large', xPt: 10, yPt: 10, widthPt: 90, fontSizePt: 10 },
    { id: 'small', text: 'x', xPt: 104, yPt: 10, widthPt: 8, fontSizePt: 10 },
  ];

  it('selects the exact existing edit instead of a neighboring padded edit', () => {
    expect(findTextEditAt(edits, 108, 16)?.id).toBe('small');
    expect(findTextEditAt(edits, 98, 16)?.id).toBe('large');
  });
});
