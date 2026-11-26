import {
  ArrowLeftRight,
  Check,
  Combine,
  FileArchive,
  Globe,
  Grid2X2,
  LayoutGrid,
  Type,
  Languages,
  Pencil,
  Scissors,
  Signature,
  ClipboardPen,
  FileText,
  FileImage,
  FileType2,
  Images,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { useLanguage } from "../lib/i18n";
import { ToolGuide } from "./ToolGuide";
import { TOOL_HINDI_NAMES, TOOLS, toolHref, type ToolId, type ToolMeta } from "../lib/tools";
import "./ToolShell.css";

/** Same six links, in the same order, as the guide and info page footers. */
const FOOTER_LINKS_EN = [
  ["/articles/", "Guides"],
  ["/about/", "About"],
  ["/privacy/", "Privacy"],
  ["/data-safety/", "Data safety"],
  ["/terms/", "Terms"],
  ["/support/", "Support"],
] as const;
const FOOTER_LINKS_HI = [
  ["/articles/", "गाइड"],
  ["/hi/about/", "हमारे बारे में"],
  ["/hi/privacy/", "प्राइवेसी"],
  ["/hi/data-safety/", "डेटा सुरक्षा"],
  ["/hi/terms/", "शर्तें"],
  ["/hi/support/", "सहायता"],
] as const;

type Step = { label: string; active?: boolean; done?: boolean };

type Props = {
  tool?: ToolMeta | null;
  steps?: Step[];
  actions?: ReactNode;
  compact?: boolean;
  children: ReactNode;
};

const toolIcons: Record<ToolId, LucideIcon> = {
  edit: Pencil,
  sign: Signature,
  "fill-form": ClipboardPen,
  "pdf-to-word": FileType2,
  "word-to-pdf": FileText,
  translate: Languages,
  merge: Combine,
  split: Scissors,
  compress: FileArchive,
  organize: LayoutGrid,
  krutidev: Type,
  "unicode-to-krutidev": ArrowLeftRight,
  "pdf-to-jpg": FileImage,
  "jpg-to-pdf": Images,
};


export function ToolShell({
  tool,
  steps,
  actions,
  compact = false,
  children,
}: Props) {
  const { lang, setLang, isHindi } = useLanguage();
  const ActiveIcon = tool ? toolIcons[tool.id] : Grid2X2;

  const switcherRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Phones show part of the tool row; bring the current tool into view.
    const active = switcherRef.current?.querySelector<HTMLElement>(".is-active");
    const row = switcherRef.current;
    if (active && row && row.scrollWidth > row.clientWidth) {
      row.scrollLeft = active.offsetLeft - row.clientWidth / 2 + active.offsetWidth / 2;
    }
  }, [tool?.id]);

  const toggleLanguage = () => {
    setLang(lang === "en" ? "hi" : "en");
  };

  const toolDisplayTitle = tool
    ? isHindi
      ? TOOL_HINDI_NAMES[tool.id]
      : tool.shortTitle
    : "";

  return (
    <div
      className={`tool-shell ${tool ? `tool-shell--${tool.id}` : ""} ${compact ? "tool-shell--compact" : ""}`.trim()}
      style={tool ? { ["--tool-accent" as string]: tool.accent } : undefined}
    >
      <div className="tool-shell__nav-wrap">
        <header className="tool-shell__header">
          <a href="/" className="tool-shell__logo-link">
            <img
              className="tool-shell__logo"
              src="/assets/app-icon.png"
              alt="Hindi PDF Editor logo"
              width={32}
              height={32}
            />
            <span className="tool-shell__wordmark">
              Hindi PDF <strong>Editor</strong>
            </span>
          </a>
          {tool && (
            <div
              className="tool-shell__current-tool"
              aria-label={isHindi ? `चुना गया टूल: ${toolDisplayTitle}` : `Current tool: ${toolDisplayTitle}`}
            >
              <ActiveIcon size={15} strokeWidth={2.2} aria-hidden="true" />
              {compact ? <h1>{toolDisplayTitle}</h1> : <span>{toolDisplayTitle}</span>}
            </div>
          )}
          <div className="tool-shell__actions">
            {/* Language Toggle in Tool Header */}
            <button
              type="button"
              onClick={toggleLanguage}
              title={isHindi ? "Switch to English" : "हिंदी भाषा में बदलें"}
              aria-label={isHindi ? "Switch to English" : "हिंदी में बदलें"}
              className="tool-shell__lang-btn"
            >
              <Globe size={13} style={{ color: "var(--brand)" }} />
              <span className="tool-shell__lang-text">
                {isHindi ? "English" : "हिन्दी"}
              </span>
            </button>

            <a className="tool-shell__all-tools" href="/#features">
              <Grid2X2 size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>{isHindi ? "सभी टूल्स" : "All tools"}</span>
            </a>
            {actions}
          </div>
        </header>
      </div>

      <main className="tool-shell__main">
        {tool && (
          <nav ref={switcherRef} className="tool-shell__tool-switcher" aria-label={isHindi ? "पीडीएफ टूल" : "PDF tools"}>
            {TOOLS.map((item) => {
              const Icon = toolIcons[item.id];
              const name = isHindi
                ? TOOL_HINDI_NAMES[item.id]
                : item.shortTitle;
              return (
                <a
                  key={item.id}
                  href={toolHref(item.id)}
                  className={item.id === tool.id ? "is-active" : ""}
                  aria-current={item.id === tool.id ? "page" : undefined}
                >
                  <Icon size={16} strokeWidth={2.1} aria-hidden="true" />
                  <span>{name}</span>
                </a>
              );
            })}
          </nav>
        )}

        {steps && steps.length > 0 && (
          <ol className="tool-shell__steps" aria-label={isHindi ? "प्रगति" : "Progress"}>
            {steps.map((step, index) => (
              <li
                key={step.label}
                className={`tool-shell__step ${step.active ? "is-active" : ""} ${step.done ? "is-done" : ""}`}
                aria-current={step.active ? "step" : undefined}
              >
                <span className="tool-shell__step-num">
                  {step.done ? (
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span>{step.label}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="tool-shell__body">{children}</div>
        {tool && !compact && <ToolGuide toolId={tool.id} language={lang} />}
      </main>

      <footer className="tool-shell__footer">
        <div>
          <span>© 2026 {isHindi ? "हिंदी पीडीएफ एडिटर" : "Hindi PDF Editor"}</span>
          <span className="tool-shell__footer-dot" aria-hidden="true">
            ·
          </span>
          <span>
            {isHindi
              ? "देवनागरी के लिए बनाया गया"
              : "Made for Devanagari · हिंदी"}
          </span>
        </div>
        <nav aria-label={isHindi ? "साइट" : "Site"}>
          {(isHindi ? FOOTER_LINKS_HI : FOOTER_LINKS_EN).map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}
