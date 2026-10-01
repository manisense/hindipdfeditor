import './LegacyFontWarning.css';
import { TriangleAlert } from 'lucide-react';

import { useTx } from '../lib/i18n';

type Props = {
  fontNames: string[];
};

export function LegacyFontWarning({ fontNames }: Props) {
  const tx = useTx();
  const isUnknown = fontNames.length === 0;

  return (
    <div className="legacy-font-warning">
      <span className="legacy-font-warning__icon" aria-hidden="true">
        <TriangleAlert size={22} strokeWidth={2.1} />
      </span>
      <div>
        <p className="legacy-font-warning__title">
          {isUnknown
            ? tx(
                'Font encoding could not be verified — editing disabled on this page',
                'फॉन्ट एनकोडिंग की पुष्टि नहीं हो सकी — इस पेज पर एडिटिंग बंद है',
              )
            : tx(
                `Legacy font detected (${fontNames.join(', ')}) — editing disabled on this page`,
                `पुराना फॉन्ट मिला (${fontNames.join(', ')}) — इस पेज पर एडिटिंग बंद है`,
              )}
        </p>
        <p className="legacy-font-warning__body">
          {isUnknown
            ? tx(
                "This page's font could not be inspected, so it can't be confirmed safe to edit. " +
                  'An unverifiable page is treated the same as a known legacy font rather than assumed safe.',
                'इस पेज का फॉन्ट जांचा नहीं जा सका, इसलिए इसे एडिट के लिए सुरक्षित नहीं माना जा सकता। ' +
                  'जिस पेज की पुष्टि न हो, उसे पुराने फॉन्ट वाले पेज की तरह ही माना जाता है।',
              )
            : tx(
                "This page's text was set in a pre-Unicode Devanagari font. Masking or adding text here " +
                  'would build on top of a mismatched text layer, so editing is disabled on this page.',
                'इस पेज का टेक्स्ट यूनिकोड से पहले के देवनागरी फॉन्ट में है। यहाँ टेक्स्ट ढकने या जोड़ने से ' +
                  'गलत टेक्स्ट लेयर पर काम होगा, इसलिए इस पेज पर एडिटिंग बंद है।',
              )}
        </p>
      </div>
    </div>
  );
}
