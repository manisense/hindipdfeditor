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
    <script type="application/ld+json">
      ${JSON.stringify(schemaGraph, null, 2)}
    </script>
  </head>
  <body>
    <!-- Floating Glass Pill Header (Matching Homepage Nav) -->
    <div class="floating-header-wrapper">
      <header class="floating-header">
        <a class="brand" href="/">
          <img src="/assets/app-icon.png" alt="Hindi PDF Editor logo" />
          <span>Hindi PDF <span style="color: var(--accent);">Editor</span></span>
        </a>
        <nav class="floating-nav-links" aria-label="Primary navigation">
          <a href="/">Features</a>
          <a href="/#how-it-works">How it works</a>
          <a href="/#compare">Compare</a>
          <a href="/#use-cases">Use cases</a>
          <a class="active" href="/articles/">Guides</a>
        </nav>
        <div class="floating-header-actions">
          <a
            class="btn-pill btn-pill-ghost"
            href="https://play.google.com/store/apps/details?id=com.hindipdfeditor.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Play
          </a>
          <a class="btn-pill btn-pill-primary" href="/edit/?tool=edit">
            Open editor
          </a>
        </div>
      </header>
    </div>

    <main>
      <!-- Hero Section with Background Grid -->
      <section class="hero-knowledge" style="padding-top: 130px;">
        <div class="bg-grid-pattern" aria-hidden="true"></div>
        <div class="hero-knowledge-inner">
          <div class="eyebrow-pill">
            <span>✨</span>
            <span>${category}</span>
          </div>
          <h1>${title}</h1>
          <p>${metaDesc}</p>
        </div>
      </section>

      <article class="content" style="max-width: 860px; margin: 0 auto; padding-inline: 24px;">
        <!-- Direct Answer Block for AEO -->
        <div class="guide-step" style="border-left: 4px solid var(--accent); background: var(--cream); padding: 22px; border-radius: 16px; margin: 28px 0;">
          <h4 style="margin: 0 0 8px; font-size: 16.5px; font-weight: 800; color: var(--ink);">Direct Answer: ${title}</h4>
          <p style="margin: 0; color: var(--ink); font-weight: 500; font-size: 15px; line-height: 1.6;">
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
                 <div class="guide-step" style="background: var(--cream); padding: 20px; border-radius: 14px; margin: 16px 0;">
                   <h4 style="margin: 0 0 6px; font-size: 16px; font-weight: 800; color: var(--ink);">${escapeHtml(f.q)}</h4>
                   <p style="margin: 0; color: var(--muted); font-size: 14.5px; line-height: 1.55;">${escapeHtml(f.a)}</p>
                 </div>
               `
                 )
                 .join('\n')}`
            : ''
        }

        <div class="content-card" style="margin-top: 42px; text-align: center; border-radius: 20px; padding: 36px 24px;">
          <h3 style="margin-top: 0; font-size: 22px; font-weight: 800;">Try Hindi PDF Editor Free</h3>
          <p style="margin: 8px 0 20px; font-size: 15px; color: var(--muted);">Zero server uploads · 100% Client-Side Private · Flawless Devanagari Shaping</p>
          <a href="/edit/?tool=edit" class="btn-pill btn-pill-primary" style="font-size: 15px; padding: 12px 28px;">
            Open Editor Now →
          </a>
        </div>
      </article>
    </main>

    <!-- Site Footer (Matching Homepage Design) -->
    <footer class="site-footer">
      <div class="footer-inner">
        <div>
          <a class="brand" href="/">
            <img src="/assets/app-icon.png" alt="Hindi PDF Editor logo" />
            <span>Hindi<span class="brand-accent">PDF</span></span>
          </a>
          <p class="footer-copy">Local-first Hindi PDF tools with flawless Devanagari shaping.</p>
        </div>
        <div class="footer-col">
          <h4>Tools</h4>
          <a href="/edit/?tool=edit">Edit Hindi PDF</a>
          <a href="/edit/?tool=translate">Translate Hindi ↔ English</a>
          <a href="/edit/?tool=merge">Merge PDF</a>
          <a href="/edit/?tool=split">Split PDF</a>
          <a href="/edit/?tool=compress">Compress PDF</a>
        </div>
        <div class="footer-col">
          <h4>Resources</h4>
          <a href="/articles/">Articles &amp; Guides</a>
          <a href="/support/">Support</a>
          <a href="/privacy/">Privacy Policy</a>
          <a href="/terms/">Terms of Service</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 Hindi PDF Editor. All rights reserved.</p>
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
