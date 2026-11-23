import { Btn } from "./ui/button";
import { GooglePlayLink } from "./ui/google-play-link";
import { useLanguage } from "../lib/i18n";
import { toolHref } from "../lib/tools";

export function CTA() {
  const { lang, t } = useLanguage();

  return (
    <section className="relative overflow-hidden bg-white py-24 text-center">
      {/* design-system.md: the one gradient mesh on the site, soft blobs at low opacity. */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="absolute left-[8%] top-[18%] size-[340px] rounded-full bg-[#1843DD] opacity-[0.16] blur-[90px]" />
        <div className="absolute left-[34%] top-[46%] size-[320px] rounded-full bg-[#7C3AED] opacity-[0.15] blur-[90px]" />
        <div className="absolute right-[26%] top-[8%] size-[300px] rounded-full bg-[#F472B6] opacity-[0.15] blur-[90px]" />
        <div className="absolute right-[6%] top-[40%] size-[320px] rounded-full bg-[#FACC15] opacity-[0.2] blur-[90px]" />
      </div>
      <div className="section-x relative z-10">
        <h2 className="text-[clamp(34px,5.2vw,60px)] font-extrabold leading-[1.05] text-ink">
          {t("cta.title")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          {t("cta.subtitle")}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3.5">
          <Btn size="lg" href={toolHref("edit", lang)}>
            {t("cta.open")}
          </Btn>
          <GooglePlayLink size="lg" variant="ghost" />
        </div>
      </div>
    </section>
  );
}
