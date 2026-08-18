import { LOGO_BADGE, PLAY_STORE_URL } from './links';
import { toolHref } from '../lib/tools';

const cols = [
  {
    title: 'Edit & OCR',
    links: [
      { label: 'Edit Hindi PDF', href: toolHref('edit') },
      { label: 'Hindi ↔ English', href: toolHref('translate') },
      { label: 'Replace text', href: `${toolHref('edit')}&mode=erase` },
      { label: 'Add text', href: `${toolHref('edit')}&mode=addText` },
    ],
  },
  {
    title: 'Organize & optimize',
    links: [
      { label: 'Merge PDF', href: toolHref('merge') },
      { label: 'Split PDF', href: toolHref('split') },
      { label: 'Compress PDF', href: toolHref('compress') },
      { label: 'OCR detection', href: toolHref('edit') },
    ],
  },
  {
    title: 'Resources & Compare',
    links: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Compare vs Acrobat/Canva', href: '#compare' },
      { label: 'Document use cases', href: '#use-cases' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Privacy Policy', href: '/privacy/' },
      { label: 'Data Safety', href: '/data-safety/' },
      { label: 'Terms of Service', href: '/terms/' },
      { label: 'Support', href: '/support/' },
      { label: 'Android App', href: PLAY_STORE_URL },
    ],
  },
];


export function Footer() {
  return (
    <footer className="border-t border-line bg-white pb-10 pt-14">
      <div className="section-x">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <a href="#top" className="flex items-center gap-2.5">
              <img src={LOGO_BADGE} alt="" className="size-8 rounded-lg" />
              <span className="font-display text-[17px] font-bold">
                Hindi PDF <span className="text-brand">Editor</span>
              </span>
            </a>
            <p className="mt-3.5 max-w-[260px] text-[14.5px] text-muted">
              Every tool you need to work with Hindi PDFs, in one private, Devanagari-safe place.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h5 className="mb-3.5 font-display text-sm font-bold">{c.title}</h5>
              <ul className="grid gap-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      {...(l.href === PLAY_STORE_URL
                        ? {
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            'aria-label': 'Android app on Google Play (opens in a new tab)',
                          }
                        : {})}
                      className="text-[14.5px] text-muted transition-colors hover:text-brand"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-11 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[13.5px] text-muted">
          <span>© 2026 Hindi PDF Editor</span>
          <span>Made for Devanagari · हिंदी</span>
        </div>
      </div>
    </footer>
  );
}
