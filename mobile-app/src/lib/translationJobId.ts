import * as Crypto from 'expo-crypto';

/**
 * AI quota job ID for one PDF, derived from the file so picking the same file again counts as
 * the same document against the daily limit. The picker copies each pick to a new cache path,
 * so the URI cannot be the key.
 *
 * @param file `size` in bytes, when known; `pageCount` in pages.
 */
export async function translationJobId(file: {
  name: string;
  size?: number;
  pageCount: number;
}): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify([file.name, file.size ?? null, file.pageCount]),
  );
  return `translate-${digest.slice(0, 32)}`;
}
