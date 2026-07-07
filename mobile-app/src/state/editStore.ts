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
  /** When set, applied in the live overlay and at export (variable-font weight axis). */
  fontWeight?: 'normal' | 'bold';
  /**
   * Optional fixed width, in PDF points. When set, both the live `TextInput` and the exported
   * HTML span render at exactly this width and wrap within it, so live view and export break
   * lines at the same point (OCR-assisted replacements set this to the detected line's width).
   * When absent, the text renders unwrapped on a single line (plus any explicit newlines) -
   * the original Phase 1 behavior for freely-placed new text.
   */
  widthPt?: number;
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

/**
 * A single line of text detected by on-device OCR (`text-recognition` module) on a page's
 * background image, converted to PDF points immediately on detection (via
 * `coordinateMath.ts`'s `imagePxToPt`/`imagePxSizeToPt`) so it lives in the same unit as
 * every other page-content field. Not a user `Edit` - nothing is exported until the user taps
 * a detected line and turns it into a real `MaskEdit`/`TextEdit` pair (see `App.tsx`'s
 * `handleTap`/`handleMaskDrawn`). Purely an assistive, best-effort hint for where existing text
 * is and what it says - OCR on a real scanned document is never assumed correct (spec Section 9's
 * "never assume, warn/fail-safe instead" posture applies here too), so this only ever pre-fills
 * an editable field the user can freely correct before committing anything.
 */
export type OcrLine = {
  id: string;
  text: string;
  /** Top-left X origin, page-relative, in PDF points. */
  xPt: number;
  /** Top-left Y origin, page-relative, in PDF points. */
  yPt: number;
  /** Width, in PDF points. */
  wPt: number;
  /** Height, in PDF points. */
  hPt: number;
};

export type PageState = {
  pageIndex: number;
  /** Page width, in PDF points. */
  widthPt: number;
  /** Page height, in PDF points. */
  heightPt: number;
  /** Local `file://` path to the rendered background image (JPEG) for this page. */
  backgroundImageUri: string;
  /** Rendered background image width, in px. */
  imagePxWidth: number;
  /** Rendered background image height, in px. */
  imagePxHeight: number;
  edits: Edit[];
  /** OCR-detected text lines on this page, populated lazily (see `App.tsx`) - empty until OCR
   * has actually run for this page, not necessarily empty because the page has no text. */
  ocrLines: OcrLine[];
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
  /**
   * Undo history: snapshots of `document` taken by `checkpoint()`, oldest first, capped at
   * `HISTORY_LIMIT`. Snapshots are just references - safe because every mutation in this
   * store replaces objects instead of mutating them. Cleared on load/close since history
   * from another document is meaningless.
   */
  history: DocumentState[];
  /**
   * Pushes the current document onto the undo history. Callers invoke this once before each
   * *user-visible* group of mutations (e.g. a tap-to-replace commits a mask + a text edit +
   * consumes an OCR line - one checkpoint, so one undo reverts all three), rather than the
   * store snapshotting every low-level action, which would make undo stop mid-gesture.
   */
  checkpoint: () => void;
  /** Restores the most recent checkpoint, if any. No-op when history is empty. */
  undo: () => void;
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
  /** Replaces a page's `ocrLines`, e.g. after `text-recognition`'s on-device OCR finishes for
   * that page. Throws if `page` is out of range, matching the other page-scoped actions. */
  setOcrLines: (page: number, lines: OcrLine[]) => void;
};

/** Oldest checkpoints are dropped beyond this - bounds memory on long editing sessions. */
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

/** App-wide edit store singleton, backing `DocumentState`/`PageState`/`Edit` (spec Section 8). */
export const useEditStore = createEditStore();
