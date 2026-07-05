import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
// expo-file-system's top-level `readAsStringAsync` is a stub that unconditionally throws in
// this SDK version (confirmed on a real device - see CHANGELOG); the actual implementation now
// lives under the `/legacy` subpath, same as `exportPdf.ts`'s own use of this API.
import * as FileSystem from 'expo-file-system/legacy';
import { useFonts } from 'expo-font';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';

import { EditableTextOverlay } from './src/components/EditableTextOverlay';
import { LegacyFontWarning } from './src/components/LegacyFontWarning';
import { MaskOverlay, type DrawnMaskRect } from './src/components/MaskOverlay';
import { OcrHighlightLayer } from './src/components/OcrHighlightLayer';
import { PdfPageViewer } from './src/components/PdfPageViewer';
import { ptSizeToImagePx, ptToImagePx } from './src/lib/coordinateMath';
import { exportPdf } from './src/lib/exportPdf';
import { getFontBase64 } from './src/lib/fontAsset';
import { detectLegacyFonts } from './src/lib/legacyFontDetector';
import { detectTextLines } from './src/lib/ocr';
import { findOcrLineAt } from './src/lib/ocrHitTest';
import { getPageCount, renderPage, sampleAverageColor } from './src/lib/pdfToImages';
import {
  useEditStore,
  type DocumentState,
  type MaskEdit,
  type PageState,
  type TextEdit,
} from './src/state/editStore';

/** Sentinel font name used when detection itself fails - see `detectLegacyFontWarnings` below. */
const UNKNOWN_ENCODING_FONT_NAME = 'unknown (font inspection failed)';

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
 * Phase 1+2+3+4 editor plus OCR-assisted tap-to-edit (spec Section 10): pick an existing PDF,
 * browse its pages, tap detected existing text to mask-and-edit it in place (on-device ML Kit
 * OCR via `ocr.ts` finds where text is and pre-fills what it says), tap empty space to add
 * new Hindi text, or drag out a manual mask in replace mode as the fallback for anything OCR
 * misses - then export every page in one PDF. Pages whose embedded font matches a known
 * pre-Unicode legacy pattern (or whose font couldn't be inspected at all) are detected on open
 * and have all edit paths disabled - see `legacyFontDetector.ts`/`LegacyFontWarning.tsx` and
 * spec Section 9. Replaces the Phase 0 spike entirely, per that screen's own comment and
 * AGENTS.md's phased build process - Phase 0 passed on a real device (see spec Section
 * 10/CHANGELOG), so this is the first screen actually built on that verified ground.
 *
 * Deliberately does NOT use `react-native-pdf` for this screen, unlike Section 10's Phase 1
 * checklist wording. Section 6's own module spec defines `PdfPageViewer.tsx` as "background
 * image + live overlays," not a live `react-native-pdf` render - the whole Render & Print
 * architecture depends on the edit canvas being the exact same rasterized image the export
 * pipeline uses, not a second, independent PDF renderer that could disagree with it
 * pixel-for-pixel. `expo-document-picker` covers "open from device storage"; `react-native-pdf`
 * stays installed even though this screen doesn't use its rendering.
 *
 * All pages are rasterized up front at open time, not lazily per navigation - per AGENTS.md's
 * performance guidance, don't pre-optimize for large documents until a real device actually
 * shows a problem; `DocumentState.pages` was already a dense array sized to the whole document
 * (spec Section 7), so eager rasterization needed no data-model change.
 */

// Default new text size, in PDF points - a reasonable starting size for a body-text edit;
// no per-edit size UI yet (not a Phase 1 checklist item).
const DEFAULT_FONT_SIZE_PT = 14;
// Output px per PDF point when rasterizing the page background - see spec Section 4.1/AGENTS.md's
// "2-3x, not arbitrarily higher" performance constraint.
const RASTER_SCALE = 2;
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
// Replacement font size as a fraction of an OCR-detected line's box height. The box spans
// ascender to descender (for Devanagari: shirorekha-topping matras down to below-base
// conjunct forms), while a font's nominal size sits a bit smaller than that full span - 0.75
// visually matches typical scanned body text without the replacement overflowing the mask.
const OCR_FONT_SIZE_RATIO = 0.75;
// Floor for the OCR-derived font size, in PDF points - below this, a detection-box hiccup
// (e.g. a squashed box on a noisy scan) would produce unreadably tiny replacement text.
const MIN_OCR_FONT_SIZE_PT = 6;
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

/** Per-page on-device OCR progress, keyed by page index - absent means not yet attempted. */
type OcrStatusByPage = Record<number, 'running' | 'done' | 'failed'>;

type Status =
  | { state: 'idle' }
  | { state: 'opening' }
  | { state: 'saving' }
  | { state: 'saved'; uri: string }
  | { state: 'error'; message: string };

