import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { fontGlyphText, PRE_BASE_MARK, REPH_MARK } from './fontGlyphText';

const noto = new Uint8Array(readFileSync(path.join(__dirname, '../../public/fonts/NotoSansDevanagari-Variable.ttf')));

describe('fontGlyphText', () => {
  const reading = fontGlyphText(noto);
  const textOf = (text: string) => [...reading.text.entries()].filter(([, t]) => t === text).map(([gid]) => gid);

  it('reads single letters from the cmap', () => {
    expect(textOf('क').length).toBeGreaterThan(0);
    expect(textOf('ष').length).toBeGreaterThan(0);
  });

  it('reads conjunct ligatures from GSUB as their letters', () => {
    expect(textOf('क्ष').length).toBeGreaterThan(0);
    expect(textOf('ज्ञ').length).toBeGreaterThan(0);
  });

  it('marks reph glyphs and pre-base i-matra glyphs', () => {
    expect(textOf(REPH_MARK).length).toBeGreaterThan(0);
    expect(textOf(PRE_BASE_MARK).length).toBeGreaterThan(0);
    expect(textOf('ि')).toEqual([]);
  });

  it('returns an empty reading for bytes that are not a font', () => {
    expect(fontGlyphText(new Uint8Array([1, 2, 3, 4])).text.size).toBe(0);
  });
});
