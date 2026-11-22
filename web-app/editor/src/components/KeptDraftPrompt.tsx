import { AppButton } from './AppButton';
import { draftEditCount, type Draft } from '../lib/draft';
import { useLanguage, useTx } from '../lib/i18n';
import './KeptDraftPrompt.css';

/** Date and time a draft was kept, in the UI language. */
function savedAtLabel(savedAt: number, lang: string): string {
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    savedAt,
  );
}

type Props = { draft: Draft; onRestore: () => void; onDiscard: () => void };

/** "Continue where you left off?" card for edits kept in this browser from an earlier visit. */
export function KeptDraftPrompt({ draft, onRestore, onDiscard }: Props) {
  const tx = useTx();
  const { lang } = useLanguage();
  const count = draftEditCount(draft);
  const when = savedAtLabel(draft.savedAt, lang);
  return (
    <section className="kept-draft" aria-label={tx('Unsaved edits', 'बिना सेव किए बदलाव')}>
      <div className="kept-draft__text">
        <strong>{tx('Continue where you left off?', 'जहाँ छोड़ा था, वहीं से जारी रखें?')}</strong>
        <span>
          {tx(
            `${draft.sourceName}: ${count} unsaved ${count === 1 ? 'change' : 'changes'} from ${when}. Kept only in this browser; opening another file and editing it replaces them.`,
            `${draft.sourceName}: ${when} के ${count} बिना सेव किए बदलाव। ये केवल इसी ब्राउज़र में रखे हैं; दूसरी फ़ाइल खोलकर बदलने पर ये हट जाएंगे।`,
          )}
        </span>
      </div>
      <div className="kept-draft__actions">
        <AppButton title={tx('Discard', 'हटाएं')} small variant="secondary" onClick={onDiscard} />
        <AppButton title={tx('Restore edits', 'बदलाव वापस लाएं')} small onClick={onRestore} />
      </div>
    </section>
  );
}
