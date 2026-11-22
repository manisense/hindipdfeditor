import { create } from 'zustand';

import type { FontWeight } from '../lib/fontWeight';

export type TextEdit = {
  type: 'text';
  id: string;
  page: number;
  xPt: number;
  yPt: number;
  fontSizePt: number;
  text: string;
  color: string;
  fontFamily: 'NotoSansDevanagari' | 'NotoSerifDevanagari' | string;
  fontWeight?: FontWeight;
  fontStyle?: 'italic';
  /** Stroke painted around the glyphs, as a share of the font size (matches a faux-bold original). */
  strokeEm?: number;
  /**
   * Baseline-to-baseline distance when the text wraps, in PDF points: set when an edit flows into
   * the rest of its paragraph, so wrapped lines keep the paragraph's spacing. Absent: the font's
   * normal line height.
   */
  lineHeightPt?: number;
  widthPt?: number;
  /** The mask that clears the original text under this edit, for replacements. */
  maskId?: string;
  /**
   * The detected line this edit replaced, as created: lets export redraw only the words that
   * changed. Ignored once the edit is moved or resized.
   */
  original?: { text: string; xPt: number; wPt: number; editXPt: number; fontSizePt: number };
};

export type MaskEdit = {
  type: 'mask';
  id: string;
  page: number;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  /** Fill colour for a whiteout or highlight; fallback colour for a replacement preview. */
  color: string;
  /**
   * `replace`: the original text under the box is removed at export (glyphs deleted from the PDF,
   * or ink cleaned from a scan) and borders survive. `whiteout` (default, the Whiteout tool): the
   * text under the box is deleted and the box is filled with `color`. `highlight`: `color` is
   * painted over the box with a multiply blend and everything under it is kept.
   */
  kind?: 'replace' | 'whiteout' | 'highlight';
  /** On-screen preview of the cleaned region (PNG data URL) for `replace` masks. */
  previewUri?: string;
};

export type ImageEdit = {
  type: 'image';
  id: string;
  page: number;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  /** PNG or JPEG data URL, already downscaled for the page. */
  uri: string;
  /** Drawn with the Signature pad rather than inserted from a file; only changes labels. */
  signature?: boolean;
};

export type Edit = TextEdit | MaskEdit | ImageEdit;

export type OcrLine = {
  id: string;
  text: string;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  /** Whether geometry came from the PDF text layer or a raster OCR engine. */
  source?: 'embedded' | 'embedded-degraded' | 'ocr';
  /** Baseline of the line, in PDF points from the page top, when the source reports one. */
  baselineYPt?: number;
  /** Look of the original font, when known, so replacement text can match it. */
  font?: FontHint;
};

export type FontHint = {
  serif: boolean;
  bold: boolean;
  italic: boolean;
  /** Bundled family that matches the original exactly or by metrics, when there is one. */
  match?: 'Hind' | 'Tinos' | 'Arimo' | 'Carlito' | 'Caladea';
  /**
   * Stroke painted around the glyphs to embolden them ("faux bold", text render mode 2), as a
   * share of the font size; absent when the text is only filled.
   */
  strokeEm?: number;
};

export type PageState = {
  pageIndex: number;
  widthPt: number;
  heightPt: number;
  /**
   * Data URL of the rasterized background JPEG for this page; empty until the page is first
   * needed (shown, read for text, or exported), since rendering every page up front made long
   * documents slow to open.
   */
  backgroundImageUri: string;
  imagePxWidth: number;
  imagePxHeight: number;
  edits: Edit[];
  ocrLines: OcrLine[];
};

export type DocumentState = {
  /** Unique per opened file, so late async results never land on a different file. */
  id: string;
  sourceName: string;
  pageCount: number;
  pages: PageState[];
  legacyFontWarnings: { page: number; fontName: string }[];
};

type NewTextEditInput = Omit<TextEdit, 'id' | 'type' | 'page'>;
type NewMaskEditInput = Omit<MaskEdit, 'id' | 'type' | 'page'>;
type TextEditFields = Omit<TextEdit, 'id' | 'type' | 'page'>;
type MaskEditFields = Omit<MaskEdit, 'id' | 'type' | 'page'>;
type ImageEditFields = Omit<ImageEdit, 'id' | 'type' | 'page'>;

export type EditStoreState = {
  document: DocumentState | null;
  history: DocumentState[];
  future: DocumentState[];
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  loadDocument: (document: DocumentState) => void;
  closeDocument: () => void;
  addTextEdit: (page: number, edit: NewTextEditInput) => TextEdit;
  addMaskEdit: (page: number, edit: NewMaskEditInput) => MaskEdit;
  addImageEdit: (page: number, edit: ImageEditFields) => ImageEdit;
  updateTextEdit: (page: number, id: string, changes: Partial<TextEditFields>) => void;
  updateMaskEdit: (page: number, id: string, changes: Partial<MaskEditFields>) => void;
  updateImageEdit: (page: number, id: string, changes: Partial<ImageEditFields>) => void;
  removeEdit: (page: number, id: string) => void;
  setLegacyFontWarnings: (warnings: DocumentState['legacyFontWarnings']) => void;
  setOcrLines: (page: number, lines: OcrLine[]) => void;
  setPageImage: (page: number, uri: string) => void;
};

const HISTORY_LIMIT = 25;

function requirePage(document: DocumentState | null, page: number): PageState {
  const pageState = document?.pages[page];
  if (!pageState) {
    throw new Error(`editStore: no page loaded at index ${page}`);
  }
  return pageState;
}

