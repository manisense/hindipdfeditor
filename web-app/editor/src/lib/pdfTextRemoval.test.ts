import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, it } from 'vitest';

import { fontMetricsOf, removePageText } from './pdfTextRemoval';

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

it('removes the /ActualText of removed Hindi glyphs, so copied text does not bring the old word back', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const { markedContentStarts } = await import('./pdfActualText');
  const { decodedContents } = await import('./pdfPageContents');
  // Tests run from web-app/editor.
  const fixture = resolve(process.cwd(), '../../mobile-app/fixtures/devanagari-fixture.pdf');
  const doc = await PDFDocument.load(readFileSync(fixture));
  const texts = () => markedContentStarts(decodedContents(doc, doc.getPage(0))).map((start) => start.actualText ?? '');
  const count = (cluster: string) => texts().filter((text) => text.includes(cluster)).length;
  // ज्ञान is on the first Hindi line and again in the legend below it.
  const before = { gya: count('ज्ञा'), rm: count('र्म') };
  expect(before.gya).toBeGreaterThan(0);
  // ज्ञान in the first Hindi line (PDF user space, pt).
  const { removedPerRect } = removePageText(doc, 0, [{ x0: 339, y0: 589, x1: 381, y1: 623 }]);
  expect(removedPerRect[0]).toBeGreaterThan(0);
  expect(count('ज्ञा')).toBe(before.gya - 1);
  // Clusters outside the rectangle keep their text.
  expect(count('र्म')).toBe(before.rm);
});
