import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseTtfMetrics } from './ttfMetrics';

const NOTO_SANS_PATH = path.resolve(__dirname, '../../public/fonts/NotoSansDevanagari-Variable.ttf');

describe('parseTtfMetrics', () => {
  it('reads metrics and advance widths from NotoSansDevanagari-Variable.ttf', () => {
    const bytes = new Uint8Array(readFileSync(NOTO_SANS_PATH));
    const metrics = parseTtfMetrics(bytes);

    expect(metrics.unitsPerEm).toBe(1000);
    expect(metrics.ascender).toBeGreaterThan(500);
    expect(metrics.descender).toBeLessThan(0);
    expect(metrics.numGlyphs).toBeGreaterThan(500);
    expect(metrics.advanceWidths.length).toBe(metrics.numGlyphs);
    expect(metrics.isVariable).toBe(true);
    // Space and Devanagari base letters have positive advance widths.
    expect(metrics.advanceWidths[74]).toBeGreaterThan(0);
  });

  it('rejects truncated or invalid binaries', () => {
    expect(() => parseTtfMetrics(new Uint8Array([0, 1, 2]))).toThrow(/too short/);
  });
});
