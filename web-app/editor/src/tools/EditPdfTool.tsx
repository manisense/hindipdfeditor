import { useEffect, useMemo, useRef, useState } from 'react';

import { AppButton } from '../components/AppButton';
import { DropZone } from '../components/DropZone';
import { EditableTextOverlay } from '../components/EditableTextOverlay';
import { EditToolbar } from '../components/EditToolbar';
import { LegacyFontWarning } from '../components/LegacyFontWarning';
import { MaskOverlay, type DrawnMaskRect } from '../components/MaskOverlay';
import { PdfPageViewer } from '../components/PdfPageViewer';
import { ToolShell } from '../components/ToolShell';
import { clearGeminiApiKey, getGeminiApiKey, setGeminiApiKey } from '../lib/apiKeyStore';
import { ptSizeToImagePx, ptToImagePx } from '../lib/coordinateMath';
import { downloadPdfBlob, exportPdf } from '../lib/exportPdf';
import { ensureFontsLoaded, getFontBase64, type DevanagariFontFamily } from '../lib/fontAsset';
import { detectLegacyFonts } from '../lib/legacyFontDetector';
import { detectTextLines, detectTextLinesWithGemini } from '../lib/ocr';
import { findOcrTargetAt, findTextEditAt } from '../lib/ocrHitTest';
import {
  getPageCount,
  getPdfBase64,
  renderPage,
  sampleAverageColor,
  sampleTextColor,
  setPdfBytes,
} from '../lib/pdfToImages';
import { getTool, readEditModeFromLocation } from '../lib/tools';
import {
  useEditStore,
  type DocumentState,
  type MaskEdit,
  type OcrLine,
  type PageState,
  type TextEdit,
} from '../state/editStore';
import './EditPdfTool.css';

const tool = getTool('edit')!;

const UNKNOWN_ENCODING_FONT_NAME = 'unknown (font inspection failed)';
const DEFAULT_FONT_SIZE_PT = 14;
const RASTER_SCALE = 2;
const MASK_SAMPLE_MARGIN_PX = 16;
const MASK_EXPAND_PT = 3;
const OCR_FONT_SIZE_RATIO = 0.82;
const MIN_OCR_FONT_SIZE_PT = 6;
const OCR_MASK_PAD_TOP_RATIO = 0.35;
const OCR_TEXT_WIDTH_SLACK_RATIO = 1.25;
const OCR_TEXT_BASELINE_NUDGE_RATIO = 0.06;

type EditMode = 'edit' | 'addText' | 'erase';
type OcrStatusByPage = Record<number, 'running' | 'done' | 'failed'>;
type EditPairing = { maskId?: string; ocrLine?: OcrLine };

type Status =
  | { state: 'idle' }
  | { state: 'opening' }
  | { state: 'saving' }
  | { state: 'saved'; filename: string }
  | { state: 'error'; message: string };

async function detectLegacyFontWarnings(
  pageCount: number,
): Promise<{ page: number; fontName: string }[]> {
  try {
    const base64 = await getPdfBase64();
    return await detectLegacyFonts(base64);
  } catch (error) {
    console.warn(
      'legacyFontDetector failed; treating every page as unknown-encoding (fail closed)',
      error,
    );
    return Array.from({ length: pageCount }, (_, page) => ({
      page,
      fontName: UNKNOWN_ENCODING_FONT_NAME,
    }));
  }
}

