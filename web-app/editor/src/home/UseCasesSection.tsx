import { motion } from 'motion/react';
import { Award, FileText, Scale, GraduationCap, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { toolHref } from '../lib/tools';

export function UseCasesSection() {
  const { t, isHindi } = useLanguage();

  const useCases = [
    {
      icon: Award,
      title: t('use.admitCard'),
      queryEn: 'Edit Hindi Admit Card PDF',
      queryHi: 'सरकारी एडमिट कार्ड में नाम या रोल नंबर सुधारें',
      desc: t('use.admitCardDesc'),
      link: toolHref('edit'),
    },
    {
      icon: Scale,
      title: t('use.legal'),
      queryEn: 'Edit Hindi Legal Notice / Affidavit',
      queryHi: 'शपथ पत्र और अनुबंध पत्र पीडीएफ एडिट करें',
      desc: t('use.legalDesc'),
      link: toolHref('edit'),
    },
    {
      icon: FileText,
      title: t('use.land'),
      queryEn: 'Khasra Khatauni Hindi PDF Edit',
      queryHi: 'खसरा खतौनी और भूमि अभिलेख पीडीएफ सुधार',
      desc: t('use.landDesc'),
      link: toolHref('edit'),
    },
    {
      icon: GraduationCap,
      title: t('use.academic'),
      queryEn: 'Hindi Question Paper & Assignment PDF',
      queryHi: 'हिंदी प्रश्न पत्र और वर्कशीट तैयार करें',
      desc: t('use.academicDesc'),
      link: toolHref('translate'),
    },
  ];

  return (
    <section id="use-cases" className="py-24 bg-white" aria-labelledby="use-cases-heading">
      <div className="section-x">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            {t('use.eyebrow')}
          </div>
          <h2
            id="use-cases-heading"
            className="text-[clamp(28px,3.6vw,42px)] font-bold leading-tight text-ink"
          >
            {t('use.title')}
          </h2>
          <p className="mt-4 text-lg text-muted">
            {t('use.subtitle')}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {useCases.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className="group relative flex flex-col justify-between rounded-2xl border border-line bg-cream/30 p-6 transition-all duration-200 hover:border-brand/40 hover:bg-white hover:shadow-[var(--shadow-soft)]"
              >
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="grid size-11 place-items-center rounded-xl bg-brand-tint text-brand">
                      <Icon className="size-5" strokeWidth={2.2} />
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-display text-xs font-semibold text-slate-700">
                      {isHindi ? item.queryHi : item.queryEn}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-line/60">
                  <a
                    href={item.link}
                    className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-brand transition-colors hover:text-brand/80"
                  >
                    <span>{t('use.openForDoc')}</span>
                    <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
