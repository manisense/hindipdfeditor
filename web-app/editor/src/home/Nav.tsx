import { Btn } from './ui/button';
import { GooglePlayMark } from './ui/google-play-link';
import { LOGO_BADGE, PLAY_STORE_URL } from './links';
import { toolHref } from '../lib/tools';

const links = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Compare', href: '#compare' },
  { label: 'Use cases', href: '#use-cases' },
];

export function Nav() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 px-4">
      <header className="pointer-events-auto mx-auto flex h-[62px] max-w-5xl items-center justify-between gap-3 sm:gap-4 rounded-full border border-black/[0.07] bg-white/85 pl-4 sm:pl-5 pr-2 sm:pr-2.5 shadow-[0_8px_30px_rgba(21,23,44,0.08)] backdrop-blur-xl backdrop-saturate-150 transition-all">
        {/* Brand */}
        <a href="#top" className="flex shrink-0 items-center gap-2 sm:gap-2.5 group">
          <img
            src={LOGO_BADGE}
            alt="Hindi PDF Editor logo"
            className="size-7 sm:size-8 rounded-lg transition-transform group-hover:scale-105"
          />
          <span className="font-display text-[15.5px] sm:text-[17px] font-bold tracking-tight text-ink whitespace-nowrap">
            Hindi PDF <span className="text-brand">Editor</span>
          </span>
        </a>

        {/* Center Links (Clean & spacious: Features, How it works, Compare, Use cases) */}
        <nav className="hidden items-center gap-4 lg:gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[14px] lg:text-[14.5px] font-medium text-muted transition-colors hover:text-brand whitespace-nowrap"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get Hindi PDF Editor on Google Play (opens in a new tab)"
            className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 lg:px-3.5 lg:py-2 font-display text-[13.5px] lg:text-[14px] font-semibold text-ink transition-colors hover:bg-black/[0.04] lg:inline-flex whitespace-nowrap"
          >
            <GooglePlayMark className="text-brand size-3.5" />
            <span>Google Play</span>
          </a>
          <Btn className="text-[13.5px] sm:text-[14px] px-4 sm:px-5 py-2 sm:py-2.5 shadow-sm" href={toolHref('edit')}>
            Open editor
          </Btn>
        </div>
      </header>
    </div>
  );
}


