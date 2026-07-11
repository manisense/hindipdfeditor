import { Btn } from './ui/button';
import { LOGO_BADGE, PLAY_STORE_URL } from './links';
import { toolHref } from '../lib/tools';

const links = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#work' },
  { label: 'Privacy', href: '#privacy' },
  { label: 'FAQ', href: '#faq' },
];

export function Nav() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 px-4">
      <header className="pointer-events-auto mx-auto flex h-[62px] max-w-4xl items-center justify-between rounded-full border border-black/[0.06] bg-white/70 pl-5 pr-2.5 shadow-[0_8px_30px_rgba(21,23,44,0.08)] backdrop-blur-xl backdrop-saturate-150">
        <a href="#top" className="flex items-center gap-2.5">
          <img src={LOGO_BADGE} alt="Hindi PDF Editor logo" className="size-8" />
          <span className="font-display text-[17px] font-bold tracking-tight whitespace-nowrap">
            Hindi PDF <span className="text-brand">Editor</span>
          </span>
        </a>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[14.5px] font-medium text-muted transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={PLAY_STORE_URL}
            className="hidden rounded-full px-3.5 py-2 font-display text-[14.5px] font-semibold text-ink transition-colors hover:bg-black/[0.04] sm:block"
          >
            Android app
          </a>
          <Btn className="text-[14.5px]" href={toolHref('edit')}>
            Open editor
          </Btn>
        </div>
      </header>
    </div>
  );
}
