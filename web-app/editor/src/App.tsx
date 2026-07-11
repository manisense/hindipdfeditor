import { lazy, Suspense, useEffect, useState } from 'react';

import { readToolIdFromLocation, type ToolId } from './lib/tools';
import { CompressPdfTool } from './tools/CompressPdfTool';
import { EditPdfTool } from './tools/EditPdfTool';
import { MergePdfTool } from './tools/MergePdfTool';
import { SplitPdfTool } from './tools/SplitPdfTool';
import { ToolsHub } from './tools/ToolsHub';
import './App.css';

/** Lazy so ORT / transformers only load when the user opens Translate. */
const TranslatePdfTool = lazy(async () => {
  const mod = await import('./tools/TranslatePdfTool');
  return { default: mod.TranslatePdfTool };
});

function useToolId(): ToolId | null {
  const [toolId, setToolId] = useState<ToolId | null>(() => readToolIdFromLocation());

  useEffect(() => {
    const onNav = () => setToolId(readToolIdFromLocation());
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

  switch (toolId) {
    case 'edit':
      return <EditPdfTool />;
    case 'translate':
      return (
        <Suspense fallback={<ToolLoading />}>
          <TranslatePdfTool />
        </Suspense>
      );
    case 'merge':
      return <MergePdfTool />;
    case 'split':
      return <SplitPdfTool />;
    case 'compress':
      return <CompressPdfTool />;
    default:
      return <ToolsHub />;
  }
}
