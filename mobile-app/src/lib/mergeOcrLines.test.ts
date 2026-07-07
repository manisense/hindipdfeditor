import type { RecognizedLine } from 'text-recognition';

import { containsDevanagari, mergeOcrLines } from './mergeOcrLines';

function line(text: string, x: number, y: number, width = 100, height = 20): RecognizedLine {
  return { text, x, y, width, height };
}

describe('containsDevanagari', () => {
  it('detects plain Hindi', () => {
    expect(containsDevanagari('छुट्टी की अर्जी')).toBe(true);
  });

  it('detects Hindi mixed into a mostly-Latin line', () => {
    expect(containsDevanagari('विभाग/ Department')).toBe(true);
  });

  it('is false for pure Latin', () => {
    expect(containsDevanagari('FORM OF APPLICATION FOR LEAVE')).toBe(false);
  });

  it('is false for empty text', () => {
    expect(containsDevanagari('')).toBe(false);
  });
});

describe('mergeOcrLines', () => {
  it('keeps Hindi-bearing lines from the Devanagari pass', () => {
    const merged = mergeOcrLines([line('छुट्टी की अर्जी', 10, 10)], []);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe('छुट्टी की अर्जी');
  });

  it('keeps Latin-pass lines in regions the Devanagari pass found nothing', () => {
    const merged = mergeOcrLines([], [line('FORM OF APPLICATION', 10, 10)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe('FORM OF APPLICATION');
  });

  it('drops a Latin-pass fragment that re-reads part of a mixed Hindi+Latin line', () => {
    // The Devanagari pass read the whole mixed line; the Latin pass re-read only its
    // English half at roughly the same position.
    const mixed = line('विभाग/ Department', 10, 10, 200, 20);
    const fragment = line('Department', 110, 10, 100, 20);
    const merged = mergeOcrLines([mixed], [fragment]);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe('विभाग/ Department');
  });

  it('prefers the dedicated Latin model for a pure-Latin region both passes read', () => {
    // Same region, no Devanagari in either reading: the Devanagari model's incidental Latin
    // reading loses to the dedicated Latin model's.
    const fromDevanagariPass = line('F0RM 0F APPLICATI0N', 10, 10, 200, 20);
    const fromLatinPass = line('FORM OF APPLICATION', 12, 11, 198, 19);
    const merged = mergeOcrLines([fromDevanagariPass], [fromLatinPass]);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe('FORM OF APPLICATION');
  });

  it('keeps a pure-Latin Devanagari-pass line the Latin pass missed entirely', () => {
    const merged = mergeOcrLines([line('ID No.', 10, 500)], [line('Pay:', 10, 10)]);
    expect(merged.map((l) => l.text)).toEqual(['Pay:', 'ID No.']);
  });

  it('does not treat lines at different vertical positions as overlapping', () => {
    const merged = mergeOcrLines(
      [line('छुट्टी का कारण', 10, 100, 200, 20)],
      [line('Ground on which leave is applied for:', 10, 400, 300, 20)],
    );
    expect(merged).toHaveLength(2);
  });

  it('sorts output top-to-bottom then left-to-right', () => {
    const merged = mergeOcrLines(
      [line('नीचे', 10, 300), line('ऊपर', 10, 10)],
      [line('right', 300, 150), line('left', 10, 150)],
    );
    expect(merged.map((l) => l.text)).toEqual(['ऊपर', 'left', 'right', 'नीचे']);
  });

  it('returns empty for two empty passes', () => {
    expect(mergeOcrLines([], [])).toEqual([]);
  });
});
