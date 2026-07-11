import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Btn } from './ui/button';
import { PLAY_STORE_URL } from './links';
import { toolHref } from '../lib/tools';

const feats = [
  {
    h: 'No install on web',
    p: 'Open a tab and get straight to editing — nothing to download.',
  },
  {
    h: 'Native Android app',
    p: 'The full toolkit on your phone, tuned for touch.',
  },
  {
    h: 'Same result, everywhere',
    p: 'Devanagari shaping stays identical across web and mobile.',
  },
];

export function WorkYourWay() {
  return (
    <section id="work" className="py-24">
      <div className="section-x grid items-center gap-14 md:grid-cols-2">
        <div>
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            Work your way
          </div>
          <h2 className="text-[clamp(28px,3.6vw,42px)] font-bold leading-tight text-ink">
            On the web, or in your pocket.
          </h2>
          <p className="mt-4 text-lg text-muted">
            Start in the browser with nothing to install, or take the same toolkit anywhere with the
            Android app.
          </p>
          <div className="mt-7 grid gap-4">
            {feats.map((f) => (
              <div key={f.h} className="flex gap-3.5">
                <span className="mt-0.5 grid size-8 flex-none place-items-center rounded-[10px] bg-accent-tint text-accent">
                  <Check className="size-4" strokeWidth={2.5} />
                </span>
                <div>
                  <h4 className="font-display text-[16.5px] font-semibold text-ink">{f.h}</h4>
                  <p className="text-[14.5px] text-muted">{f.p}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <Btn href={toolHref('edit')}>Open the editor →</Btn>
            <Btn variant="ghost" href={PLAY_STORE_URL}>
              Get the app
            </Btn>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[28px] border border-line p-8 shadow-[var(--shadow-soft)]"
          style={{ background: 'linear-gradient(160deg, #eef3ff, #ffffff)' }}
        >
          <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <div className="mb-3.5 flex gap-2">
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
            </div>
            <div className="mb-3 font-display text-2xl font-semibold text-ink">अनुबंध पत्र</div>
            {['92%', '100%', '78%'].map((w, i) => (
              <div
                key={i}
                className={`mb-2.5 h-2.5 rounded ${i === 0 ? 'bg-brand-tint' : 'bg-slate-100'}`}
                style={{ width: w }}
              />
            ))}
            <div className="mb-2.5 h-2.5 w-[88%] rounded bg-accent-tint" />
            <div className="h-2.5 w-2/3 rounded bg-slate-100" />
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={toolHref('edit')}
                className="rounded-full bg-brand px-3 py-1.5 font-display text-[13px] font-semibold text-white"
              >
                Edit
              </a>
              <a
                href={toolHref('translate')}
                className="rounded-full bg-accent px-3 py-1.5 font-display text-[13px] font-semibold text-white"
              >
                Translate
              </a>
              <a
                href={toolHref('merge')}
                className="rounded-full border border-line bg-white px-3 py-1.5 font-display text-[13px] font-semibold text-ink"
              >
                Merge
              </a>
              <a
                href={toolHref('split')}
                className="rounded-full border border-line bg-white px-3 py-1.5 font-display text-[13px] font-semibold text-ink"
              >
                Split
              </a>
              <a
                href={toolHref('compress')}
                className="rounded-full border border-line bg-white px-3 py-1.5 font-display text-[13px] font-semibold text-ink"
              >
                Compress
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
