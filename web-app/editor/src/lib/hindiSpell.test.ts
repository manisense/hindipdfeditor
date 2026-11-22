import { describe, expect, it } from 'vitest';

import { HindiSpeller, replaceWord } from './hindiSpell';

const speller = new HindiSpeller(['है', 'आवेदन', 'परीक्षा', 'विद्यालय', 'लिखवाना', 'करना', 'प्रमाणपत्र', 'हूँ', 'ज़रूरी', 'कार्यालय', 'कार्य', 'आवेदक']);

describe('HindiSpeller.isKnown', () => {
  it('knows dictionary words and their common inflections', () => {
    for (const word of ['आवेदन', 'आवेदनों', 'परीक्षाओं', 'विद्यालयों', 'लिखवाएंगे', 'प्रमाणपत्रों', 'करेंगे']) {
      expect(speller.isKnown(word), word).toBe(true);
    }
  });

  it('treats nukta and chandrabindu spellings as the same word', () => {
    expect(speller.isKnown('हूं')).toBe(true);
    expect(speller.isKnown('जरूरी')).toBe(true);
  });

  it('does not judge numbers, single letters or non-Hindi words', () => {
    for (const word of ['२०२६', 'क', 'Form', '12']) expect(speller.isKnown(word), word).toBe(true);
  });

  it('flags a misspelling', () => {
    expect(speller.isKnown('कार्यलय')).toBe(false);
  });
});

describe('HindiSpeller.suggest', () => {
  it('offers the closest dictionary words, commonest first', () => {
    expect(speller.suggest('कार्यलय')[0]).toBe('कार्यालय');
    expect(speller.suggest('आवदन')).toContain('आवेदन');
  });
});

describe('HindiSpeller.misspelt', () => {
  it('lists words added to a text that the dictionary does not know, once each', () => {
    expect(speller.misspelt('आवेदन कार्यलय है कार्यलय', 'आवेदन है')).toEqual(['कार्यलय']);
  });

  it('leaves the original words alone (names, places)', () => {
    expect(speller.misspelt('रामलाल का आवेदन', 'रामलाल का')).toEqual([]);
  });

  it('honours words the user added', () => {
    const own = new HindiSpeller(['है'], new Set(['तहसील']));
    expect(own.misspelt('तहसील है', '')).toEqual([]);
  });
});

describe('replaceWord', () => {
  it('replaces whole words only, keeping punctuation', () => {
    expect(replaceWord('कार्यलय, कार्यलयों और कार्यलय।', 'कार्यलय', 'कार्यालय')).toBe('कार्यालय, कार्यलयों और कार्यालय।');
  });
});
