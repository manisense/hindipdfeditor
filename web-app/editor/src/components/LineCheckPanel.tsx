import type { LineToCheck } from '../lib/linesToCheck';
import { useTx } from '../lib/i18n';
import { AppButton } from './AppButton';
import './LineCheckPanel.css';

type Props = {
  item: LineToCheck;
  /** Position of `item` in the page's list, from 0. */
  index: number;
  total: number;
  onNext: () => void;
  onEdit: () => void;
  onDone: () => void;
};

/**
 * One line to check at a time (see `linesToCheck`), highlighted on the page: its text, where that
 * text came from, and Next / Edit / Done.
 */
export function LineCheckPanel({ item, index, total, onNext, onEdit, onDone }: Props) {
  const tx = useTx();
  const why = {
    ocr: tx('Read by OCR from the page image. Check names and numbers.', 'पेज की इमेज से OCR द्वारा पढ़ी गई। नाम और अंक जाँचें।'),
    degraded: tx(
      'Text recognition could not confirm this line. Check it against the page.',
      'टेक्स्ट पहचान इस पंक्ति की पुष्टि नहीं कर सकी। पेज से मिलाकर देखें।',
    ),
  }[item.reason];
  return (
    <section className="line-check" aria-label={tx('Lines to check', 'जाँचने वाली पंक्तियाँ')} aria-live="polite">
      <p className="line-check__text">{item.line.text}</p>
      <p className="line-check__why">{why}</p>
      <div className="line-check__actions">
        <AppButton
          title={index + 1 < total ? tx(`Next ${index + 2}/${total}`, `अगली ${index + 2}/${total}`) : tx(`Back to 1/${total}`, `फिर 1/${total}`)}
          small
          variant="secondary"
          onClick={onNext}
        />
        <AppButton title={tx('Edit this line', 'यह पंक्ति बदलें')} small variant="secondary" onClick={onEdit} />
        <AppButton title={tx('Done', 'हो गया')} small variant="primary" onClick={onDone} />
      </div>
    </section>
  );
}
