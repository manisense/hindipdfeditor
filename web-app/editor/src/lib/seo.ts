import type { ToolId } from './tools';
import { getTool } from './tools';
import { SITE_FAQS } from '../home/faqData';

export const SITE_ORIGIN = 'https://hindipdfeditor.com';
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/assets/app-icon.png`;

export type SeoPayload = {
  title: string;
  description: string;
  canonicalPath: string;
  /** Optional robots directive, e.g. "index,follow". */
  robots?: string;
};

const HOME: SeoPayload = {
  title: 'Hindi PDF Editor — Edit, Translate & Manage Hindi PDFs Online',
  description:
    'Local-first Hindi PDF tools: edit Devanagari with correct shaping, translate Hindi and English in either direction, merge, split, compress, and OCR. No account.',
  canonicalPath: '/edit/',
  robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
};

/**
 * Returns title/description/canonical for the current tool (or home hub).
 * Units: paths are URL path+query strings for the public site.
 */
export function seoForTool(toolId: ToolId | null): SeoPayload {
  if (!toolId) return HOME;
  const tool = getTool(toolId);
  if (!tool) return HOME;
  return {
    title: `${tool.title} — Free Online | Hindi PDF Editor`,
    description: tool.description,
    canonicalPath: `/edit/?tool=${tool.id}`,
    robots: HOME.robots,
  };
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(id: string, data: unknown): void {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/** Applies document title, social tags, and canonical for the active SPA route. */
export function applySeo(payload: SeoPayload): void {
  const url = `${SITE_ORIGIN}${payload.canonicalPath}`;
  document.title = payload.title;
  upsertMeta('name', 'description', payload.description);
  if (payload.robots) upsertMeta('name', 'robots', payload.robots);
  upsertMeta('name', 'googlebot', payload.robots ?? 'index,follow');
  upsertLink('canonical', url);

  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:site_name', 'Hindi PDF Editor');
  upsertMeta('property', 'og:locale', 'en_US');
  upsertMeta('property', 'og:title', payload.title);
  upsertMeta('property', 'og:description', payload.description);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:image', DEFAULT_OG_IMAGE);

  upsertMeta('name', 'twitter:card', 'summary');
  upsertMeta('name', 'twitter:title', payload.title);
  upsertMeta('name', 'twitter:description', payload.description);
  upsertMeta('name', 'twitter:image', DEFAULT_OG_IMAGE);
}

/** Organization + WebSite + SoftwareApplication + HowTo + FAQPage graph for the marketing hub. */
export function siteGraphJsonLd(): unknown {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: 'Hindi PDF Editor',
        url: SITE_ORIGIN,
        logo: {
          '@type': 'ImageObject',
          url: DEFAULT_OG_IMAGE,
        },
        sameAs: [
          'https://play.google.com/store/apps/details?id=com.hindipdfeditor.app',
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'support@hindipdfeditor.com',
          contactType: 'customer support',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        url: SITE_ORIGIN,
        name: 'Hindi PDF Editor',
        description: HOME.description,
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        inLanguage: ['en', 'hi'],
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_ORIGIN}/#app`,
        name: 'Hindi PDF Editor',
        applicationCategory: 'ProductivityApplication',
        applicationSubCategory: 'PDF Editor',
        operatingSystem: 'Android, Web, Windows, macOS, Linux, iOS',
        url: `${SITE_ORIGIN}/edit/`,
        downloadUrl: 'https://play.google.com/store/apps/details?id=com.hindipdfeditor.app',
        image: DEFAULT_OG_IMAGE,
        description: HOME.description,
        featureList: [
          'Flawless Devanagari OpenType text shaping with correct conjuncts and matras',
          '100% Client-side local processing with zero server uploads',
          'Bidirectional Hindi to English and English to Hindi PDF translation',
          'Built-in OCR text detection for scanned Hindi and English documents',
          'Merge, split, and compress PDF documents locally',
          'Non-destructive editing: source PDFs are never overwritten',
        ],
        browserRequirements: 'Requires modern browser with WebAssembly and Canvas support (Chrome, Firefox, Safari, Edge)',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        privacyPolicy: `${SITE_ORIGIN}/privacy/`,
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      },
      {
        '@type': 'HowTo',
        '@id': `${SITE_ORIGIN}/edit/#howto`,
        name: 'How to Edit Hindi PDF Online with Correct Fonts & Shaping',
        description:
          'Step-by-step guide to add or replace Hindi Devanagari text in a PDF document with flawless character shaping and complete local privacy.',
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Open your PDF file',
            text: 'Open or drag your PDF document into the local browser editor. The file is processed locally on your device without server uploads.',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Select or mask text',
            text: 'Click on existing Hindi text to mask and replace, or tap anywhere to create a new text box.',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Type in Hindi',
            text: 'Type your text using Unicode Hindi keyboards or Google Input Tools. Conjuncts and matras render with 100% font accuracy.',
          },
          {
            '@type': 'HowToStep',
            position: 4,
            name: 'Export fresh PDF',
            text: 'Click Export PDF to download your newly shaped vector PDF document. Your original file remains untouched.',
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${SITE_ORIGIN}/edit/#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${SITE_ORIGIN}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Hindi PDF Tools',
            item: `${SITE_ORIGIN}/edit/`,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_ORIGIN}/edit/#faq`,
        mainEntity: SITE_FAQS.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.a,
          },
        })),
      },
    ],
  };
}

/** Injects (or refreshes) the hub JSON-LD graph when the home route is active. */
export function applyHomeJsonLd(): void {
  upsertJsonLd('seo-site-graph', siteGraphJsonLd());
}

/** Removes hub FAQ graph when viewing a tool page (tool pages use SoftwareApplication only). */
export function clearHomeJsonLd(): void {
  document.getElementById('seo-site-graph')?.remove();
}

/** Lightweight SoftwareApplication node for an individual tool URL. */
export function applyToolJsonLd(toolId: ToolId): void {
  const tool = getTool(toolId);
  if (!tool) return;
  upsertJsonLd('seo-tool-graph', {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_ORIGIN}/edit/?tool=${tool.id}#app`,
        name: `${tool.title} — Hindi PDF Editor`,
        applicationCategory: 'ProductivityApplication',
        applicationSubCategory: 'PDF Tool',
        operatingSystem: 'Web, Android, Windows, macOS, Linux, iOS',
        url: `${SITE_ORIGIN}/edit/?tool=${tool.id}`,
        description: tool.description,
        isPartOf: { '@id': `${SITE_ORIGIN}/#app` },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${SITE_ORIGIN}/edit/?tool=${tool.id}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${SITE_ORIGIN}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Tools',
            item: `${SITE_ORIGIN}/edit/`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: tool.title,
            item: `${SITE_ORIGIN}/edit/?tool=${tool.id}`,
          },
        ],
      },
    ],
  });
}

export function clearToolJsonLd(): void {
  document.getElementById('seo-tool-graph')?.remove();
}