/**
 * Restores a snapshot's edits, and its detected lines only where that page had already been
 * detected. Detection that finished after the snapshot was taken is kept: restoring the empty
 * list would leave a page marked as detected with nothing to tap. Page images are not part of
 * the history: one rendered after the snapshot is kept.
 */
function restoreSnapshot(current: DocumentState, snapshot: DocumentState): DocumentState {
  return {
    ...snapshot,
    pages: snapshot.pages.map((page, i) => {
      const live = current.pages[i];
      if (!live) return page;
      const ocrLines = page.ocrLines.length === 0 && live.ocrLines.length > 0 ? live.ocrLines : page.ocrLines;
      const backgroundImageUri = page.backgroundImageUri || live.backgroundImageUri;
      return ocrLines === page.ocrLines && backgroundImageUri === page.backgroundImageUri
        ? page
        : { ...page, ocrLines, backgroundImageUri };
    }),
  };
}

function withUpdatedPage(document: DocumentState, page: number, edits: Edit[]): DocumentState {
  return {
    ...document,
    pages: document.pages.map((p, i) => (i === page ? { ...p, edits } : p)),
  };
}

export function createEditStore(generateId: () => string = () => crypto.randomUUID()) {
  return create<EditStoreState>((set, get) => ({
    document: null,
    history: [],
    future: [],

    checkpoint: () => {
      const { document, history } = get();
      if (!document) return;
      set({ history: [...history, document].slice(-HISTORY_LIMIT), future: [] });
    },

    undo: () => {
      const { document, history, future } = get();
      const snapshot = history[history.length - 1];
      if (!document || !snapshot) return;
      set({
        document: restoreSnapshot(document, snapshot),
        history: history.slice(0, -1),
        future: [document, ...future].slice(0, HISTORY_LIMIT),
      });
    },

    redo: () => {
      const { document, history, future } = get();
      const next = future[0];
      if (!document || !next) return;
      set({
        document: restoreSnapshot(document, next),
        history: [...history, document].slice(-HISTORY_LIMIT),
        future: future.slice(1),
      });
    },

    loadDocument: (document) => set({ document, history: [], future: [] }),

    closeDocument: () => set({ document: null, history: [], future: [] }),

    addTextEdit: (page, edit) => {
      const document = get().document;
      const pageState = requirePage(document, page);
      const newEdit: TextEdit = { ...edit, type: 'text', id: generateId(), page };
      set({ document: withUpdatedPage(document!, page, [...pageState.edits, newEdit]) });
      return newEdit;
    },

    addMaskEdit: (page, edit) => {
      const document = get().document;
      const pageState = requirePage(document, page);
      const newEdit: MaskEdit = { ...edit, type: 'mask', id: generateId(), page };
      set({ document: withUpdatedPage(document!, page, [...pageState.edits, newEdit]) });
      return newEdit;
    },

    addImageEdit: (page, edit) => {
      const document = get().document;
      const pageState = requirePage(document, page);
      const newEdit: ImageEdit = { ...edit, type: 'image', id: generateId(), page };
      set({ document: withUpdatedPage(document!, page, [...pageState.edits, newEdit]) });
      return newEdit;
    },

    updateImageEdit: (page, id, changes) => {
      const document = get().document;
      const pageState = requirePage(document, page);
      const existing = pageState.edits.find((e) => e.id === id);
      if (!existing || existing.type !== 'image') {
        throw new Error(`editStore: no ImageEdit with id ${id} on page ${page}`);
      }
      const edits = pageState.edits.map((e) => (e.id === id ? { ...e, ...changes } : e));
      set({ document: withUpdatedPage(document!, page, edits) });
    },

    updateTextEdit: (page, id, changes) => {
      const document = get().document;
      const pageState = requirePage(document, page);
      const existing = pageState.edits.find((e) => e.id === id);
      if (!existing || existing.type !== 'text') {
        throw new Error(`editStore: no TextEdit with id ${id} on page ${page}`);
      }
      const edits = pageState.edits.map((e) => (e.id === id ? { ...e, ...changes } : e));
      set({ document: withUpdatedPage(document!, page, edits) });
    },

    updateMaskEdit: (page, id, changes) => {
      const document = get().document;
      const pageState = requirePage(document, page);
      const existing = pageState.edits.find((e) => e.id === id);
      if (!existing || existing.type !== 'mask') {
        throw new Error(`editStore: no MaskEdit with id ${id} on page ${page}`);
      }
      const edits = pageState.edits.map((e) => (e.id === id ? { ...e, ...changes } : e));
      set({ document: withUpdatedPage(document!, page, edits) });
    },

    removeEdit: (page, id) => {
      const document = get().document;
      const pageState = requirePage(document, page);
      const edits = pageState.edits.filter((e) => e.id !== id);
      set({ document: withUpdatedPage(document!, page, edits) });
    },

    setLegacyFontWarnings: (warnings) => {
      const document = get().document;
      if (!document) {
        throw new Error('editStore: cannot set legacy font warnings before a document is loaded');
      }
      set({ document: { ...document, legacyFontWarnings: warnings } });
    },

    setOcrLines: (page, lines) => {
      const document = get().document;
      requirePage(document, page);
      set({
        document: {
          ...document!,
          pages: document!.pages.map((p, i) => (i === page ? { ...p, ocrLines: lines } : p)),
        },
      });
    },

    setPageImage: (page, uri) => {
      const document = get().document;
      requirePage(document, page);
      set({
        document: {
          ...document!,
          pages: document!.pages.map((p, i) => (i === page ? { ...p, backgroundImageUri: uri } : p)),
        },
      });
    },
  }));
}

export const useEditStore = createEditStore();
