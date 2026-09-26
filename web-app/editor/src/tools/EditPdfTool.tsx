import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eraser,
  FileText,
  Languages,
  Plus,
  RotateCcw,
  Sparkles,
  Type,
  Undo2,
} from "lucide-react";

import { AppButton } from "../components/AppButton";
import { AppPopup } from "../components/AppPopup";
import { AppStatus } from "../components/AppStatus";
import { NextSteps } from "../components/NextSteps";
import { useAppPopup } from "../components/appPopupContext";
import { DropZone } from "../components/DropZone";
import { EditableTextOverlay } from "../components/EditableTextOverlay";
import { EditToolbar } from "../components/EditToolbar";
import { LegacyFontWarning } from "../components/LegacyFontWarning";
import { MaskOverlay, type DrawnMaskRect } from "../components/MaskOverlay";
import { OcrHighlightLayer } from "../components/OcrHighlightLayer";
import { PdfPageViewer } from "../components/PdfPageViewer";
import { ToolShell } from "../components/ToolShell";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { aiApiClient } from "../lib/aiApiClient";
import { ptSizeToImagePx, ptToImagePx } from "../lib/coordinateMath";
import { textGeometryForDetectedLine } from "../lib/detectedLineTextGeometry";
import { downloadPdfBlob, exportPdf } from "../lib/exportPdf";
import { toPdfFile } from "../lib/pdfOps";
import {
  ensureFontsLoaded,
  getFontBase64,
  type DevanagariFontFamily,
} from "../lib/fontAsset";
import type { TranslationDirection } from "@hindipdfeditor/translation-contract";

import { translateOcrLines } from "../lib/geminiTranslate";
import { detectLegacyFonts } from "../lib/legacyFontDetector";
import { shouldDismissFocusedEdit } from "../lib/editPointerIntent";
import { detectTextLines, detectTextLinesWithGemini } from "../lib/ocr";
import { findOcrTargetAt, findTextEditAt } from "../lib/ocrHitTest";
import {
  getPageCount,
  getPdfBase64,
  renderPage,
  sampleAverageColor,
  samplePagePaperColor,
  sampleTextColor,
  setPdfBytes,
} from "../lib/pdfToImages";
import { useTx } from "../lib/i18n";
import { getTool, readEditModeFromLocation } from "../lib/tools";
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
  type MaskEdit,
  type OcrLine,
  type PageState,
  type TextEdit,
} from "../state/editStore";
import "./EditPdfTool.css";

const tool = getTool("edit")!;

const UNKNOWN_ENCODING_FONT_NAME = "unknown (font inspection failed)";
const DEFAULT_FONT_SIZE_PT = 14;
const RASTER_SCALE = 2;
const MASK_SAMPLE_MARGIN_PX = 16;
const MASK_EXPAND_PT = 3;
const OCR_MASK_PAD_TOP_RATIO = 0.35;
const EDIT_TEXT_WIDTH_SLACK_RATIO = 1.25;

type EditMode = "edit" | "addText" | "erase";
type OcrStatusByPage = Record<number, "running" | "done" | "failed">;
type EditPairing = { maskId?: string; ocrLine?: OcrLine };

