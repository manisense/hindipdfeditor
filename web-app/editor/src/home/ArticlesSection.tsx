import { motion } from 'motion/react';
import { BookOpen, ArrowRight, Sparkles } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export function ArticlesSection() {
  const { t, isHindi } = useLanguage();

  const articlesEn = [
    {
      category: 'Typography & Fonts',
      title: "Hindi Text Broken in a PDF? 4 Different Problems and How to Fix Each One",
      desc: "Scattered matras, empty boxes, copy-paste gibberish or \"d`fr nso\"? Find which of four problems you have and fix it.",
      href: '/articles/fix-broken-hindi-fonts-in-pdf/',
      badgeTone: 'bg-brand-tint text-brand',
      readTime: '5 min read',
    },
    {
      category: 'Merge & Split',
      title: "How to Merge Hindi PDF Files Into One (in the Right Order, Without Uploading Them)",
      desc: "Combine certificates, affidavits and scans into one PDF in the right order, and stay under the portal size limit.",
      href: '/articles/merge-multiple-hindi-pdf-files-online/',
      badgeTone: 'bg-accent-tint text-accent',
      readTime: '4 min read',
    },
    {
      category: 'Translation & AI',
      title: "How to Translate a Hindi PDF to English (and Keep the Layout)",
      desc: "Four ways to translate a Hindi PDF, from quick copy-paste to keeping the original page layout.",
      href: '/articles/translate-hindi-pdf-to-english/',
      badgeTone: 'bg-pop-lav text-[#5B4BD6]',
      readTime: '4 min read',
    },
  ];

  const articlesHi = [
    {
      category: 'टाइपोग्राफी',
      title: "हिंदी पीडीएफ कैसे एडिट करें — मोबाइल और कंप्यूटर पर, बिना मात्रा टूटे (2026)",
      desc: "मोबाइल पर हिंदी टाइपिंग सेट करने से लेकर मात्राएं सही रखने और नई पीडीएफ डाउनलोड करने तक, पूरा तरीका।",
      href: '/articles/hindi-pdf-kaise-edit-kare/',
      badgeTone: 'bg-brand-tint text-brand',
      readTime: '5 मिनट',
    },
    {
      category: 'सरकारी भर्ती',
      title: "नाम में स्पेलिंग अलग है? सरकारी भर्ती के लिए 'एक ही व्यक्ति' शपथ पत्र कैसे बनवाएं (प्रारूप सहित)",
      desc: "मार्कशीट, आधार और भर्ती फॉर्म में नाम अलग है? शपथ पत्र का प्रारूप, बनवाने का तरीका और कब यह काफी नहीं होता।",
      href: '/articles/sarkari-admit-card-name-correction-affidavit-hindi/',
      badgeTone: 'bg-accent-tint text-accent',
      readTime: '4 मिनट',
    },
    {
      category: 'फॉन्ट कन्वर्जन',
      title: "कृति देव वाली पीडीएफ में 'd`fr nso' क्यों दिखता है — पढ़ें, यूनिकोड में बदलें या एडिट करें",
      desc: "कृति देव पीडीएफ में \"d`fr nso\" क्यों दिखता है, टेक्स्ट यूनिकोड में कैसे बदलें और कुछ शब्द कैसे बदलें।",
      href: '/articles/kruti-dev-pdf-unicode-converter-hindi/',
      badgeTone: 'bg-pop-lav text-[#5B4BD6]',
      readTime: '5 मिनट',
    },
  ];

  const featuredArticles = isHindi ? articlesHi : articlesEn;

  return (
    <section id="articles" className="py-24 bg-cream/40 border-t border-line" aria-labelledby="articles-heading">
      <div className="section-x">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
              <Sparkles className="size-4" />
              <span>{t('art.eyebrow')}</span>
            </div>
            <h2
              id="articles-heading"
              className="text-[clamp(28px,3.6vw,42px)] font-bold leading-tight text-ink"
            >
              {t('art.title')}
            </h2>
            <p className="mt-3 text-lg text-muted max-w-2xl">
              {t('art.subtitle')}
            </p>
          </div>
          <div>
            <a
              href="/articles/"
              className="inline-flex items-center gap-2 font-display text-[15px] font-bold text-brand hover:text-brand/80 transition-colors"
            >
              <span>{isHindi ? 'सभी गाइड्स और लेख देखें →' : 'View all guides →'}</span>
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
                  <span>{isHindi ? 'गाइड पढ़ें' : 'Read Guide'}</span>
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
