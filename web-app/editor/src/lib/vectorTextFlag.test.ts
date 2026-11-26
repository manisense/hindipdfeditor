import { describe, expect, it } from 'vitest';

import { isVectorTextEnabled, VECTOR_TEXT_STORAGE_KEY } from './vectorTextFlag';

function makeStorage(initial: Record<string, string> = {}) {
  return { getItem: (key: string) => initial[key] ?? null };
}

describe('isVectorTextEnabled', () => {
  it('is off by default when neither query nor storage enables it', () => {
    expect(isVectorTextEnabled('', makeStorage())).toBe(false);
  });

  it('enables Plan B via ?planB=1, ?planB=true, or ?planB=on', () => {
    expect(isVectorTextEnabled('?planB=1', makeStorage())).toBe(true);
    expect(isVectorTextEnabled('?planB=true', makeStorage())).toBe(true);
    expect(isVectorTextEnabled('?planB=on', makeStorage())).toBe(true);
  });

  it('enables Plan B via localStorage when query param is absent', () => {
    expect(isVectorTextEnabled('', makeStorage({ [VECTOR_TEXT_STORAGE_KEY]: 'on' }))).toBe(true);
    expect(isVectorTextEnabled('', makeStorage({ [VECTOR_TEXT_STORAGE_KEY]: 'off' }))).toBe(false);
  });

  it('lets ?planB=0 override localStorage back to Plan A fallback', () => {
    expect(isVectorTextEnabled('?planB=0', makeStorage({ [VECTOR_TEXT_STORAGE_KEY]: 'on' }))).toBe(false);
    expect(isVectorTextEnabled('?planB=off', makeStorage({ [VECTOR_TEXT_STORAGE_KEY]: 'on' }))).toBe(false);
  });
});
