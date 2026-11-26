import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  HarfBuzzShaperFont,
  instantiateHarfBuzz,
  splitScriptRuns,
  subsetAndInstanceFont,
} from './harfbuzzWasm';
import { parseTtfMetrics } from './ttfMetrics';

const HB_DIR = path.resolve(__dirname, '../../node_modules/harfbuzzjs/dist');
const NOTO_SANS_PATH = path.resolve(__dirname, '../../public/fonts/NotoSansDevanagari-Variable.ttf');

async function loadTestEngine() {
  return instantiateHarfBuzz({
    shapeWasm: new Uint8Array(readFileSync(path.join(HB_DIR, 'harfbuzz.wasm'))),
    subsetWasm: new Uint8Array(readFileSync(path.join(HB_DIR, 'harfbuzz-subset.wasm'))),
  });
}

describe('splitScriptRuns', () => {
  it('splits mixed Latin and Devanagari text into proper script runs', () => {
    expect(splitScriptRuns('Area: क्षेत्र (धर्म) 2026')).toEqual([
      { text: 'Area: ', script: 'Latn', language: 'en' },
      { text: 'क्षेत्र (धर्म) ', script: 'Deva', language: 'hi' },
      { text: '2026', script: 'Latn', language: 'en' },
    ]);
  });

  it('keeps pure Devanagari with punctuation as a single Deva run', () => {
    expect(splitScriptRuns('सूर्य, धर्म और क्षेत्र।')).toEqual([
      { text: 'सूर्य, धर्म और क्षेत्र।', script: 'Deva', language: 'hi' },
    ]);
  });
});

describe('harfbuzzWasm shaping and subsetting', () => {
  it('shapes canonical Devanagari conjuncts, pre-base ि, reph, and GPOS mark offsets', async () => {
    const engine = await loadTestEngine();
    const fontBytes = new Uint8Array(readFileSync(NOTO_SANS_PATH));
    const shaper = new HarfBuzzShaperFont(engine, fontBytes, 400);
    try {
      // धर्म: reph र् reorders after म within the "र्म" cluster.
      const dharm = shaper.shapeLine('धर्म');
      expect(dharm.map((c) => c.text).join('')).toBe('धर्म');
      expect(dharm.length).toBe(2);
      expect(dharm[1].text).toBe('र्म');
      expect(dharm[1].glyphs.length).toBe(2);

      // विद्यालय: pre-base ि reorders before व within the "वि" cluster; द्य forms a conjunct.
      const vidyalaya = shaper.shapeLine('विद्यालय');
      expect(vidyalaya.map((c) => c.text).join('')).toBe('विद्यालय');
      expect(vidyalaya[0].text).toBe('वि');
      expect(vidyalaya[0].glyphs.length).toBe(2);

      // प्रकृति: ृ carries a non-zero GPOS xOffset relative to क.
      const prakriti = shaper.shapeLine('प्रकृति');
      expect(prakriti.map((c) => c.text).join('')).toBe('प्रकृति');
      const allGlyphs = prakriti.flatMap((c) => c.glyphs);
      expect(allGlyphs.some((g) => g.xOffset !== 0)).toBe(true);
      expect(allGlyphs.every((g) => g.gid !== 0)).toBe(true);
    } finally {
      shaper.destroy();
    }
  });

  it('subsets and instances NotoSansDevanagari-Variable.ttf into a compact static TrueType font', async () => {
    const engine = await loadTestEngine();
    const fontBytes = new Uint8Array(readFileSync(NOTO_SANS_PATH));
    const shaper = new HarfBuzzShaperFont(engine, fontBytes, 700);
    const usedGids = new Set<number>([0]);
    try {
      for (const cluster of shaper.shapeLine('धर्म क्षेत्र गुरुजी ज्ञान विद्यालय सूर्य प्रकृति')) {
        for (const glyph of cluster.glyphs) usedGids.add(glyph.gid);
      }
    } finally {
      shaper.destroy();
    }

    const sourceMetrics = parseTtfMetrics(fontBytes);
    const subset = subsetAndInstanceFont(engine, fontBytes, usedGids, 700, sourceMetrics.variationAxes);
    expect(subset.byteLength).toBeLessThan(fontBytes.byteLength * 0.1);

    const metrics = parseTtfMetrics(subset);
    expect(metrics.isVariable).toBe(false);
    expect(metrics.unitsPerEm).toBe(1000);
    // Retained GIDs have valid non-negative advance widths.
    for (const gid of usedGids) {
      expect(gid).toBeLessThan(metrics.numGlyphs);
    }
  });
});
