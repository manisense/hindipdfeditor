/**
 * Unicode Devanagari converted to KrutiDev 010 key codes, the reverse of `krutiDevToUnicode`.
 *
 * KrutiDev draws Hindi glyphs on top of Latin key codes, in visual order. Two things therefore
 * move before the table lookup:
 * - the vowel sign ि is typed before its consonant cluster (`f` + cluster: हि → fg);
 * - a reph (र् before a consonant) is typed after its syllable, after the vowel signs and before
 *   ं/ँ (`Z`: धर्म → /keZ, वर्षों → o"kksZa).
 * The rest is a longest-match table. Characters KrutiDev cannot show are kept and reported, never
 * dropped, so the caller can warn the user. Latin letters are kept as typed and reported too,
 * because a KrutiDev font shows them as Hindi glyphs.
 *
 * Every mapping is checked by round trip through `krutiDevToUnicode` (unicodeToKrutiDev.test.ts).
 */

/** Result of a conversion. */
export type KrutiDevConversion = {
  /** KrutiDev 010 key codes, to be shown in a KrutiDev 010 font. */
  text: string;
  /** Distinct non-Latin characters with no KrutiDev form, kept unchanged in `text`. */
  unsupported: string[];
  /** True when the input had Latin letters, which a KrutiDev font shows as Hindi glyphs. */
  hasLatin: boolean;
};

const VIRAMA = "्";
const NUKTA = "़";
const I_SIGN = "ि";
const RA = "र";
/** Placeholders for `f` and `Z` while the text is still Unicode. Private-use, never in input. */
const I_MARK = "";
const REPH_MARK = "";

/** Consonants: [Unicode, KrutiDev full form, KrutiDev half form]. */
const CONSONANTS: readonly (readonly [string, string, string])[] = [
  ["क", "d", "D"],
  ["ख", "[k", "["],
  ["ग", "x", "X"],
  ["घ", "?k", "?"],
  ["ङ", "³", "³~"],
  ["च", "p", "P"],
  ["छ", "N", "N~"],
  ["ज", "t", "T"],
  ["झ", ">", "÷"],
  ["ञ", "¥", "¥~"],
  ["ट", "V", "V~"],
  ["ठ", "B", "B~"],
  ["ड", "M", "M~"],
  ["ढ", "<", "<~"],
  ["ण", ".k", "."],
  ["त", "r", "R"],
  ["थ", "Fk", "F"],
  ["द", "n", "n~"],
  ["ध", "/k", "/"],
  ["न", "u", "U"],
  ["प", "i", "I"],
  ["फ", "Q", "¶"],
  ["ब", "c", "C"],
  ["भ", "Hk", "H"],
  ["म", "e", "E"],
  ["य", ";", "¸"],
  ["र", "j", "j~"],
  ["ल", "y", "Y"],
  ["ळ", "G", "G~"],
  ["व", "o", "O"],
  ["श", "'k", "'"],
  ["ष", '"k', '"'],
  ["स", "l", "L"],
  ["ह", "g", "º"],
];

const CONSONANT_SET = new Set(CONSONANTS.map(([u]) => u));

/** Nukta letters, written as consonant + nukta after NFC (they are composition exclusions). */
const NUKTA_FORMS: readonly (readonly [string, string, string])[] = [
  ["क", "d+", "D+"],
  ["ख", "[+k", "[+"],
  ["ग", "x+", "X+"],
  ["ज", "t+", "T+"],
  ["ड", "M+", "M+~"],
  ["ढ", "<+", "<+~"],
  ["फ", "Q+", "¶+"],
  ["य", ";+", "¸+"],
];

/** Ligatures KrutiDev has as one key, longest first in the table below. */
const LIGATURES: readonly (readonly [string, string])[] = [
  ["क्ष्", "{"],
  ["क्ष", "{k"],
  ["त्र्", "«"],
  ["त्र", "="],
  ["ज्ञ", "K"],
  ["श्र", "J"],
  ["त्त्", "Ù"],
  ["त्त", "Ùk"],
  ["क्त", "ä"],
  ["क्क", "ô"],
  ["क्र", "Ø"],
  ["न्न", "é"],
  ["ह्न", "à"],
  ["ह्य", "á"],
  ["ह्म", "ã"],
  ["ह्र", "ºz"],
  ["हृ", "â"],
  ["दृ", "–"],
  ["कृ", "—"],
  ["द्द", "í"],
  ["द्ध", ")"],
  ["द्य", "|"],
  ["द्व", "}"],
  ["ट्ट", "ê"],
  ["ट्ठ", "ë"],
  ["ड्ड", "ì"],
  ["ड्ढ", "ï"],
  ["ट्र", "Vª"],
  ["ड्र", "Mª"],
  ["छ्र", "Nª"],
  ["फ्र", "Ý"],
  ["छ्य", "Nî"],
  ["ट्य", "Vî"],
  ["ठ्य", "Bî"],
  ["ड्य", "Mî"],
  ["ढ्य", "<î"],
  ["रु", "#"],
  ["रू", ":"],
];

const VOWELS: readonly (readonly [string, string])[] = [
  ["औ", "vkS"],
  ["ओ", "vks"],
  ["ऑ", "vkW"],
  ["आ", "vk"],
  ["अ", "v"],
  ["ई", "bZ"],
  ["इ", "b"],
  ["ऊ", "Å"],
  ["उ", "m"],
  ["ऋ", "_"],
  ["ऐ", ",s"],
  ["ए", ","],
];

