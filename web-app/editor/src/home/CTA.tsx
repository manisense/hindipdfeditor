import { useLanguage, useTx } from '../lib/i18n';
import { toolHref } from '../lib/tools';
import { Btn } from './ui/button';
import { GooglePlayLink } from './ui/google-play-link';

/** Closing call to action — the one place the pastel gradient mesh is used (design-system.md §2). */
export function CTA() {
  const { lang, isHindi } = useLanguage();
  const tx = useTx();

  return (
    <section className="relative isolate overflow-hidden bg-white py-16 text-center sm:py-24">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <span className="absolute -left-24 top-8 size-80 rounded-full bg-[#1843dd]/20 blur-3xl" />
        <span className="absolute left-1/3 -top-16 size-72 rounded-full bg-[#7c3aed]/15 blur-3xl" />
        <span className="absolute -right-16 top-1/3 size-80 rounded-full bg-[#ec4899]/15 blur-3xl" />
        <span className="absolute bottom-0 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[#facc15]/20 blur-3xl" />
      </div>
      <div className="section-x">
        <h2 className="font-display text-[clamp(32px,5vw,56px)] font-extrabold leading-[1.1] tracking-tight text-ink">
          {isHindi ? (
            <span className="block">अपनी हिंदी पीडीएफ अभी ठीक करें।</span>
          ) : (
            <>
              <span className="block">Get your Hindi PDFs sorted.</span>
              <span className="block" lang="hi">
                आज ही, बिना झंझट।
              </span>
            </>
          )}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-muted">
          {tx(
            'Free in your browser, or on your phone with the Android app.',
            'ब्राउज़र में फ्री, या फोन पर एंड्रॉयड ऐप के साथ।',
          )}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Btn size="lg" arrow href={toolHref('edit', lang)}>
            {tx('Open the editor', 'एडिटर खोलें')}
          </Btn>
          <GooglePlayLink size="lg" variant="ghost">
            {tx('Get it on Google Play', 'Google Play से डाउनलोड करें')}
          </GooglePlayLink>
        </div>
      </div>
    </section>
  );
}
