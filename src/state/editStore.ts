import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

/**
 * Canonical data model (spec Section 7). Every position/size field is in **PDF points**
 * (the page's real, resolution-independent size from `@cantoo/pdf-lib`'s `getSize()`) -
 * never device dp and never background-image px. Converting to those display/compositing
 * units happens in `coordinateMath.ts`, at the point of use, so re-rendering the background
 * image at a different resolution never invalidates a stored edit's position.
 */
export type TextEdit = {
  type: 'text';
  id: string;
  /** 0-indexed page this edit belongs to. */
  page: number;
  /** Top-left X origin, page-relative, in PDF points. */
  xPt: number;
  /** Top-left Y origin, page-relative, in PDF points. */
  yPt: number;
  /** Font size, in PDF points. */
  fontSizePt: number;
  text: string;
  /** Hex color, e.g. `#111111`. */
  color: string;
  fontFamily: 'NotoSansDevanagari' | 'NotoSerifDevanagari' | string;
};

export type MaskEdit = {
  type: 'mask';
  id: string;
  /** 0-indexed page this edit belongs to. */
  page: number;
  /** Top-left X origin, page-relative, in PDF points. */
  xPt: number;
  /** Top-left Y origin, page-relative, in PDF points. */
  yPt: number;
  /** Width, in PDF points. */
  wPt: number;
  /** Height, in PDF points. */
  hPt: number;
  /** Sampled background color to paint over the masked-out original text, hex. */
  color: string;
};

export type Edit = TextEdit | MaskEdit;

export type PageState = {
  pageIndex: number;
  /** Page width, in PDF points. */
  widthPt: number;
  /** Page height, in PDF points. */
  heightPt: number;
  /** Local `file://` path to the rendered background PNG for this page. */
  backgroundImageUri: string;
  /** Rendered background image width, in px. */
  imagePxWidth: number;
  /** Rendered background image height, in px. */
  imagePxHeight: number;
  edits: Edit[];
};

export type DocumentState = {
  sourceUri: string;
  pageCount: number;
  pages: PageState[];
  legacyFontWarnings: { page: number; fontName: string }[];
};

type NewTextEditInput = Omit<TextEdit, 'id' | 'type' | 'page'>;
type NewMaskEditInput = Omit<MaskEdit, 'id' | 'type' | 'page'>;
type TextEditFields = Omit<TextEdit, 'id' | 'type' | 'page'>;
type MaskEditFields = Omit<MaskEdit, 'id' | 'type' | 'page'>;

export type EditStoreState = {
  document: DocumentState | null;
  /** Replaces the whole in-memory document, e.g. after opening a file and rasterizing its pages. */
  loadDocument: (document: DocumentState) => void;
  /** Clears the in-memory document, e.g. before opening a different file. */
  closeDocument: () => void;
  /** Commits a new `TextEdit` to the given page. Throws if `page` is out of range. */
  addTextEdit: (page: number, edit: NewTextEditInput) => TextEdit;
  /** Commits a new `MaskEdit` to the given page. Throws if `page` is out of range. */
  addMaskEdit: (page: number, edit: NewMaskEditInput) => MaskEdit;
  /** Merges `changes` into an existing `TextEdit`. Throws if `page`/`id` don't match a `TextEdit`. */
  updateTextEdit: (page: number, id: string, changes: Partial<TextEditFields>) => void;
  /** Merges `changes` into an existing `MaskEdit`. Throws if `page`/`id` don't match a `MaskEdit`. */
  updateMaskEdit: (page: number, id: string, changes: Partial<MaskEditFields>) => void;
  /** Removes an edit (text or mask) by id from the given page. No-op if not found. */
  removeEdit: (page: number, id: string) => void;
  /** Replaces `DocumentState.legacyFontWarnings`, e.g. after `legacyFontDetector.ts` runs on load. */
  setLegacyFontWarnings: (warnings: DocumentState['legacyFontWarnings']) => void;
};

function requirePage(document: DocumentState | null, page: number): PageState {
  const pageState = document?.pages[page];
  if (!pageState) {
    throw new Error(`editStore: no page loaded at index ${page}`);
  }
  return pageState;
}

function withUpdatedPage(document: DocumentState, page: number, edits: Edit[]): DocumentState {
  return {
    ...document,
    pages: document.pages.map((p, i) => (i === page ? { ...p, edits } : p)),
  };
}

/**
 * Creates an independent edit store instance. The app uses the default singleton export
 * (`useEditStore`) below; this factory exists so tests can create a fresh, isolated store
 * per test instead of sharing module-level state across the whole suite.
 *
 * @param generateId Id generator for new edits. Defaults to `expo-crypto`'s `randomUUID`;
 *   injectable so tests don't depend on a native module being available.
 */
export function createEditStore(generateId: () => string = Crypto.randomUUID) {
  return create<EditStoreState>((set, get) => ({
    document: null,

    loadDocument: (document) => set({ document }),

    closeDocument: () => set({ document: null }),

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
  }));
}

/** App-wide edit store singleton, backing `DocumentState`/`PageState`/`Edit` (spec Section 8). */
export const useEditStore = createEditStore();
