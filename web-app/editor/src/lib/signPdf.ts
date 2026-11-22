import { exportPdf } from './exportPdf';
import type { DocumentState, ImageEdit, PageState } from '../state/editStore';

/** One placed signature: a page (zero-based) and a box on it, in PDF points (top-left origin). */
export type SignaturePlacement = { page: number; xPt: number; yPt: number; wPt: number; hPt: number };

/** Scale page images would be rendered at, in px per PDF point (used for page geometry only). */
const PAGE_PX_PER_PT = 2;

/**
 * Signs a PDF: draws the signature image at every placement and returns the new file. Built on
 * the editor's export, so unsigned pages are copied unchanged, page rotation is handled, the
 * source file is never modified and the result is re-opened before it is returned.
 *
 * @param pageSizes Size of every page, in PDF points with rotation applied.
 * @param signature PNG or JPEG data URL.
 */
export async function signPdf(
  sourceBytes: Uint8Array,
  sourceName: string,
  pageSizes: readonly { widthPt: number; heightPt: number }[],
  placements: readonly SignaturePlacement[],
  signature: string,
): Promise<Blob> {
  const pages: PageState[] = pageSizes.map((size, pageIndex) => ({
    pageIndex,
    widthPt: size.widthPt,
    heightPt: size.heightPt,
    backgroundImageUri: '',
    imagePxWidth: Math.round(size.widthPt * PAGE_PX_PER_PT),
    imagePxHeight: Math.round(size.heightPt * PAGE_PX_PER_PT),
    ocrLines: [],
    edits: placements
      .filter((placement) => placement.page === pageIndex)
      .map(
        (placement, k): ImageEdit => ({
          type: 'image',
          id: `signature-${pageIndex}-${k}`,
          page: pageIndex,
          xPt: placement.xPt,
          yPt: placement.yPt,
          wPt: placement.wPt,
          hPt: placement.hPt,
          uri: signature,
          signature: true,
        }),
      ),
  }));
  const document: DocumentState = {
    id: `sign-${Date.now()}`,
    sourceName,
    pageCount: pages.length,
    pages,
    legacyFontWarnings: [],
  };
  return exportPdf(document, sourceBytes);
}