const SIGNS: readonly (readonly [string, string])[] = [
  ["ा", "k"],
  ["ी", "h"],
  ["ु", "q"],
  ["ू", "w"],
  ["ृ", "`"],
  ["े", "s"],
  ["ै", "S"],
  ["ो", "ks"],
  ["ौ", "kS"],
  ["ॉ", "kW"],
  ["ॅ", "W"],
  ["ं", "a"],
  ["ँ", "¡"],
  ["ः", "%"],
  ["ऽ", "•"],
  [VIRAMA + RA, "z"],
];

const PUNCTUATION: readonly (readonly [string, string])[] = [
  ["॥", "AA"],
  ["।", "A"],
  ["॰", "ñ"],
  ["०", "å"],
  ["१", "ƒ"],
  ["२", "„"],
  ["३", "…"],
  ["४", "†"],
  ["५", "‡"],
  ["६", "ˆ"],
  ["७", "‰"],
  ["८", "Š"],
  ["९", "‹"],
  [".", "-"],
  ["-", "&"],
  [",", "]"],
  ["?", "\\"],
  [";", "("],
  ["(", "¼"],
  [")", "½"],
  [":", "%"],
  ["/", "@"],
  ["=", "¾"],
  ["}", "À"],
  ["‘", "^"],
  ["’", "*"],
  ["“", "Þ"],
  ["”", "ß"],
  ["'", "*"],
  ['"', "ß"],
];

/** Characters a KrutiDev font shows as themselves. */
const PASS_THROUGH = /[0-9 \t\n\r!]/u;

function buildTable(): Map<string, string> {
  const table = new Map<string, string>();
  const add = (unicode: string, kruti: string) => {
    if (!table.has(unicode)) table.set(unicode, kruti);
  };
  for (const [u, k] of LIGATURES) add(u, k);
  for (const [u, full, half] of NUKTA_FORMS) {
    add(u + NUKTA + VIRAMA, half);
    add(u + NUKTA, full);
  }
  for (const [u, full, half] of CONSONANTS) {
    add(u + VIRAMA, half);
    add(u, full);
  }
  for (const [u, k] of [...VOWELS, ...SIGNS, ...PUNCTUATION]) add(u, k);
  return table;
}

const TABLE = buildTable();
const MAX_KEY = Math.max(...[...TABLE.keys()].map((key) => key.length));

/** A consonant, optionally with nukta. */
const CONSONANT = `[${[...CONSONANT_SET].join("")}]${NUKTA}?`;
/** A consonant cluster: consonants joined by virama. */
const CLUSTER = `${CONSONANT}(?:${VIRAMA}${CONSONANT})*`;
/** Vowel signs that a reph is typed after. ं ँ follow the reph. */
const REPH_SIGNS = "[ा-ौॅॉ]*";

const REPH = new RegExp(`${RA}${VIRAMA}(${CLUSTER}${REPH_SIGNS})`, "gu");
const I_AFTER_CLUSTER = new RegExp(`(${CLUSTER})${I_SIGN}`, "gu");

/**
 * Converts Unicode Hindi text to KrutiDev 010 key codes.
 *
 * @param text Unicode text (any normalisation form).
 */
export function unicodeToKrutiDev(text: string): KrutiDevConversion {
  const prepared = text
    .normalize("NFC")
    .replace(/[‌‍]/gu, "")
    .replace(REPH, `$1${REPH_MARK}`)
    .replace(I_AFTER_CLUSTER, `${I_MARK}$1`);

  let out = "";
  const unsupported = new Set<string>();
  let hasLatin = false;
  for (let i = 0; i < prepared.length; ) {
    const char = prepared[i];
    if (char === I_MARK) {
      out += "f";
      i += 1;
      continue;
    }
    if (char === REPH_MARK) {
      out += "Z";
      i += 1;
      continue;
    }
    const match = longestMatch(prepared, i);
    if (match) {
      out += match.kruti;
      i += match.length;
      continue;
    }
    if (/[A-Za-z]/u.test(char)) hasLatin = true;
    else if (!PASS_THROUGH.test(char)) unsupported.add(char);
    out += char;
    i += 1;
  }
  return { text: out, unsupported: [...unsupported], hasLatin };
}

function longestMatch(text: string, start: number): { kruti: string; length: number } | null {
  for (let length = Math.min(MAX_KEY, text.length - start); length > 0; length -= 1) {
    const key = text.slice(start, start + length);
    const kruti = TABLE.get(key);
    if (kruti === undefined) continue;
    // A half form only joins a following consonant. Before a space or the end of a word the
    // virama is written out: जगत् → txr~, not the half form txR.
    const full = key.endsWith(VIRAMA) ? TABLE.get(key.slice(0, -1)) : undefined;
    if (full !== undefined) {
      const next = text[start + length] ?? "";
      // Consonant + ्र is the full consonant with the rakar stroke `z`: प्र → iz, केन्द्र → dsUnz.
      if (next === RA) return { kruti: `${full}z`, length: length + 1 };
      if (!CONSONANT_SET.has(next)) return { kruti: `${full}~`, length };
    }
    return { kruti, length };
  }
  return null;
}
