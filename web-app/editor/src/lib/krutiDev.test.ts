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
