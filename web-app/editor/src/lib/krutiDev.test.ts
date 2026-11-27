import { expect, it } from 'vitest';

import { krutiDevToUnicode } from './krutiDev';

// Lines from a real CISF recruitment notice and what the page shows.
it.each([
  ['rFkk dsUnz ljdkj ds deZpkfj;ksa dks le; le; ij ns; lkekU; HkÙkksa lfgr', 'तथा केन्द्र सरकार के कर्मचारियों को समय समय पर देय सामान्य भत्तों सहित'],
  ['vLFkkbZ inksa dks Hkjus ds fy, vkWuykbu', 'अस्थाई पदों को भरने के लिए ऑनलाइन'],
  ['ij ykxw dsUnzh; flfoy lsok fu;ekoyh }kjk vf/k’kkflr', 'पर लागू केन्द्रीय सिविल सेवा नियमावली द्वारा अधिशासित'],
  ['dkWye', 'कॉलम'],
  ['fu/kkZfjr', 'निर्धारित'],
  ['pkSFkk', 'चौथा'],
  ['pSu', 'चैन'],
  ['fMfLVªDV', 'डिस्ट्रिक्ट'],
  ['fLIyV', 'स्प्लिट'],
])('%s', (kruti, unicode) => {
  expect(krutiDevToUnicode(kruti)).toBe(unicode);
});

// Word files whose KrutiDev font draws its own curly-quote glyphs: ” and “ are श, ’ is ष (a UP
// RTI notice, a Himachal gazette, a BPSC notice; checked against the page images). Their text has
// curly double quotes inside words, which AutoCorrected text (the CISF notice above) does not.
it.each([
  ['mRrj izns”k “kklu ifjHkk’kk,a', 'उत्तर प्रदेश शासन परिभाषाएं'],
  ['T;s’B ofj’B “kfDr', 'ज्येष्ठ वरिष्ठ शक्ति'],
])('font quote glyphs: %s', (kruti, unicode) => {
  expect(krutiDevToUnicode(kruti)).toBe(unicode);
});

it('reads the quote style from the whole text when given it', () => {
  // One item of a page whose other items show the font's own glyphs: ’ alone is still ष.
  expect(krutiDevToUnicode('ifjHkk’kk,a', 'izns”k ifjHkk’kk,a')).toBe('परिभाषाएं');
  expect(krutiDevToUnicode('vf/k’kkflr', 'vf/k’kkflr')).toBe('अधिशासित');
});

// From the 2026 corpus survey (Uttarakhand UCC notification, MP notice), checked on the page images.
it.each([
  // è is the half form ध्, like `/`.
  ['vfèklwpuk', 'अधिसूचना'],
  ['mÙkjkfèkdkj', 'उत्तराधिकार'],
  // A reph after a conjunct goes before the whole conjunct.
  ['lkeF;Z', 'सामर्थ्य'],
  ['e/;Z', 'मर्ध्य'],
  // Rephs that were already right stay right.
  ['dk;Z', 'कार्य'],
  ['dhfrZ', 'कीर्ति'],
  ['oxhZdj.k', 'वर्गीकरण'],
])('survey: %s', (kruti, unicode) => {
  expect(krutiDevToUnicode(kruti)).toBe(unicode);
});
