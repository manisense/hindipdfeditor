export type ToolId = 'edit' | 'merge' | 'split' | 'compress';

export type ToolMeta = {
  id: ToolId;
  title: string;
  shortTitle: string;
  description: string;
  accent: string;
  category: 'edit' | 'organize' | 'optimize';
};

export const TOOLS: ToolMeta[] = [
  {
    id: 'edit',
    title: 'Edit Hindi PDF',
    shortTitle: 'Edit PDF',
    description:
      'Tap detected Hindi or English text to replace it, add new overlays, or erase burned-in text — then export a new PDF.',
    accent: '#d83b35',
    category: 'edit',
  },
  {
    id: 'merge',
    title: 'Merge PDF',
    shortTitle: 'Merge',
    description: 'Combine multiple PDFs into one file. Runs entirely in your browser.',
    accent: '#2453b2',
    category: 'organize',
  },
  {
    id: 'split',
    title: 'Split PDF',
    shortTitle: 'Split',
    description: 'Extract page ranges into a new PDF without uploading to a server.',
    accent: '#157f54',
    category: 'organize',
  },
  {
    id: 'compress',
    title: 'Compress PDF',
    shortTitle: 'Compress',
    description: 'Shrink a PDF by re-encoding page images at a lower quality.',
    accent: '#c47a12',
    category: 'optimize',
  },
];

export function getTool(id: string | null): ToolMeta | null {
  if (!id) return null;
  return TOOLS.find((t) => t.id === id) ?? null;
}

export function toolHref(id: ToolId): string {
  return `/edit/?tool=${id}`;
}

export function readToolIdFromLocation(): ToolId | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('tool');
  if (raw === 'edit' || raw === 'merge' || raw === 'split' || raw === 'compress') {
    return raw;
  }
  return null;
}

export function readEditModeFromLocation(): 'edit' | 'addText' | 'erase' {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  if (mode === 'addText' || mode === 'erase' || mode === 'edit') return mode;
  return 'edit';
}
