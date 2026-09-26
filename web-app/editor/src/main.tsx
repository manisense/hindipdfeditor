import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

import App from './App';
import { readLanguagePreference, saveLanguagePreference } from './lib/i18n';
import { legacyRedirectTarget, parseRoute, routePath } from './lib/routes';
import './home.css';

function redirectTarget(): string | null {
  const { pathname, search, hash } = window.location;
  // An explicit ?lang= in a link is the visitor's choice for this visit, so it wins over
  // (and replaces) any language they picked earlier.
  const explicitLang = new URLSearchParams(search).get('lang');
  if (explicitLang === 'hi' || explicitLang === 'en') saveLanguagePreference(explicitLang);
  const legacy = legacyRedirectTarget(pathname, search);
  if (legacy) return `${legacy}${hash}`;

  // Honour a language the visitor picked earlier. Crawlers have no stored choice, so every
  // URL still serves its own language to them.
  const route = parseRoute(pathname);
  const preferred = readLanguagePreference();
  if (preferred && preferred !== route.lang) {
    return `${routePath({ ...route, lang: preferred })}${search}${hash}`;
  }
  return null;
}

const target = redirectTarget();
if (target) {
  window.location.replace(target);
} else {
  const container = document.getElementById('root')!;
  const app = (
    <StrictMode>
      <App route={parseRoute(window.location.pathname)} />
    </StrictMode>
  );
  // Prerendered pages hydrate; the Vite dev server serves an empty root and renders fresh.
  if (container.hasChildNodes()) hydrateRoot(container, app);
  else createRoot(container).render(app);
}
