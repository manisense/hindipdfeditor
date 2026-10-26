import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { renderPage } from '../../lib/pdfToImages';
import { isWithin, keepNear, nextPageToRender } from '../../lib/readerLayout';

/** Reading render scale, in px per PDF point (AGENTS.md: 2–3× the page's point size). */
const READING_SCALE = 2.5;
/** Pages rendered on each side of the settled page. */
const RENDER_RADIUS = 1;
/** Pages kept on each side of the settled page; renders further away are dropped. */
const KEEP_RADIUS = 2;

export type PageRender = {
  /** `file://` URI of the rendered JPEG; missing when the render failed. */
  uri?: string;
};

export type PageSize = {
  /** Rendered bitmap width, in px. */
  width: number;
  /** Rendered bitmap height, in px. */
  height: number;
};

type Store = {
  uri: string | null;
  renders: Record<number, PageRender>;
  sizes: Record<number, PageSize>;
};

const EMPTY: Store = { uri: null, renders: {}, sizes: {} };

/**
 * Full-size page renders for the Reader. Renders `settledPage` (zero-based) and the page on each
 * side at `READING_SCALE`, one at a time. Pass a page that has stopped changing (not every scrub
 * step): a render that finishes after the page moved more than one away is dropped, and renders
 * more than `KEEP_RADIUS` pages away are evicted. A failed page is kept with no `uri` and is not
 * retried while it stays near. `sizes` keeps every rendered page's px size for layout, even after
 * its image is evicted. Results that arrive after the file changed are dropped.
 */
export function usePageRenders(
  fileUri: string | null,
  pageCount: number,
  settledPage: number,
): { renders: Record<number, PageRender>; sizes: Record<number, PageSize> } {
  // State is stored with the file it belongs to, so a new file starts empty without a reset.
  const [store, setStore] = useState<Store>(EMPTY);
  const current = store.uri === fileUri ? store : EMPTY;

  // The pump reads these instead of render-time values: it outlives the render that started it.
  const cacheRef = useRef<Store>(EMPTY);
  const targetRef = useRef({ uri: fileUri, pageCount, page: settledPage });
  const runningRef = useRef(false);

  const pump = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      for (;;) {
        const { uri, pageCount: count, page: center } = targetRef.current;
        if (!uri || count === 0) break;
        const cache = cacheRef.current.uri === uri ? cacheRef.current : { ...EMPTY, uri };
        const next = nextPageToRender(center, count, RENDER_RADIUS, (p) => p in cache.renders);
        if (next === null) break;

        let result: PageRender;
        let size: PageSize | undefined;
        try {
          const rendered = await renderPage(uri, next, READING_SCALE);
          result = { uri: rendered.uri };
          size = { width: rendered.pxWidth, height: rendered.pxHeight };
        } catch (err) {
          console.warn(`Failed to render page ${next}`, err);
          result = {};
        }

        const now = targetRef.current;
        // Dropped when the file changed or the reader moved on; the loop picks the new target.
        if (now.uri !== uri) continue;
        const latest = cacheRef.current.uri === uri ? cacheRef.current : { ...EMPTY, uri };
        const sizes = size ? { ...latest.sizes, [next]: size } : latest.sizes;
        const renders = isWithin(next, now.page, RENDER_RADIUS)
          ? keepNear({ ...latest.renders, [next]: result }, now.page, KEEP_RADIUS)
          : keepNear(latest.renders, now.page, KEEP_RADIUS);
        cacheRef.current = { uri, renders, sizes };
        setStore(cacheRef.current);
      }
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    targetRef.current = { uri: fileUri, pageCount, page: settledPage };
    void pump();
  }, [fileUri, pageCount, settledPage, pump]);

  useEffect(
    () => () => {
      targetRef.current = { uri: null, pageCount: 0, page: 0 };
    },
    [],
  );

  // The store is trimmed when a render lands; this also trims it as soon as the page moves.
  const renders = useMemo(
    () => keepNear(current.renders, settledPage, KEEP_RADIUS),
    [current.renders, settledPage],
  );
  return { renders, sizes: current.sizes };
}
