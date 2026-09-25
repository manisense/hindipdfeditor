import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

type Row = { feature: string; ours: string; typical: string };

/**
 * Compares against general-purpose PDF editors as a category. Named competitors are left out
 * on purpose: every claim here must be one we can back up without testing other products.
 */
export function ComparisonSection() {
  const { t, isHindi } = useLanguage();

  const rows: Row[] = isHindi
    ? [
        {
          feature: 'नया हिंदी टेक्स्ट (मात्राएं व संयुक्ताक्षर)',
          ours: 'ब्राउज़र का टेक्स्ट इंजन आकार देता है, मात्राएं जुड़ी रहती हैं',
          typical: 'मौजूदा हिंदी टेक्स्ट एडिट करने पर मात्राएं बिखरने की शिकायतें आम हैं',
        },
        {
          feature: 'फाइल कहां प्रोसेस होती है',
          ours: 'एडिट, मर्ज, स्प्लिट, कंप्रेस ब्राउज़र में; AI फीचर पूछकर ही',
          typical: 'कई ऑनलाइन टूल फाइल अपने सर्वर पर अपलोड करते हैं',
        },
        {
          feature: 'कीमत और अकाउंट',
          ours: 'फ्री · कोई अकाउंट नहीं · कोई वॉटरमार्क नहीं',
          typical: 'अक्सर फ्री इस्तेमाल सीमित या साइन-अप जरूरी',
        },
        {
          feature: 'हिंदी ↔ अंग्रेजी अनुवाद',
          ours: 'बिल्ट-इन, पेज पर ही अनुवाद',
          typical: 'आमतौर पर अलग टूल की जरूरत',
        },
        {
          feature: 'मूल फाइल',
          ours: 'हर बार नई फाइल बनती है, मूल नहीं बदलती',
          typical: 'कुछ एडिटर मूल फाइल पर ही सेव करते हैं',
        },
      ]
    : [
        {
          feature: 'New Hindi text (matras & conjuncts)',
          ours: 'Shaped by the browser text engine, so matras stay joined',
          typical: 'Scattered matras when editing existing Hindi text are a common complaint',
        },
        {
          feature: 'Where your file is processed',
          ours: 'Edit, merge, split and compress in your browser; AI features ask first',
          typical: 'Many online tools upload the file to their servers',
        },
        {
          feature: 'Price & account',
          ours: 'Free · no account · no watermark',
          typical: 'Free use is often limited or needs a sign-up',
        },
        {
          feature: 'Hindi ↔ English translation',
          ours: 'Built in, placed back on the page',
          typical: 'Usually needs a separate tool',
        },
        {
          feature: 'Your original file',
          ours: 'Always exports a new file; the original is untouched',
          typical: 'Some editors save over the original',
        },
      ];

  return (
    <section id="compare" className="py-24 bg-cream/50" aria-labelledby="comparison-heading">
      <div className="section-x">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            {t('comp.eyebrow')}
          </div>
          <h2
            id="comparison-heading"
            className="text-[clamp(28px,3.6vw,42px)] font-bold leading-tight text-ink"
          >
            {t('comp.title')}
          </h2>
          <p className="mt-4 text-lg text-muted">
            {t('comp.subtitle')}
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-cream/70 text-[14px] font-bold text-ink">
                <th className="p-4 sm:p-5 w-[28%] font-display">{t('comp.thFeature')}</th>
                <th className="p-4 sm:p-5 w-[36%] bg-brand-tint/60 text-brand font-display font-bold">
                  {t('comp.thOur')}
                </th>
                <th className="p-4 sm:p-5 w-[36%] font-display font-medium text-muted">
                  {t('comp.thTypical')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-[13.5px]">
              {rows.map((row) => (
                <tr key={row.feature} className="transition-colors hover:bg-cream/30">
                  <td className="p-4 sm:p-5 font-semibold text-ink font-display">{row.feature}</td>
                  <td className="p-4 sm:p-5 bg-brand-tint/20 font-semibold text-brand">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-brand flex-none" />
                      <span>{row.ours}</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-muted">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="size-4 text-amber-500 flex-none" />
                      <span>{row.typical}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
