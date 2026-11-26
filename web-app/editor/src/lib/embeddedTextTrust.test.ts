import { describe, expect, it } from 'vitest';

import {
  mustVerifyPage,
  newFontTrust,
  noteSkippedPage,
  recordVerifiedBand,
  recordVerifiedPage,
  SPARSE_AFTER_PAGES,
  SPOT_CHECK_EVERY,
} from './embeddedTextTrust';

// Enough words of each kind (complex: with ि or a halant; plain: without) for a verdict.
const words = (word: string, n: number) => Array.from({ length: n }, () => word).join(' ');
const good = `${words('किताब', 16)} ${words('कमल', 16)}`;
const goodOcr = 'किताब कमल';
// A broken map: the pre-base ि lands after its consonant, so complex words never match OCR.
const broken = `${words('कताबि', 16)} ${words('कमल', 16)}`;

describe('font trust', () => {
  it('checks every page until a font has passed on two pages', () => {
    const trust = newFontTrust();
    expect(mustVerifyPage(trust, ['f1'])).toBe(true);
    recordVerifiedPage(trust, new Map([['f1', good]]), goodOcr);
    expect(mustVerifyPage(trust, ['f1'])).toBe(true);
    recordVerifiedPage(trust, new Map([['f1', good]]), goodOcr);
    expect(mustVerifyPage(trust, ['f1'])).toBe(false);
  });

  it('checks pages that use a font not yet trusted', () => {
    const trust = newFontTrust();
    recordVerifiedPage(trust, new Map([['f1', good]]), goodOcr);
    recordVerifiedPage(trust, new Map([['f1', good]]), goodOcr);
    expect(mustVerifyPage(trust, ['f1', 'f2'])).toBe(true);
    expect(mustVerifyPage(trust, [])).toBe(false);
  });

  it('never trusts a font whose text failed', () => {
    const trust = newFontTrust();
    recordVerifiedPage(trust, new Map([['f1', good]]), goodOcr);
    recordVerifiedPage(trust, new Map([['f1', good]]), goodOcr);
    recordVerifiedPage(trust, new Map([['f1', broken]]), goodOcr);
    expect(mustVerifyPage(trust, ['f1'])).toBe(true);
    recordVerifiedPage(trust, new Map([['f1', good]]), goodOcr);
    expect(mustVerifyPage(trust, ['f1'])).toBe(true);
  });

  it('gathers too-little text over pages before judging', () => {
    const trust = newFontTrust();
    const half = `${words('किताब', 8)} ${words('कमल', 8)}`;
    recordVerifiedPage(trust, new Map([['f1', half]]), goodOcr);
    expect(mustVerifyPage(trust, ['f1'])).toBe(true);
    recordVerifiedPage(trust, new Map([['f1', half]]), goodOcr);
    expect(mustVerifyPage(trust, ['f1'])).toBe(false);
  });

  it('spot-checks a trusted font regularly', () => {
    const trust = newFontTrust();
    recordVerifiedPage(trust, new Map([['f1', good]]), goodOcr);
    recordVerifiedPage(trust, new Map([['f1', good]]), goodOcr);
    for (let i = 0; i < SPOT_CHECK_EVERY - 1; i++) {
      expect(mustVerifyPage(trust, ['f1'])).toBe(false);
      noteSkippedPage(trust);
    }
    expect(mustVerifyPage(trust, ['f1'])).toBe(true);
  });

  // A page that passed the quick band check counts as a checked page for the fonts in that band.
  it('trusts a font after it passes the band check on two pages', () => {
    const trust = newFontTrust();
    recordVerifiedBand(trust, new Map([['f1', good]]), good, goodOcr);
    expect(mustVerifyPage(trust, ['f1'])).toBe(true);
    recordVerifiedBand(trust, new Map([['f1', good]]), good, goodOcr);
    expect(mustVerifyPage(trust, ['f1'])).toBe(false);
  });

  it('credits only fonts whose text is in the band', () => {
    const trust = newFontTrust();
    const other = `${words('विद्यालय', 16)} ${words('नगर', 16)}`;
    for (let i = 0; i < 2; i++) recordVerifiedBand(trust, new Map([['f1', good], ['f2', other]]), good, goodOcr);
    expect(mustVerifyPage(trust, ['f1'])).toBe(false);
    expect(mustVerifyPage(trust, ['f2'])).toBe(true);
  });

  it('fails a font whose band text does not match OCR', () => {
    const trust = newFontTrust();
    recordVerifiedBand(trust, new Map([['f1', broken]]), broken, goodOcr);
    recordVerifiedBand(trust, new Map([['f1', broken]]), broken, goodOcr);
    expect(mustVerifyPage(trust, ['f1'])).toBe(true);
    expect(trust.failed.has('f1')).toBe(true);
  });

  it('stops checking for a font with too little text to judge once it has been seen on a few pages', () => {
    const trust = newFontTrust();
    for (let i = 0; i < 2; i++) recordVerifiedPage(trust, new Map([['body', good]]), goodOcr);
    for (let i = 0; i < SPARSE_AFTER_PAGES - 1; i++) {
      recordVerifiedPage(trust, new Map([['heading', 'अध्याय']]), goodOcr);
      expect(mustVerifyPage(trust, ['body', 'heading'])).toBe(true);
    }
    recordVerifiedPage(trust, new Map([['heading', 'अध्याय']]), goodOcr);
    expect(mustVerifyPage(trust, ['body', 'heading'])).toBe(false);
  });
});
