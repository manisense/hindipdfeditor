import {
  containsDevanagari,
  isSuccessfulEnglishTranslation,
  isTranslatableHindiLine,
} from './freeTranslate';

describe('containsDevanagari', () => {
  it('detects Devanagari code points', () => {
    expect(containsDevanagari('नमस्ते')).toBe(true);
    expect(containsDevanagari('Hello नमस्ते')).toBe(true);
    expect(containsDevanagari('Hello')).toBe(false);
    expect(containsDevanagari('')).toBe(false);
  });
});

describe('isTranslatableHindiLine', () => {
  it('accepts predominantly Devanagari lines', () => {
    expect(isTranslatableHindiLine('आवेदन पत्र का प्रपत्र')).toBe(true);
    expect(isTranslatableHindiLine('कर्मचारी का नाम')).toBe(true);
  });

  it('rejects English-only and short / Latin-heavy bilingual noise', () => {
    expect(isTranslatableHindiLine('FORM OF APPLICATION FOR LEAVE')).toBe(false);
    expect(isTranslatableHindiLine('Department / Office')).toBe(false);
    expect(isTranslatableHindiLine('अ')).toBe(false);
    expect(isTranslatableHindiLine('')).toBe(false);
    // Mostly Latin with a stray Devanagari glyph — skip (garbage-in → garbage-out).
    expect(isTranslatableHindiLine('FORM OF APPLICATION पत्र FOR LEAVE')).toBe(false);
  });

  it('accepts Hindi with light Latin punctuation or short acronyms', () => {
    expect(isTranslatableHindiLine('विभाग / कार्यालय:')).toBe(true);
  });
});

describe('isSuccessfulEnglishTranslation', () => {
  it('accepts normal English output', () => {
    expect(isSuccessfulEnglishTranslation('नमस्ते', 'Hello')).toBe(true);
    expect(
      isSuccessfulEnglishTranslation('आवेदन पत्र', 'Application form'),
    ).toBe(true);
  });

  it('rejects empty, echoed, or still-Hindi output', () => {
    expect(isSuccessfulEnglishTranslation('नमस्ते', '')).toBe(false);
    expect(isSuccessfulEnglishTranslation('नमस्ते', 'नमस्ते')).toBe(false);
    expect(isSuccessfulEnglishTranslation('नमस्ते', 'Hello नमस्ते')).toBe(false);
  });

  it('rejects OCR→MT garbage patterns from bilingual forms', () => {
    expect(isSuccessfulEnglishTranslation('हिंदी', 'nan of the root')).toBe(false);
    expect(
      isSuccessfulEnglishTranslation('हिंदी', 'Aur -based Monitor / Windows 2000'),
    ).toBe(false);
    expect(isSuccessfulEnglishTranslation('हिंदी', 'ERDOD FEKEM TYROD FEKECH')).toBe(false);
    expect(isSuccessfulEnglishTranslation('हिंदी', 'bcdfghjklmnp')).toBe(false);
  });
});
