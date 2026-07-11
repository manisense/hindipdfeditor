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
    'Free local-first Hindi PDF tools: edit Devanagari with correct shaping, translate Hindi to English, merge, split, compress, and OCR. No account. No uploads.',
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

/** Organization + WebSite + SoftwareApplication graph for the marketing hub. */
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
        operatingSystem: 'Android, Web',
        url: `${SITE_ORIGIN}/edit/`,
        image: DEFAULT_OG_IMAGE,
        description: HOME.description,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        privacyPolicy: `${SITE_ORIGIN}/privacy/`,
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
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
    '@type': 'SoftwareApplication',
    name: tool.title,
    applicationCategory: 'ProductivityApplication',
    operatingSystem: 'Web, Android',
    url: `${SITE_ORIGIN}/edit/?tool=${tool.id}`,
    description: tool.description,
    isPartOf: { '@id': `${SITE_ORIGIN}/#app` },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  });
}

export function clearToolJsonLd(): void {
  document.getElementById('seo-tool-graph')?.remove();
}
