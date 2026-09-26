import { getFaqs } from '../home/faqData';
import type { Language } from './i18n';
import { LANGUAGES, routePath, type Route } from './routes';
import { TOOL_COPY } from './toolContent';

export const SITE_ORIGIN = 'https://hindipdfeditor.com';
const SITE_NAME = 'Hindi PDF Editor';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.hindipdfeditor.app';
const OG_IMAGE = {
  url: `${SITE_ORIGIN}/assets/play-store/hindi-pdf-editor-tablet.png`,
  width: 2560,
  height: 1440,
  alt: 'Hindi PDF Editor showing Devanagari editing on a tablet',
};
const ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';

const HOME_META: Record<Language, { title: string; description: string }> = {
  en: {
    title: 'Hindi PDF Editor Online Free — Edit Hindi Text & Font in PDF',
    description:
      'Free Hindi PDF editor online: edit Hindi text in any PDF without broken matras or font problems, translate Hindi ↔ English, merge, split and compress. No sign-up, no watermark.',
  },
  hi: {
    title: 'हिंदी पीडीएफ एडिटर ऑनलाइन फ्री — पीडीएफ में हिंदी टेक्स्ट एडिट करें',
    description:
      'फ्री हिंदी पीडीएफ एडिटर: किसी भी पीडीएफ में हिंदी टेक्स्ट बिना मात्रा या फॉन्ट टूटे एडिट करें, हिंदी ↔ अंग्रेजी अनुवाद, मर्ज, स्प्लिट और कंप्रेस करें। बिना साइन-अप, बिना वॉटरमार्क।',
  },
};

export type SeoPayload = {
  title: string;
  description: string;
  /** Absolute canonical URL of the page. */
  canonical: string;
};

/** Absolute URL of a route. */
export function routeUrl(route: Route): string {
  return `${SITE_ORIGIN}${routePath(route)}`;
}

/** Title, description and canonical URL for a prerendered route. */
export function seoFor(route: Route): SeoPayload {
  const canonical = routeUrl(route);
  if (!route.toolId) return { ...HOME_META[route.lang], canonical };
  const copy = TOOL_COPY[route.toolId][route.lang];
  return {
    title: `${copy.metaTitle} | ${SITE_NAME}`,
    description: copy.metaDescription,
    canonical,
  };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** JSON for a `<script type="application/ld+json">` body; `<` is escaped so text can't close the tag. */
function jsonLdScript(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/** Organization + WebSite + app graph for a home page, plus the FAQ shown on that page. */
function homeGraph(route: Route): unknown {
  const url = routeUrl(route);
  const graph: unknown[] = [
    {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: SITE_NAME,
      legalName: 'Manisense',
      url: `${SITE_ORIGIN}/`,
      logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/assets/app-icon.png` },
      sameAs: [PLAY_STORE_URL, 'https://github.com/manisense/hindipdfeditor'],
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'support@hindipdfeditor.com',
        contactType: 'customer support',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      url: `${SITE_ORIGIN}/`,
      name: SITE_NAME,
      inLanguage: ['en', 'hi'],
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_ORIGIN}/#app`,
      name: SITE_NAME,
      url,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any (web browser), Android',
      browserRequirements: 'Requires JavaScript and a modern browser',
      description: HOME_META[route.lang].description,
      inLanguage: route.lang,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    },
  ];
  graph.push({
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: getFaqs(route.lang).map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  });
  return { '@context': 'https://schema.org', '@graph': graph };
}

/** WebApplication + breadcrumb + visible FAQ graph for a tool page. */
function toolGraph(route: Route & { toolId: NonNullable<Route['toolId']> }): unknown {
  const url = routeUrl(route);
  const copy = TOOL_COPY[route.toolId][route.lang];
  const home = routeUrl({ lang: route.lang, toolId: null });
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${url}#app`,
        name: copy.heading,
        url,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any (web browser)',
        description: copy.metaDescription,
        inLanguage: route.lang,
        isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: home },
          { '@type': 'ListItem', position: 2, name: copy.heading, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: copy.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}

/**
 * Full set of per-page `<head>` tags for a prerendered route: title, description, canonical,
 * reciprocal hreflang, Open Graph/Twitter and JSON-LD.
 */
export function headTags(route: Route): string {
  const seo = seoFor(route);
  const alternates = LANGUAGES.map(
    (lang) =>
      `<link rel="alternate" hreflang="${lang}" href="${routeUrl({ ...route, lang })}" />`,
  );
  alternates.push(
    `<link rel="alternate" hreflang="x-default" href="${routeUrl({ ...route, lang: 'en' })}" />`,
  );
  const title = escapeAttr(seo.title);
  const description = escapeAttr(seo.description);
  const graph = route.toolId ? toolGraph({ ...route, toolId: route.toolId }) : homeGraph(route);
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${ROBOTS}" />`,
    `<link rel="canonical" href="${seo.canonical}" />`,
    ...alternates,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="${route.lang === 'hi' ? 'hi_IN' : 'en_IN'}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${seo.canonical}" />`,
    `<meta property="og:image" content="${OG_IMAGE.url}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${escapeAttr(OG_IMAGE.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE.url}" />`,
    jsonLdScript(graph),
  ].join('\n    ');
}
