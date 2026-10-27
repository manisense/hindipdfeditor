import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditableTextOverlay } from '../components/EditableTextOverlay';
import { FontPickerModal } from '../components/FontPickerModal';
import { LegacyFontWarning } from '../components/LegacyFontWarning';
import { OldFontChip } from '../components/OldFontChip';
import { MaskOverlay, type DrawnMaskRect } from '../components/MaskOverlay';
import { OcrHighlightLayer } from '../components/OcrHighlightLayer';
import { PdfPageViewer } from '../components/PdfPageViewer';
import { createBlankPage } from '../lib/blankPage';
import { ptSizeToImagePx, ptToImagePx } from '../lib/coordinateMath';
import { exportPdf, type ExportProgress } from '../lib/exportPdf';
import { outputFileName } from '../lib/outputFileName';
import {
  fontFaceWeight,
  fontLabel,
  getFontBase64,
  installFontFamily,
  isFontFamilyLoaded,
  type DevanagariFontFamily,
} from '../lib/fontAsset';
import { detectLegacyFonts } from '../lib/legacyFontDetector';
import { legacyEditingPolicy, UNKNOWN_ENCODING_FONT_NAME } from '../lib/legacyEditingPolicy';
import { detectTextLines } from '../lib/ocr';
import { findOcrTargetAt, findTextEditAt } from '../lib/ocrHitTest';
import { getPageCount, renderPage, sampleAverageColor, sampleTextColor } from '../lib/pdfToImages';
import {
  fontSizeForOcrLine,
  ocrMaskRect,
  textBoxGeometry,
  textTopForOcrLine,
} from '../lib/textEditGeometry';
import { discardTemporaryOutput, persistOutput } from '../lib/persistOutput';
import {
  deletableRenderUris,
  pageImageUris,
  useEditStore,
  type DocumentState,
  type MaskEdit,
  type PageState,
  type TextEdit,
} from '../state/editStore';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { useHardwareBack } from '../navigation/useHardwareBack';
import { EditToolbarBar } from '../screens/editor/EditToolbarBar';
import { LineEditSheet, MAX_FONT_SIZE_PT, MIN_FONT_SIZE_PT } from '../screens/editor/LineEditSheet';
import {
  changeCounts,
  createEditSession,
  defaultEditedName,
  editsSnapshot,
  hasUnsavedEdits,
  isUntouchedReplacement,
  type EditMode,
  type EditsSnapshot,
} from '../screens/editor/editorDocument';
import { SaveSheet } from '../screens/editor/SaveSheet';
import { ToolDoneScreen } from '../screens/ToolDoneScreen';
import { ToolPickPrompt } from '../screens/tools/ToolPickPrompt';
import { useSavedFileActions, type SavedFile } from '../screens/tools/useSavedFileActions';
import { BandIconButton } from '../ui/BandIconButton';
import { BottomSheet } from '../ui/BottomSheet';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { ListRow } from '../ui/ListRow';
import { PillButton } from '../ui/PillButton';
import { ReaderBar } from '../ui/ReaderBar';
import { useSnackbar } from '../ui/Snackbar';
import { UiText } from '../ui/UiText';
import { commonErrors, useErrorDialog } from '../ui/useErrorDialog';

const DEFAULT_FONT_SIZE_PT = 14;
const RASTER_SCALE = 3;
/** Scale, in px per PDF point, of the recents thumbnail (the same as the other tools'). */
const THUMBNAIL_SCALE = 0.5;
const MASK_SAMPLE_MARGIN_PX = 16;
const EDIT_TEXT_WIDTH_SLACK_RATIO = 1.25;

type OcrStatusByPage = Record<number, 'running' | 'done' | 'failed'>;

async function detectLegacyFontWarnings(
  sourceUri: string,
  pageCount: number,
): Promise<{ page: number; fontName: string }[]> {
  try {
    const base64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return await detectLegacyFonts(base64);
  } catch (error) {
    console.warn('legacyFontDetector failed; treating every page as unknown-encoding', error);
    return Array.from({ length: pageCount }, (_, page) => ({
      page,
      fontName: UNKNOWN_ENCODING_FONT_NAME,
    }));
  }
}

/** Opens the system picker for one PDF; resolves null when the person cancels. */
async function pickOnePdf(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf'],
    copyToCacheDirectory: true,
  });
  return result.canceled || !result.assets || result.assets.length === 0 ? null : result.assets[0];
}

/** Toolbar height (48dp buttons + 4dp padding each side) and its gap above the bottom inset, in dp. */
const TOOLBAR_HEIGHT = 56;
const TOOLBAR_BOTTOM_GAP = 24;

/**
 * Drops the editor's document, its undo history and its page renders. Render files are deleted
 * only when they sit in the app cache, so nothing outside the editor's own output is touched.
 */
