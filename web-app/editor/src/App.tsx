import { useEffect, useState } from 'react';

import { ErrorBoundary } from './components/ErrorBoundary';
import { SeoHead } from './components/SeoHead';
import { HomePage } from './home/HomePage';
import { readToolIdFromLocation, type ToolId } from './lib/tools';
import { CompressPdfTool } from './tools/CompressPdfTool';
import { EditPdfTool } from './tools/EditPdfTool';
import { MergePdfTool } from './tools/MergePdfTool';
import { SplitPdfTool } from './tools/SplitPdfTool';
import { TranslatePdfTool } from './tools/TranslatePdfTool';
import './App.css';

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
    <>
      <SeoHead toolId={toolId} />
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
    </>
  );
}
