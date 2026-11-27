import { describe, expect, it } from 'vitest';

import { borrowReadings, clusterStarts, learnGlyphs, ocrConfirmsRepair, repairText, spacedLike, unresolvedLineText } from './glyphRepair';

// Placeholders for three unmapped glyphs: a reph, a pre-base ि and the द्य conjunct.
const REPH = '\u{F0000}';
const I = '\u{F0001}';
const DYA = '\u{F0002}';
const isUnknown = (char: string) => char.codePointAt(0)! >= 0xf0000;

describe('clusterStarts', () => {
  it('starts a syllable at each consonant or vowel, keeping conjuncts and signs together', () => {
    expect(clusterStarts('धर्म')).toEqual([0, 1]);
    expect(clusterStarts('विद्यालय')).toEqual([0, 2, 6, 7]);
  });
});

describe('ocrConfirmsRepair', () => {
  const map = new Map([[I, { text: 'ि', shift: 1 }]]);

  it('accepts repaired words found in OCR of the line, ignoring spaces and zero-width joiners', () => {
    // Tesseract writes दिल्‍ली with a zero-width joiner; the PDF's own text has none.
    expect(ocrConfirmsRepair(`नई ${I}दल्ली, 12 फरवरी`, 'नई दिल्\u200Dली, 2 फरवरी', map, isUnknown)).toBe(true);
    expect(ocrConfirmsRepair(`नई ${I}दल्ली`, 'नई दल्ली', map, isUnknown)).toBe(false);
  });
});

describe('unresolvedLineText', () => {
  it("prefers OCR of the line's own area, else keeps the repaired PDF text without unknown glyphs", () => {
    expect(unresolvedLineText(`पद ${REPH}भती`, 'पद भर्ती', isUnknown)).toEqual({ text: 'पद भर्ती', fromOcr: true });
    expect(unresolvedLineText(`पद ${REPH}भती`, undefined, isUnknown)).toEqual({ text: 'पद भती', fromOcr: false });
    expect(unresolvedLineText(`${REPH}`, undefined, isUnknown)).toBeNull();
  });

  it("keeps the PDF's own numbers when OCR misreads them (Gazette: 161 read as 6)", () => {
    expect(unresolvedLineText('सा.का.नि. 161(अ).— राष्ट्रपति, अनुच्छेद 309', 'सा.का.नि. 6(अ).-- राष्ट्रपति, अनुच्छेद 309', isUnknown)).toEqual({
      text: 'सा.का.नि. 161(अ).-- राष्ट्रपति, अनुच्छेद 309',
      fromOcr: true,
    });
    expect(unresolvedLineText('मार्च 9, 2026/फाल्गुन 18, 1947', 'मार्च 9, 2026/फाल्गुन 8, 947', isUnknown)?.text).toBe('मार्च 9, 2026/फाल्गुन 18, 1947');
    // Different counts: OCR found more or fewer numbers, so nothing is swapped.
    expect(unresolvedLineText('पद 12', 'पद 12 और 3', isUnknown)?.text).toBe('पद 12 और 3');
  });
});

describe('repairText', () => {
  const map = new Map([
    [REPH, { text: 'र्', shift: -1 }],
    [I, { text: 'ि', shift: 1 }],
    [DYA, { text: 'द्य', shift: 0 }],
  ]);

  it('puts a reph before the syllable it was drawn after', () => {
    expect(repairText(`धम${REPH}`, map, isUnknown)).toBe('धर्म');
    expect(repairText(`सूय${REPH} की`, map, isUnknown)).toBe('सूर्य की');
  });

  it('puts a pre-base ि before the anusvara, candrabindu or visarga of its syllable', () => {
    // Gazette of India PDFs: हिंदी is drawn ि ह ं द ी.
    expect(repairText(`${I}हंदी`, map, isUnknown)).toBe('हिंदी');
    expect(repairText(`${I}सँ`, map, isUnknown)).toBe('सिँ');
    expect(repairText(`अ${I}धक`, map, isUnknown)).toBe('अधिक');
  });

  it('puts a pre-base ि after its consonant and conjuncts in place', () => {
    expect(repairText(`${I}व${DYA}ालय`, map, isUnknown)).toBe('विद्यालय');
  });

  it('leaves glyphs it has not learned as placeholders', () => {
    expect(repairText(`क${'\u{F0009}'}`, map, isUnknown)).toBe(`क${'\u{F0009}'}`);
  });
});

