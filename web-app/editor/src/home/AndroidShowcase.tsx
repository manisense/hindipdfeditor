import { motion } from 'motion/react';
import { GooglePlayLink } from './ui/google-play-link';

const previews = [
  {
    src: '/assets/play-store/hindi-pdf-editor-android-home.png',
    alt: 'Hindi PDF Editor Android app home screen with edit, translate, OCR, merge, split and compress tools',
    caption: 'Every Hindi PDF tool in one app',
  },
  {
    src: '/assets/play-store/edit-hindi-pdf-android.png',
    alt: 'Editing Hindi text directly on a PDF page in the Hindi PDF Editor Android app',
    caption: 'Edit Devanagari directly on the page',
  },
  {
    src: '/assets/play-store/translate-hindi-pdf-android.png',
    alt: 'Translating a Hindi PDF passage into English in the Android app',
    caption: 'Translate Hindi and English documents',
  },
  {
    src: '/assets/play-store/hindi-english-ocr-android.png',
    alt: 'Hindi and English OCR detection inside a scanned PDF on Android',
    caption: 'Read Hindi and English scans with OCR',
  },
  {
    src: '/assets/play-store/merge-split-pdf-android.png',
    alt: 'Merging, splitting and reordering PDF pages in the Android app',
    caption: 'Merge, split and reorder PDF pages',
  },
] as const;

export function AndroidShowcase() {
  return (
    <section id="android-app" className="scroll-mt-24 overflow-hidden bg-navy py-24 text-white">
      <div className="section-x">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-pop-yellow">
              Hindi PDF Editor for Android
            </div>
            <h2
              className="text-[clamp(30px,4vw,46px)] font-bold leading-tight"
              style={{ color: '#ffffff' }}
            >
              Your Hindi PDF toolkit, ready for touch.
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/70">
              Edit Devanagari, translate Hindi and English, scan with OCR, and organize pages from
              your phone. Your original PDF always stays untouched.
            </p>
          </div>
          <GooglePlayLink size="lg" className="w-fit bg-white text-navy hover:bg-white/90" />
        </div>

        <div
          className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-5 [scrollbar-color:rgba(255,255,255,0.35)_transparent]"
          aria-label="Hindi PDF Editor Android app previews"
        >
          {previews.map((preview, index) => (
            <motion.figure
              key={preview.src}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: index * 0.04 }}
              className="w-[min(78vw,330px)] flex-none snap-center"
            >
              <div className="overflow-hidden rounded-[26px] border border-white/15 bg-white/5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                <img
                  src={preview.src}
                  alt={preview.alt}
                  width="1080"
                  height="1920"
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full"
                />
              </div>
              <figcaption className="mt-4 font-display text-[15px] font-semibold text-white/85">
                {preview.caption}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
