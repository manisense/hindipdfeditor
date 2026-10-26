import { useCallback, useEffect, useRef, useState } from 'react';

import { renderPage } from '../../lib/pdfToImages';

/** Thumbnail render scale, in px per PDF point (the size the tools use for previews). */
const THUMB_SCALE = 0.5;

const NO_THUMBS: Record<number, string> = {};

/**
 * Small page thumbnails for the page grid and the scroller preview, rendered one at a time on
 * request. Pages are zero-based; the latest request goes first, and each page renders once per
 * file (a failed page stays without a thumbnail).
 */
export function usePageThumbs(fileUri: string | null): {
  thumbs: Record<number, string>;
  requestThumbs: (pages: number[]) => void;
} {
  // Thumbnails are stored with the file they belong to, so a new file starts empty without a reset.
  const [store, setStore] = useState<{ uri: string | null; thumbs: Record<number, string> }>({
    uri: null,
    thumbs: {},
  });
  const thumbs = store.uri === fileUri ? store.thumbs : NO_THUMBS;
  const uriRef = useRef<string | null>(fileUri);
  const queueRef = useRef<number[]>([]);
  const requestedRef = useRef<Set<number>>(new Set());
  const runningRef = useRef(false);

  useEffect(() => {
    uriRef.current = fileUri;
    queueRef.current = [];
    requestedRef.current = new Set();
    return () => {
      uriRef.current = null;
      queueRef.current = [];
    };
  }, [fileUri]);

  const pump = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      for (let page = queueRef.current.shift(); page !== undefined;) {
        const uri = uriRef.current;
        if (!uri) break;
        try {
          const image = await renderPage(uri, page, THUMB_SCALE);
          const done = page;
          if (uriRef.current === uri) {
            setStore((prev) => ({
              uri,
              thumbs: { ...(prev.uri === uri ? prev.thumbs : {}), [done]: image.uri },
            }));
          }
        } catch (err) {
          console.warn(`Failed to render thumbnail ${page}`, err);
        }
        page = queueRef.current.shift();
      }
    } finally {
      runningRef.current = false;
    }
  }, []);

  const requestThumbs = useCallback(
    (pages: number[]) => {
      const fresh = pages.filter((page) => !requestedRef.current.has(page));
      if (fresh.length === 0) return;
      fresh.forEach((page) => requestedRef.current.add(page));
      queueRef.current = [...fresh, ...queueRef.current];
      void pump();
    },
    [pump],
  );

  return { thumbs, requestThumbs };
}
