import { describe, expect, it } from 'vitest';

import { clearLightBackground } from './signatureImage';

describe('clearLightBackground', () => {
  it('makes paper transparent and keeps ink, fading the edge between them', () => {
    const rgba = new Uint8ClampedArray([
      250, 250, 245, 255, // paper
      20, 30, 90, 255, // blue ink
      190, 190, 190, 255, // grey edge
    ]);
    clearLightBackground(rgba);
    expect(rgba[3]).toBe(0);
    expect(rgba[7]).toBe(255);
    expect(rgba[11]).toBeGreaterThan(0);
    expect(rgba[11]).toBeLessThan(255);
  });
});
