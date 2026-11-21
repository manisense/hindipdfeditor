import { describe, expect, it } from 'vitest';

import { romanWordToHindi, transliterateBeforeCaret } from './romanToHindi';

describe('romanWordToHindi', () => {
  it.each([
    ['namaste', 'नमस्ते'],
    ['mera', 'मेरा'],
    ['naam', 'नाम'],
    ['kya', 'क्या'],
    ['hai', 'है'],
    ['hain', 'हैं'],
    ['main', 'मैं'],
    ['aap', 'आप'],
    ['kaise', 'कैसे'],
    ['aur', 'और'],
    ['bharat', 'भरत'],
    ['hindi', 'हिन्दी'],
    ['shukriya', 'शुक्रिया'],
    ['dhanyavaad', 'धन्यवाद'],
    ['ki', 'की'],
    ['ke', 'के'],
    ['pradesh', 'प्रदेश'],
    ['sarkar', 'सरकर'],
    ['sarkaar', 'सरकार'],
    ['vidyalay', 'विद्यलय'],
    ['kshetra', 'क्षेत्र'],
    ['karna', 'करना'],
    ['dharm', 'धर्म'],
    ['patra', 'पत्र'],
    ['vidya', 'विद्या'],
    ['karya', 'कर्य'],
    ['kaarya', 'कार्य'],
    ['surya', 'सुर्य'],
  ])('%s → %s', (roman, hindi) => {
    expect(romanWordToHindi(roman)).toBe(hindi);
  });
});

describe('transliterateBeforeCaret', () => {
  it('converts the word just typed when a space follows it', () => {
    expect(transliterateBeforeCaret('मेरा naam ', 10)).toEqual({ value: 'मेरा नाम ', caret: 9 });
  });

  it('keeps text after the caret and ignores non-boundaries or non-Roman words', () => {
    expect(transliterateBeforeCaret('kya? baad', 4)).toEqual({ value: 'क्या? baad', caret: 5 });
    expect(transliterateBeforeCaret('naam', 4)).toBeNull();
    expect(transliterateBeforeCaret('नाम ', 4)).toBeNull();
    expect(transliterateBeforeCaret('2025 ', 5)).toBeNull();
  });
});
