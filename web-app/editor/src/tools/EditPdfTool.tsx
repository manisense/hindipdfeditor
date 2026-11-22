import { useLanguage, useTx } from "../lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FileText,
  Files,
  Highlighter,
  ImagePlus,
  Languages,
  Plus,
  RotateCcw,
  Sparkles,
  Type,
  Redo2,
  Search,
  Signature,
  Square,
  Undo2,
} from "lucide-react";

import { AppButton } from "../components/AppButton";
import { AppPopup } from "../components/AppPopup";
import { AppStatus } from "../components/AppStatus";
import { useAppPopup } from "../components/appPopupContext";
import { DropZone } from "../components/DropZone";
import { EditableTextOverlay } from "../components/EditableTextOverlay";
import { EditToolbar } from "../components/EditToolbar";
import { ImageEditOverlay } from "../components/ImageEditOverlay";
import { SignaturePad, type DrawnSignature } from "../components/SignaturePad";
import { FindReplacePanel } from "../components/FindReplacePanel";
import { LegacyFontWarning } from "../components/LegacyFontWarning";
import { MaskOverlay, type DrawnMaskRect } from "../components/MaskOverlay";
import { OcrHighlightLayer } from "../components/OcrHighlightLayer";
import { PdfPageViewer } from "../components/PdfPageViewer";
import { ToolShell } from "../components/ToolShell";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { aiApiClient } from "../lib/aiApiClient";
import { trackToolEvent } from "../lib/analytics";
import {
  editSnapshot,
  hasUnexportedChanges,
  useUnsavedChanges,
} from "../lib/unsavedChanges";
import { ptSizeToImagePx, ptToImagePx } from "../lib/coordinateMath";
import { downloadPdfBlob, exportPdf } from "../lib/exportPdf";
import {
  ensureFontsLoaded,
  type EditFontFamily,
  isSerifFamily,
  measureTextWidthPt,
  normalLineHeightRatio,
} from "../lib/fontAsset";
import type { TranslationDirection } from "@hindipdfeditor/translation-contract";

import { translateOcrLines } from "../lib/geminiTranslate";
import { detectLegacyFonts, isConvertibleLegacyFont } from "../lib/legacyFontDetector";
import { shouldDismissFocusedEdit } from "../lib/editPointerIntent";
import { findInDocument } from "../lib/findReplace";
import { flowIntoParagraph } from "../lib/paragraphFlow";
import { applyPagePlan, newIndexOf, pagePlan, remapDocument, type PageOp } from "../lib/pageOps";
import { PagesPanel } from "../components/PagesPanel";
import { lineReplacementFor } from "../lib/lineReplacement";
import { cleanedRegionPreview } from "../lib/maskPreview";
import {
  type Bilingual,
  exportFailureMessage,
  MAX_EDIT_PAGES,
  openFailureMessage,
  tooManyPagesMessage,
} from "../lib/userMessages";
import { detectTextLines, detectTextLinesWithGemini, onOcrUnavailable } from "../lib/ocr";
import { nextOcrPage } from "../lib/ocrQueue";
import { findOcrTargetAt, findTextEditAt } from "../lib/ocrHitTest";
import {
  getPageCount,
  getPdfBase64,
  getPdfBytes,
  getPageSize,
  renderPage,
  renderThumbnail,
  sampleAverageColor,
  samplePagePaperColor,
  sampleTextColor,
  setPdfBytes,
} from "../lib/pdfToImages";
import { getTool, readEditModeFromLocation, type EditMode } from "../lib/tools";
import { HIGHLIGHT_COLOR, linesOutsideWhiteouts } from "../lib/maskKinds";
import { IMAGE_ACCEPT, ImageImportError, readImageFile, type ImportedImage } from "../lib/imageImport";
import { clampToPage, placeImage, visiblePageCentre } from "../lib/imagePlacement";
import { applyDraft, draftEditCount, draftOf, type Draft } from "../lib/draft";
import { clearDraft, loadDraft, loadDraftPdf, saveDraft } from "../lib/draftStorage";
import {
  detectTranslationDirection,
  isTranslatableEnglishLine,
  isTranslatableHindiLine,
} from "../lib/translationSource";
import { buildTranslationLinesWithContext } from "../lib/translationContext";
import { geometryForTranslatedLine } from "../lib/translateEdits";
import {
  useEditStore,
  type DocumentState,
  type ImageEdit,
  type MaskEdit,
  type OcrLine,
  type PageState,
  type TextEdit,
} from "../state/editStore";
import "./EditPdfTool.css";
import { isBoldWeight, type FontWeight } from "../lib/fontWeight";

const tool = getTool("edit")!;

const UNKNOWN_ENCODING_FONT_NAME = "unknown (font inspection failed)";
const DEFAULT_FONT_SIZE_PT = 14;
/** Browser storage key for the Hindi-typing preference (a per-viewer convenience). */
const ROMAN_TYPING_KEY = "hpe-roman-typing";
const RASTER_SCALE = 2;
const MASK_SAMPLE_MARGIN_PX = 16;
const MASK_EXPAND_PT = 3;
/** Wait after the last change before keeping the draft, in ms. */
const DRAFT_SAVE_DELAY_MS = 800;

/** Date and time a draft was kept, in the UI language. */
function savedAtLabel(savedAt: number, lang: string): string {
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    savedAt,
  );
}

/** Everything a page change replaces, kept so Undo can put it back. */
type PageOpRestore = {
  bytes: Uint8Array;
  document: DocumentState;
  history: DocumentState[];
  ocrStatus: Record<number, "running" | "done" | "failed">;
  currentPageIndex: number;
  pagesChanged: boolean;
};

type OcrStatusByPage = Record<number, "running" | "done" | "failed">;
/** What a replacement took over: its mask, the line it replaced and lines its paragraph flowed into. */
type EditPairing = { maskId?: string; ocrLine?: OcrLine; absorbed?: OcrLine[] };

type Status =
  | { state: "idle" }
  | { state: "opening" }
  | { state: "saving" }
  | { state: "saved"; filename: string }
  | { state: "error"; message: Bilingual };

/** Cleaned-region preview for a replacement mask; undefined keeps the flat-colour fallback. */
async function previewFor(
  page: PageState,
  rect: { xPt: number; yPt: number; wPt: number; hPt: number },
): Promise<string | undefined> {
  try {
    const { x, y } = ptToImagePx(rect.xPt, rect.yPt, page.imagePxWidth, page.widthPt);
    const { wPx, hPx } = ptSizeToImagePx(rect.wPt, rect.hPt, page.imagePxWidth, page.widthPt);
    return await cleanedRegionPreview(page.backgroundImageUri, x, y, wPx, hPx);
  } catch (error) {
    console.warn("Edit preview failed; showing a flat patch", error);
    return undefined;
  }
}

async function detectLegacyFontWarnings(
  pageCount: number,
): Promise<{ page: number; fontName: string }[]> {
  try {
    const base64 = await getPdfBase64();
    return await detectLegacyFonts(base64);
  } catch (error) {
    console.warn(
      "legacyFontDetector failed; treating every page as unknown-encoding (fail closed)",
      error,
    );
    return Array.from({ length: pageCount }, (_, page) => ({
      page,
      fontName: UNKNOWN_ENCODING_FONT_NAME,
    }));
  }
}

