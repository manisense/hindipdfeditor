import { ArrowRight } from 'lucide-react';

import { useLanguage, useTx } from '../lib/i18n';
import { SectionHeading } from './ui/section-heading';

export function ArticlesSection() {
  const { isHindi } = useLanguage();
  const tx = useTx();

  const articlesEn = [
    {
      category: 'Typography & Fonts',
      title: "Hindi Text Broken in a PDF? 4 Different Problems and How to Fix Each One",
      desc: "Scattered matras, empty boxes, copy-paste gibberish or \"d`fr nso\"? Find which of four problems you have and fix it.",
      href: '/articles/fix-broken-hindi-fonts-in-pdf/',
      badgeTone: 'bg-cat-edit-tint text-cat-edit',
      readTime: '5 min read',
    },
    {
      category: 'Merge & Split',
      title: "How to Merge Hindi PDF Files Into One (in the Right Order, Without Uploading Them)",
      desc: "Combine certificates, affidavits and scans into one PDF in the right order, and stay under the portal size limit.",
      href: '/articles/merge-multiple-hindi-pdf-files-online/',
      badgeTone: 'bg-cat-merge-tint text-cat-merge',
      readTime: '4 min read',
    },
    {
      category: 'Translation & AI',
      title: "How to Translate a Hindi PDF to English (and Keep the Layout)",
      desc: "Four ways to translate a Hindi PDF, from quick copy-paste to keeping the original page layout.",
      href: '/articles/translate-hindi-pdf-to-english/',
      badgeTone: 'bg-cat-translate-tint text-cat-translate',
      readTime: '4 min read',
    },
  ];

  const articlesHi = [
    {
      category: 'टाइपोग्राफी',
      title: "हिंदी पीडीएफ कैसे एडिट करें — मोबाइल और कंप्यूटर पर, बिना मात्रा टूटे (2026)",
      desc: "मोबाइल पर हिंदी टाइपिंग सेट करने से लेकर मात्राएं सही रखने और नई पीडीएफ डाउनलोड करने तक, पूरा तरीका।",
      href: '/articles/hindi-pdf-kaise-edit-kare/',
      badgeTone: 'bg-cat-edit-tint text-cat-edit',
      readTime: '5 मिनट',
    },
    {
      category: 'सरकारी भर्ती',
      title: "नाम में स्पेलिंग अलग है? सरकारी भर्ती के लिए 'एक ही व्यक्ति' शपथ पत्र कैसे बनवाएं (प्रारूप सहित)",
      desc: "मार्कशीट, आधार और भर्ती फॉर्म में नाम अलग है? शपथ पत्र का प्रारूप, बनवाने का तरीका और कब यह काफी नहीं होता।",
      href: '/articles/sarkari-admit-card-name-correction-affidavit-hindi/',
      badgeTone: 'bg-cat-sarkari-tint text-cat-sarkari',
      readTime: '4 मिनट',
    },
    {
      category: 'फॉन्ट कन्वर्जन',
      title: "कृति देव वाली पीडीएफ में 'd`fr nso' क्यों दिखता है — पढ़ें, यूनिकोड में बदलें या एडिट करें",
      desc: "कृति देव पीडीएफ में \"d`fr nso\" क्यों दिखता है, टेक्स्ट यूनिकोड में कैसे बदलें और कुछ शब्द कैसे बदलें।",
      href: '/articles/kruti-dev-pdf-unicode-converter-hindi/',
      badgeTone: 'bg-cat-edit-tint text-cat-edit',
      readTime: '5 मिनट',
    },
  ];

  const featuredArticles = isHindi ? articlesHi : articlesEn;

  return (
    <section id="articles" className="bg-white py-16 sm:py-24" aria-labelledby="articles-heading">
      <div className="section-x flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          id="articles-heading"
          align="left"
          eyebrow={tx('Guides', 'गाइड्स')}
          title={tx('Stuck on a Hindi PDF?', 'हिंदी पीडीएफ में अटके हैं?')}
          subtitle={tx(
            'Step-by-step fixes for broken fonts, Sarkari forms and translation.',
            'टूटे फॉन्ट, सरकारी फॉर्म और अनुवाद के लिए कदम-दर-कदम हल।',
          )}
        />
        <a
          href="/articles/"
          className="group inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-[15px] font-semibold text-brand"
        >
          {tx('All guides', 'सभी गाइड्स')}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </a>
      </div>

      <ul className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:px-6 lg:mx-auto lg:grid lg:max-w-[1120px] lg:grid-cols-3 lg:gap-6 lg:overflow-visible">
        {featuredArticles.map((art) => (
          <li key={art.href} className="w-[80%] max-w-[340px] shrink-0 snap-start lg:w-auto lg:max-w-none">
            <a
              href={art.href}
              className="group flex h-full flex-col rounded-2xl border border-line bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(20,22,31,0.06)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-3 py-1 font-display text-[12px] font-semibold ${art.badgeTone}`}>
                  {art.category}
                </span>
                <span className="text-[12px] font-medium text-faint">{art.readTime}</span>
              </div>
              <h3 className="mt-4 font-display text-[17px] font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
                {art.title}
              </h3>
              <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted">{art.desc}</p>
              <span className="mt-6 inline-flex items-center gap-2 font-display text-[14px] font-semibold text-brand">
                {isHindi ? 'गाइड पढ़ें' : 'Read guide'}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
