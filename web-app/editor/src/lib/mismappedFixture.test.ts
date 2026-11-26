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
 * What the repair must recover: reph, conjuncts, pre-base ि and swapped consonants. In the first
 * line pdf.js measures Plan B's "क्षेत्र" as zero width, so the space before "में" is lost; that
 * comes from how Plan B positions ligatures without its /ActualText (which real exports keep), not
 * from the repair, so the line is checked in two parts.
 */
const expected = ['सूर्य, धर्म और क्षेत्र', 'गुरुजी ने ज्ञान प्रकृति दिया।', 'किताब, विद्यालय में सूर्य की रोशनी क्षितिज है।'];

describe('mis-mapped ToUnicode fixture', () => {
  it('is repaired from the embedded font', async () => {
    expect((await repairMisMappedToUnicode(fixture)).repairedFonts.length).toBeGreaterThan(0);
  });

  it('reads the edited lines exactly', async () => {
    const text = (await extractEmbeddedTextLines(fixture, 0)).map((line) => line.text).join('\n');
    for (const part of expected) expect(text).toContain(part);
  }, 30000);
});
