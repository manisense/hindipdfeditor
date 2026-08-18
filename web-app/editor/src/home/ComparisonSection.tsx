import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const comparisonData = [
  {
    feature: 'Devanagari Font Shaping (Matras & Conjuncts)',
    hindiPdfEditor: { status: 'pass', label: '100% Flawless (HarfBuzz Engine)' },
    adobe: { status: 'warn', label: 'Often detached or split matras' },
    canva: { status: 'fail', label: 'Broken conjuncts & glyph boxes' },
    smallpdf: { status: 'fail', label: 'Raw Unicode detachment' },
  },
  {
    feature: 'Document Privacy & Data Safety',
    hindiPdfEditor: { status: 'pass', label: '100% Local / Zero Server Uploads' },
    adobe: { status: 'warn', label: 'Cloud upload required' },
    canva: { status: 'fail', label: 'Cloud upload required' },
    smallpdf: { status: 'fail', label: 'Cloud upload required' },
  },
  {
    feature: 'Price & Account Requirement',
    hindiPdfEditor: { status: 'pass', label: '100% Free · No Sign-up' },
    adobe: { status: 'fail', label: 'Expensive subscription' },
    canva: { status: 'warn', label: 'Freemium / Sign-up required' },
    smallpdf: { status: 'fail', label: 'Strict 2 tasks/day limit' },
  },
  {
    feature: 'Hindi ↔ English Document Translation',
    hindiPdfEditor: { status: 'pass', label: 'Built-in Gemini AI Proxy' },
    adobe: { status: 'warn', label: 'Third-party plugin only' },
    canva: { status: 'warn', label: 'Paid add-on' },
    smallpdf: { status: 'fail', label: 'Not supported' },
  },
  {
    feature: 'Original Document Protection',
    hindiPdfEditor: { status: 'pass', label: 'Source File Never Overwritten' },
    adobe: { status: 'warn', label: 'Direct in-place overwrite' },
    canva: { status: 'warn', label: 'Re-encodes to Canva format' },
    smallpdf: { status: 'warn', label: 'Overwrites on cloud' },
  },
];

export function ComparisonSection() {
  return (
    <section id="compare" className="py-24 bg-cream/50" aria-labelledby="comparison-heading">
      <div className="section-x">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            Comparison &amp; Benchmark
          </div>
          <h2
            id="comparison-heading"
            className="text-[clamp(28px,3.6vw,42px)] font-bold leading-tight text-ink"
          >
            Why Hindi PDF Editor Beats Standard Tools
          </h2>
          <p className="mt-4 text-lg text-muted">
            See how our native Devanagari layout engine and local-first architecture compare to
            general-purpose PDF software.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-cream/70 text-[14px] font-bold text-ink">
                <th className="p-4 sm:p-5 w-[32%] font-display">Key Feature</th>
                <th className="p-4 sm:p-5 w-[24%] bg-brand-tint/60 text-brand font-display font-bold">
                  Hindi PDF Editor
                </th>
                <th className="p-4 sm:p-5 w-[16%] font-display font-medium text-muted">Adobe Acrobat</th>
                <th className="p-4 sm:p-5 w-[14%] font-display font-medium text-muted">Canva PDF</th>
                <th className="p-4 sm:p-5 w-[14%] font-display font-medium text-muted">Smallpdf / iLovePDF</th>
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
