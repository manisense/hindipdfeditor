import { Btn } from './ui/button';
import { PLAY_STORE_URL } from './links';
import { toolHref } from '../lib/tools';

export function CTA() {
  return (
    <section className="relative overflow-hidden bg-cream py-24 text-center">
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        viewBox="0 0 1200 340"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
        aria-hidden
      >
        <path d="M0 340a600 340 0 0 1 1200 0Z" fill="#D7E7FF" />
        <path d="M120 340a480 300 0 0 1 960 0Z" fill="#E9E6FF" />
        <path d="M250 340a350 240 0 0 1 700 0Z" fill="#D6F3E3" />
        <path d="M380 340a220 180 0 0 1 440 0Z" fill="#FFF0C2" />
      </svg>
      <div className="section-x relative z-10">
        <h2 className="text-[clamp(34px,5.2vw,60px)] font-extrabold leading-[1.05] text-ink">
          Get your Hindi PDFs sorted.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Open the editor in your browser, or grab the Android app. Free, private, and
          Devanagari-safe.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3.5">
          <Btn size="lg" href={toolHref('edit')}>
            Open the editor →
          </Btn>
          <Btn size="lg" variant="ghost" href={PLAY_STORE_URL}>
            Get the Android app
          </Btn>
        </div>
      </div>
    </section>
  );
}
