import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webAppRoot = path.resolve(__dirname, '..');
const queuePath = path.join(__dirname, 'seo-keyword-queue.json');
const sitemapPath = path.join(webAppRoot, 'sitemap.xml');
const llmsPath = path.join(webAppRoot, 'llms.txt');
const llmsFullPath = path.join(webAppRoot, 'llms-full.txt');
const articlesDir = path.join(webAppRoot, 'articles');
const articlesHubPath = path.join(articlesDir, 'index.html');

function getTodayDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateArticleHtml(item) {
  const today = getTodayDate();
  const title = escapeHtml(item.title);
  const metaDesc = escapeHtml(item.metaDescription || item.directAnswer);
  const slug = item.slug;
  const canonicalUrl = `https://hindipdfeditor.com/articles/${slug}/`;
  const category = escapeHtml(item.category || 'Guides & Tutorials');
  const directAnswer = escapeHtml(item.directAnswer);

  const sectionsHtml = (item.sections || [])
    .map(
      (sec) => `
        <h2>${escapeHtml(sec.heading)}</h2>
        ${(sec.paragraphs || []).map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
      `
    )
    .join('\n');

  const stepsHtml = (item.steps || [])
    .map(
      (step, idx) => `
        <div class="guide-step">
          <h4>Step ${idx + 1}: ${escapeHtml(step.title)}</h4>
          <p>${escapeHtml(step.desc)}</p>
        </div>
      `
    )
    .join('\n');

  const faqs = item.faqs || [];
  const faqSchemaElements = faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: f.a,
    },
  }));

  const schemaGraph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${canonicalUrl}#article`,
        headline: item.title,
        description: item.metaDescription || item.directAnswer,
        url: canonicalUrl,
        datePublished: today,
        dateModified: today,
        author: {
          '@type': 'Organization',
          name: 'Hindi PDF Editor Team',
          url: 'https://hindipdfeditor.com',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Hindi PDF Editor',
          logo: {
            '@type': 'ImageObject',
            url: 'https://hindipdfeditor.com/assets/app-icon.png',
          },
        },
        mainEntityOfPage: canonicalUrl,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://hindipdfeditor.com/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Articles',
            item: 'https://hindipdfeditor.com/articles/',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: item.title,
            item: canonicalUrl,
          },
        ],
      },
      ...(faqSchemaElements.length > 0
        ? [
            {
              '@type': 'FAQPage',
              '@id': `${canonicalUrl}#faq`,
              mainEntity: faqSchemaElements,
            },
          ]
        : []),
    ],
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <script src="/assets/analytics.js" defer></script>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} — Hindi PDF Editor</title>
    <meta name="description" content="${metaDesc}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <link rel="alternate" hreflang="en" href="${canonicalUrl}" />
    <link rel="alternate" hreflang="hi" href="${canonicalUrl}" />
    <link rel="alternate" hreflang="x-default" href="${canonicalUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${metaDesc}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="https://hindipdfeditor.com/assets/play-store/hindi-pdf-editor-tablet.png" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Hindi PDF Editor" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${metaDesc}" />
    <meta name="twitter:image" content="https://hindipdfeditor.com/assets/play-store/hindi-pdf-editor-tablet.png" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/assets/site.css" />
    <style>
      :root {
        --brand: #1843dd;
        --brand-hover: #1130a8;
        --brand-wash: #eef3ff;
        --brand-tint: #d7e7ff;
        --accent: #1843dd;
        --navy: #050839;
        --ink: #15172c;
        --muted: #5b6172;
        --cream: #fbf8f1;
        --line: #eceae2;
        --font-display: 'Plus Jakarta Sans', 'Noto Sans Devanagari', ui-sans-serif, system-ui, sans-serif;
        --font-body: 'Inter', 'Noto Sans Devanagari', ui-sans-serif, system-ui, sans-serif;
      }

      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: var(--font-body);
        background: #ffffff;
        color: var(--ink);
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
      }
      a { color: var(--brand); text-decoration: none; }

      /* Floating Header */
      .header-wrapper {
        position: fixed;
        top: 12px;
        left: 0;
        right: 0;
        z-index: 1000;
        padding: 0 16px;
        pointer-events: none;
      }

      .nav-container {
        pointer-events: auto;
        max-width: 1040px;
        margin: 0 auto;
        height: 62px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 0 10px 0 20px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.88);
        backdrop-filter: blur(20px) saturate(160%);
        -webkit-backdrop-filter: blur(20px) saturate(160%);
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: 0 8px 30px rgba(21, 23, 44, 0.08);
      }

      .brand-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: var(--font-display);
        font-weight: 800;
        font-size: 17px;
        color: var(--ink) !important;
        text-decoration: none;
        flex-shrink: 0;
      }

      .brand-logo img { width: 32px; height: 32px; border-radius: 8px; }

      .nav-menu { display: flex; align-items: center; gap: 28px; }
      .nav-menu a {
        font-size: 14.5px;
        font-weight: 600;
        color: var(--muted);
        text-decoration: none;
        transition: color 0.15s ease;
      }
      .nav-menu a:hover, .nav-menu a.active { color: var(--brand); }

      .nav-ctas { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
      .btn-play {
        display: inline-flex;
        align-items: center;
        padding: 8px 16px;
        border-radius: 999px;
        font-family: var(--font-display);
        font-size: 14px;
        font-weight: 700;
        color: var(--ink);
        text-decoration: none;
        transition: background 0.15s ease;
      }
      .btn-play:hover { background: rgba(0, 0, 0, 0.04); }
      .btn-editor {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--brand);
        color: #ffffff !important;
        padding: 10px 22px;
        border-radius: 999px;
        font-family: var(--font-display);
        font-size: 14px;
        font-weight: 700;
        text-decoration: none;
        box-shadow: 0 10px 24px rgba(24, 67, 221, 0.25);
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .btn-editor:hover {
        background: var(--brand-hover);
        transform: translateY(-1px);
        box-shadow: 0 12px 28px rgba(24, 67, 221, 0.35);
      }

      /* Article Hero */
      .article-hero {
        position: relative;
        padding: 130px 24px 44px;
        background: var(--cream);
        text-align: center;
        border-bottom: 1px solid var(--line);
      }
      .article-hero-inner { max-width: 820px; margin: 0 auto; }
      .eyebrow-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 16px;
        border-radius: 999px;
        background: var(--brand-wash);
        border: 1px solid rgba(24, 67, 221, 0.15);
        color: var(--brand);
        font-family: var(--font-display);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-bottom: 16px;
      }
      .article-hero h1 {
        font-family: var(--font-display);
        font-size: clamp(2rem, 3.8vw, 2.9rem);
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.2;
        color: var(--ink);
        margin-bottom: 14px;
      }
      .article-hero p {
        color: var(--muted);
        font-size: 17px;
        line-height: 1.6;
        max-width: 700px;
        margin: 0 auto;
      }

      /* Content Area */
      .article-body {
        max-width: 820px;
        margin: 0 auto;
        padding: 44px 24px 80px;
      }
      .direct-answer {
        background: var(--cream);
        border-left: 4px solid var(--brand);
        padding: 22px 24px;
        border-radius: 16px;
        margin: 0 0 36px;
      }
      .direct-answer h4 {
        font-family: var(--font-display);
        font-size: 16.5px;
        font-weight: 800;
        color: var(--ink);
        margin-bottom: 8px;
      }
      .direct-answer p {
        font-size: 15px;
        font-weight: 500;
        color: var(--ink);
        line-height: 1.65;
      }
      .article-body h2 {
        font-family: var(--font-display);
        font-size: 24px;
        font-weight: 800;
        color: var(--ink);
        margin: 38px 0 16px;
        letter-spacing: -0.01em;
      }
      .article-body p {
        font-size: 16px;
        color: #2b2e4a;
        line-height: 1.7;
        margin-bottom: 16px;
      }
      .article-body ul, .article-body ol {
        margin: 14px 0 20px 24px;
        color: #2b2e4a;
        font-size: 15.5px;
        line-height: 1.7;
      }
      .article-body li { margin-bottom: 8px; }
      .step-card {
        background: #ffffff;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 22px 24px;
        margin-bottom: 16px;
        box-shadow: 0 4px 14px rgba(21, 23, 44, 0.03);
      }
      .step-card h4 {
        font-family: var(--font-display);
        font-size: 16.5px;
        font-weight: 800;
        color: var(--ink);
        margin-bottom: 8px;
      }
      .step-card p {
        font-size: 15px;
        color: var(--muted);
        margin-bottom: 0;
        line-height: 1.6;
      }
      .article-cta-box {
        margin-top: 48px;
        background: #ffffff;
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 40px 24px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(21, 23, 44, 0.04);
      }
      .article-cta-box h3 {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 800;
        margin: 0 0 8px;
        color: var(--ink);
      }
      .article-cta-box p {
        color: var(--muted);
        font-size: 15px;
        margin-bottom: 22px;
      }

      /* Footer */
      .site-foot {
        border-top: 1px solid var(--line);
        background: #ffffff;
        padding: 60px 24px 36px;
      }
      .foot-grid {
        max-width: 1120px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1.4fr 1fr 1.2fr 1fr;
        gap: 32px;
      }
      .foot-col h4 {
        font-family: var(--font-display);
        font-size: 15px;
        font-weight: 700;
        color: var(--ink);
        margin-bottom: 14px;
      }
      .foot-col a {
        display: block;
        font-size: 14px;
        color: var(--muted);
        text-decoration: none;
        margin-bottom: 9px;
        transition: color 0.15s ease;
      }
      .foot-col a:hover { color: var(--brand); }
      .foot-bottom {
        max-width: 1120px;
        margin: 40px auto 0;
        padding-top: 24px;
        border-top: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        font-size: 13.5px;
        color: var(--muted);
      }

      @media (max-width: 860px) {
        .nav-menu { display: none; }
        .foot-grid { grid-template-columns: 1fr; gap: 28px; }
      }
    </style>
    <script type="application/ld+json">
      ${JSON.stringify(schemaGraph, null, 2)}
    </script>
  </head>
  <body>
    <!-- Floating Header -->
    <div class="header-wrapper">
      <header class="nav-container">
        <a class="brand-logo" href="/">
          <img src="/assets/app-icon.png" alt="Hindi PDF Editor logo" />
          <span>Hindi PDF <span style="color: var(--brand);">Editor</span></span>
        </a>
        <nav class="nav-menu" aria-label="Primary navigation">
          <a href="/#features">Features</a>
          <a href="/#how-it-works">How it works</a>
          <a href="/#compare">Compare</a>
          <a href="/#use-cases">Use cases</a>
          <a class="active" href="/articles/">Guides</a>
        </nav>
        <div class="nav-ctas">
          <a
            class="btn-play"
            href="https://play.google.com/store/apps/details?id=com.hindipdfeditor.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Play
          </a>
          <a class="btn-editor" href="/edit/?tool=edit">
            Open editor
          </a>
        </div>
      </header>
    </div>

    <main>
      <!-- Hero Section -->
      <section class="article-hero">
        <div class="article-hero-inner">
          <div class="eyebrow-tag">
            <span>✨</span>
            <span>${category}</span>
          </div>
          <h1>${title}</h1>
          <p>${metaDesc}</p>
        </div>
      </section>

      <article class="article-body">
        <!-- Direct Answer Block for AEO -->
        <div class="direct-answer">
          <h4>Direct Answer: ${title}</h4>
          <p>
            ${directAnswer}
          </p>
        </div>

        ${sectionsHtml}

        <h2>Step-by-Step Instructions</h2>
        ${stepsHtml}

        ${
          faqs.length > 0
            ? `<h2>Frequently Asked Questions</h2>
               ${faqs
                 .map(
                   (f) => `
                 <div class="step-card">
                   <h4>${escapeHtml(f.q)}</h4>
                   <p>${escapeHtml(f.a)}</p>
                 </div>
               `
                 )
                 .join('\n')}`
            : ''
        }

        <div class="article-cta-box">
          <h3>Try Hindi PDF Editor Free</h3>
          <p>Zero server uploads · 100% Client-Side Private · Flawless Devanagari Shaping</p>
          <a href="/edit/?tool=edit" class="btn-editor" style="font-size: 15px; padding: 12px 28px;">
            Open Editor Now →
          </a>
        </div>
      </article>
    </main>

    <!-- Footer -->
    <footer class="site-foot">
      <div class="foot-grid">
        <div>
          <a class="brand-logo" href="/" style="margin-bottom: 12px;">
            <img src="/assets/app-icon.png" alt="Hindi PDF Editor logo" />
            <span>Hindi PDF <span style="color: var(--brand);">Editor</span></span>
          </a>
          <p style="color: var(--muted); font-size: 14px; line-height: 1.55;">
            Local-first Hindi PDF tools with flawless Devanagari shaping.
          </p>
        </div>
        <div class="foot-col">
          <h4>Tools</h4>
          <a href="/edit/?tool=edit">Edit Hindi PDF</a>
          <a href="/edit/?tool=translate">Translate Hindi ↔ English</a>
          <a href="/edit/?tool=merge">Merge PDF</a>
          <a href="/edit/?tool=split">Split PDF</a>
          <a href="/edit/?tool=compress">Compress PDF</a>
        </div>
        <div class="foot-col">
          <h4>Resources</h4>
          <a href="/articles/">Articles &amp; Guides</a>
          <a href="/support/">Support</a>
          <a href="/privacy/">Privacy Policy</a>
          <a href="/terms/">Terms of Service</a>
        </div>
      </div>
      <div class="foot-bottom">
        <p>© 2026 Hindi PDF Editor. All rights reserved.</p>
        <p>100% Client-Side Processing · Zero Server Storage</p>
      </div>
    </footer>
  </body>