function releaseEditorDocument(): void {
  const state = useEditStore.getState();
  const renders = pageImageUris(state);
  const sourceUri = state.document?.sourceUri;
  state.closeDocument();
  deleteRenders(renders, sourceUri);
}

/** Best-effort delete of editor page renders (cache files only, never `sourceUri`). */
function deleteRenders(uris: readonly string[], sourceUri: string | undefined): void {
  for (const uri of deletableRenderUris(uris, FileSystem.cacheDirectory, [sourceUri])) {
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }
}

type Props = {
  initialFileUri?: string;
  initialFileName?: string;
  onClose: () => void;
  /** Opens a saved file in the Reader (the Saved screen's Open button). */
  onOpenFile: (file: RecentFile) => void;
};

/**
 * Editor for Devanagari PDFs on the dark editor chrome: a `ReaderBar` (close, file name, Save,
 * more), the page with OCR-detected lines tinted in Change text mode, and the floating
 * `EditToolbarBar` (Change text, Add text, Cover old text, undo, redo, Show original). Close
 * and Android back ask before discarding unsaved edits.
 */
export function EditPdfTool({ initialFileUri, initialFileName, onClose, onOpenFile }: Props) {
  const insets = useSafeAreaInsets();
  const ui = useUi();
  const tx = useTx();
  const snackbar = useSnackbar();
  const { errorDialog, showError } = useErrorDialog();
  const errors = commonErrors(tx);
  const savedActions = useSavedFileActions(showError, onOpenFile);
  const [opening, setOpening] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [discardVisible, setDiscardVisible] = useState(false);
  const [saveSheetVisible, setSaveSheetVisible] = useState(false);
  /** Bumped each time the save sheet opens, so its name field starts from the default again. */
  const [saveSheetKey, setSaveSheetKey] = useState(0);
  const [saved, setSaved] = useState<SavedFile | null>(null);
  const [firstEditMade, setFirstEditMade] = useState(false);

  const [editMode, setEditMode] = useState<EditMode>('edit');
  const [focusedEditId, setFocusedEditId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [fontPickerVisible, setFontPickerVisible] = useState(false);
  const [downloadingFont, setDownloadingFont] = useState<DevanagariFontFamily | null>(null);
  const [, setOcrStatusByPage] = useState<OcrStatusByPage>({});

  const ocrAttemptedPagesRef = useRef(new Set<number>());
  /** Font size, in PDF points, of the line being resized when a two-finger pinch began. */
  const pinchStartSizeRef = useRef(0);
  /** The open line as this tap created it; null when an existing line was reopened. */
  const createdLineRef = useRef<TextEdit | null>(null);
  const savingRef = useRef(false);
  /** Bumped by each load and by unmount, so only the latest load still mounted may finish. */
  const loadRunRef = useRef(0);

  const document = useEditStore((s) => s.document);
  const loadDocument = useEditStore((s) => s.loadDocument);
  const addTextEdit = useEditStore((s) => s.addTextEdit);
  const addMaskEdit = useEditStore((s) => s.addMaskEdit);
  const updateTextEdit = useEditStore((s) => s.updateTextEdit);
  const removeEdit = useEditStore((s) => s.removeEdit);
  const revertToCheckpoint = useEditStore((s) => s.revertToCheckpoint);
  const setOcrLines = useEditStore((s) => s.setOcrLines);
  const checkpoint = useEditStore((s) => s.checkpoint);
  const undo = useEditStore((s) => s.undo);
  const canUndo = useEditStore((s) => s.history.length > 0);
  const redo = useEditStore((s) => s.redo);
  const canRedo = useEditStore((s) => s.future.length > 0);
  const insertPage = useEditStore((s) => s.insertPage);
  const addRecentFile = useRecentFilesStore((s) => s.addFile);
  const [lineSession] = useState(() => createEditSession(checkpoint));

  /** Opens the line sheet; `created` is the line when this tap just created it. */
  const openLine = (id: string, created: TextEdit | null) => {
    lineSession.start(created !== null);
    createdLineRef.current = created;
    setFocusedEditId(id);
  };

  /** Applies a change from the line sheet, as one undo step per sheet opening. */
  const changeLine = (id: string, changes: Partial<TextEdit>) => {
    lineSession.beforeChange();
    updateTextEdit(currentPageIndex, id, changes);
  };

  const [savedEdits, setSavedEdits] = useState<EditsSnapshot>(() =>
    document ? editsSnapshot(document) : [],
  );
  const unsaved = document !== null && hasUnsavedEdits(savedEdits, document);

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

  const [legacyBypassPages, setLegacyBypassPages] = useState<Set<number>>(new Set());
  const policy = useMemo(
    () => legacyEditingPolicy(currentPageLegacyFontNames, legacyBypassPages.has(currentPageIndex)),
    [currentPageLegacyFontNames, legacyBypassPages, currentPageIndex],
  );
  const editingBlocked = policy.editingBlocked;
  const [legacySheetDismissedPages, setLegacySheetDismissedPages] = useState<Set<number>>(
    new Set(),
  );
  const [legacySheetReopened, setLegacySheetReopened] = useState(false);
  const legacySheetVisible =
    legacySheetReopened ||
    (currentPageLegacyFontNames.length > 0 &&
      editingBlocked &&
      !legacySheetDismissedPages.has(currentPageIndex));
  const replacementModeOn = policy.knownLegacyFontNames.length > 0 && !editingBlocked;
  const reopenLegacySheet = () =>
    setLegacySheetDismissedPages((prev) => {
      const next = new Set(prev);
      next.delete(currentPageIndex);
      return next;
    });

  const ensureOcrForPage = async (doc: DocumentState, pageIndex: number): Promise<void> => {
    const pageState = doc.pages[pageIndex];
    if (!pageState || doc.legacyFontWarnings.some((w) => w.page === pageIndex)) return;
    if (ocrAttemptedPagesRef.current.has(pageIndex)) return;
    ocrAttemptedPagesRef.current.add(pageIndex);

    setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'running' }));
    await detectTextLines(pageState)
      .then((lines) => {
        if (useEditStore.getState().document?.sourceUri !== doc.sourceUri) return;
        setOcrLines(pageIndex, lines);
        setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'done' }));
      })
      .catch((err) => {
        console.warn(`OCR failed on page ${pageIndex}`, err);
        setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'failed' }));
      });
  };

  // One page at a time: each page runs two ML Kit passes that each decode the full 3x page
  // image (~18 MB for A4), so starting every page at once could need hundreds of MB.
  const ensureOcrForAllPages = async (doc: DocumentState) => {
    for (let i = 0; i < doc.pages.length; i++) {
      if (useEditStore.getState().document?.sourceUri !== doc.sourceUri) return;
      await ensureOcrForPage(doc, i);
    }
  };

  const loadPdfFromUri = async (uri: string, name: string) => {
    const run = ++loadRunRef.current;
    const pages: PageState[] = [];
    let thumbnailUri: string | undefined;
    /** True, after releasing this load's renders, when the editor closed or another load began. */
    const superseded = () => {
      if (loadRunRef.current === run) return false;
      deleteRenders([...pages.map((p) => p.backgroundImageUri), thumbnailUri ?? ''], uri);
      return true;
    };
    setOpening(true);
    try {
      const pageCount = await getPageCount(uri);

      for (let i = 0; i < pageCount; i++) {
        if (superseded()) return;
        const image = await renderPage(uri, i, RASTER_SCALE);
        pages.push({
          pageIndex: i,
          widthPt: image.widthPt,
          heightPt: image.heightPt,
          backgroundImageUri: image.uri,
          imagePxWidth: image.pxWidth,
          imagePxHeight: image.pxHeight,
          edits: [],
          ocrLines: [],
        });
      }

      const legacyFontWarnings = await detectLegacyFontWarnings(uri, pageCount);
      // Recents get their own small render: the editor deletes its page renders when it closes.
      thumbnailUri = await renderPage(uri, 0, THUMBNAIL_SCALE)
        .then((image) => image.uri)
        .catch(() => undefined);
      if (superseded()) return;
      const newDoc: DocumentState = {
        sourceUri: uri,
        displayName: name,
        pageCount,
        pages,
        legacyFontWarnings,
      };

      loadDocument(newDoc);
      setSavedEdits(editsSnapshot(newDoc));
      setFirstEditMade(false);
      setCurrentPageIndex(0);
      setFocusedEditId(null);
      ocrAttemptedPagesRef.current.clear();
      setOcrStatusByPage({});
      setLegacySheetDismissedPages(new Set());
      void ensureOcrForAllPages(newDoc);

      const info = await FileSystem.getInfoAsync(uri).catch(() => null);
      const fileData: Omit<RecentFile, 'id' | 'date'> = {
        name,
        hindiName: name.replace(/\.pdf$/i, '') + '_संपादित.pdf',
        uri,
        thumbnailUri,
        sizeBytes: info?.exists ? info.size : 0,
        pageCount,
        category: 'all',
        starred: false,
      };
      void addRecentFile(fileData);
    } catch (error) {
      if (superseded()) return;
      console.warn('Editor open failed', error);
      showError({
        ...errors.open,
        onRetry: () =>
          void pickOnePdf()
            .then((asset) => asset && loadPdfFromUri(asset.uri, asset.name))
            .catch((pickError: unknown) => console.warn('Editor re-pick failed', pickError)),
      });
    } finally {
      if (loadRunRef.current === run) setOpening(false);
    }
  };

  // Every exit (Close, Android back, the Saved screen's Open) unmounts the editor, so the
  // document is released here rather than in one exit path.
  // A load still running then is dropped: bumping the run id makes it discard its renders.
  useEffect(() => {
    const loadRun = loadRunRef;
    return () => {
      loadRun.current += 1;
      releaseEditorDocument();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (initialFileUri && initialFileUri.length > 0) {
      void (async () => {
        if (active) {
          await loadPdfFromUri(initialFileUri, initialFileName || 'document.pdf');
        }
      })();
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFileUri]);

  const openPdfFile = async () => {
    try {
      const asset = await pickOnePdf();
      if (asset) await loadPdfFromUri(asset.uri, asset.name);
    } catch (error) {
      console.warn('Editor open failed', error);
      showError({ ...errors.open, onRetry: () => void openPdfFile() });
    }
  };

  const handleTap = async (xPt: number, yPt: number) => {
    if (!page) return;
    if (editingBlocked) {
      reopenLegacySheet();
      return;
    }

    if (focusedEditId) {
      finishEditing();
      return;
    }

    if (editMode === 'edit') {
      const textEdits = page.edits.filter((e): e is TextEdit => e.type === 'text');
      const existingText = findTextEditAt(textEdits, xPt, yPt);
      if (existingText) {
        openLine(existingText.id, null);
        return;
      }

      const ocrLine = findOcrTargetAt(page.ocrLines, xPt, yPt);
      if (ocrLine) {
        checkpoint();
        const geom = textBoxGeometry(page.widthPt, ocrLine.xPt, ocrLine.wPt);
        const mask = ocrMaskRect(page.widthPt, page.heightPt, ocrLine);

        const { x: xPx, y: yPx } = ptToImagePx(mask.xPt, mask.yPt, page.imagePxWidth, page.widthPt);
        const { wPx, hPx } = ptSizeToImagePx(mask.wPt, mask.hPt, page.imagePxWidth, page.widthPt);
        const sampledColor = await sampleAverageColor(
          page.backgroundImageUri,
          xPx,
          yPx,
          wPx,
          hPx,
          MASK_SAMPLE_MARGIN_PX,
        ).catch(() => '#ffffff');

        const { x: textXPx, y: textYPx } = ptToImagePx(
          ocrLine.xPt,
          ocrLine.yPt,
          page.imagePxWidth,
          page.widthPt,
        );
        const { wPx: textWPx, hPx: textHPx } = ptSizeToImagePx(
          ocrLine.wPt,
          ocrLine.hPt,
          page.imagePxWidth,
          page.widthPt,
        );
        const sampledTextColor = await sampleTextColor(
          page.backgroundImageUri,
          textXPx,
          textYPx,
          textWPx,
          textHPx,
        ).catch(() => '#15172c');

        const maskEdit = addMaskEdit(currentPageIndex, { ...mask, color: sampledColor });

        const textEdit = addTextEdit(currentPageIndex, {
          xPt: geom.xPt,
          yPt: textTopForOcrLine(ocrLine.yPt, fontSizeForOcrLine(ocrLine.hPt)),
          fontSizePt: fontSizeForOcrLine(ocrLine.hPt),
          text: ocrLine.text,
          color: sampledTextColor,
          fontFamily: 'NotoSansDevanagari',
          widthPt: geom.widthPt * EDIT_TEXT_WIDTH_SLACK_RATIO,
          replacement: { maskId: maskEdit.id, ocrLine },
        });

        setFirstEditMade(true);
        openLine(textEdit.id, textEdit);
        return;
      }
    }

    // Default tap: place new text overlay
    checkpoint();
    const textEdit = addTextEdit(currentPageIndex, {
      xPt,
      yPt,
      fontSizePt: DEFAULT_FONT_SIZE_PT,
      text: '',
      color: '#15172c',
      fontFamily: 'NotoSansDevanagari',
    });
    setFirstEditMade(true);
    openLine(textEdit.id, textEdit);
  };

  const handleMaskDrawn = async (drawn: DrawnMaskRect) => {
    if (!page) return;
    if (editingBlocked) {
      reopenLegacySheet();
      return;
    }
    checkpoint();

    const { x: xPx, y: yPx } = ptToImagePx(drawn.xPt, drawn.yPt, page.imagePxWidth, page.widthPt);
    const { wPx, hPx } = ptSizeToImagePx(drawn.wPt, drawn.hPt, page.imagePxWidth, page.widthPt);
    const sampledColor = await sampleAverageColor(
      page.backgroundImageUri,
      xPx,
      yPx,
      wPx,
      hPx,
      MASK_SAMPLE_MARGIN_PX,
    ).catch(() => '#ffffff');

    const maskEdit = addMaskEdit(currentPageIndex, {
      xPt: drawn.xPt,
      yPt: drawn.yPt,
      wPt: drawn.wPt,
      hPt: drawn.hPt,
      color: sampledColor,
    });
    setFirstEditMade(true);

    if (editMode === 'erase') {
      return;
    }

    const textEdit = addTextEdit(currentPageIndex, {
      xPt: drawn.xPt,
      yPt: drawn.yPt,
      fontSizePt: Math.min(Math.max(DEFAULT_FONT_SIZE_PT, drawn.hPt * 0.7), 48),
      text: '',
      color: '#15172c',
      fontFamily: 'NotoSansDevanagari',
      widthPt: drawn.wPt,
      replacement: { maskId: maskEdit.id },
    });

    openLine(textEdit.id, textEdit);
  };

  /**
   * Exports through the print pipeline, copies the result to the app's Edited folder under the
   * sanitised `typedName` (`persistOutput`, which re-checks the copy), and only then shows the
   * Saved screen (and the share sheet when `share` is true). The source file is never written.
   */
  const saveAs = async (typedName: string, share: boolean) => {
    if (!document || savingRef.current) return;
    savingRef.current = true;
    setSaveSheetVisible(false);
    let exportedUri: string | null = null;
    setExportProgress({ completedPages: 0, totalPages: document.pages.length });
    try {
      const usedFamilies = new Set<DevanagariFontFamily>(['NotoSansDevanagari']);
      for (const p of document.pages) {
        for (const e of p.edits) {
          if (e.type === 'text' && e.fontFamily) {
            usedFamilies.add(e.fontFamily);
          }
        }
      }

      const embeddedFonts: Record<string, { base64: string; cssFontWeight: '100 900' | '400' }> =
        {};
      for (const family of usedFamilies) {
        const base64 = await getFontBase64(family);
        embeddedFonts[family] = {
          base64,
          cssFontWeight: fontFaceWeight(family),
        };
      }

      exportedUri = await exportPdf(document, embeddedFonts, setExportProgress);
      const fileName = outputFileName(typedName, defaultEditedName(document.displayName));
      const file: SavedFile = await persistOutput(
        exportedUri,
        'Edited',
        fileName,
        document.pages.length,
      );
      // Home cards show only a stored thumbnail, so give the new file its own.
      const thumbnailUri = await renderPage(file.uri, 0, THUMBNAIL_SCALE)
        .then((image) => image.uri)
        .catch(() => undefined);
      await addRecentFile({
        name: file.name,
        hindiName: file.name,
        uri: file.uri,
        thumbnailUri,
        sizeBytes: file.sizeBytes,
        pageCount: file.pageCount,
        category: 'downloads',
        starred: false,
      });
      setSavedEdits(editsSnapshot(document));
      setSaved(file);
      if (share) void savedActions.share(file);
    } catch (error) {
      console.warn('Editor save failed', error);
      showError({
        title: tx("Couldn't save the PDF", 'PDF सेव नहीं हो सकी'),
        body: tx(
          'Something went wrong while building the PDF. Your edits are still here. Try again.',
          'PDF बनाते समय गड़बड़ी हुई। आपके बदलाव सुरक्षित हैं। फिर से करें।',
        ),
        onRetry: () => void saveAs(typedName, share),
      });
    } finally {
      // persistOutput removes the export and any unverified copy; this covers a failure before
      // it ran. Only app-cache files are ever deleted, so the source PDF is never touched.
      if (exportedUri) await discardTemporaryOutput(exportedUri);
      savingRef.current = false;
      setExportProgress(null);
    }
  };

  const handleInsertBlank = async () => {
    if (!document) return;
    setFirstEditMade(true);
    checkpoint();
    const widthPt = page?.widthPt ?? 595;
    const heightPt = page?.heightPt ?? 842;
    const blank = await createBlankPage(widthPt, heightPt, RASTER_SCALE);
    insertPage(currentPageIndex + 1, {
      widthPt: blank.widthPt,
      heightPt: blank.heightPt,
      backgroundImageUri: blank.backgroundImageUri,
      imagePxWidth: blank.imagePxWidth,
      imagePxHeight: blank.imagePxHeight,
      edits: [],
      ocrLines: [],
      isBlank: true,
    });
    setCurrentPageIndex(currentPageIndex + 1);
  };

  /** Removes a line's text box and the cover it was paired with. */
  const removeLine = (edit: TextEdit) => {
    if (edit.replacement?.maskId) removeEdit(currentPageIndex, edit.replacement.maskId);
    removeEdit(currentPageIndex, edit.id);
  };

  /**
   * Closes the line sheet. A new text box left empty, or a detected line opened by this tap and
   * left exactly as detected (same text, same style), is dropped with its cover, not kept.
   */
  const finishEditing = () => {
    if (focusedEdit) {
      const created = createdLineRef.current;
      const emptyNewBox = !focusedEdit.replacement && focusedEdit.text.trim() === '';
      const untouched =
        created?.id === focusedEdit.id && isUntouchedReplacement(created, focusedEdit);
      // A line this tap created took its own checkpoint and nothing since, so reverting to it
      // leaves the page and history exactly as before the tap.
      if (created?.id === focusedEdit.id && (emptyNewBox || untouched)) revertToCheckpoint();
      else if (emptyNewBox) removeLine(focusedEdit);
    }
    createdLineRef.current = null;
    setFocusedEditId(null);
    Keyboard.dismiss();
  };

  /** Puts the open line back as it is in the source: drops its text box and cover (undoable). */
  const restoreOriginal = () => {
    if (focusedEdit) {
      lineSession.beforeChange();
      removeLine(focusedEdit);
    }
    createdLineRef.current = null;
    setFocusedEditId(null);
    Keyboard.dismiss();
  };

  const handleSelectFont = async (family: DevanagariFontFamily) => {
    if (!focusedEdit) return;
    if (isFontFamilyLoaded(family)) {
      changeLine(focusedEdit.id, { fontFamily: family });
      setFontPickerVisible(false);
      return;
    }

    setDownloadingFont(family);
    try {
      await installFontFamily(family);
      changeLine(focusedEdit.id, { fontFamily: family });
      setFontPickerVisible(false);
    } catch (err) {
      console.warn('Font download failed', err);
      showError({
        title: tx("Couldn't download the font", 'फ़ॉन्ट डाउनलोड नहीं हो सका'),
        body: tx(
          'Check your internet connection, then try again.',
          'इंटरनेट कनेक्शन जाँचें, फिर से करें।',
        ),
        onRetry: () => void handleSelectFont(family),
      });
    } finally {
      setDownloadingFont(null);
    }
  };

  const requestClose = () => {
    if (unsaved) setDiscardVisible(true);
    else onClose();
  };

  const selectMode = (mode: EditMode) => {
    finishEditing();
    setEditMode(mode);
  };

  // Registered after ToolShell's handler (the shell mounts first), so it runs first.
  useHardwareBack(() => {
    if (savingRef.current) return true;
    if (focusedEditId) {
      finishEditing();
      return true;
    }
    requestClose();
    return true;
  });

  if (saved) {
    return (
      <>
        <ToolDoneScreen
          title={tx('Edit PDF', 'PDF बदलें')}
          fileName={saved.name}
          fileUri={saved.uri}
          pageCount={saved.pageCount}
          sizeBytes={saved.sizeBytes}
          onOpen={() => savedActions.open(saved)}
          onShare={() => void savedActions.share(saved)}
          onSaveCopy={() => void savedActions.saveCopy(saved)}
          onClose={onClose}
        />
        {errorDialog}
      </>
    );
  }

  const title = document?.displayName ?? tx('Edit PDF', 'PDF बदलें');
  const changes = document ? changeCounts(document) : { lines: 0, pages: 0 };
  const saving = exportProgress !== null;
  const showHint =
    !firstEditMade && editMode === 'edit' && !editingBlocked && !focusedEdit && !showingOriginal;
  const toolbarBottom = insets.bottom + TOOLBAR_BOTTOM_GAP;

  return (
    <View style={{ flex: 1, backgroundColor: ui.readingBackdrop }}>
      <ReaderBar
        title={title}
        leadingIcon="close"
        onLeading={requestClose}
        actions={
          document ? (
            <>
              <SaveButton
                label={tx('Save', 'सेव करें')}
                disabled={saving}
                onPress={() => {
                  finishEditing();
                  setSaveSheetKey((k) => k + 1);
                  setSaveSheetVisible(true);
                }}
              />
              <BandIconButton
                icon="more-vert"
                label={tx('More options', 'और विकल्प')}
                onPress={() => setMenuVisible(true)}
              />
            </>
          ) : undefined
        }
      />
      {!document ? (
        opening ? (
          <ActivityIndicator style={{ marginTop: 64 }} size="large" color={ui.brandOnSurface} />
        ) : (
          <View style={{ gap: 24 }}>
            <ToolPickPrompt
              icon="edit-note"
              iconColor={ui.category.edit}
              title={tx('Choose a PDF to edit', 'बदलने के लिए PDF चुनें')}
              body={tx(
                'Your changes are saved as a new PDF. The original file is not changed.',
                'बदलाव नई PDF में सेव होते हैं। मूल फ़ाइल नहीं बदलती।',
              )}
            />
            <View style={{ alignSelf: 'center' }}>
              <PillButton
                title={tx('Choose a PDF', 'PDF चुनें')}
                onPress={() => void openPdfFile()}
              />
            </View>
          </View>
        )
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'android' ? 'height' : 'padding'}
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1 }}>
            {page && (
              <PdfPageViewer
                page={page}
                onTap={handleTap}
                focusedEditId={focusedEditId}
                onEditPinchStart={() => {
                  lineSession.beforeChange();
                  pinchStartSizeRef.current = focusedEdit?.fontSizePt ?? DEFAULT_FONT_SIZE_PT;
                }}
                onEditPinchResize={(editId, scale) =>
                  updateTextEdit(currentPageIndex, editId, {
                    fontSizePt: Math.min(
                      MAX_FONT_SIZE_PT,
                      Math.max(MIN_FONT_SIZE_PT, pinchStartSizeRef.current * scale),
                    ),
                  })
                }
                renderOverlays={(viewWidthDp) =>
                  showingOriginal ? null : (
                    <>
                      <OcrHighlightLayer
                        lines={page.ocrLines}
                        viewWidthDp={viewWidthDp}
                        pageWidthPt={page.widthPt}
                        visible={editMode === 'edit'}
                      />
                      <MaskOverlay
                        masks={page.edits.filter((e): e is MaskEdit => e.type === 'mask')}
                        viewWidthDp={viewWidthDp}
                        pageWidthPt={page.widthPt}
                        active={editMode === 'erase'}
                        onMaskDrawn={handleMaskDrawn}
                      />
                      {page.edits
                        .filter((e): e is TextEdit => e.type === 'text')
                        .map((textEdit) => (
                          <EditableTextOverlay
                            key={textEdit.id}
                            edit={textEdit}
                            viewWidthDp={viewWidthDp}
                            pageWidthPt={page.widthPt}
                            focused={focusedEditId === textEdit.id}
                          />
                        ))}
                    </>
                  )
                }
              />
            )}

            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              {replacementModeOn ? (
                <OldFontChip onPress={() => setLegacySheetReopened(true)} />
              ) : (
                <View />
              )}
              {document.pages.length > 1 && (
                <PagePill
                  pageIndex={currentPageIndex}
                  pageCount={document.pages.length}
                  onPage={(index) => {
                    finishEditing();
                    setCurrentPageIndex(index);
                  }}
                />
              )}
            </View>

            {showHint && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 12,
                  right: 12,
                  bottom: toolbarBottom + TOOLBAR_HEIGHT + 12,
                  alignItems: 'center',
                }}
              >
                <View
                  accessibilityLiveRegion="polite"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 9999,
                    backgroundColor: ui.chrome,
                  }}
                >
                  <UiText variant="label" color="#FFFFFF">
                    {tx('Tap a line to change it', 'बदलने के लिए पंक्ति टैप करें')}
                  </UiText>
                </View>
              </View>
            )}

            {!focusedEdit && (
              <View style={{ position: 'absolute', left: 12, right: 12, bottom: toolbarBottom }}>
                <EditToolbarBar
                  mode={editMode}
                  onMode={selectMode}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={undo}
                  onRedo={redo}
                  showingOriginal={showingOriginal}
                  onToggleOriginal={() => setShowingOriginal((on) => !on)}
                />
              </View>
            )}

            {saving && <SavingOverlay progress={exportProgress} />}
          </View>
          {focusedEdit && (
            <LineEditSheet
              key={focusedEdit.id}
              originalText={focusedEdit.replacement?.ocrLine?.text ?? ''}
              value={focusedEdit.text}
              onChange={(text) => changeLine(focusedEdit.id, { text })}
              fontLabel={fontLabel(focusedEdit.fontFamily)}
              sizePt={focusedEdit.fontSizePt}
              color={focusedEdit.color}
              bold={focusedEdit.fontWeight === 'bold'}
              onFont={() => setFontPickerVisible(true)}
              onSize={(fontSizePt) => changeLine(focusedEdit.id, { fontSizePt })}
              onColor={(color) => changeLine(focusedEdit.id, { color })}
              onBold={() =>
                changeLine(focusedEdit.id, {
                  fontWeight: focusedEdit.fontWeight === 'bold' ? 'normal' : 'bold',
                })
              }
              onDone={finishEditing}
              onRestore={restoreOriginal}
            />
          )}
        </KeyboardAvoidingView>
      )}

      <LegacyFontWarning
        visible={legacySheetVisible}
        onClose={() => {
          setLegacySheetReopened(false);
          setLegacySheetDismissedPages((prev) => new Set(prev).add(currentPageIndex));
        }}
        fontNames={policy.knownLegacyFontNames}
        inspectionFailed={policy.inspectionFailed}
        onEnableSafeReplacement={
          !policy.inspectionFailed
            ? () => {
                setLegacySheetReopened(false);
                setLegacyBypassPages((prev) => new Set(prev).add(currentPageIndex));
                snackbar.show(
                  tx(
                    'Old-font page: cover old text and type new text on top',
                    'पुराने फ़ॉन्ट वाला पृष्ठ: पुराना टेक्स्ट ढककर ऊपर नया लिखें',
                  ),
                );
              }
            : undefined
        }
      />

      {focusedEdit && (
        <FontPickerModal
          visible={fontPickerVisible}
          selectedFamily={focusedEdit.fontFamily}
          loadedFamilies={
            new Set<DevanagariFontFamily>([
              'NotoSansDevanagari',
              ...(isFontFamilyLoaded('Mukta') ? (['Mukta'] as DevanagariFontFamily[]) : []),
            ])
          }
          downloadingFamily={downloadingFont}
          onChoose={handleSelectFont}
          onClose={() => setFontPickerVisible(false)}
        />
      )}

      <BottomSheet visible={menuVisible} onClose={() => setMenuVisible(false)}>
        <ListRow
          icon="note-add"
          title={tx('Add a blank page after this one', 'इसके बाद खाली पृष्ठ जोड़ें')}
          onPress={() => {
            setMenuVisible(false);
            void handleInsertBlank();
          }}
        />
      </BottomSheet>

      {document && (
        <SaveSheet
          key={saveSheetKey}
          visible={saveSheetVisible}
          defaultName={defaultEditedName(document.displayName)}
          changedSummary={tx(
            changes.lines + ' lines changed on ' + changes.pages + ' pages',
            changes.pages + ' पृष्ठों पर ' + changes.lines + ' पंक्तियाँ बदलीं',
          )}
          onSave={(name) => void saveAs(name, false)}
          onShare={(name) => void saveAs(name, true)}
          onClose={() => setSaveSheetVisible(false)}
        />
      )}

      <Dialog
        visible={discardVisible}
        title={tx('Discard changes?', 'बदलाव हटाएँ?')}
        body={tx(
          'Your changes to this PDF are not saved yet.',
          'इस PDF में किए बदलाव अभी सेव नहीं हुए हैं।',
        )}
        cancelLabel={tx('Keep editing', 'बदलाव जारी रखें')}
        confirmLabel={tx('Discard', 'हटाएँ')}
        onCancel={() => setDiscardVisible(false)}
        onConfirm={() => {
          setDiscardVisible(false);
          onClose();
        }}
      />
      {errorDialog}
    </View>
  );
}

