import { motion } from "motion/react";
import { BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { useLanguage } from "../lib/i18n";
import { ENTER, STAGGER } from "./motion";

export function ArticlesSection() {
  const { t, isHindi } = useLanguage();

  const articlesEn = [
    {
      category: "Typography & Fonts",
      title: "Broken Hindi fonts in PDF: diagnose before editing",
      desc: "Understand Unicode, legacy fonts and scanned Hindi PDFs. Test conjuncts, add safe overlays and review what the export keeps.",
      href: "/articles/fix-broken-hindi-fonts-in-pdf/",
      badgeTone: "bg-brand-tint text-brand",
      readTime: "3 min read",
    },
    {
      category: "Merge & Split",
      title: "Merge Hindi PDF files online: order and output checks",
      desc: "Combine two or more PDFs in browser memory. Check the listed order, page count and exported copy; keep the original files.",
      href: "/articles/merge-multiple-hindi-pdf-files-online/",
      badgeTone: "bg-accent-tint text-accent",
      readTime: "2 min read",
    },
    {
      category: "Translation & AI",
      title: "Translate Hindi PDF to English: consent and review",
      desc: "Translate supported Hindi or English text through the AI service after consent. Review text accuracy, skipped lines and the translated PDF.",
      href: "/articles/translate-hindi-pdf-to-english/",
      badgeTone: "bg-pop-lav text-[#5B4BD6]",
      readTime: "3 min read",
    },
  ];

  const articlesHi = [
    {
      category: "टाइपोग्राफी",
      title: "हिंदी PDF कैसे एडिट करें: टेक्स्ट जोड़ें और कॉपी जाँचें",
      desc: "हिंदी PDF में Unicode टेक्स्ट जोड़ने, स्कैन पर मास्क लगाने और एक्सपोर्ट जाँचने की गाइड। नमूना PDF, फॉन्ट चेतावनी और प्राइवेसी सीमाएँ समझें।",
      href: "/articles/hindi-pdf-kaise-edit-kare/",
      badgeTone: "bg-brand-tint text-brand",
      readTime: "5 मिनट",
    },
    {
      category: "सरकारी भर्ती",
      title: "नाम सुधार आवेदन और शपथ पत्र: प्रवेश पत्र में त्रुटि हो तो क्या करें",
      desc: "प्रवेश पत्र के नाम में त्रुटि पर जारीकर्ता से संपर्क करें। अपने सुधार आवेदन की PDF तैयार करें; शपथ पत्र का प्रारूप और नियम संबंधित संस्था से लें।",
      href: "/articles/sarkari-admit-card-name-correction-affidavit-hindi/",
      badgeTone: "bg-accent-tint text-accent",
      readTime: "4 मिनट",
    },
    {
      category: "फॉन्ट कन्वर्जन",
      title: "Kruti Dev PDF और Unicode: कन्वर्जन की सीमाएँ",
      desc: "पुरानी हिंदी एन्कोडिंग पहचानें; Unicode स्रोत लें और नया ओवरले जाँचें। यह सार्वभौमिक PDF फॉन्ट कन्वर्टर नहीं है।",
      href: "/articles/kruti-dev-pdf-unicode-converter-hindi/",
      badgeTone: "bg-pop-lav text-[#5B4BD6]",
      readTime: "3 मिनट",
    },
  ];

  const featuredArticles = isHindi ? articlesHi : articlesEn;

  return (
    <section
      id="articles"
      className="py-24 bg-cream"
      aria-labelledby="articles-heading"
    >
      <div className="section-x">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
              <Sparkles className="size-4" />
              <span>{t("art.eyebrow")}</span>
            </div>
            <h2
              id="articles-heading"
              className="text-[clamp(28px,3.6vw,42px)] font-bold leading-tight text-ink"
            >
              {t("art.title")}
            </h2>
            <p className="mt-3 text-lg text-muted max-w-2xl">
              {t("art.subtitle")}
            </p>
          </div>
          <div>
            <a
              href="/articles/"
              className="inline-flex items-center gap-2 font-display text-base font-bold text-brand hover:text-brand/80 transition-colors"
            >
              <span>{isHindi ? "सभी गाइड्स और लेख देखें" : "View all guides"}</span>
              <ArrowRight className="size-4" />
            </a>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {featuredArticles.map((art, idx) => (
            <motion.a
              key={art.title}
              href={art.href}
              initial={{ y: 18 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ ...ENTER, delay: idx * STAGGER }}
              className="group flex flex-col justify-between rounded-3xl bg-white p-7 transition-colors duration-200 hover:bg-brand-wash"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span
                    className={`inline-block rounded-full px-3 py-0.5 font-display text-[13px] font-semibold ${art.badgeTone}`}
                  >
                    {art.category}
                  </span>
                  <span className="text-[13px] text-muted font-medium">
                    {art.readTime}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold text-ink group-hover:text-brand transition-colors leading-snug">
                  {art.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">
                  {art.desc}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between text-sm font-bold text-brand">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="size-4" />
                  <span>{isHindi ? "गाइड पढ़ें" : "Read Guide"}</span>
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
