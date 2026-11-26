import { describe, expect, it } from 'vitest';

import { PRE_BASE_MARK } from './fontGlyphText';
import { buildToUnicode, parseToUnicode, repairedToUnicode } from './pdfToUnicodeRepair';

describe('ToUnicode maps', () => {
  it('parses bfchar, bfrange and array bfrange entries', () => {
    const cmap = [
      '2 beginbfchar', '<0003> <0020>', '<0048> <0069>', 'endbfchar',
      '2 beginbfrange', '<00E6> <00E7> <0905>', '<00F8> <00F9> [<0915> <093F>]', 'endbfrange',
    ].join('\n');
    const map = parseToUnicode(cmap);
    expect(map.get(0x03)).toBe(' ');
    expect(map.get(0xe7)).toBe('आ');
    expect(map.get(0xf9)).toBe('ि');
  });

  it('round-trips through buildToUnicode, including multi-letter targets', () => {
    const map = new Map([[0x10, 'क्ष'], [0x2a, 'a']]);
    expect(parseToUnicode(buildToUnicode(map))).toEqual(map);
  });
});

describe('repairedToUnicode', () => {
  const font = new Map<number, string>([[1, 'क'], [2, 'ख'], [3, 'ग'], [4, 'घ'], [5, PRE_BASE_MARK], [6, 'a'], [7, 'क्ष']]);

  it('leaves a map that agrees with the font (Unicode normalisation and ligatures aside)', () => {
    const existing = new Map<number, string>([[1, 'क'], [2, 'ख'], [3, 'ग'], [4, 'घ'], [7, 'क्‍ष']]);
    expect(repairedToUnicode(existing, font)).toBeNull();
  });

  it('rebuilds a map that names the wrong letters, keeping non-Devanagari entries', () => {
    const existing = new Map<number, string>([[1, 'क'], [2, 'ि'], [3, 'व'], [5, 'व'], [6, 'a'], [9, 'x']]);
    const repaired = repairedToUnicode(existing, font);
    expect(repaired?.get(2)).toBe('ख');
    expect(repaired?.get(5)).toBe(PRE_BASE_MARK);
    expect(repaired?.get(7)).toBe('क्ष');
    expect(repaired?.get(9)).toBe('x');
  });

  it('repairs a map in drawing order: fills unmapped ligatures, marks ि, keeps agreeing entries', () => {
    const existing = new Map<number, string>([[1, 'क'], [2, 'ख'], [5, 'ि'], [6, 'b']]);
    const repaired = repairedToUnicode(existing, font);
    expect(repaired?.get(5)).toBe(PRE_BASE_MARK);
    expect(repaired?.get(7)).toBe('क्ष');
    expect(repaired?.get(6)).toBe('b');
    expect(repaired?.get(2)).toBe('ख');
  });

  it('needs at least three disagreements', () => {
    const existing = new Map<number, string>([[1, 'क'], [2, 'ि'], [3, 'व'], [5, 'व']]);
    expect(repairedToUnicode(new Map([[1, 'क'], [2, 'ि'], [3, 'व']]), font)).toBeNull();
    expect(repairedToUnicode(existing, font)).not.toBeNull();
  });
});
