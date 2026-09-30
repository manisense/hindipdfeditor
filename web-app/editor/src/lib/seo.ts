import { getTool, type ToolId } from "./tools";
import { getFaqs } from "../home/faqData";
export const SITE_ORIGIN = "https://hindipdfeditor.com";
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/assets/app-icon.png`;
export type SeoPayload = {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
};
const robots =
  "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

/** Public homepage metadata; locale owns a stable canonical URL. */
export function seoForHome(language: "en" | "hi"): SeoPayload {
  return {
    title:
      language === "hi"
        ? "हिंदी PDF एडिटर ऑनलाइन | Hindi PDF Editor"
        : "Hindi PDF Editor Online — Edit Hindi Text",
    description:
      language === "hi"
        ? "हिंदी PDF में टेक्स्ट जोड़ें या बदलें और नई फ़ाइल एक्सपोर्ट करें। सामान्य एडिटिंग आपके डिवाइस पर होती है। AI सुविधाएं केवल सहमति से चलती हैं।"
        : "Add or replace Hindi text in PDFs and export a new file. Core editing stays on your device. Optional AI OCR and translation require your consent.",
    canonicalPath: language === "hi" ? "/hi/" : "/",
    robots,
  };
}
/** Canonical paths are URL paths; no PDF coordinate units are involved. */
export function seoForTool(toolId: ToolId | null): SeoPayload {
  const tool = getTool(toolId);
  if (!tool)
    return seoForHome(
      typeof window !== "undefined" && window.location.pathname === "/hi/"
        ? "hi"
        : "en",
    );
  return {
    title: `${tool.title} | Hindi PDF Editor`,
    description: tool.description,
    canonicalPath: tool.path,
    robots,
  };
}
function upsertMeta(
  attr: "name" | "property",
  key: string,
  content: string,
): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
function upsertJsonLd(id: string, data: unknown): void {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}
/** Keep client metadata consistent with the initial route document. */
export function applySeo(payload: SeoPayload): void {
  const url = `${SITE_ORIGIN}${payload.canonicalPath}`;
  document.title = payload.title;
  upsertMeta("name", "description", payload.description);
  upsertMeta("name", "robots", payload.robots ?? robots);
  upsertMeta("name", "googlebot", payload.robots ?? robots);
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", url);
  for (const key of ["title", "description", "url"])
    upsertMeta(
      "property",
      `og:${key}`,
      key === "url" ? url : payload[key as "title" | "description"],
    );
  upsertMeta(
    "property",
    "og:locale",
    payload.canonicalPath === "/hi/" ? "hi_IN" : "en_IN",
  );
  upsertMeta("property", "og:image", DEFAULT_OG_IMAGE);
  upsertMeta("name", "twitter:title", payload.title);
  upsertMeta("name", "twitter:description", payload.description);
  upsertMeta("name", "twitter:image", DEFAULT_OG_IMAGE);
}
/** Truthful graph shares FAQ content with the visible homepage. */
export function siteGraphJsonLd(language: "en" | "hi" = "en"): unknown {
  const home = seoForHome(language);
  const url = `${SITE_ORIGIN}${home.canonicalPath}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}/#organization`,
        name: "Hindi PDF Editor",
        url: `${SITE_ORIGIN}/`,
        logo: DEFAULT_OG_IMAGE,
        contactPoint: {
          "@type": "ContactPoint",
          email: "support@hindipdfeditor.com",
          contactType: "customer support",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        name: "Hindi PDF Editor",
        url: `${SITE_ORIGIN}/`,
        inLanguage: ["en", "hi"],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_ORIGIN}/#app`,
        name: "Hindi PDF Editor",
        url,
        applicationCategory: "ProductivityApplication",
        operatingSystem: "Web",
        description: home.description,
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: language,
        mainEntity: getFaqs(language).map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}
export function applyHomeJsonLd(): void {
  upsertJsonLd(
    "seo-site-graph",
    siteGraphJsonLd(window.location.pathname === "/hi/" ? "hi" : "en"),
  );
}
export function clearHomeJsonLd(): void {
  document.getElementById("seo-site-graph")?.remove();
}
export function applyToolJsonLd(toolId: ToolId): void {
  const tool = getTool(toolId);
  if (!tool) return;
  const url = `${SITE_ORIGIN}${tool.path}`;
  upsertJsonLd("seo-tool-graph", {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${url}#app`,
    name: tool.title,
    url,
    description: tool.description,
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
  });
}
export function clearToolJsonLd(): void {
  document.getElementById("seo-tool-graph")?.remove();
}
