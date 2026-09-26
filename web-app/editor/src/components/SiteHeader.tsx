import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Globe, Menu, X } from 'lucide-react';

import { Btn } from '../home/ui/button';
import { GooglePlayMark } from '../home/ui/google-play-link';
import { LOGO_BADGE, PLAY_STORE_URL } from '../home/links';
import { useLanguage, useTx } from '../lib/i18n';
import { routePath } from '../lib/routes';
import { TOOLS, toolHref, type ToolId } from '../lib/tools';
import { cn } from '../lib/cn';
import { TOOL_VISUALS } from './toolVisuals';

type Props = {
  /** Tool page being shown, if any; highlights it in the tools menu and hides the editor CTA. */
  activeToolId?: ToolId | null;
};

function ToolRows({ activeToolId, onPick }: { activeToolId?: ToolId | null; onPick?: () => void }) {
  const { lang, isHindi } = useLanguage();
  return (
    <ul className="grid gap-1">
      {TOOLS.map((tool) => {
        const v = TOOL_VISUALS[tool.id];
        const Icon = v.icon;
        const active = tool.id === activeToolId;
        return (
          <li key={tool.id}>
            <a
              href={toolHref(tool.id, lang)}
              onClick={onPick}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-brand-wash',
                active && 'bg-brand-wash',
              )}
            >
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', v.chip)}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-semibold text-ink">
                  {isHindi ? v.nameHi : v.nameEn}
                </span>
                <span className="block truncate text-[13px] text-muted">
                  {isHindi ? v.taglineHi : v.taglineEn}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** The one site header used by the home page and every tool page. */
export function SiteHeader({ activeToolId = null }: Props) {
  const { lang, setLang, isHindi } = useLanguage();
  const tx = useTx();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const homeHref = routePath({ lang, toolId: null });

  const links = [
    { label: tx('How it works', 'कैसे काम करता है'), href: `${homeHref}#how-it-works` },
    { label: tx('Guides', 'गाइड्स'), href: '/articles/' },
    { label: tx('FAQ', 'सवाल-जवाब'), href: `${homeHref}#faq` },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen && !toolsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setToolsOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    if (menuOpen) document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
      document.body.style.overflow = '';
    };
  }, [menuOpen, toolsOpen]);

  const switchLabel = isHindi ? 'Switch to English' : 'हिंदी में देखें';

  return (
    <div className="pointer-events-none sticky top-0 z-50 px-4 pt-3">
      <header
        className={cn(
          'pointer-events-auto mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full border bg-white/95 pl-4 pr-2 backdrop-blur-xl backdrop-saturate-150 transition-shadow sm:h-16 sm:pl-5',
          scrolled
            ? 'border-line shadow-[0_8px_24px_rgba(20,22,31,0.08)]'
            : 'border-transparent shadow-none',
        )}
      >
        <a href={homeHref} className="flex min-w-0 items-center gap-2">
          <img src={LOGO_BADGE} alt="" width={32} height={32} className="size-8 shrink-0 rounded-lg" />
          <span className="truncate font-display text-[16px] font-bold tracking-tight text-ink sm:text-[17px]">
            Hindi PDF <span className="text-brand">Editor</span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label={tx('Primary', 'मुख्य')}>
          <div ref={toolsRef} className="relative">
            <button
              type="button"
              onClick={() => setToolsOpen((o) => !o)}
              aria-expanded={toolsOpen}
              aria-controls="site-tools-menu"
              className="inline-flex h-10 items-center gap-1 rounded-full px-4 text-[15px] font-medium text-ink transition-colors hover:bg-black/[0.04]"
            >
              {tx('Tools', 'टूल्स')}
              <ChevronDown className={cn('size-4 transition-transform', toolsOpen && 'rotate-180')} aria-hidden />
            </button>
            {toolsOpen && (
              <div
                id="site-tools-menu"
                className="absolute left-1/2 top-12 w-80 -translate-x-1/2 rounded-2xl border border-line bg-white p-2 shadow-[0_16px_48px_rgba(20,22,31,0.14)]"
              >
                <ToolRows activeToolId={activeToolId} onPick={() => setToolsOpen(false)} />
              </div>
            )}
          </div>
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="inline-flex h-10 items-center rounded-full px-4 text-[15px] font-medium text-muted transition-colors hover:bg-black/[0.04] hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(isHindi ? 'en' : 'hi')}
            title={switchLabel}
            aria-label={switchLabel}
            className="inline-flex h-10 items-center gap-1 rounded-full border border-line bg-white px-3 font-display text-[13px] font-bold text-ink transition-colors hover:border-brand/30"
          >
            <Globe className="size-4 text-brand" aria-hidden />
            <span>{isHindi ? 'EN' : 'हिं'}</span>
          </button>
          {!activeToolId && (
            <Btn href={toolHref('edit', lang)} className="hidden h-10 px-5 text-[14px] sm:inline-flex">
              {tx('Open editor', 'एडिटर खोलें')}
            </Btn>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? tx('Close menu', 'मेनू बंद करें') : tx('Open menu', 'मेनू खोलें')}
            aria-expanded={menuOpen}
            aria-controls="site-mobile-menu"
            className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-brand/30 lg:hidden"
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <div
            className="pointer-events-auto fixed inset-0 -z-10 bg-ink/30 backdrop-blur-xs lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            id="site-mobile-menu"
            role="dialog"
            aria-label={tx('Menu', 'मेनू')}
            className="animate-mobile-menu pointer-events-auto mx-auto mt-2 max-h-[calc(100dvh-88px)] max-w-6xl overflow-y-auto rounded-3xl border border-line bg-white p-4 shadow-[0_20px_50px_rgba(20,22,31,0.18)] lg:hidden"
          >
            <p className="px-2 pb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">
              {tx('Tools', 'टूल्स')}
            </p>
            <ToolRows activeToolId={activeToolId} onPick={() => setMenuOpen(false)} />
            <nav className="mt-3 grid gap-1 border-t border-line pt-3" aria-label={tx('Site', 'साइट')}>
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between rounded-xl px-2 py-3 text-[15px] font-semibold text-ink hover:bg-brand-wash"
                >
                  {l.label}
                  <ChevronRight className="size-4 text-faint" aria-hidden />
                </a>
              ))}
            </nav>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex h-12 items-center justify-center gap-2 rounded-full border border-line font-display text-[15px] font-semibold text-ink"
            >
              <GooglePlayMark className="text-brand" />
              {tx('Get the Android app', 'एंड्रॉयड ऐप डाउनलोड करें')}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
