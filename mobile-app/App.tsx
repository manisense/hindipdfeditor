import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
// expo-file-system's top-level `readAsStringAsync` is a stub that unconditionally throws in
// this SDK version (confirmed on a real device - see CHANGELOG); the actual implementation now
// lives under the `/legacy` subpath, same as `exportPdf.ts`'s own use of this API.
import * as FileSystem from 'expo-file-system/legacy';
import { useFonts } from 'expo-font';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AboutModal } from './src/components/AboutModal';
import { AppButton } from './src/components/AppButton';
import { EditableTextOverlay } from './src/components/EditableTextOverlay';
import { EditToolbar } from './src/components/EditToolbar';
import { FontPickerModal } from './src/components/FontPickerModal';
import { LegacyFontWarning } from './src/components/LegacyFontWarning';
import { MaskOverlay, type DrawnMaskRect } from './src/components/MaskOverlay';
import { OcrHighlightLayer } from './src/components/OcrHighlightLayer';
import { PdfPageViewer } from './src/components/PdfPageViewer';
import { clearGeminiApiKey, getGeminiApiKey, setGeminiApiKey } from './src/lib/apiKeyStore';
import { createBlankPage } from './src/lib/blankPage';
import { ptSizeToImagePx, ptToImagePx } from './src/lib/coordinateMath';
import { exportPdf } from './src/lib/exportPdf';
import {
  fontFaceWeight,
  getFontBase64,
  installFontFamily,
  isFontFamilyLoaded,
  type DevanagariFontFamily,
} from './src/lib/fontAsset';
import { containsDevanagari, translateHindiLinesToEnglish } from './src/lib/geminiTranslate';
import { detectLegacyFonts } from './src/lib/legacyFontDetector';
import { legacyEditingPolicy, UNKNOWN_ENCODING_FONT_NAME } from './src/lib/legacyEditingPolicy';
import { detectTextLines, detectTextLinesWithGemini } from './src/lib/ocr';
import { findOcrTargetAt, findTextEditAt } from './src/lib/ocrHitTest';
import {
  getPageCount,
  renderPage,
  sampleAverageColor,
  sampleTextColor,
} from './src/lib/pdfToImages';
import { savePdfToPickedDirectory } from './src/lib/savePdf';
import { fontSizeForOcrLine, textBoxGeometry } from './src/lib/textEditGeometry';
import { geometryForTranslatedLine } from './src/lib/translateEdits';
import {
  useEditStore,
  type DocumentState,
  type MaskEdit,
  type OcrLine,
  type PageState,
  type TextEdit,
} from './src/state/editStore';
import { colors, radius, spacing } from './src/theme';

/**
 * Runs `legacyFontDetector.ts` against a freshly-picked document, in the fail-closed shape
 * AGENTS.md's font/encoding rule requires: a thrown/inconclusive detection result is treated
 * as "every page's encoding is unknown," not "assume Unicode, proceed" - so on any read or
 * parse failure this returns one warning per page instead of an empty array.
 */
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

/**
 * The full editor (spec Section 10, Phases 1-4 plus Phase 4.5 OCR-assisted tap-to-edit and
 * the post-4.5 polish pass): pick an existing PDF, browse its pages, tap detected existing
 * text to mask-and-edit it in place (on-device ML Kit OCR via `ocr.ts` finds where text is
 * and pre-fills what it says), tap empty space to add new Hindi text, or drag out a manual
 * mask in replace mode as the fallback for anything OCR misses - then export every page in
 * one PDF. Focused edits get a contextual toolbar (font size, delete-with-restore); every
 * committing gesture takes an undo checkpoint (`editStore.checkpoint`/`undo`). Pages whose
 * embedded font matches a known pre-Unicode legacy pattern (or whose font couldn't be
 * inspected at all) are detected on open and have all edit paths disabled - see
 * `legacyFontDetector.ts`/`LegacyFontWarning.tsx` and spec Section 9.
 *
 * Deliberately does NOT use `react-native-pdf` for this screen, unlike Section 10's Phase 1
 * checklist wording. Section 6's own module spec defines `PdfPageViewer.tsx` as "background
 * image + live overlays," not a live `react-native-pdf` render - the whole Render & Print
 * architecture depends on the edit canvas being the exact same rasterized image the export
 * pipeline uses, not a second, independent PDF renderer that could disagree with it
 * pixel-for-pixel. `expo-document-picker` covers "open from device storage"; the unused
 * `react-native-pdf` dependency was removed later as recorded in ADR 0006.
 *
 * All pages are rasterized up front at open time, not lazily per navigation - per AGENTS.md's
 * performance guidance, don't pre-optimize for large documents until a real device actually
 * shows a problem; `DocumentState.pages` was already a dense array sized to the whole document
 * (spec Section 7), so eager rasterization needed no data-model change.
 */

// Default new text size, in PDF points - a reasonable starting size for a body-text edit;
// adjustable per edit via the EditToolbar once the edit is focused.
const DEFAULT_FONT_SIZE_PT = 14;
// Output px per PDF point when rasterizing the page background - see spec Section 4.1/AGENTS.md's
// "2-3x, not arbitrarily higher" performance constraint.
const RASTER_SCALE = 3;
// Width, in background-image px, of the band sampled just outside a drawn mask rectangle to
// pick its fill color (Phase 3, spec Section 8) - a few points' worth at RASTER_SCALE, enough
// to average past a little JPEG noise without reaching into an unrelated neighboring text line.
const MASK_SAMPLE_MARGIN_PX = 16;
// Safety margin, in PDF points, added around a user-drawn mask rectangle before it's stored and
// sampled. A box drawn exactly to the visible edge of the original text still leaves its
// anti-aliased/JPEG-ringing pixels just outside that edge unmasked - a thin sliver of the old
// glyph's outline, which is exactly the "I can still see a box" symptom this fixes. The
// replacement TextEdit is still anchored at the un-expanded drag point, so this only grows mask
// coverage, not the text's apparent position.
const MASK_EXPAND_PT = 3;
// Extra mask padding ABOVE an OCR-detected line, as a fraction of the line's height, on top
// of the flat MASK_EXPAND_PT. ML Kit's Devanagari line boxes hug the shirorekha band and cut
// through tall upper matras (ॉ, ें) - confirmed on-device with the scanned leave form, where a
// matra sliver stayed visible above the mask. Deliberately asymmetric: padding below at the
// same ratio visibly swallowed the top of the next line on the same form (its lines sit only
// a few points apart), and ML Kit's boxes already include descenders, so below gets only the
// flat MASK_EXPAND_PT.
const OCR_MASK_PAD_TOP_RATIO = 0.35;
// Replacement text can legitimately run a little longer than the original scanned line (OCR
// replacements wrap at TextEdit.widthPt - see that field's docstring), so the editable width
// gets this much slack beyond the detected box before wrapping kicks in.
const OCR_TEXT_WIDTH_SLACK_RATIO = 1.25;
// Nudge replacement text downward within an OCR line box so the live overlay aligns closer
// to the original text baseline (ML Kit boxes hug the shirorekha band).
const OCR_TEXT_BASELINE_NUDGE_RATIO = 0.06;

