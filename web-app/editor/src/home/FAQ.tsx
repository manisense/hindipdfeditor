import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { cn } from '../lib/cn';
import { SITE_FAQS } from './faqData';

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="font-display text-[17px] font-semibold text-ink">{q}</span>
        <span
          className={cn(
            'grid size-7 flex-none place-items-center rounded-full bg-brand-wash text-brand transition-transform duration-300',
            open && 'rotate-45',
          )}
        >
          <Plus className="size-4" strokeWidth={2.5} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-10 text-[15px] leading-relaxed text-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  return (
    <section id="faq" className="py-24" aria-labelledby="faq-heading">
      <div className="section-x grid gap-12 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            FAQ
          </div>
          <h2
            id="faq-heading"
            className="text-[clamp(28px,3.6vw,42px)] font-bold leading-tight text-ink"
          >
            Questions, answered.
          </h2>
          <p className="mt-4 text-lg text-muted">
            Everything about privacy, Devanagari and the toolkit. Still curious? The editor&apos;s
            free to try.
          </p>
        </div>
        <div>
          {SITE_FAQS.map((f) => (
            <Item key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