export default function App() {
  const [fontsLoaded] = useFonts({
    NotoSansDevanagari: require('./assets/fonts/NotoSansDevanagari-Variable.ttf'),
    NotoSerifDevanagari: require('./assets/fonts/NotoSerifDevanagari-Variable.ttf'),
  });
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [focusedEditId, setFocusedEditId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  // Phase 3 (spec Section 10): a dedicated mode toggle, not a long-press gesture - the spec
  // allows either trigger, and a toggle avoids MaskOverlay's drag-to-select racing against
  // PdfPageViewer's own tap-to-add-text on the exact same gesture.
  const [replaceMode, setReplaceMode] = useState(false);

  // OCR-assisted tap-to-edit: per-page detection progress (drives the hint text). Reset
  // whenever a new document is opened (see `openPdf`), since page indices only mean anything
  // within one document.
  const [ocrStatusByPage, setOcrStatusByPage] = useState<OcrStatusByPage>({});
  // Pages OCR has already been kicked off for, so navigating back and forth doesn't re-run
  // detection. A ref (not state): this is bookkeeping for the trigger, never rendered.
  const ocrAttemptedPagesRef = useRef(new Set<number>());

  const document = useEditStore((s) => s.document);
  const loadDocument = useEditStore((s) => s.loadDocument);
  const addTextEdit = useEditStore((s) => s.addTextEdit);
  const addMaskEdit = useEditStore((s) => s.addMaskEdit);
  const updateTextEdit = useEditStore((s) => s.updateTextEdit);
  const removeEdit = useEditStore((s) => s.removeEdit);
  const setOcrLines = useEditStore((s) => s.setOcrLines);

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
      ocrAttemptedPagesRef.current.clear();
      setOcrStatusByPage({});
      ensureOcrForPage(newDocument, 0);
      setStatus({ state: 'idle' });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const page = document?.pages[currentPageIndex];

  // Phase 4 (spec Section 9): distinct legacy font names flagged on the page currently being
  // viewed. A non-empty array - including the `UNKNOWN_ENCODING_FONT_NAME` sentinel when
  // detection itself failed - blocks both edit paths on this page; per-page, not document-wide,
  // since only some pages of a document may actually use a legacy font.
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

  /**
   * OCR-assisted tap-to-edit: kicks off on-device text detection for one page, if it hasn't
   * been attempted yet. Called from the two places a page comes on screen - document open and
   * page navigation - i.e. lazily per visited page, not eagerly for the whole document (two
   * ML Kit passes per page are much slower than rasterization; per AGENTS.md, keep heavy work
   * off pages the user may never visit). Takes the document as a parameter rather than reading
   * the `document` state variable because `openPdf` calls it in the same tick it calls
   * `loadDocument`, before React re-renders.
   */
  const ensureOcrForPage = (doc: DocumentState, pageIndex: number) => {
    const pageState = doc.pages[pageIndex];
    if (!pageState) return;
    // Same fail-closed rule as every edit path: a legacy/unknown-encoding page blocks editing,
    // so detecting tappable text on it would only advertise an interaction that's disabled.
    if (doc.legacyFontWarnings.some((w) => w.page === pageIndex)) return;
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

  const goToPage = (index: number) => {
    if (!document || index < 0 || index >= document.pages.length) return;
    setCurrentPageIndex(index);
    setFocusedEditId(null);
    ensureOcrForPage(document, index);
  };

  /**
   * The one shared mask-and-replace path, used by both manual drag-to-mask (Phase 3) and
   * OCR-assisted tap-to-edit: grows `rect` by MASK_EXPAND_PT (clamped to the page), samples
   * the surrounding background color, commits the `MaskEdit`, then commits and focuses a
   * replacement `TextEdit`. The text is described separately from the mask rectangle because
   * the OCR path pads the mask taller than the detected line (see OCR_MASK_PAD_RATIO_Y) while
   * anchoring the text at the line's own origin; the manual path passes the same origin for
   * both. All `text` fields are in PDF points except the text itself.
   */
  const maskAndReplaceRegion = async (
    rect: { xPt: number; yPt: number; wPt: number; hPt: number },
    text: { xPt: number; yPt: number; prefill: string; fontSizePt: number; widthPt?: number },
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

    addMaskEdit(currentPageIndex, {
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
      color: '#111111',
      fontFamily: 'NotoSansDevanagari',
      ...(text.widthPt !== undefined ? { widthPt: text.widthPt } : {}),
    });
    setFocusedEditId(textEdit.id);
  };

  const handleTap = async (xPt: number, yPt: number) => {
    // Belt-and-suspenders: MaskOverlay's PanResponder claims the gesture before it reaches
    // PdfPageViewer's Pressable while replaceMode is on, so this shouldn't normally fire, but
    // skipping it here too avoids ever stacking a stray text edit under a freshly drawn mask.
    if (replaceMode) return;
    // AGENTS.md/spec Section 9: never allow adding text on a page whose font couldn't be
    // confirmed Unicode-safe - "do not silently allow masking/editing" on such a page.
    if (editingBlocked) return;
    if (!page) return;

    // OCR-assisted tap-to-edit: a tap on detected text edits that text in place - masks its
    // region and opens a pre-filled input right on top of it. A tap on empty page keeps the
    // Phase 1 behavior: add brand-new text at that spot.
    const hitLine = findOcrLineAt(page.ocrLines, xPt, yPt);
    if (hitLine) {
      // Consume the line so its highlight disappears and a second tap can't double-mask it.
      setOcrLines(
        currentPageIndex,
        page.ocrLines.filter((l) => l.id !== hitLine.id),
      );
      const fontSizePt = Math.max(MIN_OCR_FONT_SIZE_PT, hitLine.hPt * OCR_FONT_SIZE_RATIO);
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
          yPt: hitLine.yPt,
          prefill: hitLine.text,
          fontSizePt,
          widthPt: hitLine.wPt * OCR_TEXT_WIDTH_SLACK_RATIO,
        },
      );
      return;
    }

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
      removeEdit(currentPageIndex, id);
    }
    if (focusedEditId === id) {
      setFocusedEditId(null);
    }
  };

  const handleMaskDrawn = async (rect: DrawnMaskRect) => {
    // Same fail-closed rule as `handleTap` above - `MaskOverlay`'s `active` prop is also gated
    // on `!editingBlocked` so this shouldn't normally fire, but this stays as a second guard.
    if (!page || editingBlocked) return;
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
      const fontBase64 = await getFontBase64('NotoSansDevanagari');
      const uri = await exportPdf(document, fontBase64);
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

  if (!fontsLoaded) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Hindi PDF Editor</Text>

        <Button
          title="Open PDF"
          onPress={openPdf}
          disabled={status.state === 'opening' || status.state === 'saving'}
        />

        {status.state === 'opening' && <ActivityIndicator style={styles.spacerTop} />}
        {status.state === 'error' && (
          <Text style={[styles.spacerTop, styles.error]}>Failed: {status.message}</Text>
        )}

        {document && page && (
          <View style={styles.spacerTop}>
            {document.pages.length > 1 && (
              <View style={styles.pagerRow}>
                <Button
                  title="◀ Prev"
                  onPress={() => goToPage(currentPageIndex - 1)}
                  disabled={currentPageIndex === 0}
                />
                <Text style={styles.pagerLabel}>
                  Page {currentPageIndex + 1} of {document.pages.length}
                </Text>
                <Button
                  title="Next ▶"
                  onPress={() => goToPage(currentPageIndex + 1)}
                  disabled={currentPageIndex === document.pages.length - 1}
                />
              </View>
            )}

            {editingBlocked && <LegacyFontWarning fontNames={currentPageLegacyFontNames} />}

            <View style={styles.modeRow}>
              <Button
                title={replaceMode ? '✓ Replace text mode' : 'Switch to replace text mode'}
                onPress={() => setReplaceMode((prev) => !prev)}
                disabled={editingBlocked}
              />
            </View>
            <Text style={styles.hint}>
              {editingBlocked
                ? 'Editing is disabled on this page - see warning above.'
                : replaceMode
                  ? 'Drag a box over existing text to mask and replace it.'
                  : ocrStatusByPage[currentPageIndex] === 'running'
                    ? 'Detecting text on this page…'
                    : ocrStatusByPage[currentPageIndex] === 'failed'
                      ? 'Text detection failed - tap empty space to add text, or use replace mode.'
                      : 'Tap highlighted text to edit it in place, or tap empty space to add new text.'}
            </Text>
            <PdfPageViewer
              // Remounts the viewer (and drops any transient gesture state) on page change,
              // instead of the same instance silently rendering a different page's image.
              key={page.pageIndex}
              page={page}
              onTap={handleTap}
              renderOverlays={(viewWidthDp) => (
                <>
                  <OcrHighlightLayer
                    lines={page.ocrLines}
                    viewWidthDp={viewWidthDp}
                    pageWidthPt={page.widthPt}
                  />
                  <MaskOverlay
                    masks={page.edits.filter((e): e is MaskEdit => e.type === 'mask')}
                    viewWidthDp={viewWidthDp}
                    pageWidthPt={page.widthPt}
                    active={replaceMode && !editingBlocked}
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
                        autoFocus={edit.id === focusedEditId}
                        onChangeText={(text) => updateTextEdit(currentPageIndex, edit.id, { text })}
                        onBlur={() => handleBlur(edit.id, edit.text)}
                      />
                    ))}
                </>
              )}
            />

            <Button
              title="Save (exports all pages)"
              onPress={saveAndExport}
              disabled={status.state === 'saving'}
            />
            {status.state === 'saving' && <ActivityIndicator style={styles.spacerTop} />}
            {status.state === 'saved' && (
              <View style={styles.spacerTop}>
                <Text style={styles.success}>Exported: {status.uri}</Text>
                <Button title="Share / open in a PDF viewer" onPress={shareResult} />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pagerLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  modeRow: {
    marginBottom: 4,
  },
  spacerTop: {
    marginTop: 16,
  },
  success: {
    color: '#0a7a0a',
    marginBottom: 12,
  },
  error: {
    color: '#b00020',
  },
});
