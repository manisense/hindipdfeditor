import { describe, expect, it } from 'vitest';

import { krutiDevToUnicode } from './krutiDev';
import { unicodeToKrutiDev } from './unicodeToKrutiDev';
import corpus from './fixtures/hindi-sentences.txt?raw';

/** The forward converter writes visarga as a colon, as KrutiDev typists do, and quotes come back curly. */
const comparable = (text: string) =>
  text.normalize('NFC').replace(/ः/gu, ':').replace(/["“”]/gu, '”').replace(/['‘’]/gu, '’');

describe('unicodeToKrutiDev', () => {
  // KrutiDev as typed by hand: a real CISF notice (see krutiDev.test.ts) and the package README.
  it.each([
    ['तथा केन्द्र सरकार के कर्मचारियों को समय समय पर देय सामान्य भत्तों सहित', 'rFkk dsUnz ljdkj ds deZpkfj;ksa dks le; le; ij ns; lkekU; HkÙkksa lfgr'],
    ['अस्थाई पदों को भरने के लिए ऑनलाइन', 'vLFkkbZ inksa dks Hkjus ds fy, vkWuykbu'],
    ['कॉलम', 'dkWye'],
    ['निर्धारित', 'fu/kkZfjr'],
    ['द्वारा', '}kjk'],
    ['मेरा नाम नेहल है। मै एक छात्र हूँ।', 'esjk uke usgy gSA eS ,d Nk= gw¡A'],
    ['भारत', 'Hkkjr'],
    ['हिन्दी', 'fgUnh'],
    ['धर्म', '/keZ'],
    ['कार्य', 'dk;Z'],
    ['आर्थिक', 'vkfFkZd'],
    ['वर्षों', 'o"kksZa'],
    ['प्रमाण', 'izek.k'],
    ['श्री', 'Jh'],
    ['क्षेत्र', '{ks='],
    ['ज्ञान', 'Kku'],
    ['स्थिति', 'fLFkfr'],
    ['जगत्', 'txr~'],
  ])('%s', (unicode, kruti) => {
    expect(unicodeToKrutiDev(unicode).text).toBe(kruti);
  });

  it.each([
    'क़लम ख़बर ग़ज़ल ज़रूर पढ़ाई फ़ोन',
    'कृपया हृदय दृष्टि',
    'शुद्ध विद्या द्वार उद्देश्य',
    'राष्ट्र ट्रेन ड्रामा',
    'पत्ता उत्तर सत्त्व',
    'अन्न प्रसन्न',
    'चिह्न ब्रह्म',
    'आत्मा पद्म',
    'पूर्ति आर्थिक सूर्य',
    'किंतु सिंह',
    'अतः पुनः',
    'ॐ नमः',
    'संख्या १२३४५६७८९०',
    'क्या? हाँ, ठीक है; (नोट) - देखें।',
  ])('round-trips %s', (unicode) => {
    const result = unicodeToKrutiDev(unicode);
    expect(result.unsupported).toEqual(expect.any(Array));
    if (result.unsupported.length === 0) {
      expect(comparable(krutiDevToUnicode(result.text))).toBe(comparable(unicode));
    }
  });

  it('reports characters KrutiDev cannot show and keeps them', () => {
    const result = unicodeToKrutiDev('ॐ');
    expect(result.unsupported).toEqual(['ॐ']);
    expect(result.text).toBe('ॐ');
  });

  it('keeps Latin letters and flags them', () => {
    const result = unicodeToKrutiDev('SSC परीक्षा 2026');
    expect(result.hasLatin).toBe(true);
    expect(result.text.startsWith('SSC ')).toBe(true);
    expect(result.text.endsWith(' 2026')).toBe(true);
  });

  it('round-trips every sentence of the site corpus', () => {
    const sentences = corpus.split('\n').filter(Boolean);
    expect(sentences.length).toBeGreaterThan(300);
    const failures = sentences
      .map((sentence) => {
        const result = unicodeToKrutiDev(sentence);
        const back = krutiDevToUnicode(result.text);
        return { sentence, kruti: result.text, back, unsupported: result.unsupported };
      })
      .filter(({ sentence, back, unsupported }) => unsupported.length > 0 || comparable(back) !== comparable(sentence));
    expect(failures).toEqual([]);
  });
});
