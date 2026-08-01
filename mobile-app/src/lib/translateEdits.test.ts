import { geometryForTranslatedLine, successfulTranslations } from './translateEdits';
import type { OcrLine } from '../state/editStore';

const line = (id: string, overrides: Partial<OcrLine> = {}): OcrLine => ({
  id,
  text: id,
  xPt: 20,
  yPt: 30,
  wPt: 100,
  hPt: 12,
  ...overrides,
});

describe('translation edit preparation', () => {
  it('keeps failed, blank, and missing translations out of the consumed line set', () => {
    const lines = [line('translated'), line('blank'), line('missing')];
    const result = successfulTranslations(
      lines,
      new Map([
        ['translated', '  नमस्ते  '],
        ['blank', '   '],
      ]),
    );

    expect(result).toEqual([{ line: lines[0], translated: 'नमस्ते' }]);
  });

  it('clamps translated mask and text geometry to the PDF-point page bounds', () => {
    const result = geometryForTranslatedLine(
      line('edge', { xPt: 590, yPt: 785, wPt: 40, hPt: 20 }),
      612,
      792,
    );

    expect(result.mask.xPt).toBeGreaterThanOrEqual(0);
    expect(result.mask.yPt).toBeGreaterThanOrEqual(0);
    expect(result.mask.xPt + result.mask.wPt).toBeLessThanOrEqual(612);
    expect(result.mask.yPt + result.mask.hPt).toBeLessThanOrEqual(792);
    expect(result.text.xPt + result.text.widthPt).toBeLessThanOrEqual(612);
  });
});
