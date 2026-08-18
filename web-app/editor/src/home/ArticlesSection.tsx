import { motion } from 'motion/react';
import { BookOpen, ArrowRight, Sparkles } from 'lucide-react';

const featuredArticles = [
  {
    category: 'Typography & Fonts',
    title: 'Why Hindi Fonts & Matras Break in PDF Editors (and How to Fix Them)',
    desc: 'Understand the abugida OpenType shaping failure in conventional PDF tools and how our HarfBuzz pipeline delivers 100% ligature fidelity.',
    href: '/articles/fix-broken-hindi-fonts-in-pdf/',
    badgeTone: 'bg-brand-tint text-brand',
    readTime: '5 min read',
  },
  {
    category: 'Govt & Exams',
    title: 'How to Edit Hindi Admit Card & Sarkari Exam PDF Forms (BPSC, UPPSC, SSC)',
    desc: 'Step-by-step tutorial on safely correcting names, roll numbers, and personal details on state recruitment forms without cloud uploads.',
    href: '/articles/edit-sarkari-admit-card-hindi-pdf/',
    badgeTone: 'bg-accent-tint text-accent',
    readTime: '4 min read',
  },
  {
    category: 'Translation & AI',
    title: 'How to Translate Hindi PDF to English Online Without Losing Page Formatting',
    desc: 'Learn how our geometric bounding box translator replaces Hindi text with English while preserving font sizes, margins, and tables.',
    href: '/articles/translate-hindi-pdf-to-english/',
    badgeTone: 'bg-pop-lav text-[#5B4BD6]',
    readTime: '4 min read',
  },
];

export function ArticlesSection() {
  return (
    <section id="articles" className="py-24 bg-cream/40 border-t border-line" aria-labelledby="articles-heading">
      <div className="section-x">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
              <Sparkles className="size-4" />
              <span>Guides &amp; Articles</span>
            </div>
            <h2
              id="articles-heading"
              className="text-[clamp(28px,3.6vw,42px)] font-bold leading-tight text-ink"
            >
              Master Hindi PDF Editing
            </h2>
            <p className="mt-3 text-lg text-muted max-w-2xl">
              Practical guides, Devanagari typography tutorials, and step-by-step solutions for real-world documents.
            </p>
          </div>
          <div>
            <a
              href="/articles/"
              className="inline-flex items-center gap-2 font-display text-[15px] font-bold text-brand hover:text-brand/80 transition-colors"
            >
              <span>View all guides</span>
              <ArrowRight className="size-4" />
            </a>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {featuredArticles.map((art, idx) => (
            <motion.a
              key={art.title}
              href={art.href}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="group flex flex-col justify-between rounded-2xl border border-line bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[var(--shadow-soft)]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className={`inline-block rounded-full px-3 py-0.5 font-display text-xs font-semibold ${art.badgeTone}`}>
                    {art.category}
                  </span>
                  <span className="text-xs text-muted font-medium">{art.readTime}</span>
                </div>
                <h3 className="font-display text-lg font-bold text-ink group-hover:text-brand transition-colors leading-snug">
                  {art.title}
                </h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
                  {art.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-between text-sm font-bold text-brand">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="size-4" />
                  <span>Read Guide</span>
                </span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
