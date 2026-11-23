import {
  ChevronRight,
  ClipboardPen,
  FileArchive,
  FileText,
  FileType2,
  Languages,
  Layers,
  LayoutGrid,
  Pencil,
  Signature,
  Split,
  Type,
} from "lucide-react";
import { Btn } from "./ui/button";
import { GooglePlayLink } from "./ui/google-play-link";
import { PointerHighlight } from "./ui/pointer-highlight";
import { ImagesBadge } from "./ui/images-badge";
import { useLanguage } from "../lib/i18n";
import { toolHref } from "../lib/tools";

function Fade({
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

export function Hero() {
  const { lang, t, isHindi } = useLanguage();

  // Every tool on the site, grouped by category colour (edit blue, convert green, organise
  // violet, optimise amber), so the hero never lists fewer tools than the site has.
  const tools = [
    { icon: Pencil, name: t("tool.edit"), detail: t("tool.editSub"), tone: "bg-brand-tint text-brand", href: toolHref("edit", lang) },
    { icon: Signature, name: t("tool.sign"), detail: t("tool.signSub"), tone: "bg-brand-tint text-brand", href: toolHref("sign", lang) },
    { icon: ClipboardPen, name: t("tool.fill"), detail: t("tool.fillSub"), tone: "bg-brand-tint text-brand", href: toolHref("fill-form", lang) },
    { icon: Languages, name: t("tool.translate"), detail: t("tool.translateSub"), tone: "bg-accent-tint text-accent", href: toolHref("translate", lang) },
    { icon: FileType2, name: t("tool.pdfToWord"), detail: t("tool.pdfToWordSub"), tone: "bg-accent-tint text-accent", href: toolHref("pdf-to-word", lang) },
    { icon: FileText, name: t("tool.wordToPdf"), detail: t("tool.wordToPdfSub"), tone: "bg-accent-tint text-accent", href: toolHref("word-to-pdf", lang) },
    { icon: Type, name: t("tool.krutidev"), detail: t("tool.krutidevSub"), tone: "bg-accent-tint text-accent", href: toolHref("krutidev", lang) },
    { icon: Layers, name: t("tool.merge"), detail: t("tool.mergeSub"), tone: "bg-pop-lav text-[#5B4BD6]", href: toolHref("merge", lang) },
    { icon: Split, name: t("tool.split"), detail: t("tool.splitSub"), tone: "bg-pop-lav text-[#5B4BD6]", href: toolHref("split", lang) },
    { icon: LayoutGrid, name: t("tool.organize"), detail: t("tool.organizeSub"), tone: "bg-pop-lav text-[#5B4BD6]", href: toolHref("organize", lang) },
    { icon: FileArchive, name: t("tool.compress"), detail: t("tool.compressSub"), tone: "bg-pop-yellow-tint text-[#B58400]", href: toolHref("compress", lang) },
  ];

  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]"
        style={{
          background:
            "radial-gradient(70% 100% at 50% 0%, #eef3ff 0%, transparent 70%)",
        }}
      />

      <div className="section-x">
        <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
          <div>
            <Fade>
              <a
                href="#features"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium text-muted shadow-[0_1px_2px_rgba(21,23,44,0.04)] transition-colors hover:text-ink"
              >
                <span className="size-1.5 rounded-full bg-accent" />
                {t("hero.badge")}
                <ChevronRight className="size-3.5" />
              </a>
            </Fade>

            <Fade delay={0.05}>
              <h1 className="mt-6 font-display text-[clamp(34px,4.2vw,52px)] font-extrabold leading-[1.05] tracking-tight text-ink">
                <span className="block text-ink">{t("hero.titlePre")}</span>
                <span className="block text-ink">
                  {isHindi ? "बिना फॉन्ट टूटे।" : "No broken fonts."}
                </span>
              </h1>
            </Fade>

            <Fade delay={0.1}>
              <p className="mt-5 max-w-lg text-[clamp(16px,1.7vw,18px)] leading-relaxed text-muted">
                {isHindi ? (
                  <>
                    देवनागरी के सही अक्षरों और मात्राओं के साथ पीडीएफ{" "}
                    <PointerHighlight className="mx-0.5 font-semibold text-ink">
                      एडिट, साइन, अनुवाद और वर्ड में कन्वर्ट
                    </PointerHighlight>{" "}
                    करें — सब कुछ एक ही जगह।
                  </>
                ) : (
                  <>
                    Edit, sign, fill, translate, convert to Word, merge and compress your{" "}
                    <PointerHighlight className="mx-0.5 font-semibold text-ink">
                      Devanagari
                    </PointerHighlight>{" "}
                    documents, all in one place.
                  </>
                )}
              </p>
            </Fade>

            <Fade delay={0.15}>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Btn size="lg" href={toolHref("edit", lang)}>
                  {t("hero.ctaPrimary")}
                </Btn>
                <GooglePlayLink size="lg" variant="subtle" />
              </div>
            </Fade>

            <Fade delay={0.2}>
              <div className="mt-7">
                <ImagesBadge
                  label={
                    isHindi
                      ? "दैनिक हिंदी दस्तावेजों के लिए भरोसेमंद"
                      : "Loved for everyday Hindi paperwork"
                  }
                />
              </div>
            </Fade>
          </div>

          <div className="flex flex-col gap-4">
            <div
              className="hero-rise rounded-2xl border border-black/[0.05] bg-[#f4f5f7] p-5"
              style={{ animationDelay: "0.15s" }}
            >
              <div className="mb-3.5 flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-brand-tint text-brand">
                  <Pencil className="size-4" strokeWidth={2} />
                </span>
                <div>
                  <div className="font-display text-base font-bold text-ink leading-none">
                    {isHindi
                      ? "सीधे ब्राउज़र में एडिट करें"
                      : "Edit right in your browser"}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    {isHindi
                      ? "बिना इंस्टालेशन — सही मात्राएं"
                      : "No setup — shaping stays correct"}
                  </div>
                </div>
              </div>
              {/* A real capture of the editor: the subject line of a sample letter being retyped. */}
              <img
                src="/assets/product/editor-hindi-edit.webp"
                width={1040}
                height={373}
                alt={
                  isHindi
                    ? "एडिटर में एक हिंदी प्रार्थना पत्र, विषय की लाइन बदली जा रही है"
                    : "A Hindi letter open in the editor, with its subject line being retyped"
                }
                className="block h-auto w-full rounded-xl border border-black/[0.06] bg-white"
                fetchPriority="high"
              />
            </div>

            <div
              className="hero-rise rounded-2xl border border-black/[0.05] bg-[#f4f5f7] p-5"
              style={{ animationDelay: "0.25s" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="font-display text-base font-bold text-ink">
                  {isHindi
                    ? "एक ही टूलकिट, सभी कार्य"
                    : "One toolkit, every job"}
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 font-display text-[13px] font-semibold text-muted">
                  {tools.length} {isHindi ? "टूल्स" : "tools"}
                </span>
              </div>
              <div className="grid gap-x-1 rounded-xl border border-black/[0.06] bg-white p-2 sm:grid-cols-2">
                {tools.map((t) => (
                  <a
                    key={t.name}
                    href={t.href}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-[#f7f8fa]"
                  >
                    <span
                      className={`grid size-8 flex-none place-items-center rounded-lg ${t.tone}`}
                    >
                      <t.icon className="size-[17px]" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-sm font-semibold text-ink leading-tight">
                        {t.name}
                      </div>
                      <div className="text-[13px] text-muted">{t.detail}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
