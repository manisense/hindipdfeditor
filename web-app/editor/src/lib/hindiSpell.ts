/**
 * Hindi spell checking against a word list (see `public/dict/README.md` for its source and
 * licence). Common inflections are accepted by stripping a suffix and checking the stem;
 * nukta and chandrabindu spellings count as the same word. Only Devanagari words of two or more
 * letters are judged.
 */

/** Inflection endings, longest first, with what may stand in their place on the stem. */
const SUFFIXES: [string, string[]][] = [
  ['ाएंगे', ['ा', 'ाना']],
  ['ाएँगे', ['ा', 'ाना']],
  ['एंगे', ['', 'ना']],
  ['एँगे', ['', 'ना']],
  ['ियों', ['ी', 'ि']],
  ['ाओं', ['ा']],
  ['ुओं', ['ु']],
  ['ूओं', ['ू']],
  ['ियाँ', ['ी', 'ि']],
  ['ियां', ['ी', 'ि']],
  ['ेंगे', ['ना', '']],
  ['ेंगी', ['ना', '']],
  ['ाएं', ['ा']],
  ['ाएँ', ['ा']],
  ['ओं', ['']],
  ['ों', ['', 'ा']],
  ['ें', ['', 'ा', 'ना']],
  ['एं', ['', 'ा']],
  ['एँ', ['', 'ा']],
  ['ता', ['ना']],
  ['ती', ['ना']],
  ['ते', ['ना']],
  ['ने', ['ना', '']],
  ['कर', ['ना', '']],
  ['ा', ['ना', '']],
  ['े', ['ा', 'ना', '']],
  ['ी', ['ा', 'ना', '']],
];

const DEVANAGARI_WORD = /^[ऀ-ॣॱ-ॿ]+$/u;
const MAX_SUGGESTIONS = 4;

/** One spelling of a word for comparison: NFC, without nukta, chandrabindu as anusvara. */
function canonical(word: string): string {
  return word.normalize('NFD').replace(/़/gu, '').replace(/ँ/gu, 'ं').normalize('NFC');
}

/** Words of a text: runs of letters, with punctuation and danda removed. */
function wordsOf(text: string): string[] {
  return text
    .normalize('NFC')
    .split(/[\s।॥.,;:!?()[\]{}"'“”‘’\-–—/|]+/u)
    .filter(Boolean);
}

/** Levenshtein distance between two strings, by code point, stopping once it exceeds `max`. */
function distance(a: string, b: string, max: number): number {
  const x = [...a];
  const y = [...b];
  if (Math.abs(x.length - y.length) > max) return max + 1;
  let previous = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= y.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
      best = Math.min(best, current[j]);
    }
    if (best > max) return max + 1;
    previous = current;
  }
  return previous[y.length];
}

export class HindiSpeller {
  private readonly rank = new Map<string, number>();
  private readonly words: string[];

  /**
   * @param words Dictionary words, commonest first.
   * @param own Words the user added (kept in this browser).
   */
  constructor(words: readonly string[], private readonly own: ReadonlySet<string> = new Set()) {
    this.words = words.map((word) => word.normalize('NFC'));
    this.words.forEach((word, i) => {
      const key = canonical(word);
      if (!this.rank.has(key)) this.rank.set(key, i);
    });
  }

  /** The same checker with a different set of the user's own words. */
  withOwnWords(own: ReadonlySet<string>): HindiSpeller {
    return new HindiSpeller(this.words, own);
  }

  private has(word: string): boolean {
    return this.rank.has(canonical(word)) || this.own.has(word.normalize('NFC'));
  }

  /** Whether a word is spelt right (or is not a Hindi word this checker judges). */
  isKnown(word: string): boolean {
    const w = word.normalize('NFC');
    if (!DEVANAGARI_WORD.test(w) || [...w].length < 2 || this.has(w)) return true;
    for (const [suffix, replacements] of SUFFIXES) {
      if (!w.endsWith(suffix) || [...w].length - [...suffix].length < 2) continue;
      const stem = w.slice(0, -suffix.length);
      if (replacements.some((ending) => this.has(stem + ending))) return true;
    }
    return false;
  }

  /** Dictionary words close to a misspelt word (one or two edits), commonest first. */
  suggest(word: string): string[] {
    const w = canonical(word.normalize('NFC'));
    const found: { word: string; d: number; rank: number }[] = [];
    for (const candidate of this.words) {
      const d = distance(w, canonical(candidate), 2);
      if (d <= 2) found.push({ word: candidate, d, rank: this.rank.get(canonical(candidate)) ?? 0 });
    }
    return [...new Set(found.sort((a, b) => a.d - b.d || a.rank - b.rank).map((f) => f.word))].slice(0, MAX_SUGGESTIONS);
  }

  /**
   * Words in `text` the dictionary does not know, once each, in order. Words already in
   * `original` (the text the user started from) are not judged: names and places there are
   * the document's own.
   */
  misspelt(text: string, original: string): string[] {
    const given = new Set(wordsOf(original));
    const out: string[] = [];
    for (const word of wordsOf(text)) {
      if (given.has(word) || out.includes(word) || this.isKnown(word)) continue;
      out.push(word);
    }
    return out;
  }
}

/**
 * Replaces every whole-word occurrence of `from` in `text` with `to`, keeping spacing and
 * punctuation (a word inside a longer word is left alone).
 */
export function replaceWord(text: string, from: string, to: string): string {
  return text
    .normalize('NFC')
    .split(/([\s\u0964\u0965.,;:!?()[\]{}"'“”‘’\-–—/|]+)/u)
    .map((part) => (part === from ? to : part))
    .join('');
}
