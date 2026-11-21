import { X } from 'lucide-react';
import { useState } from 'react';

import { AppButton } from './AppButton';
import { useTx } from '../lib/i18n';
import './FindReplacePanel.css';

type Props = {
  /** Number of places `query` occurs in the document right now. */
  countMatches: (query: string) => number;
  /** Replaces every occurrence; resolves to how many places changed. */
  onReplaceAll: (query: string, replacement: string) => Promise<number>;
  /** Pages whose text is still being found, so their matches are not counted yet. */
  pagesPending: number;
  onClose: () => void;
};

export function FindReplacePanel({ countMatches, onReplaceAll, pagesPending, onClose }: Props) {
  const tx = useTx();
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const matches = query.trim().length > 0 ? countMatches(query) : 0;

  return (
    <section className="find-replace" aria-label={tx('Find and replace', 'खोजें और बदलें')}>
      <div className="find-replace__heading">
        <strong>{tx('Find and replace', 'खोजें और बदलें')}</strong>
        <button type="button" className="find-replace__close" aria-label={tx('Close', 'बंद करें')} onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <label className="find-replace__field">
        <span>{tx('Find', 'खोजें')}</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setDone(null);
          }}
          lang="hi"
        />
      </label>
      <label className="find-replace__field">
        <span>{tx('Replace with', 'इससे बदलें')}</span>
        <input
          value={replacement}
          onChange={(event) => {
            setReplacement(event.target.value);
            setDone(null);
          }}
          lang="hi"
        />
      </label>
      <p className="find-replace__status" role="status">
        {done !== null
          ? tx(`Replaced in ${done} places. Undo reverts all of them.`, `${done} जगह बदला गया। पहले जैसा करें से सब वापस होगा।`)
          : query.trim().length > 0
            ? tx(`${matches} matches`, `${matches} जगह मिला`)
            : tx('Matches are found on every page.', 'हर पेज पर खोजा जाता है।')}
        {pagesPending > 0 && done === null
          ? tx(` Still finding text on ${pagesPending} pages.`, ` ${pagesPending} पेज पर अभी टेक्स्ट खोजा जा रहा है।`)
          : ''}
      </p>
      <AppButton
        title={busy ? tx('Replacing…', 'बदल रहे हैं…') : tx('Replace all', 'सब बदलें')}
        small
        disabled={busy || matches === 0}
        onClick={async () => {
          setBusy(true);
          try {
            setDone(await onReplaceAll(query, replacement));
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}
