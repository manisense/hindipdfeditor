import { useCallback, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Btn } from "./ui/button";
import { GooglePlayLink } from "./ui/google-play-link";
import { PointerHighlight } from "./ui/pointer-highlight";
import { ImagesBadge } from "./ui/images-badge";
import { Typewriter } from "./ui/typewriter";
import { Cover } from "./ui/cover";
import { TOOL_COUNT, TOOL_GROUPS } from "./toolCatalog";
import { useLanguage } from "../lib/i18n";
import { toolHref } from "../lib/tools";

function Rise({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  // CSS animation, not motion: it starts as soon as the prerendered HTML paints instead of
  // keeping the hero invisible until JavaScript hydrates.
  return (
    <div
      className={`hero-rise ${className}`.trim()}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

/** Subject lines the sample letter cycles through while it is being retyped. */
const SUBJECT_LINES = [
  "विषय: तीन दिन के अवकाश हेतु प्रार्थना पत्र",
  "विषय: स्थानांतरण प्रमाण पत्र हेतु आवेदन",
  "विषय: शुल्क माफ़ी हेतु निवेदन",
];

/** The four tools a first-time visitor most often comes for; the rest sit behind "all tools". */
const HERO_TOOL_IDS = new Set(["edit", "sign", "translate", "pdf-to-word"]);

function LiveLetter() {
  const { isHindi } = useLanguage();
  const [signed, setSigned] = useState(true);
  const onPhrase = useCallback(
    (_index: number, complete: boolean) => setSigned(complete),
    [],
  );

  return (
    <div
      data-ui
      style={{ fontFamily: '"Noto Sans Devanagari", var(--font-body)' }}
      className="relative rounded-[14px] bg-white px-6 pt-7 pb-6 text-[#1b1d33] shadow-[0_0_0_1px_rgba(9,9,11,0.06),0_24px_60px_rgba(21,23,44,0.12)] sm:px-8"
    >
      <div className="mb-11 flex justify-between gap-3 text-[13px] leading-relaxed text-muted">
        <span>
          सेवा में,
          <br />
          प्रधानाचार्य महोदय
        </span>
        <span>दिनांक: 24/11/2026</span>
      </div>

      <p className="relative mb-3 text-[15px] leading-[1.75]">
        <span className="absolute -top-7 left-0 rounded-full bg-brand px-2.5 py-1 font-display text-[11px] font-bold leading-none text-white">
          {isHindi ? "एडिट हो रहा है" : "Editing this line"}
        </span>
        <span className="rounded bg-brand-wash px-1 py-0.5 font-semibold shadow-[0_0_0_2px_var(--color-brand)]">
          <Typewriter
            phrases={SUBJECT_LINES}
            typeMs={55}
            deleteMs={22}
            holdMs={2600}
            onPhrase={onPhrase}
          />
        </span>
      </p>
      <p className="mb-3 text-[15px] leading-[1.75]">
        महोदय, सविनय निवेदन है कि मैं आपके विद्यालय की कक्षा 10 की छात्रा हूँ। पारिवारिक
        कार्य के कारण मैं विद्यालय नहीं आ सकूँगी।
      </p>
      <p className="mb-3 text-[15px] leading-[1.75]">
        अतः कृपया मुझे अनुमति प्रदान करने की कृपा करें।
      </p>
      <p className="mt-5 text-[15px] leading-[1.75]">
        आपकी आज्ञाकारी शिष्या,
        <br />
        प्रिया शर्मा
      </p>

      <svg
        viewBox="0 0 120 40"
        aria-hidden="true"
        className={`signature-stroke absolute right-6 bottom-6 h-10 w-28 text-brand ${signed ? "is-signed" : ""}`}
      >
        <path
          d="M4 28c8-16 14-20 16-10s-4 14 2 8 10-18 14-12-2 14 4 10 8-10 12-8 2 8 8 6 10-6 16-6 12 4 18 0 10-4 18-2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
          pathLength={1}
        />
      </svg>
    </div>
  );
}

export function Hero() {
  const { lang, t, isHindi } = useLanguage();
  const heroTools = TOOL_GROUPS.flatMap((g) =>
    g.tools
      .filter((tool) => HERO_TOOL_IDS.has(tool.id))
      .map((tool) => ({ ...tool, color: g.color })),
  );

  const phrases = isHindi
    ? [
        "हिंदी टेक्स्ट बदलें।",
        "बिना फॉन्ट टूटे।",
        "सरकारी फॉर्म भरें।",
        "फ्री, बिना साइन-अप।",
      ]
    : [
        "Edit Hindi text.",
        "No broken fonts.",
        "Fill Sarkari forms.",
        "Free, no sign-up.",
      ];

  return (
    <section id="top" className="bg-white pt-28 pb-20 sm:pt-32 lg:pb-28">
      <div className="section-x grid items-center gap-14 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div className="min-w-0">
          <Rise>
            <h1
              className={`font-display font-extrabold tracking-[-0.03em] text-ink ${
                // Devanagari words run wider than Latin ones; this keeps "हिंदी पीडीएफ एडिटर" on one line.
                isHindi
                  ? "text-[clamp(30px,4.3vw,54px)] leading-[1.18]"
                  : "text-[clamp(32px,5.6vw,68px)] leading-[1.04]"
              }`}
            >
              <span className="block">{t("hero.titlePre")}</span>
              <span className="block min-h-[1.04em] whitespace-nowrap text-brand">
                <Typewriter
                  phrases={phrases}
                  caretClassName="bg-brand !w-[3px]"
                />
              </span>
            </h1>
          </Rise>

          <Rise delay={0.08}>
            <p className="mt-6 max-w-[34rem] text-[clamp(17px,1.6vw,19px)] leading-relaxed text-ink/80">
              {isHindi ? (
                <>
                  देवनागरी के सही अक्षरों और मात्राओं के साथ पीडीएफ{" "}
                  <PointerHighlight className="mx-0.5 font-semibold text-ink">
                    एडिट, साइन, अनुवाद और वर्ड में कन्वर्ट
                  </PointerHighlight>{" "}
                  करें, सब कुछ <Cover>एक ही जगह</Cover>। हर मात्रा अपनी जगह पर रहती
                  है।
                </>
              ) : (
                <>
                  Edit, sign, fill, translate and convert your{" "}
                  <PointerHighlight className="mx-0.5 font-semibold text-ink">
                    Devanagari
                  </PointerHighlight>{" "}
                  documents in <Cover>one place</Cover>. Every matra stays where
                  it belongs.
                </>
              )}
            </p>
          </Rise>

          <Rise delay={0.14}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Btn size="lg" href={toolHref("edit", lang)}>
                {t("hero.ctaPrimary")}
              </Btn>
              <GooglePlayLink size="lg" variant="subtle">
                {isHindi ? "गूगल प्ले पर पाएं" : "Get it on Google Play"}
              </GooglePlayLink>
            </div>
          </Rise>

          <Rise delay={0.2}>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <ImagesBadge
                label={
                  isHindi
                    ? "दैनिक हिंदी दस्तावेजों के लिए भरोसेमंद"
                    : "Loved for everyday Hindi paperwork"
                }
              />
              <span className="inline-flex items-center gap-2 text-sm font-medium text-muted">
                <span className="size-1.5 rounded-full bg-accent" />
                {t("hero.badge")}
              </span>
            </div>
          </Rise>
        </div>

        <Rise delay={0.12} className="min-w-0">
          <div className="rounded-[28px] bg-brand-wash px-4 pt-12 pb-5 sm:px-8 sm:pt-14 sm:pb-7">
            <LiveLetter />
            <nav
              aria-label={isHindi ? "लोकप्रिय टूल" : "Popular tools"}
              className="mt-5 flex flex-wrap gap-2"
            >
              {heroTools.map((tool) => (
                <a
                  key={tool.id}
                  href={toolHref(tool.id, lang)}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3.5 font-display text-[13px] font-semibold text-ink transition-colors hover:text-brand"
                >
                  <tool.icon
                    className="size-4"
                    style={{ color: tool.color }}
                    strokeWidth={2}
                  />
                  {t(tool.nameKey)}
                </a>
              ))}
              <a
                href="#features"
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 font-display text-[13px] font-semibold text-brand transition-colors hover:text-brand-hover"
              >
                {isHindi ? `सभी ${TOOL_COUNT} टूल्स` : `All ${TOOL_COUNT} tools`}
                <ArrowRight className="size-3.5" />
              </a>
            </nav>
          </div>
        </Rise>
      </div>
    </section>
  );
}
