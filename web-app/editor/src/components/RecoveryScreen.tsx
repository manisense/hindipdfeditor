import { House, RefreshCw, RotateCcw } from 'lucide-react';

import { useLanguage, useTx } from '../lib/i18n';
import { AppButton } from './AppButton';
import { AppStatus } from './AppStatus';

type RecoveryProps = {
  error: Error;
  onReset: () => void;
};

/** Bilingual recovery UI; a function component so it can read the page language. */
export function RecoveryScreen({ error, onReset }: RecoveryProps) {
  const tx = useTx();
  const { isHindi } = useLanguage();
  const home = isHindi ? '/hi/' : '/';
  return (
    <div className="error-boundary">
      <div className="error-boundary__card">
        <a className="error-boundary__brand" href={home}>
          <img src="/assets/app-icon.png" alt="" width={36} height={36} />
          Hindi PDF <strong>Editor</strong>
        </a>
        <span className="error-boundary__eyebrow">{tx('Safe recovery', 'सुरक्षित रिकवरी')}</span>
        <h2>{tx('This tool needs a quick reset', 'इस टूल को दोबारा शुरू करना होगा')}</h2>
        <p className="error-boundary__intro">
          {tx(
            'Switching browser tabs during translation can interrupt browser processing. Your original PDF is unchanged.',
            'अनुवाद के दौरान ब्राउज़र टैब बदलने से प्रोसेसिंग रुक सकती है। आपकी मूल पीडीएफ नहीं बदली है।',
          )}
        </p>
        <AppStatus tone="error" title={tx('What happened', 'क्या हुआ')}>
          {error.message}
        </AppStatus>
        <div className="error-boundary__actions">
          <AppButton
            title={tx('Try again', 'फिर कोशिश करें')}
            icon={<RotateCcw size={16} aria-hidden="true" />}
            onClick={onReset}
          />
          <AppButton
            title={tx('Reload page', 'पेज रीलोड करें')}
            icon={<RefreshCw size={16} aria-hidden="true" />}
            variant="secondary"
            onClick={() => window.location.reload()}
          />
        </div>
        <a className="error-boundary__home" href={home}>
          <House size={15} aria-hidden="true" /> {tx('Back to all tools', 'सभी टूल्स पर वापस')}
        </a>
      </div>
    </div>
  );
}