</html>
`;

}

function updateSitemap(slug) {
  let content = readFileSync(sitemapPath, 'utf8');
  const urlEntry = `  <url>\n    <loc>https://hindipdfeditor.com/articles/${slug}/</loc>\n    <lastmod>${getTodayDate()}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

  if (!content.includes(`/articles/${slug}/`)) {
    content = content.replace('</urlset>', `${urlEntry}</urlset>`);
    writeFileSync(sitemapPath, content, 'utf8');
    console.log(`[SEO Worker] Added https://hindipdfeditor.com/articles/${slug}/ to sitemap.xml`);
  }
}

function updateLlms(slug, title) {
  let llms = readFileSync(llmsPath, 'utf8');
  const entry = `- Guide: ${title}: https://hindipdfeditor.com/articles/${slug}/\n`;
  if (!llms.includes(`/articles/${slug}/`)) {
    llms = llms.replace('- Extended Documentation', `${entry}- Extended Documentation`);
    writeFileSync(llmsPath, llms, 'utf8');
    console.log(`[SEO Worker] Added ${slug} to llms.txt`);
  }

  let llmsFull = readFileSync(llmsFullPath, 'utf8');
  const fullEntry = `| **Guide: ${title.slice(0, 30)}...** | \`https://hindipdfeditor.com/articles/${slug}/\` | In-depth tutorial & answers |\n`;
  if (!llmsFull.includes(`/articles/${slug}/`)) {
    llmsFull = llmsFull.replace('\n---\n\n## 5.', `${fullEntry}\n---\n\n## 5.`);
    writeFileSync(llmsFullPath, llmsFull, 'utf8');
    console.log(`[SEO Worker] Added ${slug} to llms-full.txt`);
  }
}