/** Tap-to-replace OCR text, drag-to-mask erase regions, or place new overlay text. */
type EditMode = 'edit' | 'addText' | 'erase';

/** Per-page on-device OCR progress, keyed by page index - absent means not yet attempted. */
type OcrStatusByPage = Record<number, 'running' | 'done' | 'failed'>;

type Status =
  | { state: 'idle' }
  | { state: 'opening' }
  | { state: 'saving' }
  | { state: 'saved'; uri: string; savedUri?: string }
  | { state: 'error'; message: string };

function filenameFromUri(uri: string): string {
  const encodedName = uri.split('/').pop() ?? 'Document.pdf';
  try {
    return decodeURIComponent(encodedName);
  } catch {
    return encodedName;
  }
}

export default function App() {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWideLayout = windowWidth >= 840;
  const [fontsLoaded] = useFonts({
    NotoSansDevanagari: require('./assets/fonts/NotoSansDevanagari-Variable.ttf'),
  });
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [focusedEditId, setFocusedEditId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  /** OCR replacement edits select all text on first focus so typing replaces instantly. */
  const [selectAllEditId, setSelectAllEditId] = useState<string | null>(null);

  // OCR-assisted tap-to-edit: per-page detection progress (drives the hint text). Reset
  // whenever a new document is opened (see `openPdf`), since page indices only mean anything
  // within one document.
  const [ocrStatusByPage, setOcrStatusByPage] = useState<OcrStatusByPage>({});
  // Pages OCR has already been kicked off for, so navigating back and forth doesn't re-run
  // detection. A ref (not state): this is bookkeeping for the trigger, never rendered.
  const ocrAttemptedPagesRef = useRef(new Set<number>());
  // "Enhance with AI" (opt-in Gemini cloud OCR): which page a cloud pass is currently running
  // for (null = none), and whether the one-time API key prompt is showing.
  const [enhancingPage, setEnhancingPage] = useState<number | null>(null);
  const [translating, setTranslating] = useState(false);
  const [apiKeyPromptVisible, setApiKeyPromptVisible] = useState(false);
  const [apiKeyPurpose, setApiKeyPurpose] = useState<'enhance' | 'translate'>('enhance');
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [aboutVisible, setAboutVisible] = useState(false);
  const [fontPickerVisible, setFontPickerVisible] = useState(false);
  const [downloadingFont, setDownloadingFont] = useState<DevanagariFontFamily | null>(null);
  const [loadedFontFamilies, setLoadedFontFamilies] = useState<Set<DevanagariFontFamily>>(
    () => new Set(['NotoSansDevanagari']),
  );
  const [defaultFontFamily, setDefaultFontFamily] =
    useState<DevanagariFontFamily>('NotoSansDevanagari');
  const [legacySafeModePages, setLegacySafeModePages] = useState<Set<number>>(() => new Set());
  const [editMode, setEditMode] = useState<EditMode>('edit');
  const [pageZoom, setPageZoom] = useState(1);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const editPinchStartRef = useRef<{ fontSizePt: number; widthPt?: number } | null>(null);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const document = useEditStore((s) => s.document);
  const loadDocument = useEditStore((s) => s.loadDocument);
  const addTextEdit = useEditStore((s) => s.addTextEdit);
  const addMaskEdit = useEditStore((s) => s.addMaskEdit);
  const insertPage = useEditStore((s) => s.insertPage);
  const updateTextEdit = useEditStore((s) => s.updateTextEdit);
  const removeEdit = useEditStore((s) => s.removeEdit);
  const setOcrLines = useEditStore((s) => s.setOcrLines);
  const checkpoint = useEditStore((s) => s.checkpoint);
  const undo = useEditStore((s) => s.undo);
  const redo = useEditStore((s) => s.redo);
  const canUndo = useEditStore((s) => s.history.length > 0);
  const canRedo = useEditStore((s) => s.future.length > 0);

  const openPdf = async () => {
    setStatus({ state: 'opening' });
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (result.canceled) {
        setStatus({ state: 'idle' });
        return;
      }
      const sourceUri = result.assets[0].uri;

      const pageCount = await getPageCount(sourceUri);
      const pages: PageState[] = [];
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const image = await renderPage(sourceUri, pageIndex, RASTER_SCALE);
        pages.push({
          pageIndex,
          // The renderer computed pxWidth/pxHeight as round(widthPt * scale) - dividing back by
          // the same scale we passed recovers the page's real point-dimensions without a second,
          // independent read of the source file (see exportPdf.ts's docstring for why this
          // single-source-of-truth matters).
          widthPt: image.pxWidth / RASTER_SCALE,
          heightPt: image.pxHeight / RASTER_SCALE,
          backgroundImageUri: image.uri,
          imagePxWidth: image.pxWidth,
          imagePxHeight: image.pxHeight,
          edits: [],
          ocrLines: [],
        });
      }
      const legacyFontWarnings = await detectLegacyFontWarnings(sourceUri, pageCount);
      const newDocument: DocumentState = { sourceUri, pageCount, pages, legacyFontWarnings };
      loadDocument(newDocument);
      setCurrentPageIndex(0);
      setFocusedEditId(null);
      setSelectAllEditId(null);
      ocrAttemptedPagesRef.current.clear();
      setOcrStatusByPage({});
      setEditMode('edit');
      setLegacySafeModePages(new Set());
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

  // Phase 4 (spec Section 9): distinct legacy font names flagged on the page currently being
  // viewed. Unknown inspection always blocks; a known legacy match blocks until explicit
  // raster-only Unicode replacement is enabled for this page. This stays per-page because only
  // some pages of a document may use legacy fonts.
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
  const safeLegacyReplacementEnabled = legacySafeModePages.has(currentPageIndex);
  const {
    inspectionFailed: fontInspectionFailed,
    knownLegacyFontNames,
    editingBlocked,
  } = legacyEditingPolicy(currentPageLegacyFontNames, safeLegacyReplacementEnabled);

  const ensureOcrForPage = (
    doc: DocumentState,
    pageIndex: number,
    allowKnownLegacyReplacement = false,
  ) => {
    const pageState = doc.pages[pageIndex];
    if (!pageState) return;
    // Same fail-closed rule as every edit path: a legacy/unknown-encoding page blocks editing,
    // so detecting tappable text on it would only advertise an interaction that's disabled.
    const warnings = doc.legacyFontWarnings.filter((warning) => warning.page === pageIndex);
    if (warnings.some((warning) => warning.fontName === UNKNOWN_ENCODING_FONT_NAME)) return;
    if (warnings.length > 0 && !allowKnownLegacyReplacement) return;
    if (ocrAttemptedPagesRef.current.has(pageIndex)) return;
    ocrAttemptedPagesRef.current.add(pageIndex);

    setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'running' }));
    detectTextLines(pageState)
      .then((lines) => {
        // A different document may have been opened while detection ran - never write a stale
        // result into whatever happens to be loaded now.
        if (useEditStore.getState().document?.sourceUri !== doc.sourceUri) return;
        setOcrLines(pageIndex, lines);
        setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'done' }));
      })
      .catch((error) => {
        // Fails open to manual editing (tap-to-add and drag-to-mask both still work) but the
        // failure is surfaced in the hint text, not silently swallowed - the user should know
        // why nothing on this page is highlighted as tappable.
        console.warn(`OCR failed on page ${pageIndex}`, error);
        if (useEditStore.getState().document?.sourceUri !== doc.sourceUri) return;
        setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'failed' }));
      });
  };

  /** Runs on-device OCR for every page in the background so text is tappable as soon as ready. */
  const ensureOcrForAllPages = (doc: DocumentState) => {
    for (let pageIndex = 0; pageIndex < doc.pages.length; pageIndex++) {
      ensureOcrForPage(doc, pageIndex);
    }
  };

  const goToPage = (index: number) => {
    if (!document || index < 0 || index >= document.pages.length) return;
    setCurrentPageIndex(index);
    setFocusedEditId(null);
    ensureOcrForPage(document, index, legacySafeModePages.has(index));
  };

  const handleUndo = () => {
    // The focused input may be about to disappear with the undone state - drop focus first so
    // its blur handler can't fire against an edit the undo already removed.
    setFocusedEditId(null);
    Keyboard.dismiss();
    undo();
  };

  const handleRedo = () => {
    setFocusedEditId(null);
    Keyboard.dismiss();
    redo();
  };

  const enableLegacyUnicodeReplacement = () => {
    if (!document || knownLegacyFontNames.length === 0 || fontInspectionFailed) return;
    setLegacySafeModePages((current) => new Set(current).add(currentPageIndex));
    setEditMode('edit');
    ensureOcrForPage(document, currentPageIndex, true);
  };

  const confirmLegacyUnicodeReplacement = () => {
    Alert.alert(
      'Enable Unicode replacement mode?',
      'The original PDF remains untouched. This page will be edited as a raster background with real Unicode text overlays; the app will not treat the legacy-encoded text layer as Unicode.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enable', onPress: enableLegacyUnicodeReplacement },
      ],
    );
  };

  const applyFontFamily = (family: DevanagariFontFamily) => {
    setDefaultFontFamily(family);
    if (focusedEdit) {
      checkpoint();
      updateTextEdit(currentPageIndex, focusedEdit.id, { fontFamily: family });
    }
  };

  const chooseFontFamily = async (family: DevanagariFontFamily) => {
    try {
      if (!isFontFamilyLoaded(family)) {
        setDownloadingFont(family);
        await installFontFamily(family);
        setLoadedFontFamilies((current) => new Set(current).add(family));
      }
      applyFontFamily(family);
      setFontPickerVisible(false);
    } catch (error) {
      Alert.alert('Font download failed', error instanceof Error ? error.message : String(error));
    } finally {
      setDownloadingFont(null);
    }
  };

  const addBlankPageAfterCurrent = async () => {
    if (!page || Object.values(ocrStatusByPage).some((state) => state === 'running')) return;
    const insertIndex = currentPageIndex + 1;
    try {
      const blankPage = await createBlankPage(page.widthPt, page.heightPt, RASTER_SCALE);
      checkpoint();
      insertPage(insertIndex, blankPage);

      const shiftedAttempts = new Set<number>();
      for (const pageIndex of ocrAttemptedPagesRef.current) {
        shiftedAttempts.add(pageIndex >= insertIndex ? pageIndex + 1 : pageIndex);
      }
      shiftedAttempts.add(insertIndex);
      ocrAttemptedPagesRef.current = shiftedAttempts;
      setLegacySafeModePages((current) => {
        const shifted = new Set<number>();
        for (const pageIndex of current) {
          shifted.add(pageIndex >= insertIndex ? pageIndex + 1 : pageIndex);
        }
        return shifted;
      });
      setOcrStatusByPage((current) => {
        const shifted: OcrStatusByPage = { [insertIndex]: 'done' };
        for (const [rawIndex, state] of Object.entries(current)) {
          const pageIndex = Number(rawIndex);
          shifted[pageIndex >= insertIndex ? pageIndex + 1 : pageIndex] = state;
        }
        return shifted;
      });

      setCurrentPageIndex(insertIndex);
      setFocusedEditId(null);
      setEditMode('addText');
      setStatus({ state: 'idle' });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleEditDone = () => {
    // Clearing focus state alone doesn't blur the native TextInput, so dismiss explicitly -
    // otherwise "Done" leaves the keyboard covering half the page.
    setFocusedEditId(null);
    Keyboard.dismiss();
  };

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

  const handleEditMoveStart = () => {
    checkpoint();
  };

  const selectEditMode = (mode: EditMode) => {
    setEditMode(mode);
    setFocusedEditId(null);
    Keyboard.dismiss();
  };

  /**
   * Runs the opt-in Gemini cloud OCR pass over the current page and replaces its detected
   * lines with the (usually more accurate) cloud result. This is the only action in the app
   * that sends document content off-device, which is why it only ever runs from an explicit
   * button press - never automatically - and why the API key prompt below spells that out.
   */
  const runEnhanceWithAi = async (apiKey: string) => {
    if (!document || !page || editingBlocked || enhancingPage !== null) return;
    const pageIndex = currentPageIndex;
    const sourceUri = document.sourceUri;
    setEnhancingPage(pageIndex);
    try {
      const lines = await detectTextLinesWithGemini(page, apiKey);
      if (useEditStore.getState().document?.sourceUri !== sourceUri) return;
      setOcrLines(pageIndex, lines);
      setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'done' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A rejected key is the one failure the user can only fix by re-entering it, so clear
      // the stored key and let the next button press re-prompt instead of failing forever.
      if (/api key/i.test(message)) {
        await clearGeminiApiKey().catch(() => {});
      }
      Alert.alert('Enhance with AI failed', message);
    } finally {
      setEnhancingPage(null);
    }
  };

  const handleEnhancePressed = async () => {
    const storedKey = await getGeminiApiKey().catch(() => null);
    if (storedKey) {
      await runEnhanceWithAi(storedKey);
    } else {
      setApiKeyPurpose('enhance');
      setApiKeyDraft('');
      setApiKeyPromptVisible(true);
    }
  };

  /**
   * Detects Hindi lines across the open document, translates them to English via Gemini, and
   * applies mask + English text overlays (same Plan A export path as tap-to-edit). Opt-in only:
   * sends line text (not page images) to Google using the user's API key.
   */
  const runTranslateToEnglish = async (apiKey: string) => {
    const doc = useEditStore.getState().document;
    if (!doc || translating || enhancingPage !== null) return;
    setTranslating(true);
    try {
      checkpoint();
      let translatedCount = 0;
      const legacyPages = new Set(doc.legacyFontWarnings.map((w) => w.page));

      for (let pageIndex = 0; pageIndex < doc.pages.length; pageIndex++) {
        if (legacyPages.has(pageIndex)) continue;
        const page = useEditStore.getState().document?.pages[pageIndex];
        if (!page) continue;

        let lines = page.ocrLines;
        if (lines.length === 0) {
          try {
            lines = await detectTextLines(page);
            if (useEditStore.getState().document?.sourceUri !== doc.sourceUri) return;
            setOcrLines(pageIndex, lines);
            setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'done' }));
          } catch (error) {
            console.warn(`OCR failed on page ${pageIndex} during translate`, error);
            setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'failed' }));
            continue;
          }
        }

        const hindiLines = lines.filter((l) => containsDevanagari(l.text));
        if (hindiLines.length === 0) continue;

        const english = await translateHindiLinesToEnglish(
          hindiLines.map((l) => l.text),
          apiKey,
        );
        if (useEditStore.getState().document?.sourceUri !== doc.sourceUri) return;

        const hindiIds = new Set(hindiLines.map((l) => l.id));
        setOcrLines(
          pageIndex,
          lines.filter((l) => !hindiIds.has(l.id)),
        );

        for (let j = 0; j < hindiLines.length; j++) {
          const line = hindiLines[j];
          const translated = english[j]?.trim();
          if (!translated) continue;

          const geo = geometryForTranslatedLine(line, page.widthPt, page.heightPt);
          const { x: sampleXPx, y: sampleYPx } = ptToImagePx(
            line.xPt,
            line.yPt,
            page.imagePxWidth,
            page.widthPt,
          );
          const { wPx: sampleWPx, hPx: sampleHPx } = ptSizeToImagePx(
            line.wPt,
            line.hPt,
            page.imagePxWidth,
            page.widthPt,
          );
          const { x: maskXPx, y: maskYPx } = ptToImagePx(
            geo.mask.xPt,
            geo.mask.yPt,
            page.imagePxWidth,
            page.widthPt,
          );
          const { wPx: maskWPx, hPx: maskHPx } = ptSizeToImagePx(
            geo.mask.wPt,
            geo.mask.hPt,
            page.imagePxWidth,
            page.widthPt,
          );

          let maskColor = '#ffffff';
          let textColor = '#111111';
          try {
            maskColor = await sampleAverageColor(
              page.backgroundImageUri,
              Math.round(maskXPx),
              Math.round(maskYPx),
              Math.round(maskWPx),
              Math.round(maskHPx),
              16,
            );
          } catch (error) {
            console.warn('sampleAverageColor failed during translate', error);
          }
          try {
            textColor = await sampleTextColor(
              page.backgroundImageUri,
              Math.round(sampleXPx),
              Math.round(sampleYPx),
              Math.round(sampleWPx),
              Math.round(sampleHPx),
            );
          } catch (error) {
            console.warn('sampleTextColor failed during translate', error);
          }

          const maskEdit = addMaskEdit(pageIndex, {
            xPt: geo.mask.xPt,
            yPt: geo.mask.yPt,
            wPt: geo.mask.wPt,
            hPt: geo.mask.hPt,
            color: maskColor,
          });
          addTextEdit(pageIndex, {
            xPt: geo.text.xPt,
            yPt: geo.text.yPt,
            fontSizePt: geo.text.fontSizePt,
            text: translated,
            color: textColor,
            fontFamily: defaultFontFamily,
            fontWeight: geo.text.fontWeight,
            widthPt: geo.text.widthPt,
            replacement: { maskId: maskEdit.id, ocrLine: line },
          });
          translatedCount += 1;
        }
      }

      if (translatedCount === 0) {
        Alert.alert(
          'Nothing to translate',
          'No Hindi (Devanagari) text was found. Try Enhance with AI on scanned pages, then translate again.',
        );
      } else {
        Alert.alert(
          'Translation ready',
          `Replaced ${translatedCount} Hindi line${translatedCount === 1 ? '' : 's'} with English. Review the overlays, then tap Export PDF.`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/api key/i.test(message)) {
        await clearGeminiApiKey().catch(() => {});
      }
      Alert.alert('Translate failed', message);
    } finally {
      setTranslating(false);
    }
  };

  const handleTranslatePressed = async () => {
    const storedKey = await getGeminiApiKey().catch(() => null);
    if (storedKey) {
      await runTranslateToEnglish(storedKey);
    } else {
      setApiKeyPurpose('translate');
      setApiKeyDraft('');
      setApiKeyPromptVisible(true);
    }
  };

  const handleApiKeySubmitted = async () => {
    const key = apiKeyDraft.trim();
    if (key === '') return;
    setApiKeyPromptVisible(false);
    await setGeminiApiKey(key).catch((error) => {
      // Key storage failing shouldn't block this one run - it just means re-entry next time.
      console.warn('Failed to persist Gemini API key', error);
    });
    if (apiKeyPurpose === 'translate') {
      await runTranslateToEnglish(key);
    } else {
      await runEnhanceWithAi(key);
    }
  };

  /**
   * The one shared mask-and-replace path, used by both manual drag-to-mask (Phase 3) and
   * OCR-assisted tap-to-edit: grows `rect` by MASK_EXPAND_PT (clamped to the page), samples
   * the surrounding background color, commits the `MaskEdit`, then commits and focuses a
   * replacement `TextEdit`. The text is described separately from the mask rectangle because
   * the OCR path pads the mask taller than the detected line (see OCR_MASK_PAD_TOP_RATIO)
   * while anchoring the text at the line's own origin; the manual path passes the same origin
   * for both. All `text` fields are in PDF points except the text itself. `consumedOcrLine`
   * is stored on the TextEdit so undo/redo and delete restore the whole replacement group.
   */
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

    // Grow the raw rectangle by MASK_EXPAND_PT before it's used for anything, clamped to
    // the page - see that constant's docstring for why.
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
      // Fails closed to a plain white fill rather than blocking the mask entirely - same
      // "never assume, warn instead" spirit as AGENTS.md's font-detection rule, applied here
      // to color sampling.
      console.warn('sampleAverageColor failed, falling back to white', error);
    }

    const maskEdit = addMaskEdit(currentPageIndex, {
      xPt: maskRect.xPt,
      yPt: maskRect.yPt,
      wPt: maskRect.wPt,
      hPt: maskRect.hPt,
      color,
    });

    const textGeometry = textBoxGeometry(page.widthPt, text.xPt, text.widthPt);
    const textEdit = addTextEdit(currentPageIndex, {
      xPt: textGeometry.xPt,
      yPt: text.yPt,
      fontSizePt: text.fontSizePt,
      text: text.prefill,
      color: text.color ?? '#111111',
      fontFamily: text.fontFamily ?? defaultFontFamily,
      ...(text.fontWeight ? { fontWeight: text.fontWeight } : {}),
      widthPt: textGeometry.widthPt,
      replacement: { maskId: maskEdit.id, ocrLine: consumedOcrLine },
    });
    setFocusedEditId(textEdit.id);
    if (consumedOcrLine) {
      setSelectAllEditId(textEdit.id);
    }
  };

  /**
   * Removes a `TextEdit` together with whatever it was created with (see `EditPairing`):
   * its mask, and - for an OCR replacement - the consumed OCR line is put back, restoring
   * the original scanned text and its tappable highlight. Used by the toolbar's Delete and
   * by blurring an OCR replacement empty.
   */
  const removeEditGroup = (id: string) => {
    const replacement = page?.edits.find(
      (edit): edit is TextEdit => edit.type === 'text' && edit.id === id,
    )?.replacement;
    checkpoint();
    removeEdit(currentPageIndex, id);
    if (replacement?.maskId) removeEdit(currentPageIndex, replacement.maskId);
    if (replacement?.ocrLine && page) {
      setOcrLines(currentPageIndex, [...page.ocrLines, replacement.ocrLine]);
    }
    if (focusedEditId === id) setFocusedEditId(null);
  };

  const handleTap = async (xPt: number, yPt: number) => {
    if (editingBlocked || editMode === 'erase') return;
    if (!page) return;

    const textEdits = page.edits.filter((e): e is TextEdit => e.type === 'text');
    const hitEdit = findTextEditAt(textEdits, xPt, yPt);

    // While one edit is open, the first tap anywhere else only dismisses it — including on
    // another text box or OCR line — so switching targets always takes two deliberate taps.
    if (focusedEditId) {
      if (hitEdit?.id === focusedEditId) {
        return;
      }
      Keyboard.dismiss();
      setFocusedEditId(null);
      return;
    }

    if (hitEdit) {
      setFocusedEditId(hitEdit.id);
      return;
    }

    const hitLine = findOcrTargetAt(page.ocrLines, xPt, yPt);
    if (hitLine) {
      // One checkpoint for the whole group (consume line + mask + text) = one undo step.
      checkpoint();
      // Consume the line so its highlight disappears and a second tap can't double-mask it.
      setOcrLines(
        currentPageIndex,
        page.ocrLines.filter((l) => l.id !== hitLine.id),
      );
      const fontSizePt = fontSizeForOcrLine(hitLine.hPt);
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
      // Mask taller than the detected box, upward only (see OCR_MASK_PAD_TOP_RATIO's
      // docstring), but keep the replacement text anchored at the detected line's own origin.
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

    const pageLooksEmpty =
      page.isBlank === true ||
      (ocrStatusByPage[currentPageIndex] === 'done' && page.ocrLines.length === 0);

    // A confirmed-empty page accepts typing directly in Edit mode too; requiring the user to
    // discover a separate Add Text toggle when there is literally nothing to select made empty
    // pages appear non-editable. Non-empty pages retain the explicit Add Text behavior.
    if (editMode !== 'addText' && !(editMode === 'edit' && pageLooksEmpty)) {
      return;
    }

    // Don't spawn a free-floating text box while OCR is still scanning — the user likely
    // tapped existing text that isn't tappable yet.
    if (ocrStatusByPage[currentPageIndex] === 'running') {
      return;
    }

    checkpoint();
    const geometry = textBoxGeometry(page.widthPt, xPt);
    const edit = addTextEdit(currentPageIndex, {
      xPt: geometry.xPt,
      yPt,
      fontSizePt: DEFAULT_FONT_SIZE_PT,
      text: '',
      color: '#111111',
      fontFamily: defaultFontFamily,
      widthPt: geometry.widthPt,
    });
    setFocusedEditId(edit.id);
  };

  const handleBlur = (id: string, text: string) => {
    if (text.trim().length === 0) {
      const replacement = page?.edits.find(
        (edit): edit is TextEdit => edit.type === 'text' && edit.id === id,
      )?.replacement;
      if (replacement?.ocrLine) {
        // Blurring an OCR replacement empty means "never mind" - removing just the text would
        // leave its mask silently hiding the original, so the whole group goes and the
        // original text comes back.
        removeEditGroup(id);
        return;
      }
      // A manually-masked region blurred empty keeps its mask: the user explicitly drew it,
      // and "erase this text" (mask, no replacement) is a legitimate outcome. A plain
      // tap-to-add edit has no pairing, so this just removes the abandoned empty input.
      removeEdit(currentPageIndex, id);
    }
    if (focusedEditId === id) {
      setFocusedEditId(null);
    }
  };

  const handleMaskDrawn = async (rect: DrawnMaskRect) => {
    if (!page || editingBlocked || editMode !== 'erase') return;
    checkpoint();
    const geometry = textBoxGeometry(page.widthPt, rect.xPt, Math.max(72, rect.wPt * 1.25));
    await maskAndReplaceRegion(rect, {
      xPt: geometry.xPt,
      yPt: rect.yPt,
      prefill: '',
      fontSizePt: DEFAULT_FONT_SIZE_PT,
      widthPt: geometry.widthPt,
    });
  };

  const saveAndExport = async () => {
    if (!document) return;
    setStatus({ state: 'saving' });
    try {
      const usedFamilies = new Set<DevanagariFontFamily>();
      for (const page of document.pages) {
        for (const edit of page.edits) {
          if (edit.type === 'text') usedFamilies.add(edit.fontFamily);
        }
      }
      if (usedFamilies.size === 0) usedFamilies.add(defaultFontFamily);
      const embeddedFonts = Object.fromEntries(
        await Promise.all(
          [...usedFamilies].map(
            async (family) =>
              [
                family,
                {
                  base64: await getFontBase64(family),
                  cssFontWeight: fontFaceWeight(family),
                },
              ] as const,
          ),
        ),
      );
      const uri = await exportPdf(document, embeddedFonts);
      setStatus({ state: 'saved', uri });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const shareResult = async () => {
    if (status.state !== 'saved') return;
    if (!(await Sharing.isAvailableAsync())) {
      setStatus({ state: 'error', message: 'Sharing is not available on this device.' });
      return;
    }
    await Sharing.shareAsync(status.uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  };

  const saveResultToFolder = async () => {
    if (status.state !== 'saved') return;
    try {
      const savedUri = await savePdfToPickedDirectory(status.uri, documentName);
      if (savedUri) setStatus({ ...status, savedUri });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const ocrStatus = ocrStatusByPage[currentPageIndex];
  const ocrReadyCount = document
    ? Object.values(ocrStatusByPage).filter((s) => s === 'done').length
    : 0;
  const hasRunningOcr = Object.values(ocrStatusByPage).some((state) => state === 'running');
  const pageLooksEmpty =
    page?.isBlank === true ||
    (ocrStatus === 'done' && page?.ocrLines.length === 0 && page.edits.length === 0);
  const zoomHint =
    pageZoom > 1.01
      ? ` One finger to pan (${Math.round(pageZoom * 100)}% zoom). Pinch to zoom.`
      : ' Pinch to zoom in. One finger to pan when zoomed.';
  const editStretchHint = focusedEdit ? ' Pinch with 2 fingers on selected text to resize.' : '';
  const hintText = editingBlocked
    ? 'Editing is disabled on this page — see the warning above.'
    : editMode === 'erase'
      ? `Erase mode — drag a box over text OCR missed, then type replacement text.${zoomHint}`
      : editMode === 'addText'
        ? ocrStatus === 'running'
          ? `Finding text… (${ocrReadyCount}/${document?.pages.length ?? 0} pages ready)`
          : `Add Text — tap anywhere to place new text.${zoomHint}${editStretchHint}`
        : pageLooksEmpty
          ? `This page is empty — tap anywhere to start writing.${zoomHint}`
          : ocrStatus === 'running'
            ? `Finding text… (${ocrReadyCount}/${document?.pages.length ?? 0} pages ready)`
            : ocrStatus === 'failed'
              ? `Edit text — tap a line to change it.${zoomHint}${editStretchHint}`
              : `Edit text — tap any detected line to change it.${zoomHint}${editStretchHint}`;
  const documentName = document ? filenameFromUri(document.sourceUri) : '';
  const compactEditing = keyboardVisible && focusedEdit !== null;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {!document && (
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.brandIdentity}>
            <Image source={require('./assets/icon.png')} style={styles.brandLogo} />
            <View>
              <Text style={styles.headerTitle}>Hindi PDF Editor</Text>
              <Text style={styles.headerSubtitle}>हिंदी दस्तावेज़, सही आकार में</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <AppButton title="About" small variant="ghost" onPress={() => setAboutVisible(true)} />
            <AppButton
              title="Open PDF"
              small
              onPress={openPdf}
              disabled={status.state === 'opening'}
            />
          </View>
        </View>
      )}

      {status.state === 'opening' && (
        <View style={[styles.centered, styles.fill, styles.openingSurface]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.progressText}>Opening PDF…</Text>
          <Text style={styles.progressSubText}>
            Preparing crisp pages and finding editable text
          </Text>
        </View>
      )}

      {status.state !== 'opening' && !document && (
        <ScrollView
          contentContainerStyle={[styles.landing, { paddingBottom: 48 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.homeGreeting}>
            <Text style={styles.homeGreetingTitle}>नमस्ते 👋</Text>
            <Text style={styles.homeGreetingBody}>
              अपनी हिंदी PDF को आसानी से पढ़ें, बदलें और सुरक्षित रखें।
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a PDF to edit"
            onPress={openPdf}
            style={({ pressed }) => [styles.openPdfCard, pressed && styles.toolCardPressed]}
          >
            <View style={styles.openPdfIcon}>
              <Text style={styles.openPdfIconText}>PDF</Text>
            </View>
            <View style={styles.openPdfCopy}>
              <Text style={styles.openPdfTitle}>अपनी PDF खोलें</Text>
              <Text style={styles.openPdfSubtitle}>Edit, OCR और Translate शुरू करें</Text>
            </View>
            <Text style={styles.openPdfArrow}>›</Text>
          </Pressable>

          <View style={styles.featureHeadingRow}>
            <Text style={styles.featureHeading}>Tools · टूल्स</Text>
            <Text style={styles.featureHeadingMeta}>PDF चुनकर शुरू करें</Text>
          </View>
          <View style={styles.toolGrid}>
            <ToolCard
              icon="✎"
              title="Edit"
              hindiTitle="एडिट करें"
              tint="#DCE8FF"
              accent={colors.primary}
              onPress={openPdf}
            />
            <ToolCard
              icon="文"
              title="Translate"
              hindiTitle="अनुवाद"
              tint="#DDF5E7"
              accent={colors.success}
              onPress={openPdf}
            />
            <ToolCard
              icon="▣"
              title="OCR"
              hindiTitle="स्कैन पढ़ें"
              tint="#FFF0C7"
              accent="#9A6A00"
              onPress={openPdf}
            />
          </View>

          <View style={styles.homePromise}>
            <View style={styles.homePromiseIcon}>
              <Text style={styles.homePromiseIconText}>✦</Text>
            </View>
            <View style={styles.homePromiseCopy}>
              <Text style={styles.homePromiseTitle}>आपकी PDF, आपके नियंत्रण में</Text>
              <Text style={styles.homePromiseBody}>
                Original file नहीं बदलती। हर export एक नई, validated PDF बनाता है।
              </Text>
            </View>
          </View>
          {status.state === 'error' && (
            <View style={[styles.statusCard, styles.errorCard]}>
              <Text style={styles.errorText}>{status.message}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {status.state !== 'opening' && document && page && (
        <View style={[styles.editorShell, { paddingBottom: insets.bottom }]}>
          <View
            style={[
              styles.editorHeader,
              compactEditing && styles.editorHeaderCompact,
              { paddingTop: insets.top + spacing.sm },
            ]}
          >
            <View style={styles.documentIdentity}>
              <Image source={require('./assets/icon.png')} style={styles.editorLogo} />
              <View style={styles.documentTitleGroup}>
                <Text style={styles.documentTitle} numberOfLines={1}>
                  {documentName}
                </Text>
                <Text style={styles.documentSubtitle} numberOfLines={1}>
                  Editing · page {currentPageIndex + 1} of {document.pages.length}
                </Text>
              </View>
            </View>
            <View style={styles.editorHeaderActions}>
              {!compactEditing && (
                <>
                  <AppButton
                    title="⋯"
                    small
                    variant="ghost"
                    onPress={() => setAboutVisible(true)}
                  />
                  <AppButton
                    title="New"
                    small
                    variant="ghost"
                    onPress={openPdf}
                    disabled={status.state === 'saving'}
                  />
                </>
              )}
              <AppButton
                title={status.state === 'saving' ? 'Exporting…' : '✓ Export'}
                small
                onPress={saveAndExport}
                disabled={status.state === 'saving'}
              />
            </View>
          </View>

          {!compactEditing && (
            <View style={styles.commandSurface}>
              <View style={styles.commandRow}>
                {document.pages.length > 1 ? (
                  <View style={styles.pagerGroup}>
                    <AppButton
                      title="◀"
                      small
                      variant="secondary"
                      onPress={() => goToPage(currentPageIndex - 1)}
                      disabled={currentPageIndex === 0}
                    />
                    <Text style={styles.pagerLabel}>
                      {currentPageIndex + 1} / {document.pages.length}
                    </Text>
                    <AppButton
                      title="▶"
                      small
                      variant="secondary"
                      onPress={() => goToPage(currentPageIndex + 1)}
                      disabled={currentPageIndex === document.pages.length - 1}
                    />
                  </View>
                ) : (
                  <Text style={styles.pagerLabel}>1 page</Text>
                )}
                <View style={styles.commandActions}>
                  <View style={styles.zoomPill}>
                    <Text style={styles.zoomPillText}>{Math.round(pageZoom * 100)}%</Text>
                  </View>
                  <AppButton
                    title="↩ Undo"
                    small
                    variant="ghost"
                    onPress={handleUndo}
                    disabled={!canUndo}
                  />
                  <AppButton
                    title="↪ Redo"
                    small
                    variant="ghost"
                    onPress={handleRedo}
                    disabled={!canRedo}
                  />
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modeStrip}
                keyboardShouldPersistTaps="always"
              >
                <AppButton
                  title="✎ Edit text"
                  small
                  variant={editMode === 'edit' ? 'primary' : 'secondary'}
                  onPress={() => selectEditMode('edit')}
                  disabled={editingBlocked}
                />
                <AppButton
                  title="＋ Add text"
                  small
                  variant={editMode === 'addText' ? 'primary' : 'secondary'}
                  onPress={() => selectEditMode('addText')}
                  disabled={editingBlocked}
                />
                <AppButton
                  title="＋ Blank page"
                  small
                  variant="secondary"
                  onPress={addBlankPageAfterCurrent}
                  disabled={hasRunningOcr || status.state === 'saving'}
                />
                <AppButton
                  title="⌫ Erase & replace"
                  small
                  variant={editMode === 'erase' ? 'primary' : 'secondary'}
                  onPress={() => selectEditMode('erase')}
                  disabled={editingBlocked}
                />
                <AppButton
                  title={enhancingPage === currentPageIndex ? 'Enhancing…' : '✨ AI OCR'}
                  small
                  variant="secondary"
                  onPress={handleEnhancePressed}
                  disabled={
                    editingBlocked ||
                    enhancingPage !== null ||
                    translating ||
                    ocrStatus === 'running'
                  }
                />
                <AppButton
                  title={translating ? 'Translating…' : '文 Translate to EN'}
                  small
                  variant="secondary"
                  onPress={handleTranslatePressed}
                  disabled={enhancingPage !== null || translating || status.state === 'saving'}
                />
              </ScrollView>
              <View style={styles.hintStrip}>
                <View style={styles.hintDot} />
                <Text style={styles.hint} numberOfLines={isWideLayout ? 1 : 2}>
                  {hintText}
                </Text>
              </View>
            </View>
          )}

          {(editingBlocked || knownLegacyFontNames.length > 0) && (
            <LegacyFontWarning
              fontNames={knownLegacyFontNames}
              inspectionFailed={fontInspectionFailed}
              safeReplacementEnabled={safeLegacyReplacementEnabled}
              onEnableSafeReplacement={confirmLegacyUnicodeReplacement}
              onChooseUnicodeFont={() => setFontPickerVisible(true)}
            />
          )}

          {!isWideLayout && focusedEdit && (
            <View style={styles.mobilePropertiesBar}>
              <EditToolbar
                fontSizePt={focusedEdit.fontSizePt}
                fontFamily={focusedEdit.fontFamily}
                color={focusedEdit.color}
                fontWeight={focusedEdit.fontWeight === 'bold' ? 'bold' : 'normal'}
                onFontSizeChange={(fontSizePt) =>
                  updateTextEdit(currentPageIndex, focusedEdit.id, { fontSizePt })
                }
                onFontFamilyChange={applyFontFamily}
                onOpenFontPicker={() => setFontPickerVisible(true)}
                onColorChange={(color) =>
                  updateTextEdit(currentPageIndex, focusedEdit.id, { color })
                }
                onFontWeightChange={(fontWeight) =>
                  updateTextEdit(currentPageIndex, focusedEdit.id, { fontWeight })
                }
                onDelete={() => removeEditGroup(focusedEdit.id)}
                onDone={handleEditDone}
              />
            </View>
          )}

          <View style={[styles.editorBody, isWideLayout && styles.editorBodyWide]}>
            <View style={styles.pageWorkspace}>
              <View style={styles.pageCard}>
                <PdfPageViewer
                  key={page.pageIndex}
                  page={page}
                  onTap={handleTap}
                  disablePress={editingBlocked || editMode === 'erase'}
                  focusedEditId={editMode === 'erase' ? null : focusedEditId}
                  onEditPinchStart={handleEditPinchStart}
                  onEditPinchResize={handleEditPinchResize}
                  onEditPinchEnd={handleEditPinchEnd}
                  onZoomChange={setPageZoom}
                  renderOverlays={(viewWidthDp) => (
                    <>
                      {editMode === 'edit' && (
                        <OcrHighlightLayer
                          lines={page.ocrLines}
                          viewWidthDp={viewWidthDp}
                          pageWidthPt={page.widthPt}
                        />
                      )}
                      <MaskOverlay
                        masks={page.edits.filter((e): e is MaskEdit => e.type === 'mask')}
                        viewWidthDp={viewWidthDp}
                        pageWidthPt={page.widthPt}
                        active={editMode === 'erase' && !editingBlocked}
                        onMaskDrawn={handleMaskDrawn}
                      />
                      {page.edits
                        .filter((e): e is TextEdit => e.type === 'text')
                        .map((edit) => (
                          <EditableTextOverlay
                            key={edit.id}
                            edit={edit}
                            viewWidthDp={viewWidthDp}
                            pageWidthPt={page.widthPt}
                            pageHeightPt={page.heightPt}
                            zoom={pageZoom}
                            autoFocus={edit.id === focusedEditId}
                            focused={edit.id === focusedEditId}
                            selectAllOnFocus={edit.id === selectAllEditId}
                            onFocus={() => {
                              if (focusedEditId && focusedEditId !== edit.id) {
                                Keyboard.dismiss();
                                setFocusedEditId(null);
                                return false;
                              }
                              setFocusedEditId(edit.id);
                              if (edit.id === selectAllEditId) setSelectAllEditId(null);
                              return true;
                            }}
                            onChangeText={(text) =>
                              updateTextEdit(currentPageIndex, edit.id, { text })
                            }
                            onMoveStart={handleEditMoveStart}
                            onMove={(xPt, yPt) =>
                              updateTextEdit(currentPageIndex, edit.id, { xPt, yPt })
                            }
                            onBlur={() => handleBlur(edit.id, edit.text)}
                          />
                        ))}
                    </>
                  )}
                />
              </View>
            </View>

            {isWideLayout && (
              <View style={styles.propertiesPanel}>
                <Text style={styles.propertiesTitle}>Text properties</Text>
                {focusedEdit ? (
                  <EditToolbar
                    fontSizePt={focusedEdit.fontSizePt}
                    fontFamily={focusedEdit.fontFamily}
                    color={focusedEdit.color}
                    fontWeight={focusedEdit.fontWeight === 'bold' ? 'bold' : 'normal'}
                    onFontSizeChange={(fontSizePt) =>
                      updateTextEdit(currentPageIndex, focusedEdit.id, { fontSizePt })
                    }
                    onFontFamilyChange={applyFontFamily}
                    onOpenFontPicker={() => setFontPickerVisible(true)}
                    onColorChange={(color) =>
                      updateTextEdit(currentPageIndex, focusedEdit.id, { color })
                    }
                    onFontWeightChange={(fontWeight) =>
                      updateTextEdit(currentPageIndex, focusedEdit.id, { fontWeight })
                    }
                    onDelete={() => removeEditGroup(focusedEdit.id)}
                    onDone={handleEditDone}
                  />
                ) : (
                  <View style={styles.noSelectionCard}>
                    <Text style={styles.noSelectionTitle}>Select text on the page</Text>
                    <Text style={styles.noSelectionBody}>
                      Tap a highlighted line or choose Add text. Formatting controls appear here.
                    </Text>
                  </View>
                )}
                <View style={styles.shapingCard}>
                  <Text style={styles.shapingTitle}>✓ Devanagari shaping protected</Text>
                  <Text style={styles.shapingBody}>मात्रा, संयुक्ताक्षर और रेफ सही रहते हैं</Text>
                </View>
              </View>
            )}
          </View>

          {!compactEditing && status.state === 'saving' && (
            <View style={styles.inlineStatus}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.inlineStatusText}>Creating and validating your new PDF…</Text>
            </View>
          )}
          {!compactEditing && status.state === 'saved' && (
            <View style={[styles.inlineStatus, styles.successCard]}>
              <View style={styles.inlineStatusCopy}>
                <Text style={styles.successTitle}>
                  {status.savedUri ? '✓ Saved in the selected folder' : '✓ Exported as a new PDF'}
                </Text>
                <Text style={styles.successPath} numberOfLines={1}>
                  {status.uri.split('/').pop()}
                </Text>
              </View>
              <View style={styles.inlineStatusActions}>
                <AppButton title="Save to folder" small onPress={saveResultToFolder} />
                <AppButton title="Share / open" small variant="secondary" onPress={shareResult} />
              </View>
            </View>
          )}
          {!compactEditing && status.state === 'error' && (
            <View style={[styles.inlineStatus, styles.errorCard]}>
              <Text style={styles.errorText}>{status.message}</Text>
            </View>
          )}
        </View>
      )}

      <AboutModal visible={aboutVisible} onClose={() => setAboutVisible(false)} />
      <FontPickerModal
        visible={fontPickerVisible}
        selectedFamily={focusedEdit?.fontFamily ?? defaultFontFamily}
        loadedFamilies={loadedFontFamilies}
        downloadingFamily={downloadingFont}
        onChoose={chooseFontFamily}
        onClose={() => setFontPickerVisible(false)}
      />

      <Modal
        visible={apiKeyPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setApiKeyPromptVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Gemini API key needed</Text>
            <Text style={styles.modalBody}>
              {apiKeyPurpose === 'translate'
                ? "Translate to English sends detected Hindi line text to Google's Gemini API. It needs your own free API key (no credit card) - create one at aistudio.google.com, then paste it here. The key is stored only on this device."
                : "Enhance with AI sends this page's image to Google's Gemini API for higher-accuracy text detection. It needs your own free API key (no credit card) - create one at aistudio.google.com, then paste it here. The key is stored only on this device, in encrypted storage."}
            </Text>
            <TextInput
              value={apiKeyDraft}
              onChangeText={setApiKeyDraft}
              placeholder="Paste API key"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.modalInput}
            />
            <View style={styles.modalButtons}>
              <AppButton
                title="Cancel"
                small
                variant="ghost"
                onPress={() => setApiKeyPromptVisible(false)}
              />
              <AppButton
                title="Save & run"
                small
                onPress={handleApiKeySubmitted}
                disabled={apiKeyDraft.trim() === ''}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ToolCard({
  icon,
  title,
  hindiTitle,
  tint,
  accent,
  onPress,
}: {
  icon: string;
  title: string;
  hindiTitle: string;
  tint: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${hindiTitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]}
    >
      <View style={[styles.featureIcon, { backgroundColor: tint }]}>
        <Text style={[styles.featureIconText, { color: accent }]}>{icon}</Text>
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.toolHindiTitle}>{hindiTitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: 13,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  openingSurface: {
    backgroundColor: colors.surface,
  },
  progressText: {
    marginTop: spacing.lg,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  progressSubText: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textSecondary,
  },
  landing: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  homeGreeting: {
    paddingHorizontal: spacing.xs,
  },
  homeGreetingTitle: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  homeGreetingBody: {
    marginTop: spacing.xs,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  openPdfCard: {
    minHeight: 106,
    marginTop: spacing.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  openPdfIcon: {
    width: 56,
    height: 62,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  openPdfIconText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: '#E34C4C',
  },
  openPdfCopy: {
    flex: 1,
  },
  openPdfTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textOnPrimary,
  },
  openPdfSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#D9E5FF',
  },
  openPdfArrow: {
    fontSize: 36,
    fontWeight: '300',
    color: colors.textOnPrimary,
  },
  featureHeadingRow: {
    width: '100%',
    marginTop: 36,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  featureHeading: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  featureHeadingMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  toolGrid: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.md,
  },
  toolCard: {
    flex: 1,
    minHeight: 142,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#151B30',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  toolCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  featureIconText: {
    fontSize: 22,
    fontWeight: '800',
  },
  featureTitle: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  toolHindiTitle: {
    marginTop: spacing.xs,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  homePromise: {
    width: '100%',
    marginTop: spacing.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#C9D9FF',
  },
  homePromiseIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#D5E4FF',
  },
  homePromiseIconText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '900',
  },
  homePromiseCopy: {
    flex: 1,
  },
  homePromiseTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  homePromiseBody: {
    marginTop: spacing.xs,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  editorShell: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.background,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editorHeaderCompact: {
    paddingBottom: spacing.sm,
  },
  documentIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editorLogo: {
    width: 36,
    height: 36,
    borderRadius: 11,
  },
  documentTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  documentSubtitle: {
    marginTop: 1,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  editorHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  commandSurface: {
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commandRow: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  commandActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pagerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pagerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    minWidth: 48,
    textAlign: 'center',
  },
  zoomPill: {
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: '#F0F2F7',
  },
  zoomPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modeStrip: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  hintStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: '#F4F7FF',
  },
  hintDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  hint: {
    flex: 1,
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  mobilePropertiesBar: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
  },
  editorBody: {
    flex: 1,
    minHeight: 0,
  },
  editorBodyWide: {
    flexDirection: 'row',
  },
  pageWorkspace: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    padding: spacing.md,
    backgroundColor: '#ECEEF4',
    alignItems: 'center',
  },
  pageCard: {
    flex: 1,
    width: '100%',
    maxWidth: 980,
    minHeight: 220,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D5D8E2',
    backgroundColor: colors.surface,
    shadowColor: '#111827',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  propertiesPanel: {
    width: 320,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  propertiesTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  noSelectionCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: '#F6F7FA',
  },
  noSelectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  noSelectionBody: {
    marginTop: spacing.xs,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  shapingCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: '#B9DFC6',
  },
  shapingTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.success,
  },
  shapingBody: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.success,
  },
  inlineStatus: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inlineStatusCopy: {
    flex: 1,
    minWidth: 0,
  },
  inlineStatusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  inlineStatusText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  statusCard: {
    width: '100%',
    maxWidth: 900,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  successCard: {
    backgroundColor: colors.successSoft,
  },
  successTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.success,
  },
  successPath: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  errorCard: {
    backgroundColor: colors.dangerSoft,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
});
