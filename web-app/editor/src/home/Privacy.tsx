import { motion } from 'motion/react';
import { Lock, FileCheck2, Languages } from 'lucide-react';

const cards = [
  {
    icon: Lock,
    h: 'Stays on your device',
    p: "Core tools run locally in your browser or on your phone — files aren't uploaded anywhere.",
  },
  {
    icon: FileCheck2,
    h: 'Originals never overwritten',
    p: 'Every edit exports a fresh copy. Your source PDF is left exactly as it was.',
  },
  {
    icon: Languages,
    h: 'Real Devanagari shaping',
    p: 'Shaping goes through a real browser engine, so conjuncts, matras and reph stay correct.',
  },
];

export function Privacy() {
  return (
    <section id="privacy" className="bg-navy py-24 text-white">
      <div className="section-x">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand-tint">
            Private by default
          </div>
          <h2 className="text-[clamp(30px,4vw,46px)] font-bold leading-tight text-white">
            Private by default. Hindi-safe by design.
          </h2>
          <p className="mt-4 text-lg text-[#b9bee6]">
            Your documents stay yours — and your script stays correct.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c, i) => (
            <motion.div
              key={c.h}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-3xl border border-white/10 bg-white/[0.05] p-7"
            >
              <div className="mb-4 grid size-11 place-items-center rounded-xl bg-brand/35 text-brand-tint">
                <c.icon className="size-5" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-bold text-white">{c.h}</h3>
              <p className="mt-2 text-[15px] text-[#b3b8dd]">{c.p}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
