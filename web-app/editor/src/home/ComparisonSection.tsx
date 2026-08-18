import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export function ComparisonSection() {
  const { t, isHindi } = useLanguage();

  const comparisonData = [
    {
      feature: isHindi ? 'देवनागरी फॉन्ट शेपिंग (मात्राएं व संयुक्ताक्षर)' : 'Devanagari Font Shaping (Matras & Conjuncts)',
      hindiPdfEditor: { status: 'pass', label: isHindi ? '100% सही (HarfBuzz इंजन)' : '100% Flawless (HarfBuzz Engine)' },
      adobe: { status: 'warn', label: isHindi ? 'मात्राएं अलग या टूटी हुई' : 'Often detached or split matras' },
      canva: { status: 'fail', label: isHindi ? 'अक्षर बॉक्स या बिखरे हुए' : 'Broken conjuncts & glyph boxes' },
      smallpdf: { status: 'fail', label: isHindi ? 'यूनिकोड मिसमैच' : 'Raw Unicode detachment' },
    },
    {
      feature: isHindi ? 'डेटा सुरक्षा व प्राइवेसी' : 'Document Privacy & Data Safety',
      hindiPdfEditor: { status: 'pass', label: isHindi ? '100% लोकल / शून्य सर्वर अपलोड' : '100% Local / Zero Server Uploads' },
      adobe: { status: 'warn', label: isHindi ? 'क्लाउड अपलोड जरूरी' : 'Cloud upload required' },
      canva: { status: 'fail', label: isHindi ? 'क्लाउड अपलोड जरूरी' : 'Cloud upload required' },
      smallpdf: { status: 'fail', label: isHindi ? 'क्लाउड अपलोड जरूरी' : 'Cloud upload required' },
    },
    {
      feature: isHindi ? 'कीमत और अकाउंट आवश्यकता' : 'Price & Account Requirement',
      hindiPdfEditor: { status: 'pass', label: isHindi ? '100% फ्री · कोई खाता नहीं' : '100% Free · No Sign-up' },
      adobe: { status: 'fail', label: isHindi ? 'महंगा मासिक सब्सक्रिप्शन' : 'Expensive subscription' },
      canva: { status: 'warn', label: isHindi ? 'प्रीमियम / साइनअप अनिवार्य' : 'Freemium / Sign-up required' },
      smallpdf: { status: 'fail', label: isHindi ? 'प्रतिदिन केवल 2 फाइलों की सीमा' : 'Strict 2 tasks/day limit' },
    },
    {
      feature: isHindi ? 'हिंदी ↔ अंग्रेजी दस्तावेज अनुवाद' : 'Hindi ↔ English Document Translation',
      hindiPdfEditor: { status: 'pass', label: isHindi ? 'इन-बिल्ट जेमिनी AI प्रॉक्सी' : 'Built-in Gemini AI Proxy' },
      adobe: { status: 'warn', label: isHindi ? 'थर्ड पार्टी प्लगइन मात्र' : 'Third-party plugin only' },
      canva: { status: 'warn', label: isHindi ? 'सशुल्क (Paid Add-on)' : 'Paid add-on' },
      smallpdf: { status: 'fail', label: isHindi ? 'अनुपलब्ध' : 'Not supported' },
    },
    {
      feature: isHindi ? 'मूल दस्तावेज की सुरक्षा' : 'Original Document Protection',
      hindiPdfEditor: { status: 'pass', label: isHindi ? 'मूल फाइल सुरक्षित रहती है' : 'Source File Never Overwritten' },
      adobe: { status: 'warn', label: isHindi ? 'सीधे फाइल ओवरराइट' : 'Direct in-place overwrite' },
      canva: { status: 'warn', label: isHindi ? 'कैनवा फॉर्मेट में रूपांतरण' : 'Re-encodes to Canva format' },
      smallpdf: { status: 'warn', label: isHindi ? 'क्लाउड पर ओवरराइट' : 'Overwrites on cloud' },
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
          <table className="w-full min-w-[640px] text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-cream/70 text-[14px] font-bold text-ink">
                <th className="p-4 sm:p-5 w-[32%] font-display">{t('comp.thFeature')}</th>
                <th className="p-4 sm:p-5 w-[24%] bg-brand-tint/60 text-brand font-display font-bold">
                  {t('comp.thOur')}
                </th>
                <th className="p-4 sm:p-5 w-[16%] font-display font-medium text-muted">{t('comp.thAdobe')}</th>
                <th className="p-4 sm:p-5 w-[14%] font-display font-medium text-muted">{t('comp.thCanva')}</th>
                <th className="p-4 sm:p-5 w-[14%] font-display font-medium text-muted">{t('comp.thSmallpdf')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-[13.5px]">
              {comparisonData.map((row) => (
                <tr key={row.feature} className="transition-colors hover:bg-cream/30">
                  <td className="p-4 sm:p-5 font-semibold text-ink font-display">
                    {row.feature}
                  </td>
                  <td className="p-4 sm:p-5 bg-brand-tint/20 font-semibold text-brand">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-brand flex-none" />
                      <span>{row.hindiPdfEditor.label}</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-muted">
                    <div className="flex items-center gap-1.5">
                      {row.adobe.status === 'warn' ? (
                        <AlertCircle className="size-4 text-amber-500 flex-none" />
                      ) : (
                        <XCircle className="size-4 text-red-400 flex-none" />
                      )}
                      <span>{row.adobe.label}</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-muted">
                    <div className="flex items-center gap-1.5">
                      {row.canva.status === 'warn' ? (
                        <AlertCircle className="size-4 text-amber-500 flex-none" />
                      ) : (
                        <XCircle className="size-4 text-red-400 flex-none" />
                      )}
                      <span>{row.canva.label}</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-muted">
                    <div className="flex items-center gap-1.5">
                      {row.smallpdf.status === 'warn' ? (
                        <AlertCircle className="size-4 text-amber-500 flex-none" />
                      ) : (
                        <XCircle className="size-4 text-red-400 flex-none" />
                      )}
                      <span>{row.smallpdf.label}</span>
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
