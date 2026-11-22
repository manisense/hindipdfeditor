import { useEffect, useState } from 'react';

import { addOwnWord, loadHindiSpeller } from '../lib/hindiDictionary';
import type { HindiSpeller } from '../lib/hindiSpell';
import { useTx } from '../lib/i18n';
import './SpellingPanel.css';

type Props = {
  /** Text of the edit being typed. */
  text: string;
  /** Text the edit started from (the replaced line); its words are not judged. */
  original: string;
  onReplace: (word: string, replacement: string) => void;
};

/** Wait after typing before checking, in ms. */
const CHECK_DELAY_MS = 400;

/**
 * Hindi words added to the edit that the word list does not know, each with suggestions to click
 * and "Add to dictionary". Shows nothing while everything is known.
 */
export function SpellingPanel({ text, original, onReplace }: Props) {
  const tx = useTx();
  const [speller, setSpeller] = useState<HindiSpeller | null>(null);
  const [misspelt, setMisspelt] = useState<{ word: string; suggestions: string[] }[]>([]);
  const hasHindi = /[ऀ-ॿ]/u.test(text);

  useEffect(() => {
    if (!hasHindi || speller) return;
    let cancelled = false;
    loadHindiSpeller()
      .then((loaded) => {
        if (!cancelled) setSpeller(loaded);
      })
      .catch((error: unknown) => console.warn('Hindi word list could not load', error));
    return () => {
      cancelled = true;
    };
  }, [hasHindi, speller]);

  useEffect(() => {
    if (!speller) return;
    const timer = window.setTimeout(() => {
      setMisspelt(speller.misspelt(text, original).map((word) => ({ word, suggestions: speller.suggest(word) })));
    }, CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [speller, text, original]);

  if (misspelt.length === 0) return null;
  return (
    <section
      className="spelling-panel"
      aria-label={tx('Spelling', 'वर्तनी')}
      onMouseDown={(event) => {
        // Keep focus in the text being edited, as the text toolbar does.
        if ((event.target as HTMLElement).closest('button')) event.preventDefault();
      }}
    >
      <strong className="spelling-panel__title">{tx('Check spelling', 'वर्तनी जाँचें')}</strong>
      <ul className="spelling-panel__list">
        {misspelt.map(({ word, suggestions }) => (
          <li key={word} className="spelling-panel__item">
            <span className="spelling-panel__word" lang="hi">
              {word}
            </span>
            {suggestions.length > 0 ? (
              suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  lang="hi"
                  className="spelling-panel__suggestion"
                  aria-label={tx(`Replace ${word} with ${suggestion}`, `${word} को ${suggestion} से बदलें`)}
                  onClick={() => onReplace(word, suggestion)}
                >
                  {suggestion}
                </button>
              ))
            ) : (
              <span className="spelling-panel__none">{tx('No suggestions', 'कोई सुझाव नहीं')}</span>
            )}
            <button
              type="button"
              className="spelling-panel__add"
              onClick={() => void addOwnWord(word).then(setSpeller)}
            >
              {tx('Add to dictionary', 'शब्दकोश में जोड़ें')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
