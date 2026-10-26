import { useEffect, useRef, useState } from 'react';

import { renderPage } from '../../lib/pdfToImages';

/** Reading render scale, in px per PDF point (AGENTS.md: 2–3× the page's point size). */
const READING_SCALE = 2.5;

const NO_RENDERS: Record<number, PageRender> = {};

export type PageRender = {
  /** `file://` URI of the rendered JPEG; missing when the render failed. */
  uri?: string;
  /** Rendered bitmap width, in px. */
  width?: number;
  /** Rendered bitmap height, in px. */
  height?: number;
};

/**
 * Full-size page renders for the Reader: renders `currentPage` (zero-based) and its neighbours at
 * `READING_SCALE`, once each. A failed page is kept with no `uri` and is not retried. Results
 * that arrive after the file changed are dropped.
 */
export function usePageRenders(
  fileUri: string | null,
  pageCount: number,
  currentPage: number,
): Record<number, PageRender> {
  // Renders are stored with the file they belong to, so a new file starts empty without a reset.
  const [store, setStore] = useState<{ uri: string | null; renders: Record<number, PageRender> }>({
    uri: null,
    renders: {},
  });
  const renders = store.uri === fileUri ? store.renders : NO_RENDERS;
  const renderingRef = useRef<Set<number>>(new Set());

  // The file the Reader currently shows. A render that finishes after the file changed (or the
  // Reader closed) is dropped by comparing against this, not against one effect run: the effect
  // re-runs on every page change, and tying results to a run discarded pages still rendering.
  const activeFileRef = useRef<string | null>(null);
  useEffect(() => {
    activeFileRef.current = fileUri;
    renderingRef.current.clear();
    return () => {
      activeFileRef.current = null;
    };
  }, [fileUri]);

  useEffect(() => {
    if (!fileUri || pageCount === 0) return;
    const uri = fileUri;
    const save = (idx: number, render: PageRender) =>
      setStore((prev) => ({
        uri,
        renders: { ...(prev.uri === uri ? prev.renders : {}), [idx]: render },
      }));

    async function renderPageBatch() {
      const indicesToRender = [currentPage];
      if (currentPage + 1 < pageCount) indicesToRender.push(currentPage + 1);
      if (currentPage - 1 >= 0) indicesToRender.push(currentPage - 1);

      for (const idx of indicesToRender) {
        // Skip pages in flight and pages already settled (rendered, or failed: no retry loop).
        if (renderingRef.current.has(idx) || renders[idx]) continue;
        renderingRef.current.add(idx);

        try {
          const rendered = await renderPage(uri, idx, READING_SCALE);
          if (activeFileRef.current === uri) {
            save(idx, { uri: rendered.uri, width: rendered.pxWidth, height: rendered.pxHeight });
          }
        } catch (err) {
          console.warn(`Failed to render page ${idx}`, err);
          if (activeFileRef.current === uri) save(idx, {});
        } finally {
          if (activeFileRef.current === uri) renderingRef.current.delete(idx);
        }
      }
    }

    void renderPageBatch();
  }, [fileUri, pageCount, currentPage, renders]);

  return renders;
}
