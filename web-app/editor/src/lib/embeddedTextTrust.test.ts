import { describe, expect, it } from 'vitest';

import { mustVerifyPage, newFontTrust, noteSkippedPage, recordVerifiedPage, SPOT_CHECK_EVERY } from './embeddedTextTrust';

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
});
