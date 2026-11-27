import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { extractEmbeddedTextLines } from './pdfTextExtract';
import { repairMisMappedToUnicode } from './pdfToUnicodeRepair';

/** Built by web-app/scripts/make-mismapped-fixture.mjs (web ADR 0022). */
const fixture = new Uint8Array(
  readFileSync(path.join(__dirname, '../../../../mobile-app/fixtures/mismapped-tounicode-fixture.pdf')),
);
/**
 * What the repair must recover: reph, conjuncts, pre-base ि and swapped consonants, with every
 * word gap kept (pdf.js must measure ligature glyphs such as क्षेत्र; see scripts/patch-pdfjs.mjs).
 */
const expected = ['सूर्य, धर्म और क्षेत्र में गुरुजी ने ज्ञान प्रकृति दिया।', 'किताब, विद्यालय में सूर्य की रोशनी क्षितिज है।'];

describe('mis-mapped ToUnicode fixture', () => {
  it('is repaired from the embedded font', async () => {
    const repair = await repairMisMappedToUnicode(fixture);
    expect(repair.repairedFonts.length).toBeGreaterThan(0);
    // Wrong letters, not only drawing order: its pages keep the usual word-gap rules.
    expect(repair.drawingOrderFonts).toEqual([]);
  });

  it('marks the lines read through the repaired font', async () => {
    const lines = await extractEmbeddedTextLines(fixture, 0);
    // The two edited lines use the repaired fonts; the fixture's other lines keep their own fonts.
    const edited = lines.filter((line) => expected.some((part) => line.text.includes(part)));
    expect(edited.length).toBe(2);
    expect(edited.every((line) => line.repaired === true)).toBe(true);
    expect(lines.filter((line) => !edited.includes(line)).some((line) => line.repaired)).toBe(false);
  }, 30000);

  it('reads the edited lines exactly', async () => {
    const text = (await extractEmbeddedTextLines(fixture, 0)).map((line) => line.text).join('\n');
    for (const part of expected) expect(text).toContain(part);
  }, 30000);
});