function updateArticlesHub(item) {
  if (!existsSync(articlesHubPath)) return;
  let hub = readFileSync(articlesHubPath, 'utf8');
  if (hub.includes(`/articles/${item.slug}/`)) return;

  const cardHtml = `
          <!-- Article: ${item.slug} -->
          <a href="/articles/${item.slug}/" class="article-card">
            <div>
              <span class="badge">${escapeHtml(item.category)}</span>
              <h3>${escapeHtml(item.title)}</h3>
              <p>
                ${escapeHtml(item.metaDescription || item.directAnswer)}
              </p>
            </div>
            <div>
              <div class="article-meta">
                <span>⏱️ ${item.readTime || '4 min read'}</span>
                <span>•</span>
                <span>Updated ${getTodayDate()}</span>
              </div>
              <span class="article-cta">Read Guide →</span>
            </div>
          </a>
  `;

  hub = hub.replace('</div>\n\n        <div class="content-card"', `${cardHtml}\n        </div>\n\n        <div class="content-card"`);
  writeFileSync(articlesHubPath, hub, 'utf8');
  console.log(`[SEO Worker] Injected ${item.slug} card into /articles/ hub`);
}

export function runWorker({ publishNext = false } = {}) {
  console.log(`=== 24-Hour Autonomous SEO/AEO/GEO Worker Started (${getTodayDate()}) ===`);
  const queue = JSON.parse(readFileSync(queuePath, 'utf8'));

  const published = queue.filter((q) => q.status === 'published');
  const queued = queue.filter((q) => q.status === 'queued');

  console.log(`[SEO Status] Total Articles in Pool: ${queue.length} | Published: ${published.length} | Queued: ${queued.length}`);

  if (publishNext && queued.length > 0) {
    const nextItem = queued[0];
    console.log(`[SEO Worker] Publishing Next Scheduled Guide: "${nextItem.title}" (${nextItem.slug})`);

    const targetDir = path.join(articlesDir, nextItem.slug);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const htmlContent = generateArticleHtml(nextItem);
    writeFileSync(path.join(targetDir, 'index.html'), htmlContent, 'utf8');

    updateSitemap(nextItem.slug);
    updateLlms(nextItem.slug, nextItem.title);
    updateArticlesHub(nextItem);

    nextItem.status = 'published';
    nextItem.publishedDate = getTodayDate();
    writeFileSync(queuePath, JSON.stringify(queue, null, 2), 'utf8');

    console.log(`[SEO Worker] Successfully published article: ${nextItem.slug}`);

    // Rebuild dist static files
    console.log(`[SEO Worker] Syncing publish artifacts...`);
    execSync('node scripts/prepare-publish.mjs', { cwd: webAppRoot, stdio: 'inherit' });
  } else {
    console.log('[SEO Worker] Health audit complete. No new articles pending publication today.');
  }

  console.log('=== SEO Worker Run Finished ===');
}

// Direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const publishNext = process.argv.includes('--publish-next');
  runWorker({ publishNext });
}
