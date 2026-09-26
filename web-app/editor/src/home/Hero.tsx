import { useEffect, useState } from 'react';
import { ArrowRight, BadgeIndianRupee, Globe2, ShieldCheck, Sparkles } from 'lucide-react';

import { TOOL_VISUALS } from '../components/toolVisuals';
import { useLanguage, useTx } from '../lib/i18n';
import { readLastTool } from '../lib/lastTool';
import { toolHref, type ToolId } from '../lib/tools';
import { HeroPicker } from './HeroPicker';

function Rise({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  // CSS animation, not motion: it starts as soon as the prerendered HTML paints instead of
  // keeping the hero invisible until JavaScript hydrates.
  return (
    <div className={`hero-rise ${className}`.trim()} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

function ToolChip({ toolId }: { toolId: ToolId }) {
  const { icon: Icon, chip } = TOOL_VISUALS[toolId];
  return (
    <span className={`grid size-8 place-items-center rounded-full ${chip}`}>
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

export function Hero() {
  const { lang, isHindi } = useLanguage();
  const tx = useTx();
  // Read after hydration so the prerendered HTML and the first client render match.
  const [lastTool, setLastTool] = useState<ToolId | null>(null);
  useEffect(() => setLastTool(readLastTool()), []);

  const trust = [
    { icon: BadgeIndianRupee, label: tx('Free, no sign-up', 'फ्री, बिना साइन-अप') },
    { icon: ShieldCheck, label: tx('Edits stay in your browser', 'एडिट ब्राउज़र में ही') },
    { icon: Sparkles, label: tx('AI only after you confirm', 'AI सिर्फ आपकी मंजूरी से') },
    { icon: Globe2, label: tx('Hindi and English', 'हिंदी और अंग्रेजी') },
  ];

  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-8 sm:pb-24 sm:pt-16">
      <div className="section-x grid items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-x-16 lg:gap-y-8">
        <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
          {lastTool && (
            <Rise>
              <a
                href={toolHref(lastTool, lang)}
                className="mb-6 inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white pl-1 pr-4 text-[14px] font-semibold text-ink shadow-[0_8px_24px_rgba(20,22,31,0.06)] transition-colors hover:border-brand/30"
              >
                <ToolChip toolId={lastTool} />
                {tx('Continue:', 'जारी रखें:')} {isHindi ? TOOL_VISUALS[lastTool].nameHi : TOOL_VISUALS[lastTool].nameEn}
                <ArrowRight className="size-4 text-brand" aria-hidden />
              </a>
            </Rise>
          )}

          <Rise delay={0.05}>
            <h1 className="font-display text-[clamp(36px,4.4vw,56px)] font-extrabold leading-[1.08] tracking-tight text-ink">
              {isHindi ? (
                <>
                  <span className="block">हिंदी पीडीएफ एडिट करें,</span>
                  <span className="block">बिना मात्रा टूटे।</span>
                </>
              ) : (
                <>
                  <span className="block">Edit Hindi PDFs.</span>
                  <span className="block" lang="hi">
                    बिना मात्रा टूटे।
                  </span>
                </>
              )}
            </h1>
          </Rise>

          <Rise delay={0.1}>
            <p className="mt-6 max-w-xl text-[clamp(16px,1.6vw,19px)] leading-relaxed text-muted">
              {tx(
                'Replace text, translate, merge, split and compress — right in your browser. New Hindi text is shaped properly, so क्ष, त्र and कि stay joined.',
                'टेक्स्ट बदलें, अनुवाद करें, पीडीएफ जोड़ें, अलग करें और साइज कम करें — सीधे ब्राउज़र में। नया हिंदी टेक्स्ट सही आकार में बनता है, इसलिए क्ष, त्र और कि जुड़े रहते हैं।',
              )}
            </p>
          </Rise>
        </div>

        <Rise delay={0.1} className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <HeroPicker />
        </Rise>

        <Rise delay={0.15} className="lg:col-start-1 lg:row-start-2 lg:self-start">
          <ul className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-[14px] font-medium text-ink">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-cat-translate-tint text-cat-translate">
                  <Icon className="size-4" aria-hidden />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </Rise>
      </div>
    </section>
  );
}
