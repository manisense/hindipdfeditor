import { LOGO_BADGE, PLAY_STORE_URL } from './links';
import { useLanguage } from '../lib/i18n';
import { toolHref } from '../lib/tools';

export function Footer() {
  const { t, isHindi } = useLanguage();

  const cols = [
    {
      title: t('footer.editOcr'),
      links: [
        { label: isHindi ? 'हिंदी पीडीएफ एडिट करें' : 'Edit Hindi PDF', href: toolHref('edit') },
        { label: isHindi ? 'हिंदी ↔ अंग्रेजी अनुवाद' : 'Hindi ↔ English', href: toolHref('translate') },
        { label: isHindi ? 'टेक्स्ट बदलें व मास्क करें' : 'Replace text', href: `${toolHref('edit')}&mode=erase` },
        { label: isHindi ? 'नया टेक्स्ट जोड़ें' : 'Add text', href: `${toolHref('edit')}&mode=addText` },
      ],
    },
    {
      title: t('footer.organize'),
      links: [
        { label: isHindi ? 'पीडीएफ फाइलें जोड़ें (Merge)' : 'Merge PDF', href: toolHref('merge') },
        { label: isHindi ? 'पेज अलग करें (Split)' : 'Split PDF', href: toolHref('split') },
        { label: isHindi ? 'साइज कम करें (Compress)' : 'Compress PDF', href: toolHref('compress') },
        { label: isHindi ? 'स्मार्ट OCR डिटेक्शन' : 'OCR detection', href: toolHref('edit') },
      ],
    },
    {
      title: t('footer.resources'),
      links: [
        { label: isHindi ? 'गाइड्स और आर्टिकल्स' : 'Articles & Guides', href: '/articles/' },
        { label: isHindi ? 'कैसे काम करता है' : 'How it works', href: '#how-it-works' },
        { label: isHindi ? 'टूल्स की तुलना (Compare)' : 'Compare vs Acrobat/Canva', href: '#compare' },
        { label: isHindi ? 'दस्तावेज उपयोग' : 'Document use cases', href: '#use-cases' },
        { label: isHindi ? 'अक्सर पूछे जाने वाले सवाल (FAQ)' : 'FAQ', href: '#faq' },
        { label: isHindi ? 'प्राइवेसी पॉलिसी' : 'Privacy Policy', href: '/privacy/' },
        { label: isHindi ? 'डेटा सुरक्षा' : 'Data Safety', href: '/data-safety/' },
        { label: isHindi ? 'नियम और शर्तें' : 'Terms of Service', href: '/terms/' },
        { label: isHindi ? 'सहायता और संपर्क' : 'Support', href: '/support/' },
        { label: isHindi ? 'एंड्रॉयड ऐप (गूगल प्ले)' : 'Android App', href: PLAY_STORE_URL },
      ],
    },
  ];

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
              {t('footer.desc')}
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
          <span>{t('footer.rights')}</span>
          <span>{t('footer.tagline')}</span>
        </div>
      </div>
    </footer>
  );
}