describe('learnGlyphs', () => {
  it('learns each glyph from its known neighbours in the OCR line, unlocking glyphs next to it', () => {
    const pairs = [
      { embedded: `धम${REPH} और`, ocr: 'धर्म और' },
      { embedded: `सूय${REPH} की`, ocr: 'सूर्य की' },
      { embedded: `${I}कया गया`, ocr: 'किया गया' },
      { embedded: `${I}व${DYA}ालय`, ocr: 'विद्यालय' },
    ];
    const map = learnGlyphs(pairs, isUnknown);
    expect(map.get(REPH)).toEqual({ text: 'र्', shift: -1 });
    expect(map.get(I)).toEqual({ text: 'ि', shift: 1 });
    // द्य only ever follows वि, whose ि is another unknown glyph: learned once ि is known.
    expect(map.get(DYA)).toEqual({ text: 'द्य', shift: 0 });
  });

  it('keeps a glyph unlearned when the readings disagree', () => {
    const pairs = [
      { embedded: `क${REPH}`, ocr: 'कर्' },
      { embedded: `म${REPH}`, ocr: 'मं' },
    ];
    expect(learnGlyphs(pairs, isUnknown).has(REPH)).toBe(false);
  });

  it('does not depend on the PDF and OCR agreeing on spaces', () => {
    // The text layer joins धर्म and और and splits गुरुजी; OCR spaces them normally.
    const map = learnGlyphs([{ embedded: `धम${REPH}और गुरु जी`, ocr: 'धर्म और गुरुजी' }], isUnknown);
    expect(map.get(REPH)).toEqual({ text: 'र्', shift: -1 });
  });

  it('learns nothing when the known context is not found in the OCR line', () => {
    expect(learnGlyphs([{ embedded: `धम${REPH} और`, ocr: 'कुछ और ही' }], isUnknown).size).toBe(0);
  });
});

describe('spacedLike', () => {
  it('takes spaces from OCR between characters both sides agree on', () => {
    expect(spacedLike('धर्मऔर क्षेत्र मेंगुरु जी ने', 'धर्म और क्षेत्र में गुरुजी ने')).toBe('धर्म और क्षेत्र में गुरुजी ने');
  });

  it('keeps the PDF text and its spaces where OCR read something else', () => {
    expect(spacedLike('धर्म → reph (र्)', 'धर्म > reph (र')).toBe('धर्म → reph (र्)');
  });
});

describe('borrowReadings', () => {
  const a = '\u{F0010}';
  const b = '\u{F0011}';
  const mark = '\u{F0012}';
  const otherMark = '\u{F0013}';

  it('shares a reading between subsets of one font for a glyph of the same width', () => {
    const signatures = new Map([[a, 'Noto|259'], [b, 'Noto|259'], [mark, 'Noto|0'], [otherMark, 'Noto|0']]);
    const readings = new Map([[a, { text: 'ि', shift: 1 }], [mark, { text: 'र्', shift: -1 }]]);
    const borrowed = borrowReadings(readings, signatures);
    expect(borrowed.get(b)).toEqual({ text: 'ि', shift: 1 });
    // Zero-width marks are too alike to share.
    expect(borrowed.has(otherMark)).toBe(false);
  });

  it('shares nothing when glyphs of that signature read differently', () => {
    const c = '\u{F0014}';
    const signatures = new Map([[a, 'Noto|259'], [b, 'Noto|259'], [c, 'Noto|259']]);
    const readings = new Map([[a, { text: 'ि', shift: 1 }], [b, { text: 'ी', shift: 0 }]]);
    expect(borrowReadings(readings, signatures).has(c)).toBe(false);
  });
});

describe('glyph learning across symbols and ambiguous widths', () => {
  it('learns from Devanagari neighbours only, so a misread arrow does not block it', () => {
    const map = learnGlyphs([{ embedded: `धम${REPH} → reph`, ocr: 'धर्म > reph' }], isUnknown);
    expect(map.get(REPH)).toEqual({ text: 'र्', shift: -1 });
  });

  it('borrows the reading whose place fits: a glyph drawn before a consonant is a pre-base sign', () => {
    const iLong = '\u{F0020}';
    const iShort = '\u{F0021}';
    const iiLong = '\u{F0022}';
    const signatures = new Map([[iLong, 'Noto|259'], [iShort, 'Noto|259'], [iiLong, 'Noto|259']]);
    const readings = new Map([[iLong, { text: 'ि', shift: 1 }], [iiLong, { text: 'ी', shift: 0 }]]);
    const placeOf = new Map([[iShort, 'pre' as const]]);
    expect(borrowReadings(readings, signatures, placeOf).get(iShort)).toEqual({ text: 'ि', shift: 1 });
    expect(borrowReadings(readings, signatures, new Map([[iShort, 'post' as const]])).get(iShort)).toEqual({ text: 'ी', shift: 0 });
  });
});
