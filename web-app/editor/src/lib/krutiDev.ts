import kru2uni from '@anthro-ai/krutidev-unicode';

/** ि followed by virama + consonant, which no Unicode text has. */
const I_BEFORE_VIRAMA = /\u093F(\u094D[\u0915-\u0939\u0958-\u095F]\u093C?)/u;

/**
 * KrutiDev-family text (Hindi typed as Latin keystrokes, e.g. `rFkk dsUnz ljdkj`) converted to
 * Unicode Devanagari (`तथा केन्द्र सरकार`). Uses the LTRC-derived mapping in
 * `@anthro-ai/krutidev-unicode`, plus fixes measured on a real CISF notice:
 * - PDF text extraction returns curly quotes, but KrutiDev uses a straight `'` before `k` for श and
 *   `"` for ष, so curly quotes are straightened first (अधिशासित, not अधिषासित);
 * - vowel-sign fragments the mapping leaves are joined: आॅ→ऑ, ाॅ→ॉ, ाें→ों, ाे→ो, ाै→ौ, ाा→ा;
 * - the mapping reads `pkS` as चै (it is चौ: च + ौ), so a zero-width space keeps `p` and `kS` apart;
 * - ि left before a virama in long clusters (स्टि्र, स्पि्ल) moves after the cluster (स्ट्रि, स्प्लि).
 *
 * @param text KrutiDev-encoded text.
 */
export function krutiDevToUnicode(text: string): string {
  const straightened = text
    .replace(/[‘’]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/pkS/gu, 'p\u200BkS');
  let unicode = kru2uni(straightened).replace(/\u200B/gu, '');
  while (I_BEFORE_VIRAMA.test(unicode)) unicode = unicode.replace(I_BEFORE_VIRAMA, '$1\u093F');
  return unicode
    .replace(/आॅ/gu, 'ऑ')
    .replace(/ाॅ/gu, 'ॉ')
    .replace(/ाें/gu, 'ों')
    .replace(/ाे/gu, 'ो')
    .replace(/ाै/gu, 'ौ')
    .replace(/ाा/gu, 'ा')
    .normalize('NFC');
}
