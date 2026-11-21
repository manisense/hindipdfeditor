import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, it } from 'vitest';

import { fontMetricsOf } from './pdfTextRemoval';

it('reads Type3 widths through the font matrix, as Chrome-printed PDFs need', async () => {
  const doc = await PDFDocument.create();
  const type3 = doc.context.obj({
    Type: 'Font',
    Subtype: 'Type3',
    FontMatrix: [0.002, 0, 0, 0.002, 0, 0],
    FirstChar: 65,
    LastChar: 66,
    Widths: [300, 450],
  });
  const metrics = fontMetricsOf(type3);
  expect(metrics?.codeBytes).toBe(1);
  // 300 glyph units × 0.002 = 0.6 text space = 600 thousandths.
  expect(metrics?.width(65)).toBeCloseTo(600);
  expect(metrics?.width(66)).toBeCloseTo(900);
  expect(fontMetricsOf(doc.context.obj({ Type: 'Font', Subtype: 'Type3' }))).toBeUndefined();
});