export function EditPdfTool() {
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [focusedEditId, setFocusedEditId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectAllEditId, setSelectAllEditId] = useState<string | null>(null);
  const [ocrStatusByPage, setOcrStatusByPage] = useState<OcrStatusByPage>({});
  const ocrAttemptedPagesRef = useRef(new Set<number>());
  const editPairingsRef = useRef(new Map<string, EditPairing>());
  const [enhancingPage, setEnhancingPage] = useState<number | null>(null);
  const [apiKeyPromptVisible, setApiKeyPromptVisible] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [editMode, setEditMode] = useState<EditMode>(() => readEditModeFromLocation());
  const [pageZoom, setPageZoom] = useState(1);
  const editPinchStartRef = useRef<{ fontSizePt: number; widthPt?: number } | null>(null);
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

  const openPdfFile = async (file: File) => {
    setStatus({ state: 'opening' });
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
      editPairingsRef.current.clear();
      setOcrStatusByPage({});
      setEditMode('edit');
      ensureOcrForAllPages(newDocument);
      setStatus({ state: 'idle' });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const page = document?.pages[currentPageIndex];
  const focusedEdit =
    page?.edits.find((e): e is TextEdit => e.type === 'text' && e.id === focusedEditId) ?? null;

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

    setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'running' }));
    detectTextLines(pageState)
      .then((lines) => {
        if (useEditStore.getState().document?.sourceName !== doc.sourceName) return;
        setOcrLines(pageIndex, lines);
        setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'done' }));
      })
      .catch((error) => {
        console.warn(`OCR failed on page ${pageIndex}`, error);
        if (useEditStore.getState().document?.sourceName !== doc.sourceName) return;
        setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'failed' }));
      });
  };

  const ensureOcrForAllPages = (doc: DocumentState) => {
    for (let pageIndex = 0; pageIndex < doc.pages.length; pageIndex++) {
      ensureOcrForPage(doc, pageIndex);
    }
  };

  const goToPage = (index: number) => {
    if (!document || index < 0 || index >= document.pages.length) return;
    setCurrentPageIndex(index);
    setFocusedEditId(null);
    ensureOcrForPage(document, index);
  };

  const handleUndo = () => {
    setFocusedEditId(null);
    undo();
  };

  const handleEditDone = () => setFocusedEditId(null);

  const handleEditPinchStart = (editId: string) => {
    const edit = page?.edits.find((e): e is TextEdit => e.type === 'text' && e.id === editId);
    if (!edit) return;
    checkpoint();
    editPinchStartRef.current = { fontSizePt: edit.fontSizePt, widthPt: edit.widthPt };
  };

  const handleEditPinchResize = (editId: string, scale: number) => {
    const start = editPinchStartRef.current;
    if (!start) return;
    const fontSizePt = Math.min(72, Math.max(6, start.fontSizePt * scale));
    updateTextEdit(currentPageIndex, editId, {
      fontSizePt,
      ...(start.widthPt !== undefined ? { widthPt: start.widthPt * scale } : {}),
    });
  };

  const handleEditPinchEnd = () => {
    editPinchStartRef.current = null;
  };

  const selectEditMode = (mode: EditMode) => {
    setEditMode(mode);
    setFocusedEditId(null);
  };

  const runEnhanceWithAi = async (apiKey: string) => {
    if (!document || !page || editingBlocked || enhancingPage !== null) return;
    const pageIndex = currentPageIndex;
    const sourceName = document.sourceName;
    setEnhancingPage(pageIndex);
    try {
      const lines = await detectTextLinesWithGemini(page, apiKey);
      if (useEditStore.getState().document?.sourceName !== sourceName) return;
      setOcrLines(pageIndex, lines);
      setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'done' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/api key/i.test(message)) {
        await clearGeminiApiKey().catch(() => {});
      }
      window.alert(`Enhance with AI failed: ${message}`);
    } finally {
      setEnhancingPage(null);
    }
  };

  const handleEnhancePressed = async () => {
    const storedKey = await getGeminiApiKey().catch(() => null);
    if (storedKey) {
      await runEnhanceWithAi(storedKey);
    } else {
      setApiKeyDraft('');
      setApiKeyPromptVisible(true);
    }
  };

  const handleApiKeySubmitted = async () => {
    const key = apiKeyDraft.trim();
    if (key === '') return;
    setApiKeyPromptVisible(false);
    await setGeminiApiKey(key).catch((error) => {
      console.warn('Failed to persist Gemini API key', error);
    });
    await runEnhanceWithAi(key);
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
      fontWeight?: 'normal' | 'bold';
    },
    consumedOcrLine?: OcrLine,
  ) => {
    if (!page) return;

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

    let color = '#ffffff';
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
      console.warn('sampleAverageColor failed, falling back to white', error);
    }

    const maskEdit = addMaskEdit(currentPageIndex, {
      xPt: maskRect.xPt,
      yPt: maskRect.yPt,
      wPt: maskRect.wPt,
      hPt: maskRect.hPt,
      color,
    });

    const textEdit = addTextEdit(currentPageIndex, {
      xPt: text.xPt,
      yPt: text.yPt,
      fontSizePt: text.fontSizePt,
      text: text.prefill,
      color: text.color ?? '#111111',
      fontFamily: text.fontFamily ?? 'NotoSansDevanagari',
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
    if (editingBlocked || editMode === 'erase') return;
    if (!page) return;

    const textEdits = page.edits.filter((e): e is TextEdit => e.type === 'text');
    const hitEdit = findTextEditAt(textEdits, xPt, yPt);

    if (focusedEditId) {
      if (hitEdit?.id === focusedEditId) return;
      setFocusedEditId(null);
      return;
    }

    if (hitEdit) {
      setFocusedEditId(hitEdit.id);
      return;
    }

    const hitLine = findOcrTargetAt(page.ocrLines, xPt, yPt);
    if (hitLine) {
      checkpoint();
      setOcrLines(
        currentPageIndex,
        page.ocrLines.filter((l) => l.id !== hitLine.id),
      );
      const fontSizePt = Math.max(MIN_OCR_FONT_SIZE_PT, hitLine.hPt * OCR_FONT_SIZE_RATIO);
      const textY = hitLine.yPt + hitLine.hPt * OCR_TEXT_BASELINE_NUDGE_RATIO;
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
      let textColor = '#111111';
      try {
        textColor = await sampleTextColor(
          page.backgroundImageUri,
          Math.round(sampleXPx),
          Math.round(sampleYPx),
          Math.round(sampleWPx),
          Math.round(sampleHPx),
        );
      } catch (error) {
        console.warn('sampleTextColor failed, falling back to black', error);
      }
      const fontWeight: 'normal' | 'bold' = fontSizePt >= 13 ? 'bold' : 'normal';
      const padTop = hitLine.hPt * OCR_MASK_PAD_TOP_RATIO;
      await maskAndReplaceRegion(
        {
          xPt: hitLine.xPt,
          yPt: hitLine.yPt - padTop,
          wPt: hitLine.wPt,
          hPt: hitLine.hPt + padTop,
        },
        {
          xPt: hitLine.xPt,
          yPt: textY,
          prefill: hitLine.text,
          fontSizePt,
          widthPt: hitLine.wPt * OCR_TEXT_WIDTH_SLACK_RATIO,
          color: textColor,
          fontWeight,
        },
        hitLine,
      );
      return;
    }

    if (editMode !== 'addText') return;
    if (ocrStatusByPage[currentPageIndex] === 'running') return;

    checkpoint();
    const edit = addTextEdit(currentPageIndex, {
      xPt,
      yPt,
      fontSizePt: DEFAULT_FONT_SIZE_PT,
      text: '',
      color: '#111111',
      fontFamily: 'NotoSansDevanagari',
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
    if (!page || editingBlocked || editMode !== 'erase') return;
    checkpoint();
    await maskAndReplaceRegion(rect, {
      xPt: rect.xPt,
      yPt: rect.yPt,
      prefill: '',
      fontSizePt: DEFAULT_FONT_SIZE_PT,
    });
  };

  const saveAndExport = async () => {
    if (!document) return;
    setStatus({ state: 'saving' });
    try {
      const fontBase64ByFamily = {
        NotoSansDevanagari: await getFontBase64('NotoSansDevanagari'),
        NotoSerifDevanagari: await getFontBase64('NotoSerifDevanagari'),
      };
      const blob = await exportPdf(document, fontBase64ByFamily);
      const baseName = document.sourceName.replace(/\.pdf$/i, '') || 'edited';
      const filename = `${baseName}-edited.pdf`;
      downloadPdfBlob(blob, filename);
      setStatus({ state: 'saved', filename });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const ocrStatus = ocrStatusByPage[currentPageIndex];
  const ocrReadyCount = document
    ? Object.values(ocrStatusByPage).filter((s) => s === 'done').length
    : 0;
  const zoomHint =
    pageZoom > 1.01
      ? ` Ctrl+scroll or pinch to zoom (${Math.round(pageZoom * 100)}%).`
      : ' Pinch or Ctrl+scroll to zoom.';
  const hintText = editingBlocked
    ? 'Editing is disabled on this page — see the warning above.'
    : editMode === 'erase'
      ? `Erase mode — drag a box over text OCR missed, then type replacement text.${zoomHint}`
      : editMode === 'addText'
        ? ocrStatus === 'running'
          ? `Finding text… (${ocrReadyCount}/${document?.pages.length ?? 0} pages ready)`
          : `Add Text — click anywhere to place new text.${zoomHint}`
        : ocrStatus === 'running'
          ? `Finding text… (${ocrReadyCount}/${document?.pages.length ?? 0} pages ready)`
          : ocrStatus === 'failed'
            ? `Edit text — click a line to change it.${zoomHint}`
            : `Edit text — click any detected line to change it.${zoomHint}`;

  const step = status.state === 'saved' ? 3 : document ? 2 : 1;

  const handleCloseDocument = () => {
    closeDocument();
    setFocusedEditId(null);
    setSelectAllEditId(null);
    ocrAttemptedPagesRef.current.clear();
    editPairingsRef.current.clear();
    setOcrStatusByPage({});
    setStatus({ state: 'idle' });
  };

  return (
    <ToolShell
      tool={tool}
      steps={[
        { label: 'Select PDF', active: step === 1, done: step > 1 },
        { label: 'Edit', active: step === 2, done: step > 2 },
        { label: 'Download', active: step === 3, done: status.state === 'saved' },
      ]}
      actions={
        document ? (
          <AppButton
            title="Open another"
            small
            variant="secondary"
            onClick={handleCloseDocument}
            disabled={status.state === 'opening' || status.state === 'saving'}
          />
        ) : null
      }
    >
      {status.state === 'opening' && (
        <div className="app__centered app__fill">
          <div className="app__spinner" />
          <p className="app__progress">Opening PDF…</p>
          <p className="app__progress-sub">Rendering pages and detecting text</p>
        </div>
      )}

      {status.state !== 'opening' && !document && (
        <div className="app__centered app__fill app__landing">
          <DropZone
            accent={tool.accent}
            title="Edit Hindi PDF"
            subtitle="Open a PDF in your browser. Tap detected text to edit, add overlays, or erase burned-in text. Your file stays on this device."
            buttonLabel="Select PDF"
            onFiles={(files) => void openPdfFile(files[0])}
            disabled={status.state === 'saving'}
          />
          {status.state === 'error' && (
            <div className="app__status app__status--error">{status.message}</div>
          )}
        </div>
      )}

      {status.state !== 'opening' && document && page && (
        <main className="app__content">
          <section className="app__toolbar-card">
            <div className="app__toolbar-row">
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
                <span>1 page</span>
              )}
              <span className="app__filename">{document.sourceName}</span>
              <AppButton title="↩ Undo" small variant="ghost" onClick={handleUndo} disabled={!canUndo} />
            </div>
            <div className="app__toolbar-row">
              <AppButton
                title={enhancingPage === currentPageIndex ? 'Enhancing…' : '✨ Enhance with AI'}
                small
                variant="secondary"
                onClick={() => void handleEnhancePressed()}
                disabled={editingBlocked || enhancingPage !== null || ocrStatus === 'running'}
              />
            </div>
            <div className="app__toolbar-row">
              <AppButton
                title="Edit text"
                small
                variant={editMode === 'edit' ? 'primary' : 'secondary'}
                onClick={() => selectEditMode('edit')}
                disabled={editingBlocked}
              />
              <AppButton
                title="+ Add text"
                small
                variant={editMode === 'addText' ? 'primary' : 'secondary'}
                onClick={() => selectEditMode('addText')}
                disabled={editingBlocked}
              />
              <AppButton
                title="Erase box"
                small
                variant={editMode === 'erase' ? 'primary' : 'secondary'}
                onClick={() => selectEditMode('erase')}
                disabled={editingBlocked}
              />
            </div>
            <p className="app__hint">{hintText}</p>
          </section>

          {editingBlocked && <LegacyFontWarning fontNames={currentPageLegacyFontNames} />}

          {focusedEdit && (
            <EditToolbar
              fontSizePt={focusedEdit.fontSizePt}
              fontFamily={
                focusedEdit.fontFamily === 'NotoSerifDevanagari'
                  ? 'NotoSerifDevanagari'
                  : 'NotoSansDevanagari'
              }
              color={focusedEdit.color}
              fontWeight={focusedEdit.fontWeight === 'bold' ? 'bold' : 'normal'}
              onFontSizeChange={(fontSizePt) =>
                updateTextEdit(currentPageIndex, focusedEdit.id, { fontSizePt })
              }
              onFontFamilyChange={(fontFamily) =>
                updateTextEdit(currentPageIndex, focusedEdit.id, { fontFamily })
              }
              onColorChange={(color) => updateTextEdit(currentPageIndex, focusedEdit.id, { color })}
              onFontWeightChange={(fontWeight) =>
                updateTextEdit(currentPageIndex, focusedEdit.id, { fontWeight })
              }
              onDelete={() => removeEditGroup(focusedEdit.id)}
              onDone={handleEditDone}
            />
          )}

          <section className="app__page-card">
            <PdfPageViewer
              key={page.pageIndex}
              page={page}
              onTap={(xPt, yPt) => void handleTap(xPt, yPt)}
              disablePress={editingBlocked || editMode === 'erase'}
              focusedEditId={editMode === 'erase' ? null : focusedEditId}
              onEditPinchStart={handleEditPinchStart}
              onEditPinchResize={handleEditPinchResize}
              onEditPinchEnd={handleEditPinchEnd}
              onZoomChange={setPageZoom}
              renderOverlays={(viewWidthPx) => (
                <>
                  <MaskOverlay
                    masks={page.edits.filter((e): e is MaskEdit => e.type === 'mask')}
                    viewWidthPx={viewWidthPx}
                    pageWidthPt={page.widthPt}
                    active={editMode === 'erase' && !editingBlocked}
                    onMaskDrawn={(rect) => void handleMaskDrawn(rect)}
                  />
                  {page.edits
                    .filter((e): e is TextEdit => e.type === 'text')
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
                          if (focusedEditId && focusedEditId !== edit.id) {
                            setFocusedEditId(null);
                            return false;
                          }
                          setFocusedEditId(edit.id);
                          if (edit.id === selectAllEditId) setSelectAllEditId(null);
                          return true;
                        }}
                        onChangeText={(text) => updateTextEdit(currentPageIndex, edit.id, { text })}
                        onBlur={() => handleBlur(edit.id, edit.text)}
                      />
                    ))}
                </>
              )}
            />
          </section>

          <AppButton
            title={status.state === 'saving' ? 'Exporting…' : 'Download edited PDF'}
            onClick={() => void saveAndExport()}
            disabled={status.state === 'saving'}
          />
          {status.state === 'saved' && (
            <div className="app__status app__status--success">
              Exported successfully as {status.filename}
            </div>
          )}
          {status.state === 'error' && (
            <div className="app__status app__status--error">{status.message}</div>
          )}
        </main>
      )}

      {apiKeyPromptVisible && (
        <div className="app__modal-backdrop">
          <div className="app__modal" role="dialog" aria-labelledby="api-key-title">
            <h2 id="api-key-title">Gemini API key needed</h2>
            <p>
              Enhance with AI sends this page&apos;s image to Google&apos;s Gemini API for
              higher-accuracy text detection. It needs your own free API key — create one at{' '}
              <a href="https://aistudio.google.com" target="_blank" rel="noreferrer">
                aistudio.google.com
              </a>
              , then paste it here. The key is stored only in this browser.
            </p>
            <input
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder="Paste API key"
              className="app__modal-input"
            />
            <div className="app__modal-actions">
              <AppButton title="Cancel" small variant="ghost" onClick={() => setApiKeyPromptVisible(false)} />
              <AppButton
                title="Save & run"
                small
                onClick={() => void handleApiKeySubmitted()}
                disabled={apiKeyDraft.trim() === ''}
              />
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
