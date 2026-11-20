import { createHash as mockCreateHash } from 'crypto';

import { translationJobId } from './translationJobId';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, data: string) =>
    mockCreateHash('sha256').update(data).digest('hex'),
}));

describe('translationJobId', () => {
  it('gives the same file the same job each time it is picked', async () => {
    const first = await translationJobId({ name: 'form.pdf', size: 1200, pageCount: 3 });
    const again = await translationJobId({ name: 'form.pdf', size: 1200, pageCount: 3 });
    expect(again).toBe(first);
    expect(first).toMatch(/^translate-[0-9a-f]{32}$/u);
  });

  it('gives a different file a different job', async () => {
    const a = await translationJobId({ name: 'form.pdf', size: 1200, pageCount: 3 });
    expect(await translationJobId({ name: 'form.pdf', size: 1201, pageCount: 3 })).not.toBe(a);
    expect(await translationJobId({ name: 'other.pdf', size: 1200, pageCount: 3 })).not.toBe(a);
    expect(await translationJobId({ name: 'form.pdf', pageCount: 3 })).not.toBe(a);
  });
});
