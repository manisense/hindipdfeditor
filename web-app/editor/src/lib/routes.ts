import type { Language } from './i18n';
import { TOOL_SLUGS, TOOLS, toolHref, type ToolId } from './tools';

/** A public, prerendered page of the web app: the home hub or one tool, in one language. */
export type Route = {
  lang: Language;
  toolId: ToolId | null;
};

export const LANGUAGES: readonly Language[] = ['en', 'hi'];

/** Every route that gets its own static HTML file at build time. */
export const ALL_ROUTES: readonly Route[] = LANGUAGES.flatMap((lang) => [
  { lang, toolId: null },
  ...TOOLS.map((tool) => ({ lang, toolId: tool.id })),
]);

/** Public path of a route, always with a trailing slash, e.g. `/`, `/hi/`, `/hi/merge-pdf/`. */
export function routePath(route: Route): string {
  if (route.toolId) return toolHref(route.toolId, route.lang);
  return route.lang === 'hi' ? '/hi/' : '/';
}

/** Parses a URL pathname into a route; unknown paths fall back to the home hub of their language. */
export function parseRoute(pathname: string): Route {
  const segments = pathname.split('/').filter(Boolean);
  const lang: Language = segments[0] === 'hi' ? 'hi' : 'en';
  const slug = lang === 'hi' ? segments[1] : segments[0];
  const toolId =
    (Object.keys(TOOL_SLUGS) as ToolId[]).find((id) => TOOL_SLUGS[id] === slug) ?? null;
  return { lang, toolId };
}

/**
 * Where an old-style URL should now live, or null if it is already canonical.
 * Handles the retired `?tool=` and `?lang=` query parameters of the single-page app.
 */
export function legacyRedirectTarget(pathname: string, search: string): string | null {
  const params = new URLSearchParams(search);
  const legacyTool = params.get('tool');
  const legacyLang = params.get('lang');
  if (!legacyTool && !legacyLang) return null;

  const current = parseRoute(pathname);
  const toolId = (legacyTool && legacyTool in TOOL_SLUGS ? legacyTool : current.toolId) as
    | ToolId
    | null;
  const lang: Language = legacyLang === 'hi' || legacyLang === 'en' ? legacyLang : current.lang;

  params.delete('tool');
  params.delete('lang');
  const rest = params.toString();
  return `${routePath({ lang, toolId })}${rest ? `?${rest}` : ''}`;
}
