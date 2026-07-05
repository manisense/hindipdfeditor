import { useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFonts } from 'expo-font';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';

import { EditableTextOverlay } from './src/components/EditableTextOverlay';
import { PdfPageViewer } from './src/components/PdfPageViewer';
import { exportPdf } from './src/lib/exportPdf';
import { getFontBase64 } from './src/lib/fontAsset';
import { getPageCount, renderPage } from './src/lib/pdfToImages';
import { useEditStore, type PageState, type TextEdit } from './src/state/editStore';

/**
 * Phase 1+2 editor (spec Section 10): pick an existing PDF, browse its pages, tap a page to
 * add Hindi text at that spot, then export every page in one PDF. Replaces the Phase 0 spike
 * entirely, per that screen's own comment and AGENTS.md's phased build process - Phase 0
 * passed on a real device (see spec Section 10/CHANGELOG), so this is the first screen
 * actually built on that verified ground.
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

  const document = useEditStore((s) => s.document);
  const loadDocument = useEditStore((s) => s.loadDocument);
  const addTextEdit = useEditStore((s) => s.addTextEdit);
  const updateTextEdit = useEditStore((s) => s.updateTextEdit);
  const removeEdit = useEditStore((s) => s.removeEdit);

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
        });
      }
      loadDocument({ sourceUri, pageCount, pages, legacyFontWarnings: [] });
      setCurrentPageIndex(0);
      setFocusedEditId(null);
      setStatus({ state: 'idle' });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const goToPage = (index: number) => {
    if (!document || index < 0 || index >= document.pages.length) return;
    setCurrentPageIndex(index);
    setFocusedEditId(null);
  };

  const handleTap = (xPt: number, yPt: number) => {
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

  const page = document?.pages[currentPageIndex];

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

            <Text style={styles.hint}>Tap anywhere on the page to add Hindi text.</Text>
            <PdfPageViewer
              // Remounts the viewer (and drops any transient gesture state) on page change,
              // instead of the same instance silently rendering a different page's image.
              key={page.pageIndex}
              page={page}
              onTap={handleTap}
              renderOverlays={(viewWidthDp) =>
                page.edits
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
                  ))
              }
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
