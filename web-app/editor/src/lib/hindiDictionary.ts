import { HindiSpeller } from './hindiSpell';

/** Words the user added, kept in this browser only. */
const OWN_WORDS_KEY = 'hpe-hindi-own-words';

let speller: Promise<HindiSpeller> | null = null;

function ownWords(): Set<string> {
  try {
    const saved = window.localStorage.getItem(OWN_WORDS_KEY);
    return new Set(saved ? (JSON.parse(saved) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * The Hindi spell checker, loading its word list (`/edit/dict/hi-words.txt`, about 360 KB) the
 * first time it is needed. Rejects when the list cannot be loaded; a later call tries again.
 */
export function loadHindiSpeller(): Promise<HindiSpeller> {
  if (!speller) {
    speller = fetch('/edit/dict/hi-words.txt')
      .then((response) => {
        if (!response.ok) throw new Error(`word list: HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => new HindiSpeller(text.split('\n').filter(Boolean), ownWords()))
      .catch((error: unknown) => {
        speller = null;
        throw error;
      });
  }
  return speller;
}

/** Adds a word to the user's own list (this browser only) and reloads the checker with it. */
export function addOwnWord(word: string): Promise<HindiSpeller> {
  const words = ownWords();
  words.add(word.normalize('NFC'));
  try {
    window.localStorage.setItem(OWN_WORDS_KEY, JSON.stringify([...words]));
  } catch {
    /* Private mode: the word counts for this visit only. */
  }
  const current = speller;
  speller = current ? current.then((s) => s.withOwnWords(words)) : null;
  return loadHindiSpeller();
}
