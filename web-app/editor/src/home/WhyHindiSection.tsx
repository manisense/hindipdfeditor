import { CircleAlert, CircleCheck } from 'lucide-react';

import { useLanguage, useTx } from '../lib/i18n';
import { SectionHeading } from './ui/section-heading';

type Row = { feature: string; ours: string; typical: string };

/** Before/after of Devanagari shaping, set in real text so the browser shows the difference. */
function ShapingDemo() {
  const tx = useTx();
  const pairs = [
    { broken: 'क्\u200Cष', joined: 'क्ष' },
    { broken: 'ि\u00A0क', joined: 'कि' },
    { broken: 'त्\u200Cर', joined: 'त्र' },
  ];
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_8px_24px_rgba(20,22,31,0.06)] sm:p-8">
      <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-6 gap-y-4">
        <span />
        <p className="text-[13px] font-semibold text-warn">{tx('Often breaks', 'अक्सर टूटता है')}</p>
        <p className="text-[13px] font-semibold text-success">{tx('Here', 'यहाँ')}</p>
        {pairs.map((pair, i) => (
          <div key={pair.joined} className="contents">
            <span className="font-display text-[13px] font-semibold text-faint">0{i + 1}</span>
            <span lang="hi" className="font-display text-[clamp(32px,5vw,48px)] font-bold leading-none text-faint">
              {pair.broken}
            </span>
            <span lang="hi" className="font-display text-[clamp(32px,5vw,48px)] font-bold leading-none text-ink">
              {pair.joined}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 border-t border-line pt-4 text-[14px] leading-relaxed text-muted">
        {tx(
          'New text is typed in Unicode and shaped by the browser’s text engine, so conjuncts and the short-i matra render joined — the same way they do on web pages.',
          'नया टेक्स्ट यूनिकोड में टाइप होता है और ब्राउज़र का टेक्स्ट इंजन उसे आकार देता है, इसलिए संयुक्ताक्षर और छोटी-इ की मात्रा वेब पेज की तरह जुड़ी दिखती हैं।',
        )}
      </p>
    </div>
  );
}

/**
 * Why a Hindi-first editor: shaping demo plus a comparison with general-purpose PDF editors as
 * a category. Named competitors are left out on purpose: every claim here must be one we can
 * back up without testing other products.
 */
export function WhyHindiSection() {
  const { isHindi } = useLanguage();
  const tx = useTx();

  const rows: Row[] = isHindi
    ? [
        {
          feature: 'नया हिंदी टेक्स्ट (मात्राएं व संयुक्ताक्षर)',
          ours: 'ब्राउज़र का टेक्स्ट इंजन आकार देता है, मात्राएं जुड़ी रहती हैं',
          typical: 'मौजूदा हिंदी टेक्स्ट एडिट करने पर मात्राएं बिखरने की शिकायतें आम हैं',
        },
        {
          feature: 'फाइल कहां प्रोसेस होती है',
          ours: 'एडिट, मर्ज, स्प्लिट, कंप्रेस ब्राउज़र में; AI फीचर पूछकर ही',
          typical: 'कई ऑनलाइन टूल फाइल अपने सर्वर पर अपलोड करते हैं',
        },
        {
          feature: 'कीमत और अकाउंट',
          ours: 'फ्री · कोई अकाउंट नहीं · कोई वॉटरमार्क नहीं',
          typical: 'अक्सर फ्री इस्तेमाल सीमित या साइन-अप जरूरी',
        },
        {
          feature: 'हिंदी ↔ अंग्रेजी अनुवाद',
          ours: 'बिल्ट-इन, पेज पर ही अनुवाद',
          typical: 'आमतौर पर अलग टूल की जरूरत',
        },
        {
          feature: 'मूल फाइल',
          ours: 'हर बार नई फाइल बनती है, मूल नहीं बदलती',
          typical: 'कुछ एडिटर मूल फाइल पर ही सेव करते हैं',
        },
      ]
    : [
        {
          feature: 'New Hindi text (matras & conjuncts)',
          ours: 'Shaped by the browser text engine, so matras stay joined',
          typical: 'Scattered matras when editing existing Hindi text are a common complaint',
        },
        {
          feature: 'Where your file is processed',
          ours: 'Edit, merge, split and compress in your browser; AI features ask first',
          typical: 'Many online tools upload the file to their servers',
        },
        {
          feature: 'Price & account',
          ours: 'Free · no account · no watermark',
          typical: 'Free use is often limited or needs a sign-up',
        },
        {
          feature: 'Hindi ↔ English translation',
          ours: 'Built in, placed back on the page',
          typical: 'Usually needs a separate tool',
        },
        {
          feature: 'Your original file',
          ours: 'Always exports a new file; the original is untouched',
          typical: 'Some editors save over the original',
        },
      ];

  return (
    <section id="compare" className="bg-white py-16 sm:py-24" aria-labelledby="why-heading">
      <div className="section-x">
        <SectionHeading
          id="why-heading"
          eyebrow={tx('Why a Hindi-first editor', 'हिंदी के लिए ही क्यों')}
          title={tx('Hindi text that stays joined', 'हिंदी टेक्स्ट जो जुड़ा रहे')}
          subtitle={tx(
            'General-purpose PDF editors often scatter matras and split conjuncts. This one is built around Devanagari.',
            'साधारण पीडीएफ एडिटर अक्सर मात्राएं बिखेर देते हैं और संयुक्ताक्षर तोड़ देते हैं। यह एडिटर देवनागरी के लिए ही बना है।',
          )}
        />

        <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1fr_1.2fr] lg:gap-8">
          <div className="lg:sticky lg:top-24">
            <ShapingDemo />
          </div>

          <ul className="grid gap-3">
            {rows.map((row) => (
              <li key={row.feature} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">{row.feature}</p>
                <p className="mt-2 flex gap-2 text-[15px] font-semibold text-ink">
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                  {row.ours}
                </p>
                <p className="mt-1.5 flex gap-2 text-[14px] text-muted">
                  <CircleAlert className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
                  {row.typical}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
