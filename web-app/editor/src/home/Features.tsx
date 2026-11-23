import {
  Check,
  ClipboardPen,
  FileArchive,
  FileType2,
  Languages,
  Layers,
  Pencil,
  ScanText,
  ShieldCheck,
  Signature,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/cn";
import { useLanguage } from "../lib/i18n";
import { toolHref } from "../lib/tools";

function Card({
  className,
  children,
  href,
}: {
  className?: string;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <motion.a
      href={href}
      initial={{ y: 24 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-white p-7 transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {children}
    </motion.a>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="mt-auto flex flex-wrap gap-2 pt-6">
      {items.map((text) => (
        <span
          key={text}
          className="rounded-full border border-line bg-white px-3 py-1 font-display text-[13px] font-semibold text-ink"
        >
          {text}
        </span>
      ))}
    </div>
  );
}

function Ico({ icon: Icon, tone }: { icon: LucideIcon; tone: string }) {
  return (
    <div
      className={cn("mb-5 grid size-12 place-items-center rounded-2xl", tone)}
    >
      <Icon className="size-6" strokeWidth={2} />
    </div>
  );
}

function EditVisual() {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-cream p-5">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3 font-display text-xl font-semibold text-ink">
          अनुबंध पत्र
        </div>
        <div className="mb-2 h-2.5 w-[92%] rounded bg-brand-tint" />
        <div className="mb-2 flex items-center gap-1">
          <div className="h-2.5 w-1/3 rounded bg-slate-100" />
          <span className="rounded bg-brand px-2 py-0.5 font-display text-[11px] font-semibold text-white">
            हस्ताक्षर
          </span>
          <div className="h-2.5 w-1/4 rounded bg-slate-100" />
        </div>
        <div className="mb-2 h-2.5 w-[78%] rounded bg-accent-tint" />
        <div className="h-2.5 w-2/3 rounded bg-slate-100" />
      </div>
    </div>
  );
}

function TranslateVisual() {
  return (
    <div className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-cream p-4">
      <div className="flex-1 rounded-xl bg-white p-3 shadow-sm">
        <div className="font-display text-[15px] font-semibold text-ink">
          नमस्ते
        </div>
        <div className="mt-1 h-1.5 w-3/4 rounded bg-brand-tint" />
      </div>
      <div className="grid size-7 place-items-center rounded-full bg-accent text-white">
        →
      </div>
      <div className="flex-1 rounded-xl bg-white p-3 shadow-sm">
        <div className="font-display text-[15px] font-semibold text-accent">
          Hello
        </div>
        <div className="mt-1 h-1.5 w-3/4 rounded bg-accent-tint" />
      </div>
    </div>
  );
}

function OcrVisual() {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-cream p-4">
      <div className="relative rounded-xl bg-white p-3 shadow-sm">
        <div className="absolute inset-2 rounded-md border-2 border-dashed border-brand/40" />
        <div className="relative space-y-2 p-1">
          <div className="inline-block rounded bg-brand-tint px-2 py-0.5 font-display text-xs font-semibold text-brand">
            हिंदी
          </div>{" "}
          <div className="inline-block rounded bg-accent-tint px-2 py-0.5 font-display text-xs font-semibold text-accent-700">
            English
          </div>
          <div className="h-1.5 w-2/3 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function OrganizeVisual() {
  return (
    <div className="mt-6 flex items-end justify-center gap-2 rounded-2xl border border-line bg-cream p-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 w-11 rounded-md border border-line bg-white shadow-sm"
          style={{
            transform: `translateY(${i === 1 ? -8 : 0}px) rotate(${(i - 1) * 5}deg)`,
          }}
        >
          <div className="m-1.5 h-1 rounded bg-brand-tint" />
          <div className="mx-1.5 h-1 w-3/4 rounded bg-slate-100" />
        </div>
      ))}
      <span className="ml-1 font-display text-2xl text-muted">+</span>
    </div>
  );
}

function SignVisual() {
  return (
    <div className="mt-6 flex items-end justify-center gap-2 rounded-2xl border border-line bg-cream p-5">
      {[1, 2, 3].map((page) => (
        <div
          key={page}
          className="relative h-20 w-14 rounded-md border border-line bg-white p-1.5 shadow-sm"
        >
          <div className="mb-1 h-1 rounded bg-slate-100" />
          <div className="mb-1 h-1 w-3/4 rounded bg-slate-100" />
          <div className="h-1 w-2/3 rounded bg-slate-100" />
          <svg
            viewBox="0 0 40 14"
            aria-hidden="true"
            className="absolute right-1.5 bottom-2 h-3.5 w-9 text-brand"
            style={page === 2 ? { transform: "translate(-6px, -4px)" } : undefined}
          >
            <path
              d="M2 10c4-7 6-7 7-2s3 4 6-2 4-3 5 1 3 3 7-1 6-2 11-1"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
        </div>
      ))}
    </div>
  );
}

function FormVisual() {
  return (
    <div className="mt-6 space-y-2 rounded-2xl border border-line bg-cream p-4">
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <div className="text-[13px] font-semibold text-muted">नाम</div>
        <div className="mt-1 rounded-md border border-brand/40 bg-brand-tint/40 px-2 py-1 font-display text-[15px] font-semibold text-ink">
          कृष्ण कुमार त्रिपाठी
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
        <span className="grid size-4 place-items-center rounded bg-brand text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
        <span className="text-[13px] font-semibold text-ink">सामान्य वर्ग</span>
      </div>
    </div>
  );
}

