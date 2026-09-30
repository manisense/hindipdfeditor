import { renderToString } from "react-dom/server";
import { Suspense } from "react";
import { HomePage } from "./home/HomePage";
import { LanguageProvider, type Language } from "./lib/i18n";

/** Render public content without reading browser preferences or loading PDF tools. */
export function renderHome(language: Language): string {
  return renderToString(
    <LanguageProvider initialLanguage={language}>
      <Suspense>
        <HomePage />
      </Suspense>
    </LanguageProvider>,
  );
}

export { seoForHome, siteGraphJsonLd } from "./lib/seo";
