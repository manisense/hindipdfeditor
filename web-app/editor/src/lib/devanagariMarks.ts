import { PRE_BASE_MARK, REPH_MARK } from './fontGlyphText';

const CONSONANT = '[\u0915-\u0939\u0958-\u095F\u0978-\u097F]';
/** A consonant cluster: consonants joined by virama, each with an optional nukta. */
const CLUSTER = `(?:${CONSONANT}़?्)*${CONSONANT}़?`;
/** Signs that belong to a syllable after its consonants: matras, candrabindu, anusvara, visarga. */
const SIGNS = '[ा-ौॎॏॕ-ॗऀ-ः]*';

// A pre-base ि always belongs to the cluster after it, so a measured gap between them is no space.
// A cluster cut off after a virama or nukta (a text item ending inside a conjunct) is not matched.
const preBase = new RegExp(`${PRE_BASE_MARK}\\s*(${CLUSTER})(?![़्])`, 'gu');
const reph = new RegExp(`(${CLUSTER}${SIGNS})${REPH_MARK}`, 'gu');

/**
 * Puts glyph text drawn in visual order back in reading order: a pre-base ि mark moves after the
 * consonant cluster drawn after it, and a reph mark becomes र् before the syllable drawn before it.
 * A mark with nothing to move past becomes its plain letters where it stands, unless
 * `keepUnresolved` keeps it for a later pass (a word split across pdf.js text items: उ ि ल्ल | ि खत).
 */
export function reorderDevanagariMarks(text: string, options: { keepUnresolved?: boolean } = {}): string {
  if (!text.includes(PRE_BASE_MARK) && !text.includes(REPH_MARK)) return text;
  const ordered = text
    .replace(preBase, (_, cluster: string) => `${cluster}ि`)
    .replace(reph, (_, syllable: string) => `र्${syllable}`);
  return options.keepUnresolved ? ordered : ordered.replaceAll(PRE_BASE_MARK, 'ि').replaceAll(REPH_MARK, 'र्');
}

/** Whether `char` is one of the marks {@link reorderDevanagariMarks} resolves. */
export const isDevanagariMark = (char: string) => char === PRE_BASE_MARK || char === REPH_MARK;
