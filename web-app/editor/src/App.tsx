import { lazy, Suspense, useEffect, useState } from 'react';

import { AppPopupProvider } from './components/AppPopup';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SeoHead } from './components/SeoHead';
import { HomePage } from './home/HomePage';
import { LanguageProvider } from './lib/i18n';
import { readToolIdFromLocation, type ToolId } from './lib/tools';
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

function useToolId(): ToolId | null {
  const [toolId, setToolId] = useState<ToolId | null>(() => readToolIdFromLocation());

  useEffect(() => {
    const onNav = () => {
      setToolId(readToolIdFromLocation());
      // Client-side tool switches (popstate) need an explicit page_view; first load
      // is already counted by analytics.js gtag('config', ...).
      const path = `${window.location.pathname}${window.location.search}`;
      window.gtag?.('event', 'page_view', {
        page_path: path,
        page_location: window.location.href,
        page_title: document.title,
      });
    };
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  return toolId;
}

export default function App() {
  const toolId = useToolId();

  return (
    <LanguageProvider>
      <AppPopupProvider>
        <SeoHead toolId={toolId} />
        <Suspense
          fallback={
            <div className="app-loading" role="status" aria-live="polite">
              Loading PDF tool…
            </div>
          }
        >
          {toolId === 'edit' ? (
            <EditPdfTool />
          ) : toolId === 'translate' ? (
            <ErrorBoundary label="Translate">
              <TranslatePdfTool />
            </ErrorBoundary>
          ) : toolId === 'merge' ? (
            <MergePdfTool />
          ) : toolId === 'split' ? (
            <SplitPdfTool />
          ) : toolId === 'compress' ? (
            <CompressPdfTool />
          ) : (
            <HomePage />
          )}
        </Suspense>
      </AppPopupProvider>
    </LanguageProvider>
  );
}