function WordVisual() {
  return (
    <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-cream p-4">
      <div className="flex-1 rounded-xl bg-white p-3 shadow-sm">
        <div className="mb-2 font-display text-[13px] font-bold text-ink">PDF</div>
        <div className="mb-1.5 font-display text-[15px] font-semibold text-ink">
          रिक्तियां
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line text-[12px]">
          {["पद", "संख्या", "सहायक", "12"].map((cell) => (
            <div key={cell} className="bg-white px-1.5 py-1 text-ink">
              {cell}
            </div>
          ))}
        </div>
      </div>
      <div className="grid size-7 flex-none place-items-center rounded-full bg-accent text-white">
        →
      </div>
      <div className="flex-1 rounded-xl bg-white p-3 shadow-sm">
        <div className="mb-2 font-display text-[13px] font-bold text-accent">.docx</div>
        <div className="mb-1.5 font-display text-[15px] font-semibold text-ink">
          रिक्तियां
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-accent/40 bg-accent/30 text-[12px]">
          {["पद", "संख्या", "सहायक", "12"].map((cell) => (
            <div key={cell} className="bg-white px-1.5 py-1 text-ink">
              {cell}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Features() {
  const { lang, t, isHindi } = useLanguage();

  return (
    <section id="features" className="bg-cream py-24">
      <div className="section-x">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            {t("feat.eyebrow")}
          </div>
          <h2 className="text-[clamp(30px,4vw,46px)] font-bold leading-tight text-ink">
            {t("feat.title")}
          </h2>
          <p className="mt-4 text-lg text-muted">{t("feat.subtitle")}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-6">
          <Card className="md:col-span-4" href={toolHref("edit", lang)}>
            <Ico icon={Pencil} tone="bg-brand-tint text-brand" />
            <h3 className="text-xl font-bold text-ink">
              {t("feat.editHeading")}
            </h3>
            <p className="mt-2 max-w-md text-[15px] text-muted">
              {t("feat.editDesc")}
            </p>
            <EditVisual />
          </Card>

          <Card className="md:col-span-2" href={toolHref("translate", lang)}>
            <Ico icon={Languages} tone="bg-accent-tint text-accent" />
            <h3 className="text-xl font-bold text-ink">
              {t("feat.translateHeading")}
            </h3>
            <p className="mt-2 text-[15px] text-muted">
              {t("feat.translateDesc")}
            </p>
            <TranslateVisual />
          </Card>

          <Card className="md:col-span-2" href={toolHref("sign", lang)}>
            <Ico icon={Signature} tone="bg-brand-tint text-brand" />
            <h3 className="text-xl font-bold text-ink">
              {t("feat.signHeading")}
            </h3>
            <p className="mt-2 text-[15px] text-muted">{t("feat.signDesc")}</p>
            <SignVisual />
          </Card>

          <Card className="md:col-span-2" href={toolHref("fill-form", lang)}>
            <Ico icon={ClipboardPen} tone="bg-brand-tint text-brand" />
            <h3 className="text-xl font-bold text-ink">
              {t("feat.formHeading")}
            </h3>
            <p className="mt-2 text-[15px] text-muted">{t("feat.formDesc")}</p>
            <FormVisual />
          </Card>

          <Card className="md:col-span-2" href={toolHref("edit", lang)}>
            <Ico icon={ScanText} tone="bg-pop-yellow-tint text-[#B58400]" />
            <h3 className="text-xl font-bold text-ink">
              {t("feat.ocrHeading")}
            </h3>
            <p className="mt-2 text-[15px] text-muted">{t("feat.ocrDesc")}</p>
            <OcrVisual />
          </Card>

          <Card className="md:col-span-4" href={toolHref("pdf-to-word", lang)}>
            <Ico icon={FileType2} tone="bg-accent-tint text-accent" />
            <h3 className="text-xl font-bold text-ink">
              {t("feat.wordHeading")}
            </h3>
            <p className="mt-2 max-w-lg text-[15px] text-muted">
              {t("feat.wordDesc")}
            </p>
            <WordVisual />
          </Card>

          <Card className="md:col-span-2" href={toolHref("merge", lang)}>
            <Ico icon={Layers} tone="bg-pop-lav text-[#5B4BD6]" />
            <h3 className="text-xl font-bold text-ink">
              {isHindi
                ? "पीडीएफ जोड़ें, अलग करें व क्रम बदलें"
                : "Merge, split & reorder"}
            </h3>
            <p className="mt-2 text-[15px] text-muted">
              {isHindi
                ? "कई पीडीएफ को मनचाहे क्रम में जोड़ें या जरूरी पेज अलग करें।"
                : "Combine, extract page ranges and rebuild documents in the order you want."}
            </p>
            <OrganizeVisual />
          </Card>

          <Card className="md:col-span-3" href={toolHref("compress", lang)}>
            <Ico icon={FileArchive} tone="bg-brand-tint text-brand" />
            <h3 className="text-xl font-bold text-ink">
              {t("feat.compressHeading")}
            </h3>
            <p className="mt-2 text-[15px] text-muted">
              {t("feat.compressDesc")}
            </p>
            <Chips
              items={
                isHindi
                  ? ["छोटी फाइल", "ब्राउज़र में", "नया एक्सपोर्ट"]
                  : ["Smaller files", "Local-only", "New export"]
              }
            />
          </Card>

          <Card className="md:col-span-3" href={toolHref("edit", lang)}>
            <Ico icon={ShieldCheck} tone="bg-accent-tint text-accent" />
            <h3 className="text-xl font-bold text-ink">
              {t("feat.privacyHeading")}
            </h3>
            <p className="mt-2 text-[15px] text-muted">
              {t("feat.privacyDesc")}
            </p>
            <Chips
              items={
                isHindi
                  ? ["कोई अपलोड नहीं", "कोई खाता नहीं", "AI सिर्फ अनुमति से"]
                  : ["No upload", "No account", "AI only on approval"]
              }
            />
          </Card>
        </div>
      </div>
    </section>
  );
}
