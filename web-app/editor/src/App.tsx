import { lazy, Suspense, useEffect, useState } from 'react';

import { AppPopupProvider } from './components/AppPopup';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToolShell } from './components/ToolShell';
import { HomePage } from './home/HomePage';
import { LanguageProvider, type Language } from './lib/i18n';
import { ROUTE_CHANGE_EVENT } from './lib/navigation';
import { parseRoute, routePath, type Route } from './lib/routes';
import { seoFor } from './lib/seo';
import { getTool, type ToolId } from './lib/tools';
import './App.css';

const CompressPdfTool = lazy(() =>
  import('./tools/CompressPdfTool').then((module) => ({ default: module.CompressPdfTool })),
);
const EditPdfTool = lazy(() =>
  import('./tools/EditPdfTool').then((module) => ({ default: module.EditPdfTool })),
);
const MergePdfTool = lazy(() =>
  import('./tools/MergePdfTool').then((module) => ({ default: module.MergePdfTool })),
);
const SplitPdfTool = lazy(() =>
  import('./tools/SplitPdfTool').then((module) => ({ default: module.SplitPdfTool })),
);
const TranslatePdfTool = lazy(() =>
  import('./tools/TranslatePdfTool').then((module) => ({ default: module.TranslatePdfTool })),
);

/**
 * Tool page as prerendered and as first hydrated: the shell with its intro and guide, and a
 * loading slot where the interactive tool mounts once the browser has taken over.
 */
function ToolPlaceholder({ toolId }: { toolId: ToolId }) {
  return (
    <ToolShell tool={getTool(toolId)}>
      <div className="app-loading" role="status" aria-live="polite">
        Loading PDF tool…
      </div>
    </ToolShell>
  );
}

function ToolRoute({ toolId }: { toolId: ToolId }) {
  // The tools use browser-only APIs, so they are never prerendered; the placeholder is
  // rendered for the server HTML and the hydration pass, then swapped for the real tool.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const placeholder = <ToolPlaceholder toolId={toolId} />;
  if (!hydrated) return placeholder;

  return (
    <Suspense fallback={placeholder}>
      {toolId === 'edit' ? (
        <EditPdfTool />
      ) : toolId === 'translate' ? (
        <ErrorBoundary>
          <TranslatePdfTool />
        </ErrorBoundary>
      ) : toolId === 'merge' ? (
        <MergePdfTool />
      ) : toolId === 'split' ? (
        <SplitPdfTool />
      ) : (
        <CompressPdfTool />
      )}
    </Suspense>
  );
}

export default function App({ route: initialRoute }: { route: Route }) {
  const [route, setRoute] = useState(initialRoute);

  useEffect(() => {
    const sync = () => {
      const next = parseRoute(window.location.pathname);
      setRoute(next);
      document.title = seoFor(next).title;
    };
    window.addEventListener('popstate', sync);
    window.addEventListener(ROUTE_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(ROUTE_CHANGE_EVENT, sync);
    };
  }, []);

  const pathFor = (lang: Language) => routePath({ ...route, lang });

  return (
    <LanguageProvider lang={route.lang} pathFor={pathFor}>
      <AppPopupProvider>
        {route.toolId ? <ToolRoute toolId={route.toolId} /> : <HomePage />}
      </AppPopupProvider>
    </LanguageProvider>
  );
}
