import { describe, expect, it } from 'vitest';

import { reorderDevanagariMarks } from './devanagariMarks';
import { PRE_BASE_MARK as I, REPH_MARK as R } from './fontGlyphText';

describe('reorderDevanagariMarks', () => {
  it('moves a pre-base ि after its consonant and after a whole conjunct', () => {
    expect(reorderDevanagariMarks(`${I}वषय`)).toBe('विषय');
    expect(reorderDevanagariMarks(`${I}त${I}थयाँ`)).toBe('तिथियाँ');
    expect(reorderDevanagariMarks(`सं${I}क्षप्त`)).toBe('संक्षिप्त');
  });

  it('moves a reph before its syllable, including the syllable’s matras', () => {
    expect(reorderDevanagariMarks(`धम${R}`)).toBe('धर्म');
    expect(reorderDevanagariMarks(`नि दे${R}श`.replace(' ', ''))).toBe('निर्देश');
    expect(reorderDevanagariMarks(`आ${I}थ${R}क`)).toBe('आर्थिक');
    expect(reorderDevanagariMarks(`स्वणं${R}`)).toBe('स्वर्णं');
  });

  it('keeps reph combinations that carry a sign, and leaves plain text alone', () => {
    expect(reorderDevanagariMarks(`वग${R}ं`)).toBe('वर्गं');
    expect(reorderDevanagariMarks('सामान्य निर्देश')).toBe('सामान्य निर्देश');
  });

  it('turns a mark with nothing to move past into its letters', () => {
    expect(reorderDevanagariMarks(`${I}`)).toBe('ि');
    expect(reorderDevanagariMarks(`${R}क`)).toBe('र्क');
  });
});
