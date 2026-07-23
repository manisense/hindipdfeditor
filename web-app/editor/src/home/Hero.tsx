import { motion } from 'motion/react';
import { ChevronRight, Pencil, Languages, ScanText, Layers, FileArchive } from 'lucide-react';
import { Btn } from './ui/button';
import { TypewriterCycle } from './ui/typewriter-cycle';
import { PointerHighlight } from './ui/pointer-highlight';
import { Cover } from './ui/cover';
import { ImagesBadge } from './ui/images-badge';
import { PLAY_STORE_URL } from './links';
import { toolHref } from '../lib/tools';

const tools = [
  {
    icon: Pencil,
    name: 'Edit Hindi PDF',
    detail: 'Live Devanagari shaping',
    tone: 'bg-brand-tint text-brand',
    href: toolHref('edit'),
  },
  {
    icon: Languages,
    name: 'Hindi ↔ English',
    detail: 'Free in your browser',
    tone: 'bg-accent-tint text-accent',
    href: toolHref('translate'),
  },
  {
    icon: ScanText,
    name: 'OCR detection',
    detail: 'Hindi + English',
    tone: 'bg-pop-yellow-tint text-[#B58400]',
    href: toolHref('edit'),
  },
  {
    icon: Layers,
    name: 'Merge & split',
    detail: 'Any order, any range',
    tone: 'bg-pop-lav text-[#5B4BD6]',
    href: toolHref('merge'),
  },
  {
    icon: FileArchive,
    name: 'Compress PDF',
    detail: 'Shrink scanned files',
    tone: 'bg-pop-yellow-tint text-[#B58400]',
    href: toolHref('compress'),
  },
];

function Fade({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]"
        style={{ background: 'radial-gradient(70% 100% at 50% 0%, #eef3ff 0%, transparent 70%)' }}
      />

      <div className="section-x">
        <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
          <div>
            <Fade>
              <a
                href="#features"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-[13.5px] font-medium text-muted shadow-[0_1px_2px_rgba(21,23,44,0.04)] transition-colors hover:text-ink"
              >
                <span className="size-1.5 rounded-full bg-accent" />
                Free to use · runs locally · no account
                <ChevronRight className="size-3.5" />
              </a>
            </Fade>

            <Fade delay={0.05}>
              <h1 className="mt-6 font-display text-[clamp(34px,4.6vw,56px)] font-extrabold leading-[1.05] tracking-tight text-ink">
                <span className="block font-semibold text-muted">Every tool for</span>
                <TypewriterCycle
                  className="text-ink"
                  caretClassName="bg-brand"
                  phrases={[
                    { text: 'Hindi PDFs.' },
                    { text: 'हिंदी दस्तावेज़।' },
                    { text: 'your paperwork.' },
                    { text: 'हर हिंदी फ़ाइल।' },
                  ]}
                />
              </h1>
            </Fade>

            <Fade delay={0.1}>
              <p className="mt-5 max-w-lg text-[clamp(16px,1.7vw,18px)] leading-relaxed text-muted">
                Edit, translate, merge, split, compress and OCR your{' '}
                <PointerHighlight className="mx-0.5 font-semibold text-ink">
                  Devanagari
                </PointerHighlight>{' '}
                documents — all of it, in <Cover>one place</Cover>.
              </p>
            </Fade>

            <Fade delay={0.15}>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Btn size="lg" href={toolHref('edit')}>
                  Open the editor →
                </Btn>
                <Btn size="lg" variant="subtle" href={PLAY_STORE_URL}>
                  Get the Android app
                </Btn>
              </div>
            </Fade>

            <Fade delay={0.2}>
              <div className="mt-7">
                <ImagesBadge label="Loved for everyday Hindi paperwork" />
              </div>
            </Fade>
          </div>

          <div className="flex flex-col gap-4">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-black/[0.05] bg-[#f4f5f7] p-5"
            >
              <div className="mb-3.5 flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-brand-tint text-brand">
                  <Pencil className="size-4" strokeWidth={2} />
                </span>
                <div>
                  <div className="font-display text-[14.5px] font-bold text-ink leading-none">
                    Edit right in your browser
                  </div>
                  <div className="mt-1 text-[12.5px] text-muted">
                    No setup — shaping stays correct
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-black/[0.06] bg-white p-4 shadow-[0_8px_24px_rgba(21,23,44,0.07)]">
                <div className="mb-3 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-line" />
                  <span className="size-2 rounded-full bg-line" />
                  <span className="size-2 rounded-full bg-line" />
                  <span className="ml-1.5 h-3.5 flex-1 rounded bg-[#f4f5f7]" />
                </div>
                <div className="mb-2.5 font-display text-xl font-semibold text-ink">अनुबंध पत्र</div>
                <div className="mb-2 h-2.5 w-[92%] rounded bg-brand-tint" />
                <div className="mb-2 flex items-center gap-1.5">
                  <div className="h-2.5 w-1/3 rounded bg-slate-100" />
                  <span className="rounded-md bg-brand px-2 py-0.5 font-display text-[11px] font-semibold text-white">
                    हस्ताक्षर
                  </span>
                  <div className="h-2.5 w-1/5 rounded bg-slate-100" />
                </div>
                <div className="h-2.5 w-2/3 rounded bg-accent-tint" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-black/[0.05] bg-[#f4f5f7] p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="font-display text-[14.5px] font-bold text-ink">
                  One toolkit, every job
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 font-display text-[12px] font-semibold text-muted">
                  {tools.length} tools
                </span>
              </div>
              <div className="rounded-xl border border-black/[0.06] bg-white p-2">
                {tools.map((t) => (
                  <a
                    key={t.name}
                    href={t.href}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-[#f7f8fa]"
                  >
                    <span
                      className={`grid size-8 flex-none place-items-center rounded-lg ${t.tone}`}
                    >
                      <t.icon className="size-[17px]" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[13.5px] font-semibold text-ink leading-tight">
                        {t.name}
                      </div>
                      <div className="text-[12px] text-muted">{t.detail}</div>
                    </div>
                    <span className="text-[16px] leading-none text-slate-300">⋯</span>
                  </a>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
