import { renderToString } from "react-dom/server";
import { Suspense } from "react";
import { ToolGuide } from "./components/ToolGuide";
import { HomePage } from "./home/HomePage";
import { LanguageProvider, type Language } from "./lib/i18n";
import type { ToolId } from "./lib/tools";

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

/** Static help for a tool page, read by crawlers before the PDF tool loads. */
export function renderToolGuide(toolId: ToolId): string {
  return renderToString(<ToolGuide toolId={toolId} language="en" />);
}

export { seoForHome, siteGraphJsonLd, toolGraphJsonLd } from "./lib/seo";
