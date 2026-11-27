import kru2uni from '@anthro-ai/krutidev-unicode';

import { reorderDevanagariMarks } from './devanagariMarks';
import { REPH_MARK } from './fontGlyphText';

/** ि followed by virama + consonant, which no Unicode text has. */
const I_BEFORE_VIRAMA = /\u093F(\u094D[\u0915-\u0939\u0958-\u095F]\u093C?)/u;

/**
 * KrutiDev-family text (Hindi typed as Latin keystrokes, e.g. `rFkk dsUnz ljdkj`) converted to
 * Unicode Devanagari (`तथा केन्द्र सरकार`). Uses the LTRC-derived mapping in
 * `@anthro-ai/krutidev-unicode`, plus fixes measured on a real CISF notice:
 * - curly quotes: KrutiDev types श with `'` and ष with `"`. When Word's AutoCorrect curled those
 *   keys, ’ stands for श (a CISF notice: अधिशासित); but when the text uses the font's own curly
 *   glyphs, which show as curly double quotes inside words, ” and “ are श and ’ and ‘ are ष (UP,
 *   Himachal and Bihar notices: प्रदेश, परिभाषाएं). See {@link usesFontQuoteGlyphs};
 * - vowel-sign fragments the mapping leaves are joined: आॅ→ऑ, ाॅ→ॉ, ाें→ों, ाे→ो, ाै→ौ, ाा→ा;
 * - the mapping reads `pkS` as चै (it is चौ: च + ौ), so a zero-width space keeps `p` and `kS` apart;
 * - ि left before a virama in long clusters (स्टि्र, स्पि्ल) moves after the cluster (स्ट्रि, स्प्लि);
 * - `è` is the half form ध् (like `/`); the mapping reads it as a full ध (अधिासूचना);
 * - `£` (ि with a reph) is left unread by the mapping (विनि£दष्ट for विनिर्दिष्ट);
 * - the reph key `Z` goes before the whole syllable it follows, conjuncts included: the mapping
 *   put it inside them (सामथर्य for सामर्थ्य), so it is placed with the reph mark instead.
 *
 * @param text KrutiDev-encoded text.
 * @param context The whole text it comes from (a page's text in that font), to judge which
 *   quote glyphs it uses; the text itself by default.
 */
export function krutiDevToUnicode(text: string, context: string = text): string {
  const fontQuotes = usesFontQuoteGlyphs(context);
  const straightened = text
    .replace(/[‘’]/gu, fontQuotes ? '"' : "'")
    .replace(/[“”]/gu, fontQuotes ? "'" : '"')
    .replace(/pkS/gu, 'p\u200BkS')
    .replace(/è/gu, '/')
    // `£` is ि with a reph: typed before the letter it goes with, like `f` with `Z` after it.
    .replace(/£(.)/gu, 'f$1Z')
    // `bZ` is ई, not a reph; `ZZ` is one reph (as the mapping reads them).
    .replace(/(?<!b)Z+/gu, REPH_MARK);
  const mapped = kru2uni(straightened).replace(/\u200B/gu, '').replace(new RegExp(`\u094D${REPH_MARK}`, 'gu'), REPH_MARK);
  let unicode = reorderDevanagariMarks(mapped);
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

/**
 * Whether KrutiDev text uses the font's own curly-quote glyphs (curly double quotes inside words,
 * as in `izns”k`) rather than AutoCorrected keys.
 */
export function usesFontQuoteGlyphs(text: string): boolean {
  return /[A-Za-z;][“”]|[“”][A-Za-z]/u.test(text);
}
