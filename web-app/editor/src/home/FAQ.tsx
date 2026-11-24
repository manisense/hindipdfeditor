import { useId, useState } from "react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { cn } from "../lib/cn";
import { useLanguage } from "../lib/i18n";
import { getFaqs } from "./faqData";
import { UI } from "./motion";

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        id={`${id}-q`}
        aria-expanded={open}
        aria-controls={`${id}-a`}
      >
        <span className="font-display text-lg font-semibold text-ink">{q}</span>
        <span
          className={cn(
            "grid size-7 flex-none place-items-center rounded-full bg-brand-wash text-brand transition-transform duration-300",
            open && "rotate-45",
          )}
        >
          <Plus className="size-4" strokeWidth={2.5} />
        </span>
      </button>
      {/* The answer stays in the HTML when closed (hidden), so the button always has a
          target and crawlers read the same answers as the FAQPage JSON-LD. */}
      <div
        id={`${id}-a`}
        role="region"
        aria-labelledby={`${id}-q`}
        hidden={!open}
      >
        <motion.p
          // Opacity and a 4px rise only: animating height re-lays out the page every frame.
          key={String(open)}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={UI}
          className="pb-5 pr-10 text-base leading-relaxed text-muted"
        >
          {a}
        </motion.p>
      </div>
    </div>
  );
}

export function FAQ() {
  const { lang, t } = useLanguage();
  const faqs = getFaqs(lang);

  return (
    <section id="faq" className="py-24" aria-labelledby="faq-heading">
      <div className="section-x grid gap-12 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            {t("faq.eyebrow")}
          </div>
          <h2
            id="faq-heading"
            className="text-[clamp(28px,3.6vw,42px)] font-bold leading-tight text-ink"
          >
            {t("faq.title")}
          </h2>
          <p className="mt-4 text-lg text-muted">{t("faq.subtitle")}</p>
        </div>
        <div>
          {faqs.map((f) => (
            <Item key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
