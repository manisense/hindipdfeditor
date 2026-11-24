import { motion } from "motion/react";
import { Check } from "lucide-react";
import { Btn } from "./ui/button";
import { GooglePlayLink } from "./ui/google-play-link";
import { useLanguage } from "../lib/i18n";
import { toolHref } from "../lib/tools";
import { TOOL_GROUPS } from "./toolCatalog";

const SHOWN_TOOLS = new Set([
  "edit",
  "translate",
  "merge",
  "split",
  "compress",
]);

export function WorkYourWay() {
  const { lang, t, isHindi } = useLanguage();

  const feats = [
    {
      h: t("work.f1Title"),
      p: t("work.f1Desc"),
    },
    {
      h: t("work.f2Title"),
      p: t("work.f2Desc"),
    },
    {
      h: t("work.f3Title"),
      p: t("work.f3Desc"),
    },
  ];

  return (
    <section id="work" className="py-24">
      <div className="section-x grid items-center gap-14 md:grid-cols-2">
        <div>
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            {t("work.eyebrow")}
          </div>
          <h2 className="text-[clamp(28px,3.6vw,42px)] font-bold leading-tight text-ink">
            {t("work.title")}
          </h2>
          <p className="mt-4 text-lg text-muted">{t("work.subtitle")}</p>
          <div className="mt-7 grid gap-4">
            {feats.map((f) => (
              <div key={f.h} className="flex gap-3.5">
                <Check
                  className="mt-0.5 size-5 flex-none text-[#16A34A]"
                  strokeWidth={2.5}
                />
                <div>
                  <h4 className="font-display text-base font-semibold text-ink">
                    {f.h}
                  </h4>
                  <p className="text-base text-muted">{f.p}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <Btn href={toolHref("edit", lang)}>
              {isHindi ? "एडिटर खोलें →" : "Open the editor →"}
            </Btn>
            <GooglePlayLink variant="ghost" />
          </div>
        </div>

        <motion.div
          initial={{ scale: 0.96 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[28px] bg-brand-wash p-8"
        >
          {/* A real capture of the web editor retyping the subject line of a Hindi letter. */}
          <img
            src="/assets/product/editor-hindi-edit.webp"
            width={1040}
            height={373}
            loading="lazy"
            alt={
              isHindi
                ? "एडिटर में एक हिंदी प्रार्थना पत्र, विषय की लाइन बदली जा रही है"
                : "A Hindi letter open in the editor, with its subject line being retyped"
            }
            className="block h-auto w-full rounded-2xl bg-white"
          />
          <div className="mt-5 flex flex-wrap gap-2">
            {TOOL_GROUPS.flatMap((g) =>
              g.tools
                .filter((tool) => SHOWN_TOOLS.has(tool.id))
                .map((tool) => (
                  <a
                    key={tool.id}
                    href={toolHref(tool.id, lang)}
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3.5 font-display text-[13px] font-semibold text-ink transition-colors hover:text-brand"
                  >
                    <tool.icon
                      className="size-4"
                      style={{ color: g.color }}
                      strokeWidth={2}
                    />
                    {t(tool.nameKey)}
                  </a>
                )),
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
