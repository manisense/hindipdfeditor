import { TOOLS, toolHref, type ToolId } from '../lib/tools';
import './ToolsHub.css';

const ICONS: Record<ToolId, { color: string; path: string }> = {
  edit: {
    color: '#e5322d',
    path: 'M4 20h4l11-11-4-4L4 16v4Zm9-13 4 4',
  },
  translate: {
    color: '#5b4fc9',
    path: 'M5 5h6v2H5V5Zm0 6h14v2H5v-2Zm0 6h10v2H5v-2ZM15 4l4 4-4 4',
  },
  merge: {
    color: '#f59e0b',
    path: 'M8 4h5l3 3v13H8V4Zm6-1h4l2 2v10h-4',
  },
  split: {
    color: '#f59e0b',
    path: 'M9 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M12 8v8',
  },
  compress: {
    color: '#22a06b',
    path: 'M8 4h8v4H8V4Zm0 12h8v4H8v-4ZM5 10h14v4H5v-4Z',
  },
};

const EXTRA = [
  {
    href: '/edit/?tool=edit&mode=erase',
    title: 'Replace text',
    description: 'Cover burned-in text, then type a fresh Hindi replacement.',
    color: '#f59e0b',
    path: 'M5 6h14v12H5V6Zm3 4h8M8 14h5',
  },
  {
    href: '/edit/?tool=edit&mode=addText',
    title: 'Add text',
    description: 'Place new Devanagari text anywhere on the page.',
    color: '#3b82f6',
    path: 'M12 5v14M5 12h14',
  },
];

