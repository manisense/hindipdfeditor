import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Menu, ShieldCheck, X } from "lucide-react";
import { Btn } from "./ui/button";
import { GooglePlayMark } from "./ui/google-play-link";
import { LOGO_BADGE, PLAY_STORE_URL } from "./links";
import { TOOL_COUNT, TOOL_GROUPS } from "./toolCatalog";
import { useLanguage } from "../lib/i18n";
import { toolHref } from "../lib/tools";

/** Every tool, grouped by category: the desktop menu panel and the mobile sheet both render this. */
function ToolGroups({
  columns,
  onPick,
}: {
  columns: string;
  onPick?: () => void;
}) {
  const { lang, t, isHindi } = useLanguage();
  return (
    <div className={`grid gap-x-6 gap-y-6 ${columns}`}>
      {TOOL_GROUPS.map((group) => (
        <div key={group.id} className="min-w-0">
          <div className="mb-2 flex items-center gap-2 px-2.5 font-display text-[13px] font-bold text-ink">
            <span
              className="size-2 rounded-full"
              style={{ background: group.color }}
            />
            {isHindi ? group.hi : group.en}
          </div>
          <ul className="grid gap-0.5">
            {group.tools.map((tool) => (
              <li key={tool.id}>
                <a
                  href={toolHref(tool.id, lang)}
                  onClick={onPick}
                  className="flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-brand-wash focus-visible:bg-brand-wash"
                >
                  <tool.icon
                    className="mt-0.5 size-[18px] flex-none"
                    style={{ color: group.color }}
                    strokeWidth={2}
                  />
                  <span className="min-w-0">
                    <span className="block font-display text-[14px] font-semibold leading-tight text-ink">
                      {t(tool.nameKey)}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">
                      {t(tool.detailKey)}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Nav() {
  const { lang, setLang, t, isHindi } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const panelId = useId();

  const links = [
    { label: t("nav.howItWorks"), href: "#how-it-works" },
    { label: t("nav.compare"), href: "#compare" },
    { label: t("nav.useCases"), href: "#use-cases", wideOnly: true },
    { label: t("nav.guides"), href: "/articles/" },
    { label: "FAQ", href: "#faq", wideOnly: true },
  ];

  const toggleLanguage = () => setLang(lang === "en" ? "hi" : "en");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Esc closes whichever menu is open; the mobile sheet also locks page scroll.
  useEffect(() => {
    if (!mobileOpen && !toolsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setToolsOpen(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    if (mobileOpen) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      document.body.style.overflow = "";
    };
  }, [mobileOpen, toolsOpen]);

  // Hover opens the menu on devices with a mouse; a short close delay lets the
  // pointer cross the gap between the button and the panel.
  const hoverOpen = (open: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(
      () => setToolsOpen(open),
      open ? 60 : 160,
    );
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 bg-white/95 transition-shadow duration-200 ${
        scrolled || toolsOpen || mobileOpen
          ? "shadow-[0_1px_0_rgba(9,9,11,0.07)]"
          : ""
      }`}
    >
      <div className="relative mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:px-6 lg:gap-8">
        <a href="#top" className="flex shrink-0 items-center gap-2.5">
          <img src={LOGO_BADGE} alt="" className="size-8 rounded-lg" />
          <span className="font-display text-[16px] font-bold tracking-tight text-ink whitespace-nowrap sm:text-[17px]">
            Hindi PDF <span className="text-brand">Editor</span>
          </span>
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden flex-1 items-center gap-1 lg:flex"
        >
          <div
            ref={toolsRef}
            className="flex h-full items-center"
            onPointerEnter={hoverOpen(true)}
            onPointerLeave={hoverOpen(false)}
          >
            <button
              type="button"
              aria-expanded={toolsOpen}
              aria-controls={panelId}
              onClick={() => setToolsOpen((o) => !o)}
              className={`inline-flex h-10 items-center gap-1 rounded-full px-3.5 font-display text-[14px] font-semibold transition-colors ${
                toolsOpen
                  ? "bg-brand-wash text-brand"
                  : "text-ink hover:bg-black/[0.04]"
              }`}
            >
              {isHindi ? "सभी टूल्स" : "Tools"}
              <ChevronDown
                className={`size-4 transition-transform ${toolsOpen ? "rotate-180" : ""}`}
                strokeWidth={2.2}
              />
            </button>

            {toolsOpen && (
              <div
                id={panelId}
                className="animate-menu-in absolute inset-x-4 top-full z-10 pt-1 sm:inset-x-6"
              >
                <div className="rounded-3xl bg-white p-5 shadow-[0_0_0_1px_rgba(9,9,11,0.06),0_24px_60px_rgba(21,23,44,0.16)]">
                  <ToolGroups
                    columns="grid-cols-2 lg:grid-cols-4"
                    onPick={() => setToolsOpen(false)}
                  />
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink">
                      <ShieldCheck
                        className="size-4 text-accent"
                        strokeWidth={2}
                      />
                      {isHindi
                        ? `${TOOL_COUNT} टूल्स, ब्राउज़र में ही। कोई खाता नहीं।`
                        : `${TOOL_COUNT} tools that run in your browser. No account.`}
                    </span>
                    <a
                      href="#how-it-works"
                      onClick={() => setToolsOpen(false)}
                      className="inline-flex items-center gap-1 font-display text-[13px] font-semibold text-brand hover:text-brand-hover"
                    >
                      {t("nav.howItWorks")}
                      <ArrowRight className="size-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`inline-flex h-10 items-center rounded-full px-3.5 font-display text-[14px] font-semibold text-ink/75 transition-colors whitespace-nowrap hover:bg-black/[0.04] hover:text-ink ${l.wideOnly ? "max-xl:hidden" : ""}`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={isHindi ? "Switch to English" : "हिंदी भाषा में बदलें"}
            className="inline-flex h-10 items-center rounded-full px-3 font-display text-[14px] font-bold text-ink transition-colors hover:bg-black/[0.04]"
          >
            {isHindi ? "English" : "हिन्दी"}
          </button>

          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get Hindi PDF Editor on Google Play (opens in a new tab)"
            className="hidden h-10 items-center gap-1.5 rounded-full px-3 font-display text-[14px] font-semibold text-ink transition-colors whitespace-nowrap hover:bg-black/[0.04] xl:inline-flex"
          >
            <GooglePlayMark className="size-3.5 text-brand" />
            {isHindi ? "एंड्रॉयड ऐप" : "Android app"}
          </a>

          <Btn
            className="h-10 px-4 py-0 text-[14px] sm:px-5"
            href={toolHref("edit", lang)}
          >
            <span className="hidden min-[420px]:inline">
              {t("nav.openEditor")}
            </span>
            <span className="min-[420px]:hidden">
              {isHindi ? "एडिटर" : "Editor"}
            </span>
          </Btn>

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={
              mobileOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
            className="inline-flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-black/[0.04] lg:hidden"
          >
            {mobileOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          id="mobile-nav-menu"
          role="dialog"
          aria-label={isHindi ? "नेविगेशन मेनू" : "Navigation menu"}
          className="animate-menu-in h-[calc(100dvh-64px)] overflow-y-auto bg-white px-4 pt-2 pb-8 lg:hidden"
        >
          <ToolGroups
            columns="grid-cols-1 min-[520px]:grid-cols-2"
            onPick={() => setMobileOpen(false)}
          />

          <nav
            aria-label={isHindi ? "पेज के हिस्से" : "Page sections"}
            className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-cream p-2"
          >
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-2.5 font-display text-[15px] font-semibold text-ink transition-colors hover:bg-white"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get Hindi PDF Editor on Google Play (opens in a new tab)"
            className="mt-4 flex items-center gap-2 rounded-2xl bg-brand-wash px-4 py-3.5 font-display text-[15px] font-semibold text-ink"
          >
            <GooglePlayMark className="size-4 text-brand" />
            {isHindi ? "एंड्रॉयड ऐप डाउनलोड करें" : "Get the Android app"}
            <ArrowRight className="ml-auto size-4 text-brand" />
          </a>
        </div>
      )}
    </header>
  );
}
