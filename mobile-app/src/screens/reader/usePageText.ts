import { useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

import { detectTextLines } from '../../lib/ocr';
import { renderPage } from '../../lib/pdfToImages';
import { searchOrder } from '../../lib/textSearch';
import type { OcrLine } from '../../state/editStore';

/** OCR render scale, in px per PDF point (same as the editor's raster scale). */
const OCR_SCALE = 3;

export type PageText = {
  /** 0-based page index. */
  pageIndex: number;
  /** Page width, in PDF points (to convert line boxes to dp). */
  widthPt: number;
  /** Lines in reading order; boxes in PDF points. Empty when the page has no text or OCR failed. */
  lines: OcrLine[];
  /** True when the page couldn't be rendered or read. */
  failed: boolean;
};

type Cache = { uri: string | null; pages: Map<number, PageText> };

/**
 * On-device OCR text for the Reader's Find. While `active`, reads pages one at a time, starting
 * at `startPage` (0-based) and working outward, and keeps only the text and line boxes: each
 * page image is deleted once read. Text stays cached for the open file, so closing and reopening
 * Find resumes where it stopped. Work stops when `active` turns false or the Reader unmounts.
 *
 * @returns `pages` sorted by page index, and `done`, the number of pages read so far.
 */
export function usePageText(
  fileUri: string | null,
  pageCount: number,
  active: boolean,
  startPage: number,
): { pages: PageText[]; done: number } {
  const cacheRef = useRef<Cache>({ uri: null, pages: new Map() });
  const startRef = useRef(startPage);
  const [snapshot, setSnapshot] = useState<{ uri: string | null; pages: PageText[] }>({
    uri: null,
    pages: [],
  });

  useEffect(() => {
    startRef.current = startPage;
  });

  useEffect(() => {
    if (!active || !fileUri || pageCount === 0) return;
    if (cacheRef.current.uri !== fileUri) cacheRef.current = { uri: fileUri, pages: new Map() };
    const cache = cacheRef.current;
    let cancelled = false;

    const run = async () => {
      for (const pageIndex of searchOrder(startRef.current, pageCount)) {
        if (cancelled) return;
        if (cache.pages.has(pageIndex)) continue;
        const text = await readPage(fileUri, pageIndex);
        if (cancelled) return;
        cache.pages.set(pageIndex, text);
        setSnapshot({
          uri: fileUri,
          pages: [...cache.pages.values()].sort((a, b) => a.pageIndex - b.pageIndex),
        });
        // Lets touches and scrolling through before the next page starts.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [active, fileUri, pageCount]);

  const pages = snapshot.uri === fileUri ? snapshot.pages : [];
  return { pages, done: pages.length };
}

/** Renders page `pageIndex` (0-based), reads its lines, then deletes the image. */
async function readPage(fileUri: string, pageIndex: number): Promise<PageText> {
  let imageUri: string | null = null;
  try {
    const image = await renderPage(fileUri, pageIndex, OCR_SCALE);
    imageUri = image.uri;
    const lines = await detectTextLines({
      pageIndex,
      widthPt: image.widthPt,
      heightPt: image.heightPt,
      backgroundImageUri: image.uri,
      imagePxWidth: image.pxWidth,
      imagePxHeight: image.pxHeight,
      edits: [],
      ocrLines: [],
    });
    return { pageIndex, widthPt: image.widthPt, lines, failed: false };
  } catch (error) {
    console.warn(`Find: couldn't read page ${pageIndex}`, error);
    return { pageIndex, widthPt: 0, lines: [], failed: true };
  } finally {
    if (imageUri) {
      FileSystem.deleteAsync(imageUri, { idempotent: true }).catch(() => undefined);
    }
  }
}
