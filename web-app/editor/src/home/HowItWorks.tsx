import { motion } from 'motion/react';
import { UploadCloud, Edit3, Type, FileCheck } from 'lucide-react';
import { Btn } from './ui/button';
import { useLanguage } from '../lib/i18n';
import { toolHref } from '../lib/tools';

export function HowItWorks() {
  const { t, isHindi } = useLanguage();

  const steps = [
    {
      icon: UploadCloud,
      number: '01',
      title: t('how.step1Title'),
      desc: t('how.step1Desc'),
    },
    {
      icon: Edit3,
      number: '02',
      title: t('how.step2Title'),
      desc: t('how.step2Desc'),
    },
    {
      icon: Type,
      number: '03',
      title: t('how.step3Title'),
      desc: t('how.step3Desc'),
    },
    {
      icon: FileCheck,
      number: '04',
      title: t('how.step4Title'),
      desc: t('how.step4Desc'),
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white border-y border-line" aria-labelledby="how-it-works-heading">
      <div className="section-x">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            {t('how.eyebrow')}
          </div>
          <h2
            id="how-it-works-heading"
            className="text-[clamp(28px,3.6vw,42px)] font-bold leading-tight text-ink"
          >
            {t('how.title')}
          </h2>
          <p className="mt-4 text-lg text-muted">
            {t('how.subtitle')}
          </p>
        </div>

        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.li
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="relative flex flex-col rounded-2xl border border-line bg-cream/40 p-6 transition-all duration-200 hover:border-brand/30 hover:bg-white hover:shadow-[var(--shadow-soft)]"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="grid size-11 place-items-center rounded-xl bg-brand-tint text-brand">
                    <Icon className="size-5" strokeWidth={2.2} />
                  </div>
                  <span className="font-display text-2xl font-black text-brand/25">
                    {step.number}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">
                  {step.desc}
                </p>
              </motion.li>
            );
          })}
        </ol>

        <div className="mt-12 text-center">
          <Btn href={toolHref('edit')}>
            {isHindi ? 'अभी हिंदी पीडीएफ एडिट करना शुरू करें →' : 'Start Editing Hindi PDF Now →'}
          </Btn>
        </div>
      </div>
    </section>
  );
}
