import { useEffect, useState } from 'react';

import { readToolIdFromLocation, type ToolId } from './lib/tools';
import { CompressPdfTool } from './tools/CompressPdfTool';
import { EditPdfTool } from './tools/EditPdfTool';
import { MergePdfTool } from './tools/MergePdfTool';
import { SplitPdfTool } from './tools/SplitPdfTool';
import { ToolsHub } from './tools/ToolsHub';
import { TranslatePdfTool } from './tools/TranslatePdfTool';
import './App.css';

function useToolId(): ToolId | null {
  const [toolId, setToolId] = useState<ToolId | null>(() => readToolIdFromLocation());

  useEffect(() => {
    const onNav = () => setToolId(readToolIdFromLocation());
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  return toolId;
}

export default function App() {
  const toolId = useToolId();

  switch (toolId) {
    case 'edit':
      return <EditPdfTool />;
    case 'translate':
      return <TranslatePdfTool />;
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
