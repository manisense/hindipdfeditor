import { lazy, Suspense, useEffect, useState } from 'react';

import { SeoHead } from './components/SeoHead';
import { HomePage } from './home/HomePage';
import { readToolIdFromLocation, type ToolId } from './lib/tools';
import { CompressPdfTool } from './tools/CompressPdfTool';
import { EditPdfTool } from './tools/EditPdfTool';
import { MergePdfTool } from './tools/MergePdfTool';
import { SplitPdfTool } from './tools/SplitPdfTool';
import './App.css';

/** Lazy so ORT / transformers only load when the user opens Translate. */
const TranslatePdfTool = lazy(async () => {
  const mod = await import('./tools/TranslatePdfTool');
  return { default: mod.TranslatePdfTool };
});

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

function ToolLoading() {
  return (
    <div className="utility-tool" style={{ padding: 48, textAlign: 'center' }}>
      Loading translate tool…
    </div>
  );
}

export default function App() {
  const toolId = useToolId();

  return (
    <>
      <SeoHead toolId={toolId} />
      {toolId === 'edit' ? (
        <EditPdfTool />
      ) : toolId === 'translate' ? (
        <Suspense fallback={<ToolLoading />}>
          <TranslatePdfTool />
        </Suspense>
      ) : toolId === 'merge' ? (
        <MergePdfTool />
      ) : toolId === 'split' ? (
        <SplitPdfTool />
      ) : toolId === 'compress' ? (
        <CompressPdfTool />
      ) : (
        <HomePage />
      )}
    </>
  );
}