export function EditPdfTool() {
  const tx = useTx();
  const { showPopup } = useAppPopup();
  const { lang } = useLanguage();
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [focusedEditId, setFocusedEditId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [signaturePadOpen, setSignaturePadOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectAllEditId, setSelectAllEditId] = useState<string | null>(null);
  const [ocrStatusByPage, setOcrStatusByPage] = useState<OcrStatusByPage>({});
  const ocrAttemptedPagesRef = useRef(new Set<number>());
  const pageImageRequestsRef = useRef(new Map<string, Promise<PageState | undefined>>());
  const ocrPriorityPageRef = useRef(0);
  const ocrRunnerDocRef = useRef<string | null>(null);
  const editPairingsRef = useRef(new Map<string, EditPairing>());
  const dismissOnlyGestureRef = useRef(false);
  const pendingEditRequestRef = useRef(0);
  const [enhancingPage, setEnhancingPage] = useState<number | null>(null);
  const [translating, setTranslating] = useState(false);
  const [aiConsentVisible, setAiConsentVisible] = useState(false);
  const [translationOptionsVisible, setTranslationOptionsVisible] =
    useState(false);
  const [detectedDirection, setDetectedDirection] =
    useState<TranslationDirection | null>(null);
  const [pendingTranslation, setPendingTranslation] = useState<{
    direction: TranslationDirection;
    scope: "page" | "document";
  } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [aiGateMode, setAiGateMode] = useState<"ocr" | "translate">("ocr");
  const aiJobIdRef = useRef(`document-${crypto.randomUUID()}`);
  const [editMode, setEditMode] = useState<EditMode>(() =>
    readEditModeFromLocation(),
  );
  /** Tools that drag a box on the page instead of tapping text. */
  const boxMode = editMode === "erase" || editMode === "highlight" || editMode === "whiteout";
  const [pageZoom, setPageZoom] = useState(1);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [ocrUnavailable, setOcrUnavailable] = useState(false);
  useEffect(() => onOcrUnavailable(() => setOcrUnavailable(true)), []);
  const [romanTyping, setRomanTyping] = useState(() => {
    try {
      return window.localStorage.getItem(ROMAN_TYPING_KEY) === "on";
    } catch {
      return false;
    }
  });
  const changeRomanTyping = (on: boolean) => {
    setRomanTyping(on);
    try {
      window.localStorage.setItem(ROMAN_TYPING_KEY, on ? "on" : "off");
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
  };
  const editPinchStartRef = useRef<{
    fontSizePt: number;
    widthPt?: number;
  } | null>(null);
  const closeDocument = useEditStore((s) => s.closeDocument);

  const document = useEditStore((s) => s.document);
  const [exportedSnapshot, setExportedSnapshot] = useState<string | null>(null);
  /** Draft kept in this browser from an earlier visit, offered for restoring on the open screen. */
  const [keptDraft, setKeptDraft] = useState<Draft | null>(null);
  /** Whether the latest edits are kept in this browser. */
  const [draftKept, setDraftKept] = useState(false);
  /** Document whose draft this visit wrote or restored, so only that draft is ever deleted. */
  const draftDocumentIdRef = useRef<string | null>(null);
  const [discardVisible, setDiscardVisible] = useState(false);
  /** Pages were moved, turned, deleted or added since the last export. */
  const [pagesChanged, setPagesChanged] = useState(false);
  const dirty = hasUnexportedChanges(document, exportedSnapshot) || pagesChanged;
  const [pagesOpen, setPagesOpen] = useState(false);
  const [pageOpBusy, setPageOpBusy] = useState(false);
  const [pageOpStatus, setPageOpStatus] = useState<string | null>(null);
  /**
   * State before each page change, newest last. A page change starts a new edit history; Undo
   * steps back over it once the edits made after it have been undone.
   */
  const pageOpRestoreRef = useRef<PageOpRestore[]>([]);
  const [pageOpUndoCount, setPageOpUndoCount] = useState(0);

  // Offer the draft kept from an earlier visit while no file is open.
  useEffect(() => {
    if (document) return;
    let cancelled = false;
    void loadDraft().then((draft) => {
      if (!cancelled) setKeptDraft(draft);
    });
    return () => {
      cancelled = true;
    };
  }, [document]);

  // Keep unexported edits in this browser, shortly after each change; drop the draft once the
  // edits are exported.
  useEffect(() => {
    if (!document) return;
    if (!dirty) {
      if (draftDocumentIdRef.current === document.id) {
        draftDocumentIdRef.current = null;
        setDraftKept(false);
        void clearDraft();
      }
      return;
    }
    setDraftKept(false);
    const timer = window.setTimeout(() => {
      const bytes = getPdfBytes();
      if (!bytes) return;
      const draft = draftOf(
        document,
        (pageIndex) => ocrStatusByPage[pageIndex] === "done",
        editPairingsRef.current,
        Date.now(),
      );
      draftDocumentIdRef.current = document.id;
      void saveDraft(draft, bytes).then(setDraftKept);
    }, DRAFT_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [document, dirty, ocrStatusByPage]);
  useUnsavedChanges(
    dirty || status.state === "saving" || translating || enhancingPage !== null,
  );
  const loadDocument = useEditStore((s) => s.loadDocument);
  const addTextEdit = useEditStore((s) => s.addTextEdit);
  const addMaskEdit = useEditStore((s) => s.addMaskEdit);
  const addImageEdit = useEditStore((s) => s.addImageEdit);
  const updateImageEdit = useEditStore((s) => s.updateImageEdit);
  const updateTextEdit = useEditStore((s) => s.updateTextEdit);
  const updateMaskEdit = useEditStore((s) => s.updateMaskEdit);
  const removeEdit = useEditStore((s) => s.removeEdit);
  const setOcrLines = useEditStore((s) => s.setOcrLines);
  const setPageImage = useEditStore((s) => s.setPageImage);
  const checkpoint = useEditStore((s) => s.checkpoint);
  const undo = useEditStore((s) => s.undo);
  const redo = useEditStore((s) => s.redo);
  const canUndoEdit = useEditStore((s) => s.history.length > 0);
  const canRedo = useEditStore((s) => s.future.length > 0);

  useEffect(() => {
    ensureFontsLoaded();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      const inTextField =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || /^(TEXTAREA|INPUT)$/.test(event.target.tagName));
      if (command && !inTextField && /^[zy]$/i.test(event.key)) {
        // Outside text fields: Cmd/Ctrl+Z undoes edits, Shift+Cmd/Ctrl+Z or Ctrl+Y redoes.
        // Inside a field the browser's own text undo applies.
        event.preventDefault();
        pendingEditRequestRef.current += 1;
        setFocusedEditId(null);
        if (event.key.toLowerCase() === "y" || event.shiftKey) useEditStore.getState().redo();
        else handleUndoRef.current();
        return;
      }
      if (event.key !== "Escape") return;
      setSelectedImageId(null);
      pendingEditRequestRef.current += 1;
      dismissOnlyGestureRef.current = false;
      setFocusedEditId(null);
      setEditMode("edit");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const exitToolMode = () => {
    pendingEditRequestRef.current += 1;
    dismissOnlyGestureRef.current = false;
    setFocusedEditId(null);
    setEditMode("edit");
  };

  const openPdfFile = async (file: File, restore?: Draft) => {
    pendingEditRequestRef.current += 1;
    setStatus({ state: "opening" });
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setPdfBytes(bytes);

      const pageCount = await getPageCount();
      if (pageCount > MAX_EDIT_PAGES) {
        setStatus({ state: "error", message: tooManyPagesMessage(pageCount) });
        return;
      }
      // Pages are laid out from their sizes; each page's image is rendered when it is first
      // needed (see ensurePageImage). Only the first page is rendered before the editor opens.
      const pages: PageState[] = [];
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const size = await getPageSize(pageIndex, RASTER_SCALE);
        pages.push({
          pageIndex,
          widthPt: size.pxWidth / RASTER_SCALE,
          heightPt: size.pxHeight / RASTER_SCALE,
          backgroundImageUri: "",
          imagePxWidth: size.pxWidth,
          imagePxHeight: size.pxHeight,
          edits: [],
          ocrLines: [],
        });
      }
      pages[0] = { ...pages[0], backgroundImageUri: (await renderPage(0, RASTER_SCALE)).uri };

      const legacyFontWarnings = await detectLegacyFontWarnings(pageCount);
      const restored = restore ? applyDraft(pages, restore) : null;
      if (restore && !restored) throw new Error("The kept draft does not match its PDF");
      const newDocument: DocumentState = {
        id: restore?.documentId ?? crypto.randomUUID(),
        sourceName: file.name,
        pageCount,
        pages: restored?.pages ?? pages,
        legacyFontWarnings,
      };
      loadDocument(newDocument);
      // A restored draft opens on its first edited page.
      const startPage = Math.max(0, newDocument.pages.findIndex((p) => p.edits.length > 0));
      if (startPage > 0) void ensurePageImage(newDocument, startPage);
      setCurrentPageIndex(startPage);
      setFocusedEditId(null);
      setSelectAllEditId(null);
      ocrAttemptedPagesRef.current.clear();
      pageImageRequestsRef.current.clear();
      aiJobIdRef.current = `document-${crypto.randomUUID()}`;
      editPairingsRef.current = new Map(restore?.pairings ?? []);
      for (const pageIndex of restored?.detectedPages ?? []) ocrAttemptedPagesRef.current.add(pageIndex);
      setOcrStatusByPage(
        Object.fromEntries((restored?.detectedPages ?? []).map((pageIndex) => [pageIndex, "done" as const])),
      );
      draftDocumentIdRef.current = restore ? newDocument.id : null;
      pageOpRestoreRef.current = [];
      setPageOpUndoCount(0);
      setPagesChanged(false);
      setPageOpStatus(null);
      setKeptDraft(null);
      setDraftKept(Boolean(restore));
      setEditMode(readEditModeFromLocation());
      ocrPriorityPageRef.current = startPage;
      void runOcrQueue(newDocument);
      setStatus({ state: "idle" });
      trackToolEvent("pdf_open_success", "edit");
    } catch (error) {
      console.error("Opening the PDF failed", error);
      setStatus({
        state: "error",
        message: openFailureMessage(error),
      });
    }
  };

  const page = document?.pages[currentPageIndex];
  const focusedEdit =
    page?.edits.find(
      (e): e is TextEdit => e.type === "text" && e.id === focusedEditId,
    ) ?? null;

  const currentPageLegacyFontNames = useMemo(
    () => [
      ...new Set(
        (document?.legacyFontWarnings ?? [])
          .filter((w) => w.page === currentPageIndex)
          .map((w) => w.fontName),
      ),
    ],
    [document?.legacyFontWarnings, currentPageIndex],
  );
  const blockingLegacyFontNames = currentPageLegacyFontNames.filter(
    (name) => !isConvertibleLegacyFont(name),
  );
  const editingBlocked = blockingLegacyFontNames.length > 0;
  const convertedLegacyPage =
    !editingBlocked && currentPageLegacyFontNames.length > 0;

  /**
   * The page with its background image, rendering it on first use. Resolves undefined when a
   * different document was opened meanwhile.
   */
  const ensurePageImage = (
    doc: DocumentState,
    pageIndex: number,
  ): Promise<PageState | undefined> => {
    const live = useEditStore.getState().document;
    const livePage = live?.id === doc.id ? live.pages[pageIndex] : undefined;
    if (!livePage) return Promise.resolve(undefined);
    if (livePage.backgroundImageUri) return Promise.resolve(livePage);
    const key = `${doc.id}:${pageIndex}`;
    const pending = pageImageRequestsRef.current.get(key);
    if (pending) return pending;
    const request = renderPage(pageIndex, RASTER_SCALE)
      .then((image) => {
        if (useEditStore.getState().document?.id !== doc.id) return undefined;
        setPageImage(pageIndex, image.uri);
        return useEditStore.getState().document?.pages[pageIndex];
      })
      .finally(() => pageImageRequestsRef.current.delete(key));
    pageImageRequestsRef.current.set(key, request);
    return request;
  };

  const ensureOcrForPage = (
    doc: DocumentState,
    pageIndex: number,
  ): Promise<void> => {
    const pageState = doc.pages[pageIndex];
    const pageWarnings = doc.legacyFontWarnings.filter((w) => w.page === pageIndex);
    if (
      !pageState ||
      pageWarnings.some((w) => !isConvertibleLegacyFont(w.fontName)) ||
      ocrAttemptedPagesRef.current.has(pageIndex)
    ) {
      return Promise.resolve();
    }
    ocrAttemptedPagesRef.current.add(pageIndex);

    setOcrStatusByPage((s) => ({ ...s, [pageIndex]: "running" }));
    // KrutiDev-family pages are converted to Unicode, then checked against OCR like any page.
    return ensurePageImage(doc, pageIndex)
      .then((rendered) => {
        if (!rendered) throw new Error("document closed");
        return detectTextLines(rendered, { convertLegacy: pageWarnings.length > 0 });
      })
      .then((lines) => {
        if (useEditStore.getState().document?.id !== doc.id)
          return;
        setOcrLines(pageIndex, lines);
        setOcrStatusByPage((s) => ({ ...s, [pageIndex]: "done" }));
      })
      .catch((error) => {
        console.warn(`OCR failed on page ${pageIndex}`, error);
        if (useEditStore.getState().document?.id !== doc.id)
          return;
        setOcrStatusByPage((s) => ({ ...s, [pageIndex]: "failed" }));
      });
  };

  // One page at a time, the page on screen first (see nextOcrPage): Hindi pages are checked with
  // OCR, and queuing pages as they were passed made the page on screen wait behind all of them.
  const runOcrQueue = async (doc: DocumentState) => {
    if (ocrRunnerDocRef.current === doc.id) return;
    ocrRunnerDocRef.current = doc.id;
    const blocked = (pageIndex: number) =>
      doc.legacyFontWarnings.some((w) => w.page === pageIndex && !isConvertibleLegacyFont(w.fontName));
    try {
      while (useEditStore.getState().document?.id === doc.id) {
        const next = nextOcrPage(
          doc.pages.length,
          ocrPriorityPageRef.current,
          (pageIndex) => !ocrAttemptedPagesRef.current.has(pageIndex) && !blocked(pageIndex),
        );
        if (next === null) return;
        await ensureOcrForPage(doc, next);
      }
    } finally {
      if (ocrRunnerDocRef.current === doc.id) ocrRunnerDocRef.current = null;
    }
  };

  const goToPage = (index: number) => {
    if (!document || index < 0 || index >= document.pages.length) return;
    pendingEditRequestRef.current += 1;
    dismissOnlyGestureRef.current = false;
    setCurrentPageIndex(index);
    setFocusedEditId(null);
    ocrPriorityPageRef.current = index;
    void runOcrQueue(document);
    // Ready the next page before it is opened.
    if (index + 1 < document.pages.length) void ensurePageImage(document, index + 1).catch(() => undefined);
  };

  const countMatches = (query: string): number => {
    const doc = useEditStore.getState().document;
    if (!doc) return 0;
    const found = findInDocument(doc.pages, query, query);
    return found.lines.length + found.edits.length;
  };

  /** Replaces every occurrence across the document as one undo step; returns places changed. */
  const replaceAll = async (query: string, replacement: string): Promise<number> => {
    const doc = useEditStore.getState().document;
    if (!doc) return 0;
    const found = findInDocument(doc.pages, query, replacement);
    if (found.lines.length + found.edits.length === 0) return 0;
    setFocusedEditId(null);
    checkpoint();
    const requestId = ++pendingEditRequestRef.current;
    for (const match of found.edits) {
      updateTextEdit(match.pageIndex, match.edit.id, { text: match.newText });
    }
    for (const match of found.lines) {
      const pageState = useEditStore.getState().document?.pages[match.pageIndex];
      if (!pageState) continue;
      const { rect, text } = await lineReplacementFor(pageState, match.line);
      await maskAndReplaceRegion(rect, { ...text, prefill: match.newText }, match.line, requestId, {
        pageIndex: match.pageIndex,
        batch: true,
      });
    }
    return found.lines.length + found.edits.length;
  };

  const handleRedo = () => {
    pendingEditRequestRef.current += 1;
    dismissOnlyGestureRef.current = false;
    setFocusedEditId(null);
    redo();
  };

  /** Puts back the state before the latest page change; false when there is none. */
  const undoPageOp = (): boolean => {
    const restore = pageOpRestoreRef.current.pop();
    if (!restore) return false;
    setPageOpUndoCount(pageOpRestoreRef.current.length);
    setPdfBytes(restore.bytes);
    pageImageRequestsRef.current.clear();
    // Pages being read when the change was made are read again.
    const ocrStatus = Object.fromEntries(
      Object.entries(restore.ocrStatus).filter(([, status]) => status !== "running"),
    ) as OcrStatusByPage;
    ocrAttemptedPagesRef.current = new Set(Object.keys(ocrStatus).map(Number));
    setOcrStatusByPage(ocrStatus);
    useEditStore.setState({ document: restore.document, history: restore.history, future: [] });
    setPagesChanged(restore.pagesChanged);
    setCurrentPageIndex(restore.currentPageIndex);
    ocrPriorityPageRef.current = restore.currentPageIndex;
    void ensurePageImage(restore.document, restore.currentPageIndex);
    void runOcrQueue(restore.document);
    setPageOpStatus(null);
    return true;
  };

  const handleUndo = () => {
    pendingEditRequestRef.current += 1;
    dismissOnlyGestureRef.current = false;
    setFocusedEditId(null);
    if (useEditStore.getState().history.length === 0 && undoPageOp()) return;
    undo();
  };
  const handleUndoRef = useRef(handleUndo);
  handleUndoRef.current = handleUndo;

  const applyPageOp = async (op: PageOp) => {
    const state = useEditStore.getState();
    const doc = state.document;
    const bytes = getPdfBytes();
    if (!doc || !bytes || pageOpBusy) return;
    setPageOpBusy(true);
    pendingEditRequestRef.current += 1;
    setFocusedEditId(null);
    setSelectedImageId(null);
    try {
      const plan = pagePlan(op, doc.pages.length);
      const newBytes = await applyPagePlan(bytes, plan);
      if (useEditStore.getState().document?.id !== doc.id) return;
      pageOpRestoreRef.current.push({
        bytes,
        document: doc,
        history: state.history,
        ocrStatus: ocrStatusByPage,
        currentPageIndex,
        pagesChanged,
      });
      setPageOpUndoCount(pageOpRestoreRef.current.length);
      const next = remapDocument(doc, plan, crypto.randomUUID(), RASTER_SCALE);
      setPdfBytes(newBytes);
      pageImageRequestsRef.current.clear();
      // Pages read before keep their result; turned, new and half-read pages are read again.
      const ocrStatus: OcrStatusByPage = {};
      plan.forEach((entry, index) => {
        const status = entry.from === null || entry.rotate !== 0 ? undefined : ocrStatusByPage[entry.from];
        if (status === "done" || status === "failed") ocrStatus[index] = status;
      });
      ocrAttemptedPagesRef.current = new Set(Object.keys(ocrStatus).map(Number));
      setOcrStatusByPage(ocrStatus);
      useEditStore.setState({ document: next, history: [], future: [] });
      setPagesChanged(true);
      const shown =
        op.kind === "insertBlank"
          ? op.after + 1
          : (newIndexOf(plan, currentPageIndex) ?? Math.min(currentPageIndex, next.pages.length - 1));
      setCurrentPageIndex(shown);
      ocrPriorityPageRef.current = shown;
      void ensurePageImage(next, shown);
      void runOcrQueue(next);
      const n = (index: number) => index + 1;
      setPageOpStatus(
        op.kind === "delete"
          ? tx(`Page ${n(op.index)} deleted. Undo brings it back.`, `पेज ${n(op.index)} हटाया गया। पहले जैसा करें से वापस आएगा।`)
          : op.kind === "move"
            ? tx(`Page ${n(op.from)} is now page ${n(op.to)}.`, `पेज ${n(op.from)} अब पेज ${n(op.to)} है।`)
            : op.kind === "rotate"
              ? tx(`Page ${n(op.index)} turned.`, `पेज ${n(op.index)} घुमाया गया।`)
              : tx(`Blank page added as page ${n(op.after + 1)}.`, `खाली पेज ${n(op.after + 1)} के रूप में जोड़ा गया।`),
      );
    } catch (error) {
      console.error("Page change failed", error);
      await showPopup({
        title: tx("Couldn't change the pages", "पेज नहीं बदले जा सके"),
        message: tx("This PDF's pages could not be changed. Your edits are unchanged.", "इस पीडीएफ के पेज नहीं बदले जा सके। आपके बदलाव जैसे थे वैसे हैं।"),
        tone: "error",
      });
    } finally {
      setPageOpBusy(false);
    }
  };

  const handleEditDone = () => setFocusedEditId(null);

  const handleEditPinchStart = (editId: string) => {
    const edit = page?.edits.find(
      (e): e is TextEdit => e.type === "text" && e.id === editId,
    );
    if (!edit) return;
    checkpoint();
    editPinchStartRef.current = {
      fontSizePt: edit.fontSizePt,
      widthPt: edit.widthPt,
    };
  };

  const handleEditPinchResize = (editId: string, scale: number) => {
    const start = editPinchStartRef.current;
    if (!start) return;
    const fontSizePt = Math.min(72, Math.max(6, start.fontSizePt * scale));
    updateTextEdit(currentPageIndex, editId, {
      fontSizePt,
      ...(start.widthPt !== undefined
        ? { widthPt: start.widthPt * scale }
        : {}),
    });
  };

  const handleEditPinchEnd = () => {
    editPinchStartRef.current = null;
  };

  const selectEditMode = (mode: EditMode) => {
    pendingEditRequestRef.current += 1;
    dismissOnlyGestureRef.current = false;
    setEditMode(mode);
    setFocusedEditId(null);
  };

  const runEnhanceWithAi = async () => {
    if (!document || !page || editingBlocked || enhancingPage !== null) return;
    const pageIndex = currentPageIndex;
    const documentId = document.id;
    setEnhancingPage(pageIndex);
    try {
      const lines = await detectTextLinesWithGemini(
        page,
        aiJobIdRef.current,
        pageIndex,
      );
      if (useEditStore.getState().document?.id !== documentId) return;
      setOcrLines(pageIndex, lines);
      setOcrStatusByPage((s) => ({ ...s, [pageIndex]: "done" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await showPopup({
        title: tx(
          "Enhancement couldn’t finish",
          "AI टेक्स्ट पहचान पूरी नहीं हो पाई",
        ),
        message,
        tone: "error",
        eyebrow: tx("AI text detection", "AI टेक्स्ट पहचान"),
        actionLabel: tx("Back to editor", "एडिटर पर वापस"),
      });
    } finally {
      setEnhancingPage(null);
    }
  };

  const handleEnhancePressed = () => {
    setAiGateMode("ocr");
    setPendingTranslation(null);
    setTurnstileToken(null);
    setAiConsentVisible(true);
  };

  const handleTranslatePressed = () => {
    const doc = useEditStore.getState().document;
    if (!doc) return;
    const pageTexts = doc.pages.flatMap((pageState) =>
      pageState.ocrLines.map((line) => line.text),
    );
    // Prefer the current page when it already has detections; otherwise use the whole doc.
    const currentTexts =
      doc.pages[currentPageIndex]?.ocrLines.map((line) => line.text) ?? [];
    const direction =
      detectTranslationDirection(currentTexts) ??
      detectTranslationDirection(pageTexts);
    setDetectedDirection(direction);
    setTranslationOptionsVisible(true);
  };

  const queueTranslation = (scope: "page" | "document") => {
    if (!detectedDirection) return;
    setTranslationOptionsVisible(false);
    setPendingTranslation({ direction: detectedDirection, scope });
    setAiGateMode("translate");
    setTurnstileToken(null);
    setAiConsentVisible(true);
  };

  const runTranslation = async (
    direction: TranslationDirection,
    scope: "page" | "document",
  ) => {
    const doc = useEditStore.getState().document;
    if (!doc || translating || enhancingPage !== null) return;
    setTranslating(true);
    try {
      checkpoint();
      let translatedCount = 0;
      const legacyPages = new Set(
        doc.legacyFontWarnings.map((warning) => warning.page),
      );
      const pageIndexes =
        scope === "page"
          ? [currentPageIndex]
          : Array.from({ length: doc.pages.length }, (_, index) => index);

      for (const pageIndex of pageIndexes) {
        const pageState = await ensurePageImage(doc, pageIndex);
        if (!pageState) continue;
        const forceOcr = legacyPages.has(pageIndex);

        let lines = pageState.ocrLines;
        if (lines.length === 0 || forceOcr) {
          try {
            lines = await detectTextLines(pageState, { forceOcr });
            if (
              useEditStore.getState().document?.id !== doc.id
            ) {
              return;
            }
            setOcrLines(pageIndex, lines);
            setOcrStatusByPage((s) => ({ ...s, [pageIndex]: "done" }));
          } catch (error) {
            console.warn(
              `Text detection failed on page ${pageIndex} during translate`,
              error,
            );
            setOcrStatusByPage((s) => ({ ...s, [pageIndex]: "failed" }));
            continue;
          }
        }

        const needsHighAccuracyOcr =
          forceOcr ||
          lines.length === 0 ||
          lines.some((line) => line.source === "embedded-degraded");
        if (needsHighAccuracyOcr) {
          try {
            lines = await detectTextLinesWithGemini(
              pageState,
              aiJobIdRef.current,
              pageIndex,
            );
            if (
              useEditStore.getState().document?.id !== doc.id
            ) {
              return;
            }
            setOcrLines(pageIndex, lines);
            setOcrStatusByPage((s) => ({ ...s, [pageIndex]: "done" }));
          } catch (error) {
            console.warn(
              `High-accuracy OCR failed on page ${pageIndex} during translate`,
              error,
            );
            setOcrStatusByPage((s) => ({ ...s, [pageIndex]: "failed" }));
            continue;
          }
        }

        const sourceLines = lines.filter((line) =>
          direction === "hi-en"
            ? isTranslatableHindiLine(line.text)
            : isTranslatableEnglishLine(line.text),
        );
        if (sourceLines.length === 0) continue;

        const translatedById = await translateOcrLines(
          aiJobIdRef.current,
          direction,
          buildTranslationLinesWithContext(pageIndex, lines, sourceLines),
        );
        if (useEditStore.getState().document?.id !== doc.id) {
          return;
        }

        let paperColor = "#ffffff";
        try {
          paperColor = await samplePagePaperColor(
            pageState.backgroundImageUri,
            pageState.imagePxWidth,
            pageState.imagePxHeight,
          );
        } catch {
          /* keep white */
        }

        const consumedIds = new Set<string>();
        for (const line of sourceLines) {
          const translated = translatedById.get(line.id)?.trim();
          if (!translated) continue;
          const geo = geometryForTranslatedLine(
            line,
            pageState.widthPt,
            pageState.heightPt,
            translated,
          );
          const { x: sampleXPx, y: sampleYPx } = ptToImagePx(
            line.xPt,
            line.yPt,
            pageState.imagePxWidth,
            pageState.widthPt,
          );
          const { wPx: sampleWPx, hPx: sampleHPx } = ptSizeToImagePx(
            line.wPt,
            line.hPt,
            pageState.imagePxWidth,
            pageState.widthPt,
          );
          let textColor = "#111111";
          let maskColor = paperColor;
          try {
            textColor = await sampleTextColor(
              pageState.backgroundImageUri,
              Math.round(sampleXPx),
              Math.round(sampleYPx),
              Math.round(sampleWPx),
              Math.round(sampleHPx),
            );
          } catch {
            /* keep black */
          }
          try {
            maskColor = await sampleAverageColor(
              pageState.backgroundImageUri,
              Math.round(sampleXPx),
              Math.round(sampleYPx),
              Math.round(sampleWPx),
              Math.round(sampleHPx),
              MASK_SAMPLE_MARGIN_PX,
            );
          } catch {
            /* keep page-level fallback */
          }

          const maskEdit = addMaskEdit(pageIndex, {
            ...geo.mask,
            color: maskColor,
            kind: "replace",
            previewUri: await previewFor(pageState, geo.mask),
          });
          const textEdit = addTextEdit(pageIndex, {
            xPt: geo.text.xPt,
            yPt: geo.text.yPt,
            fontSizePt: geo.text.fontSizePt,
            text: translated,
            color: textColor,
            fontFamily: "NotoSansDevanagari",
            fontWeight: geo.text.fontWeight,
            widthPt: geo.text.widthPt,
          });
          editPairingsRef.current.set(textEdit.id, {
            maskId: maskEdit.id,
            ocrLine: line,
          });
          consumedIds.add(line.id);
          translatedCount += 1;
        }
        setOcrLines(
          pageIndex,
          lines.filter((line) => !consumedIds.has(line.id)),
        );
      }

      if (translatedCount === 0) {
        const sourceLabel =
          direction === "hi-en" ? "Hindi (Devanagari)" : "English";
        await showPopup({
          title: tx("No source text found", "अनुवाद के लिए टेक्स्ट नहीं मिला"),
          message: tx(
            `No ${sourceLabel} text was found to translate. Try Enhance with AI on scanned pages, then translate again.`,
            'अनुवाद के लिए टेक्स्ट नहीं मिला। स्कैन पेजों पर पहले "Enhance with AI" आज़माएं, फिर दोबारा अनुवाद करें।',
          ),
          tone: "warning",
          eyebrow: tx("Translation check", "अनुवाद जांच"),
          actionLabel: tx("Back to editor", "एडिटर पर वापस"),
        });
        return;
      }
      const targetLabel = direction === "hi-en" ? "English" : "Hindi";
      await showPopup({
        title: tx("Translation complete", "अनुवाद पूरा हुआ"),
        message: tx(
          `Replaced ${translatedCount} line${translatedCount === 1 ? "" : "s"} with ${targetLabel}. Review the overlays, then download the edited PDF.`,
          `${translatedCount} लाइनें ${direction === "hi-en" ? "अंग्रेजी" : "हिंदी"} में बदली गईं। बदलाव जांचें, फिर एडिट की हुई पीडीएफ डाउनलोड करें।`,
        ),
        tone: "success",
        eyebrow: tx("Ready to review", "जांच के लिए तैयार"),
        actionLabel: tx("Review edits", "बदलाव देखें"),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await showPopup({
        title: tx("Translation couldn’t finish", "अनुवाद पूरा नहीं हो पाया"),
        message,
        tone: "error",
        eyebrow: tx("Translation failed", "अनुवाद विफल"),
        actionLabel: tx("Back to editor", "एडिटर पर वापस"),
      });
    } finally {
      setTranslating(false);
    }
  };

  const confirmAiOcr = () => {
    if (!turnstileToken) return;
    aiApiClient.setTurnstileTokenProvider(() => turnstileToken);
    setAiConsentVisible(false);
    if (aiGateMode === "translate" && pendingTranslation) {
      const { direction, scope } = pendingTranslation;
      setPendingTranslation(null);
      void runTranslation(direction, scope);
      return;
    }
    void runEnhanceWithAi();
  };

  const maskAndReplaceRegion = async (
    rect: { xPt: number; yPt: number; wPt: number; hPt: number },
    text: {
      xPt: number;
      yPt: number;
      prefill: string;
      fontSizePt: number;
      widthPt?: number;
      color?: string;
      fontFamily?: EditFontFamily;
      fontWeight?: FontWeight;
      fontStyle?: "italic";
      strokeEm?: number;
    },
    consumedOcrLine?: OcrLine,
    requestId = ++pendingEditRequestRef.current,
    options: { pageIndex?: number; batch?: boolean } = {},
  ) => {
    const targetPageIndex = options.pageIndex ?? currentPageIndex;
    const page = useEditStore.getState().document?.pages[targetPageIndex];
    if (!page || !document) return;
    const targetDocumentId = document.id;

    const maskRect = {
      xPt: Math.max(0, rect.xPt - MASK_EXPAND_PT),
      yPt: Math.max(0, rect.yPt - MASK_EXPAND_PT),
      wPt:
        Math.min(page.widthPt, rect.xPt + rect.wPt + MASK_EXPAND_PT) -
        Math.max(0, rect.xPt - MASK_EXPAND_PT),
      hPt:
        Math.min(page.heightPt, rect.yPt + rect.hPt + MASK_EXPAND_PT) -
        Math.max(0, rect.yPt - MASK_EXPAND_PT),
    };

    const { x: xPx, y: yPx } = ptToImagePx(
      maskRect.xPt,
      maskRect.yPt,
      page.imagePxWidth,
      page.widthPt,
    );
    const { wPx, hPx } = ptSizeToImagePx(
      maskRect.wPt,
      maskRect.hPt,
      page.imagePxWidth,
      page.widthPt,
    );

    let color = "#ffffff";
    try {
      color = await sampleAverageColor(
        page.backgroundImageUri,
        Math.round(xPx),
        Math.round(yPx),
        Math.round(wPx),
        Math.round(hPx),
        MASK_SAMPLE_MARGIN_PX,
      );
    } catch (error) {
      console.warn("sampleAverageColor failed, falling back to white", error);
    }
    const previewUri = await previewFor(page, maskRect);

    const currentDocument = useEditStore.getState().document;
    const currentPage = currentDocument?.pages[targetPageIndex];
    if (
      requestId !== pendingEditRequestRef.current ||
      currentDocument?.id !== targetDocumentId ||
      !currentPage
    ) {
      return;
    }

    if (!options.batch) checkpoint();
    if (consumedOcrLine) {
      setOcrLines(
        targetPageIndex,
        currentPage.ocrLines.filter((line) => line.id !== consumedOcrLine.id),
      );
    }

    const maskEdit = addMaskEdit(targetPageIndex, {
      xPt: maskRect.xPt,
      yPt: maskRect.yPt,
      wPt: maskRect.wPt,
      hPt: maskRect.hPt,
      color,
      kind: "replace",
      previewUri,
    });

    const textEdit = addTextEdit(targetPageIndex, {
      xPt: text.xPt,
      yPt: text.yPt,
      fontSizePt: text.fontSizePt,
      text: text.prefill,
      color: text.color ?? "#111111",
      fontFamily: text.fontFamily ?? "NotoSansDevanagari",
      ...(text.fontWeight ? { fontWeight: text.fontWeight } : {}),
      ...(text.fontStyle ? { fontStyle: text.fontStyle } : {}),
      ...(text.strokeEm ? { strokeEm: text.strokeEm } : {}),
      ...(text.widthPt !== undefined ? { widthPt: text.widthPt } : {}),
      maskId: maskEdit.id,
      ...(consumedOcrLine
        ? {
            original: {
              text: consumedOcrLine.text,
              xPt: consumedOcrLine.xPt,
              wPt: consumedOcrLine.wPt,
              editXPt: text.xPt,
              fontSizePt: text.fontSizePt,
            },
          }
        : {}),
    });
    editPairingsRef.current.set(textEdit.id, {
      maskId: maskEdit.id,
      ocrLine: consumedOcrLine,
    });
    if (options.batch) return;
    setFocusedEditId(textEdit.id);
    if (consumedOcrLine) setSelectAllEditId(textEdit.id);
  };

  /**
   * Updates an edit's text and, for a replaced line, lets it flow into the rest of its paragraph
   * when it no longer fits (see flowIntoParagraph).
   */
  const handleEditTextChange = (editId: string, text: string) => {
    const pageIndex = currentPageIndex;
    updateTextEdit(pageIndex, editId, { text });
    const pageState = useEditStore.getState().document?.pages[pageIndex];
    const edit = pageState?.edits.find((e): e is TextEdit => e.type === "text" && e.id === editId);
    const pairing = editPairingsRef.current.get(editId);
    if (!pageState || !edit || !pairing?.ocrLine || !pairing.maskId) return;
    const measure = (run: string) =>
      measureTextWidthPt(run, edit.fontFamily, edit.fontWeight ?? "normal", edit.fontSizePt);
    const covered = [pairing.ocrLine, ...(pairing.absorbed ?? [])];
    const flow = flowIntoParagraph(edit.text, edit.xPt, covered, pageState.ocrLines, measure);
    if (!flow) return;
    const takenIds = new Set(flow.absorbed.map((line) => line.id));
    setOcrLines(pageIndex, pageState.ocrLines.filter((line) => !takenIds.has(line.id)));
    updateMaskEdit(pageIndex, pairing.maskId, flow.rect);
    const previousLineHeight = edit.lineHeightPt;
    // Word-level redrawing no longer applies once the text spans several lines.
    updateTextEdit(pageIndex, editId, {
      text: flow.text,
      widthPt: flow.widthPt,
      lineHeightPt: flow.lineHeightPt,
      original: undefined,
    });
    editPairingsRef.current.set(editId, { ...pairing, absorbed: [...(pairing.absorbed ?? []), ...flow.absorbed] });
    // An explicit line height adds half its extra leading above the first line: move the box up
    // by the change in that, so the first line stays on its original baseline.
    void normalLineHeightRatio(edit.fontFamily, edit.fontWeight ?? "normal", edit.fontStyle, edit.text).then((ratio) => {
      if (ratio === undefined) return;
      const live = useEditStore.getState().document?.pages[pageIndex]?.edits.find((e) => e.id === editId);
      if (!live || live.type !== "text" || live.lineHeightPt !== flow.lineHeightPt) return;
      const halfLeading = (lineHeightPt: number | undefined) =>
        lineHeightPt === undefined ? 0 : (lineHeightPt - ratio * edit.fontSizePt) / 2;
      const shift = halfLeading(flow.lineHeightPt) - halfLeading(previousLineHeight);
      if (shift !== 0) updateTextEdit(pageIndex, editId, { yPt: live.yPt - shift });
    });
  };

  const removeEditGroup = (id: string) => {
    const pairing = editPairingsRef.current.get(id);
    checkpoint();
    removeEdit(currentPageIndex, id);
    if (pairing?.maskId) removeEdit(currentPageIndex, pairing.maskId);
    if (pairing?.ocrLine && page) {
      setOcrLines(currentPageIndex, [...page.ocrLines, pairing.ocrLine, ...(pairing.absorbed ?? [])]);
    }
    editPairingsRef.current.delete(id);
    if (focusedEditId === id) setFocusedEditId(null);
  };

  const handleTap = async (xPt: number, yPt: number) => {
    setSelectedImageId(null);
    if (editingBlocked || boxMode) return;
    if (!page) return;
    const requestId = ++pendingEditRequestRef.current;

    // `blur` fires before `click`, so React may already report no focused edit here.
    // Pointer-down capture preserves that this gesture began as a dismiss-only click.
    // Keep the flag until the next pointer-down so touchend + synthetic click are both ignored.
    if (dismissOnlyGestureRef.current) {
      setFocusedEditId(null);
      return;
    }

    const textEdits = page.edits.filter(
      (e): e is TextEdit => e.type === "text",
    );
    const hitEdit = findTextEditAt(textEdits, xPt, yPt);

    if (focusedEditId) {
      if (hitEdit?.id === focusedEditId) return;
      // Clicking outside the active line only exits edit mode for that line.
      // Do not start editing a nearby OCR/text hit on the same click.
      setFocusedEditId(null);
      return;
    }

    if (hitEdit) {
      setFocusedEditId(hitEdit.id);
      return;
    }

    const hitLine = findOcrTargetAt(linesOutsideWhiteouts(page.ocrLines, page.edits), xPt, yPt);
    if (hitLine) {
      const { rect, text } = await lineReplacementFor(page, hitLine);
      await maskAndReplaceRegion(rect, { ...text, prefill: hitLine.text }, hitLine, requestId);
      return;
    }

    if (editMode !== "addText") {
      // Empty click in Edit mode exits any transient tool state.
      if (editMode !== "edit") setEditMode("edit");
      return;
    }
    if (ocrStatusByPage[currentPageIndex] === "running") return;

    checkpoint();
    const edit = addTextEdit(currentPageIndex, {
      xPt,
      yPt,
      fontSizePt: DEFAULT_FONT_SIZE_PT,
      text: "",
      color: "#111111",
      fontFamily: "NotoSansDevanagari",
    });
    setFocusedEditId(edit.id);
  };

  const handleBlur = (id: string, text: string) => {
    if (text.trim().length === 0) {
      const pairing = editPairingsRef.current.get(id);
      if (pairing?.ocrLine) {
        removeEditGroup(id);
        return;
      }
      removeEdit(currentPageIndex, id);
    }
    if (focusedEditId === id) setFocusedEditId(null);
  };

  /** Adds a whiteout (filled with the surrounding paper colour) or a highlight over `rect`. */
  const addBoxMark = async (rect: DrawnMaskRect, kind: "whiteout" | "highlight") => {
    if (!page || !document) return;
    const requestId = ++pendingEditRequestRef.current;
    const pageIndex = currentPageIndex;
    const documentId = document.id;
    let color = HIGHLIGHT_COLOR;
    if (kind === "whiteout") {
      color = "#ffffff";
      const { x, y } = ptToImagePx(rect.xPt, rect.yPt, page.imagePxWidth, page.widthPt);
      const { wPx, hPx } = ptSizeToImagePx(rect.wPt, rect.hPt, page.imagePxWidth, page.widthPt);
      try {
        color = await sampleAverageColor(
          page.backgroundImageUri,
          Math.round(x),
          Math.round(y),
          Math.round(wPx),
          Math.round(hPx),
          MASK_SAMPLE_MARGIN_PX,
        );
      } catch (error) {
        console.warn("sampleAverageColor failed, falling back to white", error);
      }
    }
    if (
      requestId !== pendingEditRequestRef.current ||
      useEditStore.getState().document?.id !== documentId
    ) {
      return;
    }
    checkpoint();
    addMaskEdit(pageIndex, { ...rect, color, kind });
  };

  const removeBoxMark = (id: string) => {
    pendingEditRequestRef.current += 1;
    checkpoint();
    removeEdit(currentPageIndex, id);
  };

  /** Centre of the visible part of the current page, in PDF points, when it is laid out. */
  const onScreenPageCentre = () => {
    const pageElement = window.document.querySelector(".pdf-page-viewer__page");
    if (!page || !pageElement) return null;
    const pageBox = pageElement.getBoundingClientRect();
    const scrollBox = window.document.querySelector(".pdf-page-viewer__scroll")?.getBoundingClientRect();
    const clipLeft = Math.max(0, scrollBox?.left ?? 0);
    const clipTop = Math.max(0, scrollBox?.top ?? 0);
    const clipRight = Math.min(window.innerWidth, scrollBox?.right ?? window.innerWidth);
    const clipBottom = Math.min(window.innerHeight, scrollBox?.bottom ?? window.innerHeight);
    return visiblePageCentre(
      { left: pageBox.left - clipLeft, top: pageBox.top - clipTop, width: pageBox.width, height: pageBox.height },
      { width: clipRight - clipLeft, height: clipBottom - clipTop },
      page.widthPt,
    );
  };

  /** Places an image or drawn signature where the user is looking on the current page and selects it. */
  const insertImage = (image: ImportedImage | DrawnSignature, signature: boolean) => {
    if (!page) return;
    pendingEditRequestRef.current += 1;
    checkpoint();
    const rect = placeImage(image.pxWidth, image.pxHeight, page.widthPt, page.heightPt);
    // A drawn signature is sized like handwriting (about 160 pt wide at most), not like a picture.
    const scale = signature ? Math.min(1, 160 / rect.wPt) : 1;
    const wPt = rect.wPt * scale;
    const hPt = rect.hPt * scale;
    const centre = onScreenPageCentre() ?? { xPt: page.widthPt / 2, yPt: page.heightPt / 2 };
    const placed = clampToPage(
      { xPt: centre.xPt - wPt / 2, yPt: centre.yPt - hPt / 2, wPt, hPt },
      page.widthPt,
      page.heightPt,
    );
    const edit = addImageEdit(currentPageIndex, {
      ...placed,
      uri: image.uri,
      ...(signature ? { signature: true } : {}),
    });
    setEditMode("edit");
    setFocusedEditId(null);
    setSelectedImageId(edit.id);
  };

  const handleImageFile = async (file: File) => {
    try {
      insertImage(await readImageFile(file), false);
    } catch (error) {
      const reason = error instanceof ImageImportError ? error.reason : "decode";
      await showPopup({
        title: tx("Could not add this image", "यह इमेज नहीं जोड़ी जा सकी"),
        message:
          reason === "type"
            ? tx("Choose a PNG, JPEG or WebP image.", "PNG, JPEG या WebP इमेज चुनें।")
            : reason === "size"
              ? tx("Choose an image smaller than 20 MB.", "20 MB से छोटी इमेज चुनें।")
              : tx("This image file could not be read. Try another file.", "यह इमेज फ़ाइल पढ़ी नहीं जा सकी। दूसरी फ़ाइल आज़माएं।"),
        tone: "error",
      });
    }
  };

  const removeImage = (id: string) => {
    pendingEditRequestRef.current += 1;
    checkpoint();
    removeEdit(currentPageIndex, id);
    setSelectedImageId(null);
  };

  const handleMaskDrawn = async (rect: DrawnMaskRect) => {
    if (!page || editingBlocked || !boxMode) return;
    if (editMode === "highlight" || editMode === "whiteout") {
      await addBoxMark(rect, editMode);
      return;
    }
    await maskAndReplaceRegion(rect, {
      xPt: rect.xPt,
      yPt: rect.yPt,
      prefill: "",
      fontSizePt: DEFAULT_FONT_SIZE_PT,
    });
  };

  const saveAndExport = async () => {
    pendingEditRequestRef.current += 1;
    dismissOnlyGestureRef.current = false;
    setFocusedEditId(null);
    const documentToExport = useEditStore.getState().document;
    if (!documentToExport) return;
    const snapshotToExport = editSnapshot(documentToExport);
    setStatus({ state: "saving" });
    try {
      const sourceBytes = getPdfBytes();
      if (!sourceBytes) throw new Error("No PDF loaded");
      const blob = await exportPdf(documentToExport, sourceBytes);
      const baseName =
        documentToExport.sourceName.replace(/\.pdf$/i, "") || "edited";
      const filename = `${baseName}-edited.pdf`;
      downloadPdfBlob(blob, filename);
      setExportedSnapshot(snapshotToExport);
      setPagesChanged(false);
      setStatus({ state: "saved", filename });
      trackToolEvent("export_success", "edit");
    } catch (error) {
      trackToolEvent("export_failed", "edit");
      console.error("Export failed", error);
      setStatus({
        state: "error",
        message: exportFailureMessage(),
      });
    }
  };

  const ocrStatus = ocrStatusByPage[currentPageIndex];
  const ocrReadyCount = document
    ? Object.values(ocrStatusByPage).filter((s) => s === "done").length
    : 0;
  const zoomHint =
    pageZoom > 1.01
      ? tx(
          ` Ctrl+scroll or pinch to zoom (${Math.round(pageZoom * 100)}%).`,
          ` ज़ूम के लिए पिंच या Ctrl+स्क्रॉल करें (${Math.round(pageZoom * 100)}%)।`,
        )
      : tx(
          " Pinch or Ctrl+scroll to zoom.",
          " ज़ूम के लिए पिंच या Ctrl+स्क्रॉल करें।",
        );
  const findingText = tx(
    `Finding text… (${ocrReadyCount}/${document?.pages.length ?? 0} pages ready)`,
    `टेक्स्ट खोजा जा रहा है… (${ocrReadyCount}/${document?.pages.length ?? 0} पेज तैयार)`,
  );
  const hintText = editingBlocked
    ? tx(
        "Editing is disabled on this page — see the warning above.",
        "इस पेज पर एडिटिंग बंद है — ऊपर की चेतावनी देखें।",
      )
    : editMode === "highlight"
      ? tx(
          "Highlight — drag over text to mark it. × removes a highlight; Esc finishes.",
          "हाइलाइट — टेक्स्ट पर खींचकर चिह्नित करें। × से हाइलाइट हटाएं; Esc से खत्म करें।",
        ) + zoomHint
    : editMode === "whiteout"
      ? tx(
          "Whiteout — drag a box to cover it; text under it is deleted on save. × removes a box; Esc finishes.",
          "व्हाइटआउट — छिपाने के लिए बॉक्स खींचें; सेव पर उसके नीचे का टेक्स्ट हट जाता है। × से बॉक्स हटाएं; Esc से खत्म करें।",
        ) + zoomHint
    : editMode === "erase"
      ? tx(
          "Erase mode — drag a box over text to replace. Click without dragging, click outside the page, or press Esc to cancel.",
          "मिटाने का मोड — बदलने वाले टेक्स्ट पर बॉक्स खींचें। रद्द करने के लिए बिना खींचे क्लिक करें, पेज के बाहर क्लिक करें या Esc दबाएं।",
        ) + zoomHint
      : editMode === "addText"
        ? ocrStatus === "running"
          ? findingText
          : tx(
              "Add Text — click the page to place text. Click outside the page or press Esc to cancel.",
              "टेक्स्ट जोड़ें — जहाँ लिखना है वहाँ पेज पर क्लिक करें। रद्द करने के लिए पेज के बाहर क्लिक करें या Esc दबाएं।",
            ) + zoomHint
        : ocrStatus === "running"
          ? findingText
          : ocrStatus === "failed"
            ? tx(
                "Could not detect text automatically — use Erase box or Add text. Press Esc to clear selection.",
                'टेक्स्ट अपने-आप नहीं पहचाना जा सका — "मिटाएं" या "टेक्स्ट जोड़ें" इस्तेमाल करें। चुनाव हटाने के लिए Esc दबाएं।',
              ) + zoomHint
            : (page?.ocrLines.length ?? 0) === 0
              ? tx(
                  "No tappable text found yet — try Enhance with AI, Erase box, or Add text.",
                  'अभी टैप करने लायक टेक्स्ट नहीं मिला — "Enhance with AI", "Erase box" या "Add text" आज़माएं।',
                ) + zoomHint
              : tx(
                  "Edit text — click a highlighted line to change it. Press Esc to finish.",
                  "टेक्स्ट एडिट करें — बदलने के लिए हाइलाइट की गई लाइन पर क्लिक करें। खत्म करने के लिए Esc दबाएं।",
                ) + zoomHint;

  const step = status.state === "saved" && !dirty ? 3 : document ? 2 : 1;

  const closeWithoutChanges = () => {
    if (document && draftDocumentIdRef.current === document.id) {
      draftDocumentIdRef.current = null;
      void clearDraft();
    }
    setDraftKept(false);
    pageOpRestoreRef.current = [];
    setPageOpUndoCount(0);
    setPagesChanged(false);
    setPagesOpen(false);
    setDiscardVisible(false);
    setExportedSnapshot(null);
    pendingEditRequestRef.current += 1;
    dismissOnlyGestureRef.current = false;
    closeDocument();
    setFocusedEditId(null);
    setSelectAllEditId(null);
    ocrAttemptedPagesRef.current.clear();
    editPairingsRef.current.clear();
    setOcrStatusByPage({});
    setStatus({ state: "idle" });
  };

  const restoreKeptDraft = async (draft: Draft) => {
    const bytes = await loadDraftPdf(draft);
    if (!bytes) {
      setKeptDraft(null);
      await clearDraft();
      setStatus({ state: "error", message: { en: "The kept edits could not be read. Open the PDF again.", hi: "रखे गए बदलाव पढ़े नहीं जा सके। पीडीएफ फिर से खोलें।" } });
      return;
    }
    await openPdfFile(new File([bytes.slice().buffer], draft.sourceName, { type: "application/pdf" }), draft);
  };

  const discardKeptDraft = () => {
    setKeptDraft(null);
    void clearDraft();
  };

  const handleCloseDocument = () => {
    if (status.state === "saving" || translating || enhancingPage !== null)
      return;
    if (dirty) setDiscardVisible(true);
    else closeWithoutChanges();
  };

  return (
    <ToolShell
      tool={tool}
      compact={Boolean(document)}
      steps={[
        {
          label: tx("Select PDF", "पीडीएफ चुनें"),
          active: step === 1,
          done: step > 1,
        },
        { label: tx("Edit", "एडिट"), active: step === 2, done: step > 2 },
        {
          label: tx("Download", "डाउनलोड"),
          active: step === 3,
          done: status.state === "saved" && !dirty,
        },
      ]}
      actions={
        document ? (
          <AppButton
            title={tx("Open another", "दूसरी फाइल खोलें")}
            disabled={
              status.state === "opening" ||
              status.state === "saving" ||
              translating ||
              enhancingPage !== null
            }
            icon={<RotateCcw size={16} aria-hidden="true" />}
            small
            variant="secondary"
            onClick={handleCloseDocument}
          />
        ) : null
      }
    >
      {status.state === "opening" && (
        <div className="app__centered app__fill">
          <div className="app__loading-card">
            <div className="app__spinner" />
            <div>
              <p className="app__progress">Opening your PDF…</p>
              <p className="app__progress-sub">
                Rendering pages and detecting editable text
              </p>
            </div>
          </div>
        </div>
      )}

      {status.state !== "opening" && !document && (
        <div className="app__centered app__fill app__landing">
          {keptDraft && (
            <section className="app__kept-draft" aria-label={tx("Unsaved edits", "बिना सेव किए बदलाव")}>
              <div className="app__kept-draft-text">
                <strong>{tx("Continue where you left off?", "जहाँ छोड़ा था, वहीं से जारी रखें?")}</strong>
                <span>
                  {tx(
                    `${keptDraft.sourceName}: ${draftEditCount(keptDraft)} unsaved ${draftEditCount(keptDraft) === 1 ? "change" : "changes"} from ${savedAtLabel(keptDraft.savedAt, lang)}. Kept only in this browser; opening another file and editing it replaces them.`,
                    `${keptDraft.sourceName}: ${savedAtLabel(keptDraft.savedAt, lang)} के ${draftEditCount(keptDraft)} बिना सेव किए बदलाव। ये केवल इसी ब्राउज़र में रखे हैं; दूसरी फ़ाइल खोलकर बदलने पर ये हट जाएंगे।`,
                  )}
                </span>
              </div>
              <div className="app__kept-draft-actions">
                <AppButton title={tx("Discard", "हटाएं")} small variant="secondary" onClick={discardKeptDraft} />
                <AppButton title={tx("Restore edits", "बदलाव वापस लाएं")} small onClick={() => void restoreKeptDraft(keptDraft)} />
              </div>
            </section>
          )}
          <DropZone
            accent={tool.accent}
            title={tx("Edit Hindi PDF", "हिंदी पीडीएफ एडिट करें")}
            subtitle={tx(
              "Open a PDF in your browser. Tap detected text to edit, add overlays, or erase burned-in text. Your file stays on this device.",
              "पीडीएफ अपने ब्राउज़र में खोलें। पहचाने गए टेक्स्ट पर टैप करके बदलें, नया टेक्स्ट जोड़ें या पेज पर छपा टेक्स्ट मिटाएं। फाइल इसी डिवाइस पर रहती है।",
            )}
            buttonLabel={tx("Select PDF", "पीडीएफ चुनें")}
            onFiles={(files) => void openPdfFile(files[0])}
            disabled={status.state === "saving"}
          />
          {status.state === "error" && (
            <AppStatus tone="error" title={tx("Couldn’t open this PDF", "यह PDF नहीं खुल पाई")}>
              {tx(status.message.en, status.message.hi)}
            </AppStatus>
          )}
        </div>
      )}

      {status.state !== "opening" && document && page && (
        <main
          className="app__content"
          onMouseDown={(event) => {
            const target = event.target as HTMLElement;
            if (
              target.closest(
                ".app__page-card, .app__toolbar-card, .edit-toolbar",
              )
            ) {
              return;
            }
            // Cancel an in-flight OCR replacement even before it has created/focused
            // a textarea. Otherwise a click-away during async color sampling can still
            // commit the stale replacement after the user has left the editor.
            exitToolMode();
          }}
        >
          <section className="app__toolbar-card">
            <div className="app__toolbar-row app__toolbar-row--document">
              {document.pages.length > 1 ? (
                <div className="app__pager">
                  <button
                    type="button"
                    className="app-button app-button--secondary app-button--small"
                    aria-label={tx("Previous page", "पिछला पेज")}
                    onClick={() => goToPage(currentPageIndex - 1)}
                    disabled={currentPageIndex === 0}
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                  <span>
                    {currentPageIndex + 1} / {document.pages.length}
                  </span>
                  <button
                    type="button"
                    className="app-button app-button--secondary app-button--small"
                    aria-label={tx("Next page", "अगला पेज")}
                    onClick={() => goToPage(currentPageIndex + 1)}
                    disabled={currentPageIndex === document.pages.length - 1}
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <span className="app__page-count">{tx("1 page", "1 पेज")}</span>
              )}
              <span className="app__filename">
                <FileText size={15} aria-hidden="true" />
                <span>{document.sourceName}</span>
                {draftKept && dirty && (
                  <span className="app__draft-kept" role="status">
                    {tx("Edits kept in this browser", "बदलाव इस ब्राउज़र में रखे गए")}
                  </span>
                )}
              </span>
              <AppButton
                title={tx("Undo", "पहले जैसा करें")}
                icon={<Undo2 size={15} aria-hidden="true" />}
                small
                variant="ghost"
                onClick={handleUndo}
                disabled={!canUndoEdit && pageOpUndoCount === 0}
              />
              <AppButton
                title={tx("Redo", "फिर से करें")}
                icon={<Redo2 size={15} aria-hidden="true" />}
                small
                variant="ghost"
                onClick={handleRedo}
                disabled={!canRedo}
              />
            </div>
            <div className="app__toolbar-row app__toolbar-row--ai">
              <AppButton
                title={
                  enhancingPage === currentPageIndex
                    ? tx("Enhancing…", "सुधार रहे हैं…")
                    : tx("Enhance with AI", "AI से सुधारें")
                }
                icon={<Sparkles size={15} aria-hidden="true" />}
                small
                variant="secondary"
                onClick={() => void handleEnhancePressed()}
                disabled={
                  editingBlocked ||
                  enhancingPage !== null ||
                  translating ||
                  ocrStatus === "running"
                }
              />
              <AppButton
                title={
                  translating
                    ? tx("Translating…", "अनुवाद हो रहा है…")
                    : tx("Translate", "अनुवाद")
                }
                icon={<Languages size={15} aria-hidden="true" />}
                small
                variant="secondary"
                onClick={() => void handleTranslatePressed()}
                disabled={
                  editingBlocked ||
                  enhancingPage !== null ||
                  translating ||
                  ocrStatus === "running"
                }
              />
              <AppButton
                title={tx("Pages", "पेज")}
                icon={<Files size={15} aria-hidden="true" />}
                small
                variant={pagesOpen ? "primary" : "secondary"}
                onClick={() => setPagesOpen((open) => !open)}
                disabled={translating || enhancingPage !== null}
              />
              <AppButton
                title={tx("Find & replace", "खोजें और बदलें")}
                icon={<Search size={15} aria-hidden="true" />}
                small
                variant={findReplaceOpen ? "primary" : "secondary"}
                onClick={() => setFindReplaceOpen((open) => !open)}
                disabled={translating || enhancingPage !== null}
              />
              <AppButton
                title={tx("Image", "इमेज")}
                icon={<ImagePlus size={15} aria-hidden="true" />}
                small
                variant="secondary"
                onClick={() => imageInputRef.current?.click()}
                disabled={editingBlocked}
              />
              <AppButton
                title={tx("Signature", "हस्ताक्षर")}
                icon={<Signature size={15} aria-hidden="true" />}
                small
                variant="secondary"
                onClick={() => setSignaturePadOpen(true)}
                disabled={editingBlocked}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void handleImageFile(file);
                }}
              />
            </div>
            <div
              className="app__toolbar-row app__toolbar-row--modes"
              aria-label={tx("Editing modes", "एडिट करने के तरीके")}
            >
              <AppButton
                title={tx("Edit text", "टेक्स्ट बदलें")}
                icon={<Type size={15} aria-hidden="true" />}
                small
                variant={editMode === "edit" ? "primary" : "secondary"}
                onClick={() => selectEditMode("edit")}
                disabled={editingBlocked}
              />
              <AppButton
                title={tx("Add text", "टेक्स्ट जोड़ें")}
                icon={<Plus size={15} aria-hidden="true" />}
                small
                variant={editMode === "addText" ? "primary" : "secondary"}
                onClick={() => selectEditMode("addText")}
                disabled={editingBlocked}
              />
              <AppButton
                title={tx("Erase box", "मिटाएं")}
                icon={<Eraser size={15} aria-hidden="true" />}
                small
                variant={editMode === "erase" ? "primary" : "secondary"}
                onClick={() => selectEditMode("erase")}
                disabled={editingBlocked}
              />
              <AppButton
                title={tx("Highlight", "हाइलाइट")}
                icon={<Highlighter size={15} aria-hidden="true" />}
                small
                variant={editMode === "highlight" ? "primary" : "secondary"}
                onClick={() => selectEditMode("highlight")}
                disabled={editingBlocked}
              />
              <AppButton
                title={tx("Whiteout", "व्हाइटआउट")}
                icon={<Square size={15} aria-hidden="true" />}
                small
                variant={editMode === "whiteout" ? "primary" : "secondary"}
                onClick={() => selectEditMode("whiteout")}
                disabled={editingBlocked}
              />
            </div>
            <p className="app__hint">{hintText}</p>
          </section>

          {ocrUnavailable && (
            <AppStatus tone="warning" title={tx("Text recognition could not load", "टेक्स्ट पहचान लोड नहीं हो सकी")}>
              {tx(
                "Hindi text on some pages could not be double-checked. Check the text in each box before saving, or reload the page to try again.",
                "कुछ पेज पर हिंदी टेक्स्ट की दोबारा जाँच नहीं हो सकी। सेव करने से पहले हर बॉक्स का टेक्स्ट देख लें, या पेज दोबारा लोड करके फिर कोशिश करें।",
              )}
            </AppStatus>
          )}

          {pagesOpen && (
            <PagesPanel
              documentId={document.id}
              pages={document.pages.map((p) => ({ widthPt: p.widthPt, heightPt: p.heightPt, hasEdits: p.edits.length > 0 }))}
              currentPageIndex={currentPageIndex}
              busy={pageOpBusy || status.state === "saving"}
              status={pageOpStatus}
              renderThumbnail={renderThumbnail}
              onSelect={goToPage}
              onOp={(op) => void applyPageOp(op)}
              onClose={() => setPagesOpen(false)}
            />
          )}

          {findReplaceOpen && (
            <FindReplacePanel
              countMatches={countMatches}
              onReplaceAll={replaceAll}
              pagesPending={
                document.pages.length -
                Object.values(ocrStatusByPage).filter((s) => s === "done" || s === "failed").length
              }
              onClose={() => setFindReplaceOpen(false)}
            />
          )}

          {convertedLegacyPage && (
            <LegacyFontWarning fontNames={currentPageLegacyFontNames} converted />
          )}
          {editingBlocked && (
            <LegacyFontWarning fontNames={blockingLegacyFontNames} />
          )}

          {focusedEdit && (
            <EditToolbar
              fontSizePt={focusedEdit.fontSizePt}
              fontFamily={
                isSerifFamily(focusedEdit.fontFamily)
                  ? "NotoSerifDevanagari"
                  : "NotoSansDevanagari"
              }
              color={focusedEdit.color}
              fontWeight={isBoldWeight(focusedEdit.fontWeight) || focusedEdit.strokeEm ? "bold" : "normal"}
              onFontSizeChange={(fontSizePt) =>
                updateTextEdit(currentPageIndex, focusedEdit.id, { fontSizePt })
              }
              onFontFamilyChange={(fontFamily) =>
                updateTextEdit(currentPageIndex, focusedEdit.id, { fontFamily })
              }
              onColorChange={(color) =>
                updateTextEdit(currentPageIndex, focusedEdit.id, { color })
              }
              onFontWeightChange={(fontWeight) =>
                // Turning bold off also drops a faux-bold stroke copied from the original.
                updateTextEdit(currentPageIndex, focusedEdit.id, {
                  fontWeight,
                  ...(fontWeight === "normal" ? { strokeEm: undefined } : {}),
                })
              }
              onDelete={() => removeEditGroup(focusedEdit.id)}
              onDone={handleEditDone}
              romanTyping={romanTyping}
              onRomanTypingChange={changeRomanTyping}
            />
          )}

          <section
            className="app__page-card"
            onPointerDownCapture={(event) => {
              const target = event.target as HTMLElement;
              const targetEditId =
                target.closest<HTMLElement>("[data-edit-id]")?.dataset.editId ??
                null;
              dismissOnlyGestureRef.current = shouldDismissFocusedEdit(
                focusedEditId,
                targetEditId,
              );
            }}
          >
            <PdfPageViewer
              key={page.pageIndex}
              page={page}
              onTap={(xPt, yPt) => void handleTap(xPt, yPt)}
              disablePress={editingBlocked || boxMode}
              focusedEditId={boxMode ? null : focusedEditId}
              onEditPinchStart={handleEditPinchStart}
              onEditPinchResize={handleEditPinchResize}
              onEditPinchEnd={handleEditPinchEnd}
              onZoomChange={setPageZoom}
              renderOverlays={(viewWidthPx) => (
                <>
                  <OcrHighlightLayer
                    lines={linesOutsideWhiteouts(page.ocrLines, page.edits)}
                    viewWidthPx={viewWidthPx}
                    pageWidthPt={page.widthPt}
                    visible={
                      !editingBlocked &&
                      !boxMode &&
                      !focusedEditId &&
                      ocrStatus === "done"
                    }
                  />
                  <MaskOverlay
                    masks={page.edits.filter(
                      (e): e is MaskEdit => e.type === "mask",
                    )}
                    viewWidthPx={viewWidthPx}
                    pageWidthPt={page.widthPt}
                    active={boxMode && !editingBlocked}
                    onMaskDrawn={(rect) => void handleMaskDrawn(rect)}
                    onCancel={exitToolMode}
                    drawKind={editMode === "highlight" ? "highlight" : undefined}
                    removableKind={
                      editMode === "highlight" || editMode === "whiteout" ? editMode : undefined
                    }
                    removeLabel={
                      editMode === "highlight"
                        ? tx("Remove highlight", "हाइलाइट हटाएं")
                        : tx("Remove whiteout", "व्हाइटआउट हटाएं")
                    }
                    onRemove={removeBoxMark}
                  />
                  {page.edits
                    .filter((e): e is ImageEdit => e.type === "image")
                    .map((edit) => (
                      <ImageEditOverlay
                        key={edit.id}
                        edit={edit}
                        viewWidthPx={viewWidthPx}
                        pageWidthPt={page.widthPt}
                        pageHeightPt={page.heightPt}
                        selected={edit.id === selectedImageId}
                        interactive={!boxMode && !editingBlocked}
                        label={edit.signature ? tx("Signature", "हस्ताक्षर") : tx("Image", "इमेज")}
                        deleteLabel={edit.signature ? tx("Remove signature", "हस्ताक्षर हटाएं") : tx("Remove image", "इमेज हटाएं")}
                        resizeLabel={tx("Drag to resize", "आकार बदलने के लिए खींचें")}
                        onSelect={() => {
                          setFocusedEditId(null);
                          setSelectedImageId(edit.id);
                        }}
                        onChange={(rect) => {
                          checkpoint();
                          updateImageEdit(currentPageIndex, edit.id, rect);
                        }}
                        onDelete={() => removeImage(edit.id)}
                      />
                    ))}
                  {page.edits
                    .filter((e): e is TextEdit => e.type === "text")
                    .map((edit) => (
                      <EditableTextOverlay
                        key={edit.id}
                        edit={edit}
                        romanTyping={romanTyping}
                        viewWidthPx={viewWidthPx}
                        pageWidthPt={page.widthPt}
                        autoFocus={edit.id === focusedEditId}
                        focused={edit.id === focusedEditId}
                        selectAllOnFocus={edit.id === selectAllEditId}
                        onFocus={() => {
                          // While another line is focused, refuse focus transfer so an
                          // outside/nearby click only dismisses the active editor.
                          if (focusedEditId && focusedEditId !== edit.id) {
                            return false;
                          }
                          setFocusedEditId(edit.id);
                          setSelectedImageId(null);
                          if (edit.id === selectAllEditId)
                            setSelectAllEditId(null);
                          return true;
                        }}
                        onChangeText={(text) => handleEditTextChange(edit.id, text)}
                        onBlur={() => handleBlur(edit.id, edit.text)}
                      />
                    ))}
                </>
              )}
            />
          </section>

          <AppButton
            title={
              status.state === "saving"
                ? tx("Exporting…", "एक्सपोर्ट हो रहा है…")
                : tx("Download edited PDF", "एडिट की हुई पीडीएफ डाउनलोड करें")
            }
            icon={<Download size={17} aria-hidden="true" />}
            onClick={() => void saveAndExport()}
            disabled={status.state === "saving"}
          />
          {status.state === "saved" && !dirty && (
            <AppStatus tone="success" title="Edited PDF ready">
              Download started as {status.filename}
            </AppStatus>
          )}
          {status.state === "error" && (
            <AppStatus tone="error" title={tx("Export failed", "डाउनलोड नहीं हो पाया")}>
              {tx(status.message.en, status.message.hi)}
            </AppStatus>
          )}
        </main>
      )}

      <AppPopup
        open={discardVisible}
        title="Discard unexported changes?"
        tone="warning"
        onClose={() => setDiscardVisible(false)}
        actions={
          <>
            <AppButton
              title="Keep editing"
              onClick={() => setDiscardVisible(false)}
              data-popup-initial-focus
            />
            <AppButton
              title="Discard changes"
              variant="secondary"
              onClick={closeWithoutChanges}
            />
          </>
        }
      >
        <p>
          Download your edited PDF before closing to keep your changes. The
          original PDF will remain unchanged.
        </p>
      </AppPopup>
      {translationOptionsVisible && (
        <AppPopup
          open
          title={tx("Translate PDF", "पीडीएफ अनुवाद")}
          eyebrow={tx("Choose translation scope", "कितना अनुवाद करना है")}
          onClose={() => setTranslationOptionsVisible(false)}
          actions={
            <>
              <AppButton
                title={tx("Cancel", "रद्द करें")}
                small
                variant="ghost"
                onClick={() => setTranslationOptionsVisible(false)}
              />
              {detectedDirection && (
                <>
                  <AppButton
                    title={tx("This page", "यह पेज")}
                    small
                    variant="secondary"
                    onClick={() => queueTranslation("page")}
                  />
                  <AppButton
                    title={tx("Whole PDF", "पूरी पीडीएफ")}
                    small
                    onClick={() => queueTranslation("document")}
                    data-popup-initial-focus
                  />
                </>
              )}
            </>
          }
        >
          {detectedDirection ? (
            <p>
              {tx("Detected", "पहचानी गई दिशा:")}{" "}
              <strong>
                {detectedDirection === "hi-en"
                  ? tx("Hindi → English", "हिंदी → अंग्रेजी")
                  : tx("English → Hindi", "अंग्रेजी → हिंदी")}
              </strong>
              {tx(
                ". Source-language lines are sent securely through our Gemini proxy. The original PDF is never overwritten.",
                "। स्रोत भाषा की लाइनें सुरक्षित रूप से हमारे Gemini प्रॉक्सी से भेजी जाती हैं। मूल पीडीएफ कभी नहीं बदलती।",
              )}
            </p>
          ) : (
            <p>
              {tx(
                "No clear Hindi or English source text was detected yet. Run Enhance with AI or wait for text detection, then try Translate again.",
                'अभी साफ हिंदी या अंग्रेजी टेक्स्ट नहीं मिला। "AI से सुधारें" चलाएं या टेक्स्ट पहचान पूरी होने दें, फिर दोबारा अनुवाद करें।',
              )}
            </p>
          )}
        </AppPopup>
      )}

      {aiConsentVisible && (
        <AppPopup
          open
          title={
            aiGateMode === "translate"
              ? tx(
                  "Security check for translation",
                  "अनुवाद के लिए सुरक्षा चेक",
                )
              : tx("Enhance with AI OCR", "AI OCR से सुधारें")
          }
          eyebrow={tx("Privacy-first AI", "प्राइवेसी के साथ AI")}
          onClose={() => {
            setAiConsentVisible(false);
            setPendingTranslation(null);
          }}
          actions={
            <>
              <AppButton
                title={tx("Cancel", "रद्द करें")}
                small
                variant="ghost"
                onClick={() => {
                  setAiConsentVisible(false);
                  setPendingTranslation(null);
                }}
              />
              <AppButton
                title={tx("Continue", "आगे बढ़ें")}
                small
                onClick={confirmAiOcr}
                disabled={!turnstileToken}
                data-popup-initial-focus
              />
            </>
          }
        >
          <p>
            {aiGateMode === "translate"
              ? tx(
                  "Complete the security check, then detected source-language lines will be translated through our Gemini proxy. If local extraction is unreliable, only the affected page image is also sent for higher-accuracy OCR. The original PDF is never changed.",
                  "सुरक्षा चेक पूरा करें, फिर पहचानी गई लाइनों का अनुवाद हमारे Gemini प्रॉक्सी से होगा। अगर ब्राउज़र में टेक्स्ट ठीक से न पढ़ा जाए, तो सिर्फ उस पेज की इमेज भी बेहतर OCR के लिए भेजी जाएगी। मूल पीडीएफ कभी नहीं बदलती।",
                )
              : tx(
                  "This page image will be sent securely through our service to Google's Gemini API for higher-accuracy text detection. The original PDF is never changed.",
                  "इस पेज की इमेज बेहतर टेक्स्ट पहचान के लिए हमारी सर्विस से सुरक्षित रूप से Google के Gemini API को भेजी जाएगी। मूल पीडीएफ कभी नहीं बदलती।",
                )}
          </p>
          <TurnstileWidget onToken={setTurnstileToken} />
        </AppPopup>
      )}
      <SignaturePad
        open={signaturePadOpen}
        onCancel={() => setSignaturePadOpen(false)}
        onAdd={(signature) => {
          setSignaturePadOpen(false);
          insertImage(signature, true);
        }}
      />
    </ToolShell>
  );
}
