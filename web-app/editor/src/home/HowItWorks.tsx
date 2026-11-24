import { motion } from "motion/react";
import { UploadCloud, Edit3, Type, FileCheck } from "lucide-react";
import { Btn } from "./ui/button";
import { useLanguage } from "../lib/i18n";
import { toolHref } from "../lib/tools";

export function HowItWorks() {
  const { lang, t, isHindi } = useLanguage();

  const steps = [
    {
      icon: UploadCloud,
      title: t("how.step1Title"),
      desc: t("how.step1Desc"),
    },
    {
      icon: Edit3,
      title: t("how.step2Title"),
      desc: t("how.step2Desc"),
    },
    {
      icon: Type,
      title: t("how.step3Title"),
      desc: t("how.step3Desc"),
    },
    {
      icon: FileCheck,
      title: t("how.step4Title"),
      desc: t("how.step4Desc"),
    },
  ];

  return (
    <section
      id="how-it-works"
      className="bg-white py-24 lg:py-32"
      aria-labelledby="how-it-works-heading"
    >
      <div className="section-x grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            {t("how.eyebrow")}
          </div>
          <h2
            id="how-it-works-heading"
            className="text-[clamp(30px,3.8vw,46px)] font-bold leading-[1.1] tracking-[-0.02em] text-ink"
          >
            {t("how.title")}
          </h2>
          <p className="mt-5 max-w-md text-lg text-ink/80">
            {t("how.subtitle")}
          </p>
          <div className="mt-8">
            <Btn href={toolHref("edit", lang)}>
              {isHindi
                ? "अभी हिंदी पीडीएफ एडिट करना शुरू करें →"
                : "Start Editing Hindi PDF Now →"}
            </Btn>
          </div>
        </div>

        <ol className="grid gap-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.li
                key={step.title}
                initial={{ y: 20 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.45,
                  delay: idx * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="grid grid-cols-[auto_1fr] gap-x-5 rounded-3xl bg-cream px-6 py-7 sm:px-8"
              >
                <Icon className="mt-1 size-7 text-brand" strokeWidth={2} />
                <div>
                  <h3 className="font-display text-xl font-bold text-ink sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-ink/80">
                    {step.desc}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
