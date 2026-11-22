import kru2uni from '@anthro-ai/krutidev-unicode';

/**
 * KrutiDev-family text (Hindi typed as Latin keystrokes, e.g. `rFkk dsUnz ljdkj`) converted to
 * Unicode Devanagari (`तथा केन्द्र सरकार`). Uses the LTRC-derived mapping in
 * `@anthro-ai/krutidev-unicode`, plus fixes measured on a real CISF notice:
 * - PDF text extraction returns curly quotes, but KrutiDev uses a straight `'` before `k` for श and
 *   `"` for ष, so curly quotes are straightened first (अधिशासित, not अधिषासित);
 * - vowel-sign fragments the mapping leaves are joined: आॅ→ऑ, ाॅ→ॉ, ाें→ों, ाे→ो, ाै→ौ, ाा→ा.
 *
 * @param text KrutiDev-encoded text.
 */
export function krutiDevToUnicode(text: string): string {
  const straightened = text.replace(/[‘’]/gu, "'").replace(/[“”]/gu, '"');
  return kru2uni(straightened)
    .replace(/आॅ/gu, 'ऑ')
    .replace(/ाॅ/gu, 'ॉ')
    .replace(/ाें/gu, 'ों')
    .replace(/ाे/gu, 'ो')
    .replace(/ाै/gu, 'ौ')
    .replace(/ाा/gu, 'ा')
    .normalize('NFC');
}