/** 40dp-tall brand pill for the editor bar, with a 48dp touch target. */
function SaveButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const ui = useUi();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: false }}
      style={{
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 9999,
        overflow: 'hidden',
        justifyContent: 'center',
        backgroundColor: ui.brand,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <UiText variant="label" color="#FFFFFF" style={{ fontSize: 14, fontWeight: '600' }}>
        {label}
      </UiText>
    </Pressable>
  );
}

/** Dark pill with previous and next page buttons (48dp) around `n / total`. */
function PagePill({
  pageIndex,
  pageCount,
  onPage,
}: {
  pageIndex: number;
  pageCount: number;
  onPage: (index: number) => void;
}) {
  const ui = useUi();
  const tx = useTx();
  const atStart = pageIndex === 0;
  const atEnd = pageIndex >= pageCount - 1;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 9999,
        backgroundColor: ui.chrome,
        elevation: 4,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx('Previous page', 'पिछला पृष्ठ')}
        accessibilityState={{ disabled: atStart }}
        disabled={atStart}
        onPress={() => onPage(pageIndex - 1)}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="chevron-left" size={24} color={atStart ? 'rgba(255,255,255,0.4)' : '#FFFFFF'} />
      </Pressable>
      <UiText variant="label" color="#FFFFFF" style={{ minWidth: 40, textAlign: 'center' }}>
        {`${pageIndex + 1} / ${pageCount}`}
      </UiText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx('Next page', 'अगला पृष्ठ')}
        accessibilityState={{ disabled: atEnd }}
        disabled={atEnd}
        onPress={() => onPage(pageIndex + 1)}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="chevron-right" size={24} color={atEnd ? 'rgba(255,255,255,0.4)' : '#FFFFFF'} />
      </Pressable>
    </View>
  );
}

/** Blocks the page while the export runs and shows `Saving page i of n`. */
function SavingOverlay({ progress }: { progress: ExportProgress | null }) {
  const ui = useUi();
  const tx = useTx();
  const done = Math.min((progress?.completedPages ?? 0) + 1, progress?.totalPages ?? 1);
  const total = progress?.totalPages ?? 1;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ui.scrim,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          gap: 16,
          paddingVertical: 24,
          paddingHorizontal: 32,
          borderRadius: 28,
          backgroundColor: ui.chrome,
        }}
      >
        <ActivityIndicator size="large" color="#FFFFFF" />
        <UiText color="#FFFFFF">
          {tx(`Saving page ${done} of ${total}`, `पृष्ठ ${done} / ${total} सेव हो रहा है`)}
        </UiText>
      </View>
    </View>
  );
}
