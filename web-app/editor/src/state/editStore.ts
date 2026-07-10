import { create } from 'zustand';

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
  fontWeight?: 'normal' | 'bold';
  widthPt?: number;
};

export type MaskEdit = {
  type: 'mask';
  id: string;
  page: number;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  color: string;
};

export type Edit = TextEdit | MaskEdit;

export type OcrLine = {
  id: string;
  text: string;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
};

export type PageState = {
  pageIndex: number;
  widthPt: number;
  heightPt: number;
  /** Data URL of the rasterized background JPEG for this page. */
  backgroundImageUri: string;
  imagePxWidth: number;
  imagePxHeight: number;
  edits: Edit[];
  ocrLines: OcrLine[];
};

export type DocumentState = {
  sourceName: string;
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
  history: DocumentState[];
  checkpoint: () => void;
  undo: () => void;
  loadDocument: (document: DocumentState) => void;
  closeDocument: () => void;
  addTextEdit: (page: number, edit: NewTextEditInput) => TextEdit;
  addMaskEdit: (page: number, edit: NewMaskEditInput) => MaskEdit;
  updateTextEdit: (page: number, id: string, changes: Partial<TextEditFields>) => void;
  updateMaskEdit: (page: number, id: string, changes: Partial<MaskEditFields>) => void;
  removeEdit: (page: number, id: string) => void;
  setLegacyFontWarnings: (warnings: DocumentState['legacyFontWarnings']) => void;
  setOcrLines: (page: number, lines: OcrLine[]) => void;
};

const HISTORY_LIMIT = 25;

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

export function createEditStore(generateId: () => string = () => crypto.randomUUID()) {
  return create<EditStoreState>((set, get) => ({
    document: null,
    history: [],

    checkpoint: () => {
      const { document, history } = get();
      if (!document) return;
      set({ history: [...history, document].slice(-HISTORY_LIMIT) });
    },

    undo: () => {
      const { history } = get();
      if (history.length === 0) return;
      set({ document: history[history.length - 1], history: history.slice(0, -1) });
    },

    loadDocument: (document) => set({ document, history: [] }),

    closeDocument: () => set({ document: null, history: [] }),

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
  }));
}

export const useEditStore = createEditStore();
