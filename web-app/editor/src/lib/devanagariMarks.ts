import { PRE_BASE_MARK, REPH_MARK } from './fontGlyphText';

const CONSONANT = '[\u0915-\u0939\u0958-\u095F\u0978-\u097F]';
/** A consonant cluster: consonants joined by virama, each with an optional nukta. */
const CLUSTER = `(?:${CONSONANT}़?्)*${CONSONANT}़?`;
/** Signs that belong to a syllable after its consonants: matras, candrabindu, anusvara, visarga. */
const SIGNS = '[ा-ौॎॏॕ-ॗऀ-ः]*';

const preBase = new RegExp(`${PRE_BASE_MARK}(${CLUSTER})`, 'gu');
const reph = new RegExp(`(${CLUSTER}${SIGNS})${REPH_MARK}`, 'gu');

/**
 * Puts glyph text drawn in visual order back in reading order: a pre-base ि mark moves after the
 * consonant cluster drawn after it, and a reph mark becomes र् before the syllable drawn before it.
 * A mark with nothing to move past becomes its plain letters where it stands.
 */
export function reorderDevanagariMarks(text: string): string {
  if (!text.includes(PRE_BASE_MARK) && !text.includes(REPH_MARK)) return text;
  return text
    .replace(preBase, (_, cluster: string) => `${cluster}ि`)
    .replace(reph, (_, syllable: string) => `र्${syllable}`)
    .replaceAll(PRE_BASE_MARK, 'ि')
    .replaceAll(REPH_MARK, 'र्');
}
