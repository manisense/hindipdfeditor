import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';

import App from './App';
import { ALL_ROUTES, routePath, type Route } from './lib/routes';
import { headTags } from './lib/seo';

export type PrerenderedPage = {
  /** Public path, e.g. `/hi/merge-pdf/`. */
  path: string;
  lang: Route['lang'];
  head: string;
  html: string;
};

/** Renders every public route to static HTML for the build-time prerender step. */
export function renderAllRoutes(): PrerenderedPage[] {
  return ALL_ROUTES.map((route) => ({
    path: routePath(route),
    lang: route.lang,
    head: headTags(route),
    html: renderToString(
      <StrictMode>
        <App route={route} />
      </StrictMode>,
    ),
  }));
}
