/**
 * Phonetic Roman → Devanagari for people typing Hindi on an English keyboard ("Hinglish"):
 * `mera naam kya hai` → `मेरा नाम क्या है`. Consonant clusters become conjuncts (`namaste` →
 * नमस्ते), and three habits of casual Hinglish spelling are followed: a word-final `a` is a long
 * ा (`mera`, `kya`), a word-final `i` is ी (`hindi`), and a word-final `n` after a vowel is the
 * nasal ं (`main` → मैं, `hain` → हैं). Two more habits decide ambiguous clusters: `r` before
 * another consonant inside a word keeps its vowel (`karna` → करना, `sarkar` → सरकर; a word-final
 * `rm`/`rsh` still joins: `dharm` → धर्म), and a final `a` after a cluster stays short (`kshetra`
 * → क्षेत्र) unless the cluster ends in `y` (`kya` → क्या; but `karya` → कर्य). Long vowels can always be typed
 * explicitly (`aa`, `ee`, `oo`).
 */

const CONSONANTS: [string, string][] = [
  ['ksh', 'क्ष'],
  ['chh', 'छ'],
  ['gy', 'ज्ञ'],
  ['kh', 'ख'],
  ['gh', 'घ'],
  ['ch', 'च'],
  ['jh', 'झ'],
  ['th', 'थ'],
  ['dh', 'ध'],
  ['ph', 'फ'],
  ['bh', 'भ'],
  ['sh', 'श'],
  ['k', 'क'],
  ['g', 'ग'],
  ['c', 'क'],
  ['j', 'ज'],
  ['t', 'त'],
  ['d', 'द'],
  ['n', 'न'],
  ['p', 'प'],
  ['f', 'फ़'],
  ['b', 'ब'],
  ['m', 'म'],
  ['y', 'य'],
  ['r', 'र'],
  ['l', 'ल'],
  ['v', 'व'],
  ['w', 'व'],
  ['s', 'स'],
  ['h', 'ह'],
  ['z', 'ज़'],
  ['q', 'क़'],
  ['x', 'क्स'],
];

/** [roman, independent vowel, vowel sign after a consonant] — longest spellings first. */
const VOWELS: [string, string, string][] = [
  ['aa', 'आ', 'ा'],
  ['ai', 'ऐ', 'ै'],
  ['au', 'औ', 'ौ'],
  ['ee', 'ई', 'ी'],
  ['ii', 'ई', 'ी'],
  ['oo', 'ऊ', 'ू'],
  ['uu', 'ऊ', 'ू'],
  ['a', 'अ', ''],
  ['i', 'इ', 'ि'],
  ['u', 'उ', 'ु'],
  ['e', 'ए', 'े'],
  ['o', 'ओ', 'ो'],
];

const VIRAMA = '्';
const ANUSVARA = 'ं';

/**
 * Converts one Roman word to Devanagari. Non-letters are not expected inside `word`.
 *
 * @param word Letters only, any case.
 */
export function romanWordToHindi(word: string): string {
  const roman = word.toLowerCase();
  let out = '';
  let i = 0;
  let afterConsonant = false;
  let afterCluster = false;
  let lastConsonant = '';
  let clusterStart = '';
  while (i < roman.length) {
    const rest = roman.slice(i);
    const atEnd = (length: number) => i + length === roman.length;

    if (rest === 'n' && i > 0 && !afterConsonant) {
      out += ANUSVARA; // main → मैं, hain → हैं
      break;
    }

    const vowel = VOWELS.find(([spelling]) => rest.startsWith(spelling));
    if (vowel) {
      const [spelling, independent, sign] = vowel;
      if (afterConsonant) {
        const longFinalA = !afterCluster || (lastConsonant === 'y' && clusterStart !== 'r');
        if (spelling === 'a' && atEnd(1) && i > 0 && longFinalA) out += 'ा'; // mera → मेरा
        else if (spelling === 'i' && atEnd(1)) out += 'ी'; // hindi → हिन्दी
        else out += sign;
      } else {
        out += independent;
      }
      afterConsonant = false;
      afterCluster = false;
      i += spelling.length;
      continue;
    }

    const consonant = CONSONANTS.find(([spelling]) => rest.startsWith(spelling));
    if (consonant) {
      const followedByVowel = VOWELS.some(([spelling]) => roman.startsWith(spelling, i + consonant[0].length));
      // karna → करना, not कर्ना; but र्य joins (karya → कर्य, as in कार्य, सूर्य).
      const keepsVowel = lastConsonant === 'r' && followedByVowel && consonant[0] !== 'y';
      if (afterConsonant && !keepsVowel) {
        out += VIRAMA; // cluster → conjunct
        if (!afterCluster) clusterStart = lastConsonant;
        afterCluster = true;
      } else {
        afterCluster = false;
      }
      out += consonant[1];
      afterConsonant = true;
      lastConsonant = consonant[0];
      i += consonant[0].length;
      continue;
    }
    out += roman[i];
    afterConsonant = false;
    afterCluster = false;
    i += 1;
  }
  return out;
}

/**
 * After the user types a word boundary, converts the Roman word right before it. Returns null
 * when there is nothing to convert.
 *
 * @param value Field value after the keystroke.
 * @param caret Caret position (UTF-16 index) after the keystroke.
 */
export function transliterateBeforeCaret(
  value: string,
  caret: number,
): { value: string; caret: number } | null {
  const boundary = value[caret - 1];
  if (boundary === undefined || !/[\s.,?!;:।]/u.test(boundary)) return null;
  const before = value.slice(0, caret - 1);
  const match = /[A-Za-z]+$/.exec(before);
  if (!match) return null;
  const converted = romanWordToHindi(match[0]);
  const start = before.length - match[0].length;
  const next = value.slice(0, start) + converted + value.slice(caret - 1);
  return { value: next, caret: start + converted.length + 1 };
}