export function ToolsHub() {
  return (
    <div className="ilove-hub">
      <header className="ilove-hub__nav">
        <a className="ilove-hub__brand" href="/">
          <img src="/assets/app-icon.png" alt="" width={28} height={28} />
          <span>
            Hindi<span>PDF</span>
          </span>
        </a>
        <nav className="ilove-hub__links" aria-label="Tools">
          <a href={toolHref('merge')}>MERGE PDF</a>
          <a href={toolHref('split')}>SPLIT PDF</a>
          <a href={toolHref('compress')}>COMPRESS PDF</a>
          <a href={toolHref('translate')}>TRANSLATE</a>
          <a href={toolHref('edit')}>EDIT PDF</a>
        </nav>
        <a
          className="ilove-hub__cta"
          href="https://play.google.com/store/apps/details?id=com.hindipdfeditor.app"
        >
          Get App
        </a>
      </header>

      <main>
        <section className="ilove-hub__hero">
          <div className="ilove-hub__blobs" aria-hidden="true" />
          <div className="ilove-hub__inner">
            <h1>Every tool you need to work with Hindi PDFs in one place</h1>
            <p>
              Edit Devanagari text correctly, translate Hindi to English, merge and split files, or
              compress large scans — free, local-first, no account.
            </p>

            <div className="ilove-hub__grid">
              {TOOLS.map((tool) => {
                const icon = ICONS[tool.id];
                return (
                  <a key={tool.id} className="ilove-hub__card" href={toolHref(tool.id)}>
                    <span
                      className="ilove-hub__icon"
                      style={{ color: icon.color }}
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                        <path
                          d={icon.path}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <h2>{tool.shortTitle === 'Edit PDF' ? 'Edit Hindi PDF' : tool.title}</h2>
                    <p>{tool.description}</p>
                  </a>
                );
              })}
              {EXTRA.map((item) => (
                <a key={item.href} className="ilove-hub__card" href={item.href}>
                  <span
                    className="ilove-hub__icon"
                    style={{ color: item.color }}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                      <path
                        d={item.path}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="ilove-hub__work">
          <h2>Work your way</h2>
          <div className="ilove-hub__work-grid">
            <article className="ilove-hub__work-card">
              <div className="ilove-hub__work-visual ilove-hub__work-visual--web">
                <img src="/assets/app-preview.png" alt="Hindi PDF Editor in the browser" />
              </div>
              <h3>Hindi PDF on the web</h3>
              <p>
                Open any tool in your browser, drop a PDF, edit or process it, and download the
                result — no install required.
              </p>
              <a href="/edit/?tool=edit">Open Edit PDF →</a>
            </article>
            <article className="ilove-hub__work-card">
              <div className="ilove-hub__work-visual ilove-hub__work-visual--mobile">
                <img src="/assets/app-preview.png" alt="Hindi PDF Editor Android app" />
              </div>
              <h3>Hindi PDF on Android</h3>
              <p>
                The same tap-to-edit Hindi workflow on your phone, with on-device OCR and private
                export.
              </p>
              <a href="https://play.google.com/store/apps/details?id=com.hindipdfeditor.app">
                Get the Android app →
              </a>
            </article>
            <article className="ilove-hub__work-card">
              <div className="ilove-hub__work-visual ilove-hub__work-visual--glyph">
                <span aria-hidden="true">अ</span>
              </div>
              <h3>Built for Devanagari</h3>
              <p>
                Shaping goes through a real browser engine so conjuncts, matras, and reph stay
                correct in preview and export.
              </p>
              <a href={toolHref('edit')}>Try Edit PDF →</a>
            </article>
          </div>
        </section>

        <section className="ilove-hub__promo">
          <div className="ilove-hub__promo-inner">
            <div>
              <h2>Private by default. Hindi-safe by design.</h2>
              <ul>
                <li>Core tools run locally in your browser or on your phone</li>
                <li>Original PDFs are never overwritten</li>
                <li>Optional AI OCR uses only your own Gemini API key</li>
                <li>Translate runs free in your browser (Opus-MT) — no account or API key</li>
                <li>No account required for editing, merge, split, or compress</li>
              </ul>
              <a className="ilove-hub__cta" href={toolHref('edit')}>
                Start editing
              </a>
            </div>
            <div className="ilove-hub__promo-art" aria-hidden="true">
              <div className="ilove-hub__promo-doc">
                <span>नमस्ते</span>
                <span>PDF</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ilove-hub__trust">
          <h2>Made for everyday Hindi documents</h2>
          <p>
            Forms, letters, school files, office PDFs — edit them without broken Devanagari
            characters.
          </p>
          <div className="ilove-hub__pills">
            <span>Local-first</span>
            <span>No signup</span>
            <span>Android + Web</span>
            <span>Devanagari-safe</span>
          </div>
        </section>
      </main>

      <footer className="ilove-hub__footer">
        <div className="ilove-hub__footer-grid">
          <div>
            <h3>HINDI PDF</h3>
            <a href="/">Home</a>
            <a href="/edit/">All tools</a>
            <a href="https://play.google.com/store/apps/details?id=com.hindipdfeditor.app">
              Android app
            </a>
          </div>
          <div>
            <h3>TOOLS</h3>
            <a href={toolHref('edit')}>Edit PDF</a>
            <a href={toolHref('translate')}>Translate PDF</a>
            <a href={toolHref('merge')}>Merge PDF</a>
            <a href={toolHref('split')}>Split PDF</a>
            <a href={toolHref('compress')}>Compress PDF</a>
          </div>
          <div>
            <h3>HELP</h3>
            <a href="/support/">Support</a>
            <a href="mailto:support@hindipdfeditor.com">Email</a>
            <a href="/data-safety/">Data Safety</a>
          </div>
          <div>
            <h3>LEGAL</h3>
            <a href="/privacy/">Privacy Policy</a>
            <a href="/terms/">Terms</a>
            <a href="/sitemap.xml">Sitemap</a>
          </div>
          <div>
            <h3>GET THE APP</h3>
            <a
              className="ilove-hub__store"
              href="https://play.google.com/store/apps/details?id=com.hindipdfeditor.app"
            >
              Google Play
            </a>
            <a className="ilove-hub__store ilove-hub__store--ghost" href={toolHref('edit')}>
              Open Edit PDF
            </a>
          </div>
        </div>
        <div className="ilove-hub__footer-bottom">
          © 2026 Hindi PDF Editor. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