type Status =
  | { state: "idle" }
  | { state: "opening" }
  | { state: "saving" }
  | { state: "saved"; filename: string; output: File }
  | { state: "error"; message: string };

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
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [focusedEditId, setFocusedEditId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectAllEditId, setSelectAllEditId] = useState<string | null>(null);
  const [ocrStatusByPage, setOcrStatusByPage] = useState<OcrStatusByPage>({});
  const ocrAttemptedPagesRef = useRef(new Set<number>());
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
  const [pageZoom, setPageZoom] = useState(1);
  const editPinchStartRef = useRef<{
    fontSizePt: number;
    widthPt?: number;
  } | null>(null);
  const closeDocument = useEditStore((s) => s.closeDocument);

  const document = useEditStore((s) => s.document);
  const loadDocument = useEditStore((s) => s.loadDocument);
  const addTextEdit = useEditStore((s) => s.addTextEdit);
  const addMaskEdit = useEditStore((s) => s.addMaskEdit);
  const updateTextEdit = useEditStore((s) => s.updateTextEdit);
  const removeEdit = useEditStore((s) => s.removeEdit);
  const setOcrLines = useEditStore((s) => s.setOcrLines);
  const checkpoint = useEditStore((s) => s.checkpoint);
  const undo = useEditStore((s) => s.undo);
  const canUndo = useEditStore((s) => s.history.length > 0);

  useEffect(() => {
    ensureFontsLoaded();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
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

  const openPdfFile = async (file: File) => {
    pendingEditRequestRef.current += 1;
    setStatus({ state: "opening" });
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setPdfBytes(bytes);

      const pageCount = await getPageCount();
      const pages: PageState[] = [];
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const image = await renderPage(pageIndex, RASTER_SCALE);
        pages.push({
          pageIndex,
          widthPt: image.pxWidth / RASTER_SCALE,
          heightPt: image.pxHeight / RASTER_SCALE,
          backgroundImageUri: image.uri,
          imagePxWidth: image.pxWidth,
          imagePxHeight: image.pxHeight,
          edits: [],
          ocrLines: [],
        });
      }

      const legacyFontWarnings = await detectLegacyFontWarnings(pageCount);
      const newDocument: DocumentState = {
        sourceName: file.name,
        pageCount,
        pages,
        legacyFontWarnings,
      };
      loadDocument(newDocument);
      setCurrentPageIndex(0);
      setFocusedEditId(null);
      setSelectAllEditId(null);
      ocrAttemptedPagesRef.current.clear();
      aiJobIdRef.current = `document-${crypto.randomUUID()}`;
      editPairingsRef.current.clear();
      setOcrStatusByPage({});
      setEditMode("edit");
      ensureOcrForAllPages(newDocument);
      setStatus({ state: "idle" });
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
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
  const editingBlocked = currentPageLegacyFontNames.length > 0;

  const ensureOcrForPage = (doc: DocumentState, pageIndex: number) => {
    const pageState = doc.pages[pageIndex];
    if (!pageState) return;
    if (doc.legacyFontWarnings.some((w) => w.page === pageIndex)) return;
    if (ocrAttemptedPagesRef.current.has(pageIndex)) return;
    ocrAttemptedPagesRef.current.add(pageIndex);

    setOcrStatusByPage((s) => ({ ...s, [pageIndex]: "running" }));
    detectTextLines(pageState)
      .then((lines) => {
        if (useEditStore.getState().document?.sourceName !== doc.sourceName)
          return;
        setOcrLines(pageIndex, lines);
        setOcrStatusByPage((s) => ({ ...s, [pageIndex]: "done" }));
      })
      .catch((error) => {
        console.warn(`OCR failed on page ${pageIndex}`, error);
        if (useEditStore.getState().document?.sourceName !== doc.sourceName)
          return;
        setOcrStatusByPage((s) => ({ ...s, [pageIndex]: "failed" }));
      });
  };

  const ensureOcrForAllPages = (doc: DocumentState) => {
    for (let pageIndex = 0; pageIndex < doc.pages.length; pageIndex++) {
      ensureOcrForPage(doc, pageIndex);
    }
  };

  const goToPage = (index: number) => {
    if (!document || index < 0 || index >= document.pages.length) return;
    pendingEditRequestRef.current += 1;
    dismissOnlyGestureRef.current = false;
    setCurrentPageIndex(index);
    setFocusedEditId(null);
    ensureOcrForPage(document, index);
  };

  const handleUndo = () => {
    pendingEditRequestRef.current += 1;
    dismissOnlyGestureRef.current = false;
    setFocusedEditId(null);
    undo();
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
    const sourceName = document.sourceName;
    setEnhancingPage(pageIndex);
    try {
      const lines = await detectTextLinesWithGemini(
        page,
        aiJobIdRef.current,
        pageIndex,
      );
      if (useEditStore.getState().document?.sourceName !== sourceName) return;
      setOcrLines(pageIndex, lines);
      setOcrStatusByPage((s) => ({ ...s, [pageIndex]: "done" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await showPopup({
        title: tx("Enhancement couldn’t finish", "AI टेक्स्ट पहचान पूरी नहीं हो पाई"),
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
        const pageState = useEditStore.getState().document?.pages[pageIndex];
        if (!pageState) continue;
        const forceOcr = legacyPages.has(pageIndex);

        let lines = pageState.ocrLines;
        if (lines.length === 0 || forceOcr) {
          try {
            lines = await detectTextLines(pageState, { forceOcr });
            if (
              useEditStore.getState().document?.sourceName !== doc.sourceName
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
              useEditStore.getState().document?.sourceName !== doc.sourceName
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
        if (useEditStore.getState().document?.sourceName !== doc.sourceName) {
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
            "अनुवाद के लिए टेक्स्ट नहीं मिला। स्कैन पेजों पर पहले \"Enhance with AI\" आज़माएं, फिर दोबारा अनुवाद करें।",
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
      fontFamily?: DevanagariFontFamily;
      fontWeight?: "normal" | "bold";
    },
    consumedOcrLine?: OcrLine,
    requestId = ++pendingEditRequestRef.current,
  ) => {
    if (!page || !document) return;
    const targetPageIndex = currentPageIndex;
    const targetSourceName = document.sourceName;

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

    const currentDocument = useEditStore.getState().document;
    const currentPage = currentDocument?.pages[targetPageIndex];
    if (
      requestId !== pendingEditRequestRef.current ||
      currentDocument?.sourceName !== targetSourceName ||
      !currentPage
    ) {
      return;
    }

    checkpoint();
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
    });

    const textEdit = addTextEdit(targetPageIndex, {
      xPt: text.xPt,
      yPt: text.yPt,
      fontSizePt: text.fontSizePt,
      text: text.prefill,
      color: text.color ?? "#111111",
      fontFamily: text.fontFamily ?? "NotoSansDevanagari",
      ...(text.fontWeight ? { fontWeight: text.fontWeight } : {}),
      ...(text.widthPt !== undefined ? { widthPt: text.widthPt } : {}),
    });
    editPairingsRef.current.set(textEdit.id, {
      maskId: maskEdit.id,
      ocrLine: consumedOcrLine,
    });
    setFocusedEditId(textEdit.id);
    if (consumedOcrLine) setSelectAllEditId(textEdit.id);
  };

  const removeEditGroup = (id: string) => {
    const pairing = editPairingsRef.current.get(id);
    checkpoint();
    removeEdit(currentPageIndex, id);
    if (pairing?.maskId) removeEdit(currentPageIndex, pairing.maskId);
    if (pairing?.ocrLine && page) {
      setOcrLines(currentPageIndex, [...page.ocrLines, pairing.ocrLine]);
    }
    editPairingsRef.current.delete(id);
    if (focusedEditId === id) setFocusedEditId(null);
  };

  const handleTap = async (xPt: number, yPt: number) => {
    if (editingBlocked || editMode === "erase") return;
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

    const hitLine = findOcrTargetAt(page.ocrLines, xPt, yPt);
    if (hitLine) {
      const textGeometry = textGeometryForDetectedLine(
        hitLine,
        page.widthPt,
        EDIT_TEXT_WIDTH_SLACK_RATIO,
      );
      const { x: sampleXPx, y: sampleYPx } = ptToImagePx(
        hitLine.xPt,
        hitLine.yPt,
        page.imagePxWidth,
        page.widthPt,
      );
      const { wPx: sampleWPx, hPx: sampleHPx } = ptSizeToImagePx(
        hitLine.wPt,
        hitLine.hPt,
        page.imagePxWidth,
        page.widthPt,
      );
      let textColor = "#111111";
      try {
        textColor = await sampleTextColor(
          page.backgroundImageUri,
          Math.round(sampleXPx),
          Math.round(sampleYPx),
          Math.round(sampleWPx),
          Math.round(sampleHPx),
        );
      } catch (error) {
        console.warn("sampleTextColor failed, falling back to black", error);
      }
      const padTop = hitLine.hPt * OCR_MASK_PAD_TOP_RATIO;
      await maskAndReplaceRegion(
        {
          xPt: hitLine.xPt,
          yPt: hitLine.yPt - padTop,
          wPt: hitLine.wPt,
          hPt: hitLine.hPt + padTop,
        },
        {
          xPt: textGeometry.xPt,
          yPt: textGeometry.yPt,
          prefill: hitLine.text,
          fontSizePt: textGeometry.fontSizePt,
          widthPt: textGeometry.widthPt,
          color: textColor,
          fontWeight: "normal",
        },
        hitLine,
        requestId,
      );
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

  const handleMaskDrawn = async (rect: DrawnMaskRect) => {
    if (!page || editingBlocked || editMode !== "erase") return;
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
    setStatus({ state: "saving" });
    try {
      const fontBase64ByFamily = {
        NotoSansDevanagari: await getFontBase64("NotoSansDevanagari"),
        NotoSerifDevanagari: await getFontBase64("NotoSerifDevanagari"),
      };
      const blob = await exportPdf(documentToExport, fontBase64ByFamily);
      const baseName =
        documentToExport.sourceName.replace(/\.pdf$/i, "") || "edited";
      const filename = `${baseName}-edited.pdf`;
      downloadPdfBlob(blob, filename);
      setStatus({ state: "saved", filename, output: toPdfFile(blob, filename) });
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const ocrStatus = ocrStatusByPage[currentPageIndex];
  const ocrReadyCount = document
    ? Object.values(ocrStatusByPage).filter((s) => s === "done").length
    : 0;
  const zoomHint =
    pageZoom > 1.01
      ? tx(` Ctrl+scroll or pinch to zoom (${Math.round(pageZoom * 100)}%).`, ` ज़ूम के लिए पिंच या Ctrl+स्क्रॉल करें (${Math.round(pageZoom * 100)}%)।`)
      : tx(" Pinch or Ctrl+scroll to zoom.", " ज़ूम के लिए पिंच या Ctrl+स्क्रॉल करें।");
  const findingText = tx(
    `Finding text… (${ocrReadyCount}/${document?.pages.length ?? 0} pages ready)`,
    `टेक्स्ट खोजा जा रहा है… (${ocrReadyCount}/${document?.pages.length ?? 0} पेज तैयार)`,
  );
  const hintText = editingBlocked
    ? tx("Editing is disabled on this page — see the warning above.", "इस पेज पर एडिटिंग बंद है — ऊपर की चेतावनी देखें।")
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
                "टेक्स्ट अपने-आप नहीं पहचाना जा सका — \"Erase box\" या \"Add text\" इस्तेमाल करें। चुनाव हटाने के लिए Esc दबाएं।",
              ) + zoomHint
            : (page?.ocrLines.length ?? 0) === 0
              ? tx(
                  "No tappable text found yet — try Enhance with AI, Erase box, or Add text.",
                  "अभी टैप करने लायक टेक्स्ट नहीं मिला — \"Enhance with AI\", \"Erase box\" या \"Add text\" आज़माएं।",
                ) + zoomHint
              : tx(
                  "Edit text — click a highlighted line to change it. Press Esc to finish.",
                  "टेक्स्ट एडिट करें — बदलने के लिए हाइलाइट की गई लाइन पर क्लिक करें। खत्म करने के लिए Esc दबाएं।",
                ) + zoomHint;

  const step = status.state === "saved" ? 3 : document ? 2 : 1;

  const handleCloseDocument = () => {
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

  return (
    <ToolShell
      tool={tool}
      compact={Boolean(document)}
      steps={[
        { label: tx("Select PDF", "पीडीएफ चुनें"), active: step === 1, done: step > 1 },
        { label: tx("Edit", "एडिट"), active: step === 2, done: step > 2 },
        {
          label: tx("Download", "डाउनलोड"),
          active: step === 3,
          done: status.state === "saved",
        },
      ]}
      actions={
        document ? (
          <AppButton
            title={tx("Open another", "दूसरी फाइल खोलें")}
            icon={<RotateCcw size={16} aria-hidden="true" />}
            small
            variant="secondary"
            onClick={handleCloseDocument}
            disabled={status.state === "opening" || status.state === "saving"}
          />
        ) : null
      }
    >
      {status.state === "opening" && (
        <div className="app__centered app__fill">
          <div className="app__loading-card">
            <div className="app__spinner" />
            <div>
              <p className="app__progress">{tx("Opening your PDF…", "आपकी पीडीएफ खुल रही है…")}</p>
              <p className="app__progress-sub">{tx("Rendering pages and detecting editable text", "पेज बन रहे हैं और एडिट होने वाला टेक्स्ट पहचाना जा रहा है")}</p>
            </div>
          </div>
        </div>
      )}

      {status.state !== "opening" && !document && (
        <div className="app__centered app__fill app__landing">
          <DropZone
            accent={tool.accent}
            title={tx("Edit Hindi PDF", "हिंदी पीडीएफ एडिट करें")}
            subtitle={tx("Open a PDF in your browser. Tap detected text to edit, add overlays, or erase burned-in text. Your file stays on this device.", "पीडीएफ अपने ब्राउज़र में खोलें। पहचाने गए टेक्स्ट पर टैप करके बदलें, नया टेक्स्ट जोड़ें या पेज पर छपा टेक्स्ट मिटाएं। फाइल इसी डिवाइस पर रहती है।")}
            buttonLabel={tx("Select PDF", "पीडीएफ चुनें")}
            onFiles={(files) => void openPdfFile(files[0])}
            disabled={status.state === "saving"}
          />
          {status.state === "error" && (
            <AppStatus tone="error" title={tx("Couldn’t open this PDF", "यह पीडीएफ नहीं खुल पाई")}>{status.message}</AppStatus>
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
                  <AppButton
                    title="◀"
                    small
                    variant="secondary"
                    onClick={() => goToPage(currentPageIndex - 1)}
                    disabled={currentPageIndex === 0}
                  />
                  <span>
                    {currentPageIndex + 1} / {document.pages.length}
                  </span>
                  <AppButton
                    title="▶"
                    small
                    variant="secondary"
                    onClick={() => goToPage(currentPageIndex + 1)}
                    disabled={currentPageIndex === document.pages.length - 1}
                  />
                </div>
              ) : (
                <span className="app__page-count">{tx("1 page", "1 पेज")}</span>
              )}
              <span className="app__filename">
                <FileText size={15} aria-hidden="true" />
                <span>{document.sourceName}</span>
              </span>
              <AppButton
                title={tx("Undo", "पहले जैसा करें")}
                icon={<Undo2 size={15} aria-hidden="true" />}
                small
                variant="ghost"
                onClick={handleUndo}
                disabled={!canUndo}
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
                title={translating ? tx("Translating…", "अनुवाद हो रहा है…") : tx("Translate", "अनुवाद")}
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
            </div>
            <div className="app__toolbar-row app__toolbar-row--modes" aria-label={tx("Editing modes", "एडिटिंग मोड")}>
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
            </div>
            <p className="app__hint">{hintText}</p>
          </section>

          {editingBlocked && (
            <LegacyFontWarning fontNames={currentPageLegacyFontNames} />
          )}

          {focusedEdit && (
            <EditToolbar
              fontSizePt={focusedEdit.fontSizePt}
              fontFamily={
                focusedEdit.fontFamily === "NotoSerifDevanagari"
                  ? "NotoSerifDevanagari"
                  : "NotoSansDevanagari"
              }
              color={focusedEdit.color}
              fontWeight={focusedEdit.fontWeight === "bold" ? "bold" : "normal"}
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
                updateTextEdit(currentPageIndex, focusedEdit.id, { fontWeight })
              }
              onDelete={() => removeEditGroup(focusedEdit.id)}
              onDone={handleEditDone}
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
              disablePress={editingBlocked || editMode === "erase"}
              focusedEditId={editMode === "erase" ? null : focusedEditId}
              onEditPinchStart={handleEditPinchStart}
              onEditPinchResize={handleEditPinchResize}
              onEditPinchEnd={handleEditPinchEnd}
              onZoomChange={setPageZoom}
              renderOverlays={(viewWidthPx) => (
                <>
                  <OcrHighlightLayer
                    lines={page.ocrLines}
                    viewWidthPx={viewWidthPx}
                    pageWidthPt={page.widthPt}
                    visible={
                      !editingBlocked &&
                      editMode !== "erase" &&
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
                    active={editMode === "erase" && !editingBlocked}
                    onMaskDrawn={(rect) => void handleMaskDrawn(rect)}
                    onCancel={exitToolMode}
                  />
                  {page.edits
                    .filter((e): e is TextEdit => e.type === "text")
                    .map((edit) => (
                      <EditableTextOverlay
                        key={edit.id}
                        edit={edit}
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
                          if (edit.id === selectAllEditId)
                            setSelectAllEditId(null);
                          return true;
                        }}
                        onChangeText={(text) =>
                          updateTextEdit(currentPageIndex, edit.id, { text })
                        }
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
          {status.state === "saved" && (
            <AppStatus tone="success" title={tx("Edited PDF downloaded", "एडिट की हुई पीडीएफ डाउनलोड हो गई")}>
              {tx("Exported successfully as", "इस नाम से सेव हुई:")} {status.filename}
            </AppStatus>
          )}
          {status.state === "saved" && <NextSteps current="edit" output={status.output} />}
          {status.state === "error" && (
            <AppStatus tone="error" title={tx("Export failed", "एक्सपोर्ट नहीं हो पाया")}>{status.message}</AppStatus>
          )}
        </main>
      )}

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
                "अभी साफ हिंदी या अंग्रेजी टेक्स्ट नहीं मिला। \"AI से सुधारें\" चलाएं या टेक्स्ट पहचान पूरी होने दें, फिर दोबारा अनुवाद करें।",
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
              ? tx("Security check for translation", "अनुवाद के लिए सुरक्षा चेक")
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
    </ToolShell>
  );
}
