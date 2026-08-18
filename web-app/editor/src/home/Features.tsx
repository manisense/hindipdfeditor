import { Pencil, Languages, ScanText, Layers, ShieldCheck, FileArchive } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/cn';
import { useLanguage } from '../lib/i18n';
import { toolHref } from '../lib/tools';

function Card({
  className,
  children,
  href,
}: {
  className?: string;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <motion.a
      href={href}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[var(--shadow-soft)]',
        className,
      )}
    >
      {children}
    </motion.a>
  );
}

function Ico({ icon: Icon, tone }: { icon: LucideIcon; tone: string }) {
  return (
    <div className={cn('mb-5 grid size-12 place-items-center rounded-2xl', tone)}>
      <Icon className="size-6" strokeWidth={2} />
    </div>
  );
}

function EditVisual() {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-cream p-5">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3 font-display text-xl font-semibold text-ink">अनुबंध पत्र</div>
        <div className="mb-2 h-2.5 w-[92%] rounded bg-brand-tint" />
        <div className="mb-2 flex items-center gap-1">
          <div className="h-2.5 w-1/3 rounded bg-slate-100" />
          <span className="rounded bg-brand px-2 py-0.5 font-display text-[11px] font-semibold text-white">
            हस्ताक्षर
          </span>
          <div className="h-2.5 w-1/4 rounded bg-slate-100" />
        </div>
        <div className="mb-2 h-2.5 w-[78%] rounded bg-accent-tint" />
        <div className="h-2.5 w-2/3 rounded bg-slate-100" />
      </div>
    </div>
  );
}

function TranslateVisual() {
  return (
    <div className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-cream p-4">
      <div className="flex-1 rounded-xl bg-white p-3 shadow-sm">
        <div className="font-display text-[15px] font-semibold text-ink">नमस्ते</div>
        <div className="mt-1 h-1.5 w-3/4 rounded bg-brand-tint" />
      </div>
      <div className="grid size-7 place-items-center rounded-full bg-accent text-white">→</div>
      <div className="flex-1 rounded-xl bg-white p-3 shadow-sm">
        <div className="font-display text-[15px] font-semibold text-accent">Hello</div>
        <div className="mt-1 h-1.5 w-3/4 rounded bg-accent-tint" />
      </div>
    </div>
  );
}

function OcrVisual() {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-cream p-4">
      <div className="relative rounded-xl bg-white p-3 shadow-sm">
        <div className="absolute inset-2 rounded-md border-2 border-dashed border-brand/40" />
        <div className="relative space-y-2 p-1">
          <div className="inline-block rounded bg-brand-tint px-2 py-0.5 font-display text-xs font-semibold text-brand">
            हिंदी
          </div>{' '}
          <div className="inline-block rounded bg-accent-tint px-2 py-0.5 font-display text-xs font-semibold text-accent">
            English
          </div>
          <div className="h-1.5 w-2/3 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function OrganizeVisual() {
  return (
    <div className="mt-6 flex items-end justify-center gap-2 rounded-2xl border border-line bg-cream p-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 w-11 rounded-md border border-line bg-white shadow-sm"
          style={{ transform: `translateY(${i === 1 ? -8 : 0}px) rotate(${(i - 1) * 5}deg)` }}
        >
          <div className="m-1.5 h-1 rounded bg-brand-tint" />
          <div className="mx-1.5 h-1 w-3/4 rounded bg-slate-100" />
        </div>
      ))}
      <span className="ml-1 font-display text-2xl text-muted">+</span>
    </div>
  );
}

export function Features() {
  const { t, isHindi } = useLanguage();

  return (
    <section id="features" className="bg-cream py-24">
      <div className="section-x">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            {t('feat.eyebrow')}
          </div>
          <h2 className="text-[clamp(30px,4vw,46px)] font-bold leading-tight text-ink">
            {t('feat.title')}
          </h2>
          <p className="mt-4 text-lg text-muted">
            {t('feat.subtitle')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-6">
          <Card className="md:col-span-4" href={toolHref('edit')}>
            <Ico icon={Pencil} tone="bg-brand-tint text-brand" />
            <h3 className="text-xl font-bold text-ink">{t('feat.editHeading')}</h3>
            <p className="mt-2 max-w-md text-[15px] text-muted">
              {t('feat.editDesc')}
            </p>
            <EditVisual />
          </Card>

          <Card className="md:col-span-2" href={toolHref('translate')}>
            <Ico icon={Languages} tone="bg-accent-tint text-accent" />
            <h3 className="text-xl font-bold text-ink">{t('feat.translateHeading')}</h3>
            <p className="mt-2 text-[15px] text-muted">
              {t('feat.translateDesc')}
            </p>
            <TranslateVisual />
          </Card>

          <Card className="md:col-span-2" href={toolHref('edit')}>
            <Ico icon={ScanText} tone="bg-pop-yellow-tint text-[#B58400]" />
            <h3 className="text-xl font-bold text-ink">{t('feat.ocrHeading')}</h3>
            <p className="mt-2 text-[15px] text-muted">
              {t('feat.ocrDesc')}
            </p>
            <OcrVisual />
          </Card>

          <Card className="md:col-span-2" href={toolHref('merge')}>
            <Ico icon={Layers} tone="bg-pop-lav text-[#5B4BD6]" />
            <h3 className="text-xl font-bold text-ink">{isHindi ? 'पीडीएफ जोड़ें, अलग करें व क्रम बदलें' : 'Merge, split & reorder'}</h3>
            <p className="mt-2 text-[15px] text-muted">
              {isHindi ? 'कई पीडीएफ को मनचाहे क्रम में जोड़ें या जरूरी पेज अलग करें।' : 'Combine, extract page ranges and rebuild documents in the order you want.'}
            </p>
            <OrganizeVisual />
          </Card>

          <Card className="md:col-span-2" href={toolHref('compress')}>
            <Ico icon={FileArchive} tone="bg-brand-tint text-brand" />
            <h3 className="text-xl font-bold text-ink">{t('feat.compressHeading')}</h3>
            <p className="mt-2 text-[15px] text-muted">
              {t('feat.compressDesc')}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {(isHindi ? ['छोटी फाइल', '100% लोकल', 'नया एक्सपोर्ट'] : ['Smaller files', 'Local-only', 'New export']).map((text) => (
                <span
                  key={text}
                  className="rounded-full border border-line bg-white px-3 py-1 font-display text-[13px] font-semibold text-ink"
                >
                  {text}
                </span>
              ))}
            </div>
          </Card>

          <Card className="md:col-span-2" href={toolHref('edit')}>
            <Ico icon={ShieldCheck} tone="bg-accent-tint text-accent" />
            <h3 className="text-xl font-bold text-ink">{t('feat.privacyHeading')}</h3>
            <p className="mt-2 text-[15px] text-muted">
              {t('feat.privacyDesc')}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {(isHindi ? ['टेक्स्ट जोड़ें', 'मास्क करें', 'सुरक्षित एक्सपोर्ट'] : ['Add text', 'Replace', 'Export clean']).map((text) => (
                <span
                  key={text}
                  className="rounded-full border border-line bg-white px-3 py-1 font-display text-[13px] font-semibold text-ink"
                >
                  {text}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
