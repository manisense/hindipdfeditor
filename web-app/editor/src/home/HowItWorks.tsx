import { Download, PenLine, UploadCloud } from 'lucide-react';

import { useLanguage, useTx } from '../lib/i18n';
import { toolHref } from '../lib/tools';
import { Btn } from './ui/button';
import { SectionHeading } from './ui/section-heading';

export function HowItWorks() {
  const { lang } = useLanguage();
  const tx = useTx();

  const steps = [
    {
      icon: UploadCloud,
      title: tx('Open your PDF', 'अपनी पीडीएफ खोलें'),
      desc: tx(
        'Choose or drop a file. It opens in your browser and is not uploaded.',
        'फाइल चुनें या छोड़ें। वह आपके ब्राउज़र में खुलती है, अपलोड नहीं होती।',
      ),
    },
    {
      icon: PenLine,
      title: tx('Tap a line and type Hindi', 'लाइन पर टैप करें, हिंदी लिखें'),
      desc: tx(
        'Replace detected text, add a new box or erase text. Type with any Unicode Hindi keyboard, such as Gboard or InScript.',
        'पहचाना गया टेक्स्ट बदलें, नया बॉक्स जोड़ें या टेक्स्ट मिटाएं। Gboard या InScript जैसे किसी भी यूनिकोड हिंदी कीबोर्ड से लिखें।',
      ),
    },
    {
      icon: Download,
      title: tx('Download a new PDF', 'नई पीडीएफ डाउनलोड करें'),
      desc: tx(
        'Pages are saved as high-resolution images, so the Hindi looks the same everywhere. Your original file is not changed.',
        'पेज हाई-रेजोल्यूशन इमेज के रूप में सेव होते हैं, इसलिए हिंदी हर जगह एक जैसी दिखती है। मूल फाइल नहीं बदलती।',
      ),
    },
  ];

  return (
    <section id="how-it-works" className="bg-cream py-16 sm:py-24" aria-labelledby="how-it-works-heading">
      <div className="section-x">
        <SectionHeading
          id="how-it-works-heading"
          eyebrow={tx('How it works', 'कैसे काम करता है')}
          title={tx('Three steps. No account.', 'तीन कदम। कोई अकाउंट नहीं।')}
        />

        <ol className="mt-12 grid gap-4 md:grid-cols-3 md:gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(20,22,31,0.06)]">
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-xl bg-cat-edit-tint text-cat-edit">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="font-display text-[32px] font-extrabold leading-none text-line">{i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-[18px] font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{step.desc}</p>
              </li>
            );
          })}
        </ol>

        <div className="mt-10 text-center">
          <Btn arrow href={toolHref('edit', lang)}>
            {tx('Edit a Hindi PDF now', 'अभी हिंदी पीडीएफ एडिट करें')}
          </Btn>
        </div>
      </div>
    </section>
  );
}
