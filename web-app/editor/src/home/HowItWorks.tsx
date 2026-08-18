import { motion } from 'motion/react';
import { UploadCloud, Edit3, Type, FileCheck } from 'lucide-react';
import { Btn } from './ui/button';
import { toolHref } from '../lib/tools';

const steps = [
  {
    icon: UploadCloud,
    number: '01',
    title: 'Open Your PDF Locally',
    desc: 'Select or drag your PDF into the editor. Your file is processed 100% inside your browser via WebAssembly — never uploaded to any remote server.',
  },
  {
    icon: Edit3,
    number: '02',
    title: 'Tap to Edit or Mask Text',
    desc: 'Click on existing Hindi text to mask and replace it, or tap anywhere on the canvas to add fresh Devanagari text boxes and headings.',
  },
  {
    icon: Type,
    number: '03',
    title: 'Type with Correct Hindi Shaping',
    desc: 'Type using standard Unicode Hindi keyboards or Google Input Tools. Our HarfBuzz layout engine ensures all conjuncts (क्ष, त्र, ज्ञ) and matras align flawlessly.',
  },
  {
    icon: FileCheck,
    number: '04',
    title: 'Export Clean Vector PDF',
    desc: 'Download your newly rendered, print-ready PDF instantly. Your original document remains completely unmodified on your device.',
  },
];


export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-white border-y border-line" aria-labelledby="how-it-works-heading">
      <div className="section-x">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            How It Works
          </div>
          <h2
            id="how-it-works-heading"
            className="text-[clamp(28px,3.6vw,42px)] font-bold leading-tight text-ink"
          >
            How to Edit Hindi PDF Online in 4 Easy Steps
          </h2>
          <p className="mt-4 text-lg text-muted">
            Edit and replace Devanagari text without broken fonts, missing matras, or privacy risks.
            No software installation or account required.
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
          <Btn href={toolHref('edit')}>Start Editing Hindi PDF Now →</Btn>
        </div>
      </div>
    </section>
  );
}
