import { useState, useEffect } from 'react';
import {
  Globe,
  Menu,
  X,
  ChevronRight,
  FileEdit,
  Languages,
  Layers,
  Split,
  Minimize2,
} from 'lucide-react';
import { Btn } from './ui/button';
import { GooglePlayMark } from './ui/google-play-link';
import { LOGO_BADGE, PLAY_STORE_URL } from './links';
import { useLanguage } from '../lib/i18n';
import { toolHref } from '../lib/tools';

export function Nav() {
  const { lang, setLang, t, isHindi } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const links = [
    { label: t('nav.features'), href: '#features' },
    { label: t('nav.howItWorks'), href: '#how-it-works' },
    { label: t('nav.compare'), href: '#compare' },
    { label: t('nav.useCases'), href: '#use-cases' },
    { label: t('nav.guides'), href: '/articles/' },
  ];

  const toolShortcuts = [
    {
      id: 'edit' as const,
      nameEn: 'Edit Hindi PDF',
      nameHi: 'हिंदी एडिट',
      icon: FileEdit,
      tintFg: '#1843DD',
      tintBg: '#E8EDFF',
    },
    {
      id: 'translate' as const,
      nameEn: 'Translate PDF',
      nameHi: 'अनुवाद',
      icon: Languages,
      tintFg: '#16A34A',
      tintBg: '#E6F7EC',
    },
    {
      id: 'merge' as const,
      nameEn: 'Merge PDF',
      nameHi: 'जोड़ें',
      icon: Layers,
      tintFg: '#7C3AED',
      tintBg: '#F1EAFE',
    },
    {
      id: 'split' as const,
      nameEn: 'Split PDF',
      nameHi: 'अलग करें',
      icon: Split,
      tintFg: '#7C3AED',
      tintBg: '#F1EAFE',
    },
    {
      id: 'compress' as const,
      nameEn: 'Compress PDF',
      nameHi: 'कंप्रेस करें',
      icon: Minimize2,
      tintFg: '#F0700F',
      tintBg: '#FFF1E4',
    },
  ];

  const toggleLanguage = () => {
    setLang(lang === 'en' ? 'hi' : 'en');
  };

  // Close mobile menu on Esc key & lock body scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2.5 sm:top-3 z-50 px-2.5 sm:px-4">
      <header className="pointer-events-auto mx-auto flex h-[56px] sm:h-[62px] max-w-5xl items-center justify-between gap-2 sm:gap-4 rounded-full border border-black/[0.08] bg-white/90 pl-3.5 sm:pl-5 pr-2 sm:pr-2.5 shadow-[0_8px_30px_rgba(21,23,44,0.08)] backdrop-blur-xl backdrop-saturate-150 transition-all">
        {/* Brand */}
        <a href="#top" className="flex shrink-0 items-center gap-2 sm:gap-2.5 group">
          <img
            src={LOGO_BADGE}
            alt="Hindi PDF Editor logo"
            className="size-7 sm:size-8 rounded-lg transition-transform group-hover:scale-105"
          />
          <span className="font-display text-[14px] min-[360px]:text-[15.5px] sm:text-[17px] font-bold tracking-tight text-ink whitespace-nowrap">
            Hindi PDF <span className="text-brand">Editor</span>
          </span>
        </a>

        {/* Center Links (Desktop md+) */}
        <nav className="hidden items-center gap-3.5 md:flex lg:gap-6" aria-label="Primary navigation">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13.5px] lg:text-[14.5px] font-medium text-muted transition-colors hover:text-brand whitespace-nowrap"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Language Switcher Pill */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={isHindi ? 'Switch to English' : 'हिंदी भाषा में बदलें'}
            aria-label={isHindi ? 'Switch to English' : 'हिंदी भाषा में बदलें'}
            className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-line bg-cream/70 px-2.5 sm:px-3 py-1.5 font-display text-[12px] sm:text-[13px] font-bold text-ink transition-all hover:bg-white hover:border-brand/30 hover:shadow-sm"
          >
            <Globe className="size-3.5 text-brand shrink-0" />
            <span className="hidden min-[380px]:inline">{isHindi ? 'English' : 'हिन्दी'}</span>
            <span className="min-[380px]:hidden">{isHindi ? 'EN' : 'HI'}</span>
          </button>

          {/* Google Play link — only on wide desktop xl so it never crowds 1024px */}
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get Hindi PDF Editor on Google Play (opens in a new tab)"
            className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[13.5px] font-semibold text-ink transition-colors hover:bg-black/[0.04] xl:inline-flex whitespace-nowrap"
          >
            <GooglePlayMark className="text-brand size-3.5" />
            <span>{t('nav.googlePlay')}</span>
          </a>

          {/* Open Editor CTA */}
          <Btn
            className="text-[12.5px] min-[380px]:text-[13px] sm:text-[14px] px-3 min-[380px]:px-4 sm:px-5 py-1.5 sm:py-2.5 shadow-sm shrink-0"
            href={toolHref('edit')}
          >
            <span className="hidden min-[440px]:inline">{t('nav.openEditor')}</span>
            <span className="min-[440px]:hidden">{isHindi ? 'एडिटर' : 'Editor'}</span>
          </Btn>

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav-menu"
            className="inline-flex md:hidden size-8 sm:size-9 items-center justify-center rounded-full border border-line bg-cream/70 text-ink transition-colors hover:bg-white hover:border-brand/30 hover:text-brand shrink-0"
          >
            {isMobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Backdrop and Drawer */}
      {isMobileMenuOpen && (
        <>
          <div
            className="pointer-events-auto fixed inset-0 -z-10 bg-black/40 backdrop-blur-xs transition-opacity md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-nav-menu"
            role="dialog"
            aria-label="Navigation menu"
            className="animate-mobile-menu pointer-events-auto mx-auto mt-2 w-full max-w-5xl max-h-[calc(100vh-76px)] overflow-y-auto rounded-2xl sm:rounded-3xl border border-black/[0.08] bg-white/95 p-4 sm:p-5 shadow-[0_20px_50px_rgba(21,23,44,0.18)] backdrop-blur-2xl backdrop-saturate-150 transition-all md:hidden"
          >
            {/* Primary Navigation Links */}
            <nav className="flex flex-col gap-1 pb-3 border-b border-line" aria-label="Mobile site sections">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[15px] font-semibold text-ink transition-colors hover:bg-brand-wash hover:text-brand"
                >
                  <span>{l.label}</span>
                  <ChevronRight className="size-4 text-muted/60" />
                </a>
              ))}
            </nav>

            {/* Quick Tools Category Chips */}
            <div className="pt-3 pb-3 border-b border-line">
              <div className="px-3.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                {isHindi ? 'सभी पीडीएफ टूल्स' : 'Quick PDF Tools'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {toolShortcuts.map((tool) => (
                  <a
                    key={tool.id}
                    href={toolHref(tool.id)}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl p-2.5 text-[13.5px] font-medium text-ink transition-colors hover:bg-brand-wash"
                  >
                    <span
                      className="flex size-7 items-center justify-center rounded-lg shrink-0"
                      style={{ backgroundColor: tool.tintBg, color: tool.tintFg }}
                    >
                      <tool.icon className="size-3.5" />
                    </span>
                    <span className="truncate">{isHindi ? tool.nameHi : tool.nameEn}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Bottom Utilities */}
            <div className="flex items-center justify-between pt-3 gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  toggleLanguage();
                  setIsMobileMenuOpen(false);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-cream/70 px-3.5 py-2 text-[13px] font-bold text-ink hover:bg-white hover:border-brand/30"
              >
                <Globe className="size-4 text-brand" />
                <span>{isHindi ? 'Switch to English' : 'हिंदी भाषा चुनें'}</span>
              </button>

              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Get Hindi PDF Editor on Google Play"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream/70 px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:bg-white hover:border-brand/30"
              >
                <GooglePlayMark className="size-3.5 text-brand" />
                <span>Google Play</span>
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
