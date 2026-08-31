import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { AppButton } from '../components/AppButton';
import { useAppPopup } from '../components/appPopupContext';
import { DropZone } from '../components/DropZone';
import { EditableTextOverlay } from '../components/EditableTextOverlay';
import { EditToolbar } from '../components/EditToolbar';
import { FontPickerModal } from '../components/FontPickerModal';
import { LegacyFontWarning } from '../components/LegacyFontWarning';
import { MaskOverlay, type DrawnMaskRect } from '../components/MaskOverlay';
import { OcrHighlightLayer } from '../components/OcrHighlightLayer';
import { PdfPageViewer } from '../components/PdfPageViewer';
import { createBlankPage } from '../lib/blankPage';
import { ptSizeToImagePx, ptToImagePx } from '../lib/coordinateMath';
import { exportPdf } from '../lib/exportPdf';
import {
  fontFaceWeight,
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
import { savePdfToPickedDirectory } from '../lib/savePdf';
import { fontSizeForOcrLine, textBoxGeometry } from '../lib/textEditGeometry';
import {
  useEditStore,
  type DocumentState,
  type MaskEdit,
  type OcrLine,
  type PageState,
  type TextEdit,
} from '../state/editStore';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { colors, radius, shadows, spacing } from '../theme';

const DEFAULT_FONT_SIZE_PT = 14;
const RASTER_SCALE = 3;
const MASK_SAMPLE_MARGIN_PX = 16;
const OCR_MASK_PAD_TOP_RATIO = 0.35;
const EDIT_TEXT_WIDTH_SLACK_RATIO = 1.25;

export type EditMode = 'edit' | 'addText' | 'erase';
type OcrStatusByPage = Record<number, 'running' | 'done' | 'failed'>;
type EditPairing = { maskId?: string; ocrLine?: OcrLine };

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

type Props = {
  initialFileUri?: string;
  initialFileName?: string;
};

/**
 * Mobile Edit PDF Tool - Full WYSIWYG editor for Devanagari PDFs.
 * Supports smart tap-to-edit with OCR detection, new text placement, and drag-to-erase masks.
 */
export function EditPdfTool({ initialFileUri, initialFileName }: Props = {}) {
  const { showPopup } = useAppPopup();
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportResultUri, setExportResultUri] = useState<string | null>(null);

  const [editMode, setEditMode] = useState<EditMode>('edit');
  const [focusedEditId, setFocusedEditId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectAllEditId, setSelectAllEditId] = useState<string | null>(null);
  const [fontPickerVisible, setFontPickerVisible] = useState(false);
  const [downloadingFont, setDownloadingFont] = useState<DevanagariFontFamily | null>(null);
  const [, setOcrStatusByPage] = useState<OcrStatusByPage>({});

  const ocrAttemptedPagesRef = useRef(new Set<number>());
  const editPairingsRef = useRef(new Map<string, EditPairing>());

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
  const redo = useEditStore((s) => s.redo);
  const canRedo = useEditStore((s) => s.future.length > 0);
  const insertPage = useEditStore((s) => s.insertPage);
  const addRecentFile = useRecentFilesStore((s) => s.addFile);

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

  const ensureOcrForPage = (doc: DocumentState, pageIndex: number) => {
    const pageState = doc.pages[pageIndex];
    if (!pageState || doc.legacyFontWarnings.some((w) => w.page === pageIndex)) return;
    if (ocrAttemptedPagesRef.current.has(pageIndex)) return;
    ocrAttemptedPagesRef.current.add(pageIndex);

    setOcrStatusByPage((s) => ({ ...s, [pageIndex]: 'running' }));
    detectTextLines(pageState)
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

  const ensureOcrForAllPages = (doc: DocumentState) => {
    for (let i = 0; i < doc.pages.length; i++) {
      ensureOcrForPage(doc, i);
    }
  };

  const loadPdfFromUri = async (uri: string, name: string) => {
    setOpening(true);
    try {
      const pageCount = await getPageCount(uri);
      const pages: PageState[] = [];

      for (let i = 0; i < pageCount; i++) {
        const image = await renderPage(uri, i, RASTER_SCALE);
        pages.push({
          pageIndex: i,
          widthPt: image.pxWidth / RASTER_SCALE,
          heightPt: image.pxHeight / RASTER_SCALE,
          backgroundImageUri: image.uri,
          imagePxWidth: image.pxWidth,
          imagePxHeight: image.pxHeight,
          edits: [],
          ocrLines: [],
        });
      }

      const legacyFontWarnings = await detectLegacyFontWarnings(uri, pageCount);
      const newDoc: DocumentState = {
        sourceUri: uri,
        displayName: name,
        pageCount,
        pages,
        legacyFontWarnings,
      };

      loadDocument(newDoc);
      setCurrentPageIndex(0);
      setFocusedEditId(null);
      setSelectAllEditId(null);
      ocrAttemptedPagesRef.current.clear();
      editPairingsRef.current.clear();
      setOcrStatusByPage({});
      ensureOcrForAllPages(newDoc);

      const fileData: Omit<RecentFile, 'id' | 'date'> = {
        name,
        hindiName: name.replace(/\.pdf$/i, '') + '_संपादित.pdf',
        uri,
        thumbnailUri: pages[0]?.backgroundImageUri,
        sizeBytes: 0,
        pageCount,
        category: 'all',
        starred: false,
      };
      void addRecentFile(fileData);
    } catch (error) {
      await showPopup({
        title: 'Could not open PDF',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    } finally {
      setOpening(false);
    }
  };

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
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      await loadPdfFromUri(asset.uri, asset.name);
    } catch (error) {
      await showPopup({
        title: 'Could not open PDF',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    }
  };

  const handleTap = async (xPt: number, yPt: number) => {
    if (!page || editingBlocked) return;

    if (focusedEditId) {
      setFocusedEditId(null);
      Keyboard.dismiss();
      return;
    }

    if (editMode === 'edit') {
      const textEdits = page.edits.filter((e): e is TextEdit => e.type === 'text');
      const existingText = findTextEditAt(textEdits, xPt, yPt);
      if (existingText) {
        setFocusedEditId(existingText.id);
        return;
      }

      const ocrLine = findOcrTargetAt(page.ocrLines, xPt, yPt);
      if (ocrLine) {
        checkpoint();
        const geom = textBoxGeometry(page.widthPt, ocrLine.xPt, ocrLine.wPt);
        const topPadPt = ocrLine.hPt * OCR_MASK_PAD_TOP_RATIO;
        const maskYPt = Math.max(0, ocrLine.yPt - topPadPt);
        const maskHPt = Math.min(page.heightPt - maskYPt, ocrLine.hPt + topPadPt);

        const { x: xPx, y: yPx } = ptToImagePx(geom.xPt, maskYPt, page.imagePxWidth, page.widthPt);
        const { wPx, hPx } = ptSizeToImagePx(
          geom.widthPt,
          maskHPt,
          page.imagePxWidth,
          page.widthPt,
        );
        const sampledColor = await sampleAverageColor(
          page.backgroundImageUri,
          xPx,
          yPx,
          wPx,
          hPx,
          MASK_SAMPLE_MARGIN_PX,
        ).catch(() => '#ffffff');

        const { x: textXPx, y: textYPx } = ptToImagePx(
          geom.xPt,
          ocrLine.yPt,
          page.imagePxWidth,
          page.widthPt,
        );
        const { wPx: textWPx, hPx: textHPx } = ptSizeToImagePx(
          geom.widthPt,
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

        const maskEdit = addMaskEdit(currentPageIndex, {
          xPt: geom.xPt,
          yPt: maskYPt,
          wPt: geom.widthPt,
          hPt: maskHPt,
          color: sampledColor,
        });

        const textEdit = addTextEdit(currentPageIndex, {
          xPt: geom.xPt,
          yPt: ocrLine.yPt,
          fontSizePt: fontSizeForOcrLine(ocrLine.hPt),
          text: ocrLine.text,
          color: sampledTextColor,
          fontFamily: 'NotoSansDevanagari',
          widthPt: geom.widthPt * EDIT_TEXT_WIDTH_SLACK_RATIO,
          replacement: { maskId: maskEdit.id, ocrLine },
        });

        editPairingsRef.current.set(textEdit.id, { maskId: maskEdit.id, ocrLine });
        setFocusedEditId(textEdit.id);
        setSelectAllEditId(textEdit.id);
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
    setFocusedEditId(textEdit.id);
  };

  const handleMaskDrawn = async (drawn: DrawnMaskRect) => {
    if (!page || editingBlocked) return;
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

    setFocusedEditId(textEdit.id);
  };

  const handleExport = async () => {
    if (!document) return;
    setSaving(true);
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

      const outUri = await exportPdf(document, embeddedFonts);
      setExportResultUri(outUri);
      await showPopup({
        title: 'PDF ready to export!',
        message: `Successfully shaped and exported ${document.pages.length} page(s).`,
        tone: 'success',
      });
    } catch (error) {
      await showPopup({
        title: 'Export failed',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!exportResultUri) return;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(exportResultUri, { mimeType: 'application/pdf' });
    }
  };

  const handleSaveToDevice = async () => {
    if (!exportResultUri) return;
    try {
      const saved = await savePdfToPickedDirectory(exportResultUri, 'edited-document.pdf');
      if (saved) {
        await showPopup({
          title: 'Saved to Files',
          message: 'Edited PDF successfully saved to your chosen folder.',
          tone: 'success',
        });
      }
    } catch (error) {
      await showPopup({
        title: 'Save failed',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    }
  };

  const handleInsertBlank = async () => {
    if (!document) return;
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

  const handleDeleteEdit = () => {
    if (!focusedEditId || !page) return;
    checkpoint();
    const pairing = editPairingsRef.current.get(focusedEditId);
    if (pairing?.maskId) {
      removeEdit(currentPageIndex, pairing.maskId);
    }
    removeEdit(currentPageIndex, focusedEditId);
    setFocusedEditId(null);
  };

  const handleSelectFont = async (family: DevanagariFontFamily) => {
    if (!focusedEdit) return;
    if (isFontFamilyLoaded(family)) {
      updateTextEdit(currentPageIndex, focusedEdit.id, { fontFamily: family });
      setFontPickerVisible(false);
      return;
    }

    setDownloadingFont(family);
    try {
      await installFontFamily(family);
      updateTextEdit(currentPageIndex, focusedEdit.id, { fontFamily: family });
      setFontPickerVisible(false);
    } catch (err) {
      await showPopup({
        title: 'Font download failed',
        message: err instanceof Error ? err.message : String(err),
        tone: 'error',
      });
    } finally {
      setDownloadingFont(null);
    }
  };

  return (
    <View style={styles.container}>
      {!document ? (
        <ScrollView contentContainerStyle={styles.landingContent}>
          <DropZone
            title="Edit Hindi PDF"
            subtitle="Tap to edit existing Devanagari text, place new text, or drag to mask."
            buttonLabel="Select PDF file"
            badgeAccent={colors.brand}
            badgeTint={colors.brandWash}
            onSelect={openPdfFile}
            loading={opening}
          />
        </ScrollView>
      ) : (
        <View style={styles.editorWorkspace}>
          {/* Document info bar */}
          <View style={styles.docHeaderRow}>
            <View style={styles.docTitleBadge}>
              <Ionicons name="document-text-outline" size={16} color={colors.brand} />
              <Text style={styles.docNameText} numberOfLines={1}>
                {document.displayName}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change PDF file"
              onPress={openPdfFile}
              style={({ pressed }) => [styles.changePdfBtn, pressed && styles.changePdfBtnPressed]}
            >
              <Text style={styles.changePdfText}>Change PDF</Text>
            </Pressable>
          </View>

          {/* Sub-toolbar card */}
          <View style={styles.subToolbar}>
            <View style={styles.toolbarRow}>
              {/* Pager */}
              <View style={styles.pagerPill}>
                <Pressable
                  accessibilityLabel="Previous page"
                  disabled={currentPageIndex === 0}
                  onPress={() => setCurrentPageIndex((i) => Math.max(0, i - 1))}
                  style={[styles.pagerBtn, currentPageIndex === 0 && styles.pagerBtnDisabled]}
                >
                  <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.pagerText}>
                  {currentPageIndex + 1} / {document.pages.length}
                </Text>
                <Pressable
                  accessibilityLabel="Next page"
                  disabled={currentPageIndex >= document.pages.length - 1}
                  onPress={() =>
                    setCurrentPageIndex((i) => Math.min(document.pages.length - 1, i + 1))
                  }
                  style={[
                    styles.pagerBtn,
                    currentPageIndex >= document.pages.length - 1 && styles.pagerBtnDisabled,
                  ]}
                >
                  <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
                </Pressable>
              </View>

              {/* Mode Switcher */}
              <View style={styles.modeSegment}>
                <ModeTab
                  label="Edit"
                  iconName="format-text"
                  active={editMode === 'edit'}
                  onPress={() => {
                    setEditMode('edit');
                    setFocusedEditId(null);
                  }}
                />
                <ModeTab
                  label="Add"
                  iconName="plus-circle-outline"
                  active={editMode === 'addText'}
                  onPress={() => {
                    setEditMode('addText');
                    setFocusedEditId(null);
                  }}
                />
                <ModeTab
                  label="Erase"
                  iconName="eraser"
                  active={editMode === 'erase'}
                  onPress={() => {
                    setEditMode('erase');
                    setFocusedEditId(null);
                  }}
                />
              </View>

              {/* Undo & Redo */}
              <View style={styles.undoGroup}>
                <Pressable
                  accessibilityLabel="Undo"
                  disabled={!canUndo}
                  onPress={undo}
                  style={[styles.undoBtn, !canUndo && styles.undoBtnDisabled]}
                >
                  <Ionicons name="arrow-undo-outline" size={15} color={colors.textPrimary} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Redo"
                  disabled={!canRedo}
                  onPress={redo}
                  style={[styles.undoBtn, !canRedo && styles.undoBtnDisabled]}
                >
                  <Ionicons name="arrow-redo-outline" size={15} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Legacy font warning if applicable */}
          {currentPageLegacyFontNames.length > 0 && (
            <LegacyFontWarning
              fontNames={currentPageLegacyFontNames}
              inspectionFailed={policy.inspectionFailed}
              safeReplacementEnabled={!policy.editingBlocked && !policy.inspectionFailed}
              onEnableSafeReplacement={
                !policy.inspectionFailed
                  ? () => setLegacyBypassPages((prev) => new Set(prev).add(currentPageIndex))
                  : undefined
              }
              onChooseUnicodeFont={() => setFontPickerVisible(true)}
            />
          )}

          {/* PDF Page Canvas */}
          <View style={styles.canvasCard}>
            <View style={styles.topGradientBar} />

            {page && (
              <PdfPageViewer
                page={page}
                onTap={handleTap}
                renderOverlays={(viewWidthDp) => (
                  <>
                    {/* Visual OCR highlight boxes in Edit mode */}
                    <OcrHighlightLayer
                      lines={page.ocrLines}
                      viewWidthDp={viewWidthDp}
                      pageWidthPt={page.widthPt}
                      visible={editMode === 'edit'}
                    />

                    {/* Mask overlay for erase mode */}
                    <MaskOverlay
                      masks={page.edits.filter((e): e is MaskEdit => e.type === 'mask')}
                      viewWidthDp={viewWidthDp}
                      pageWidthPt={page.widthPt}
                      active={editMode === 'erase'}
                      onMaskDrawn={handleMaskDrawn}
                    />

                    {/* Editable text overlays for placed text */}
                    {page.edits
                      .filter((e): e is TextEdit => e.type === 'text')
                      .map((textEdit) => (
                        <EditableTextOverlay
                          key={textEdit.id}
                          edit={textEdit}
                          viewWidthDp={viewWidthDp}
                          pageWidthPt={page.widthPt}
                          pageHeightPt={page.heightPt}
                          zoom={1}
                          focused={focusedEditId === textEdit.id}
                          autoFocus={focusedEditId === textEdit.id}
                          selectAllOnFocus={selectAllEditId === textEdit.id}
                          onChangeText={(text) => {
                            updateTextEdit(currentPageIndex, textEdit.id, { text });
                          }}
                          onFocus={() => {
                            setFocusedEditId(textEdit.id);
                          }}
                          onBlur={() => {
                            if (focusedEditId === textEdit.id) {
                              setFocusedEditId(null);
                            }
                          }}
                        />
                      ))}
                  </>
                )}
              />
            )}
          </View>

          {/* Contextual Edit Toolbar */}
          {focusedEdit && (
            <View style={styles.floatingToolbarContainer}>
              <EditToolbar
                fontSizePt={focusedEdit.fontSizePt}
                fontFamily={focusedEdit.fontFamily}
                color={focusedEdit.color}
                fontWeight={focusedEdit.fontWeight ?? 'normal'}
                onFontSizeChange={(size) =>
                  updateTextEdit(currentPageIndex, focusedEdit.id, { fontSizePt: size })
                }
                onFontFamilyChange={(family) =>
                  updateTextEdit(currentPageIndex, focusedEdit.id, { fontFamily: family })
                }
                onOpenFontPicker={() => setFontPickerVisible(true)}
                onColorChange={(color) =>
                  updateTextEdit(currentPageIndex, focusedEdit.id, { color })
                }
                onFontWeightChange={(weight) =>
                  updateTextEdit(currentPageIndex, focusedEdit.id, { fontWeight: weight })
                }
                onDelete={handleDeleteEdit}
                onDone={() => setFocusedEditId(null)}
              />
            </View>
          )}

          {/* Bottom Action Row */}
          <View style={styles.bottomActionRow}>
            <AppButton title="+ Blank Page" small variant="subtle" onPress={handleInsertBlank} />
            <AppButton
              title={saving ? 'Exporting...' : 'Export PDF'}
              variant="primary"
              loading={saving}
              disabled={saving}
              onPress={handleExport}
              style={styles.exportBtn}
            />
          </View>

          {/* Export Success Result Actions */}
          {exportResultUri && (
            <View style={styles.exportResultRow}>
              <AppButton
                title="Share Exported PDF"
                variant="success"
                onPress={handleShare}
                style={styles.exportResultBtn}
              />
              <AppButton
                title="Save to Folder"
                variant="secondary"
                onPress={handleSaveToDevice}
                style={styles.exportResultBtn}
              />
            </View>
          )}

          {/* Font Picker Modal */}
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
        </View>
      )}
    </View>
  );
}

function ModeTab({
  label,
  iconName,
  active,
  onPress,
}: {
  label: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.modeTab, active && styles.modeTabActive]}
    >
      <MaterialCommunityIcons
        name={iconName}
        size={14}
        color={active ? colors.brand : colors.textSecondary}
      />
      <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  landingContent: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  editorWorkspace: {
    flex: 1,
    gap: spacing.xs + 2,
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    paddingHorizontal: 2,
  },
  docTitleBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 5,
  },
  docNameText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  changePdfBtn: {
    backgroundColor: colors.brandTint,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.brandTint,
  },
  changePdfBtnPressed: {
    backgroundColor: colors.brandTint,
    transform: [{ scale: 0.96 }],
  },
  changePdfText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.brand,
  },
  subToolbar: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.soft,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  pagerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.full,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 3,
  },
  pagerBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerBtnDisabled: {
    opacity: 0.3,
  },
  pagerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    minWidth: 44,
    textAlign: 'center',
  },
  modeSegment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.full,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 2,
  },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    gap: 3,
  },
  modeTabActive: {
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  modeLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeLabelActive: {
    color: colors.brand,
    fontWeight: '800',
  },
  undoGroup: {
    flexDirection: 'row',
    gap: 3,
  },
  undoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoBtnDisabled: {
    opacity: 0.35,
  },
  canvasCard: {
    flex: 1,
    backgroundColor: '#EEF0F4',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    ...shadows.card,
  },
  topGradientBar: {
    height: 4,
    backgroundColor: colors.brand,
    width: '100%',
  },
  floatingToolbarContainer: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  bottomActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: 2,
  },
  exportBtn: {
    flex: 1,
  },
  exportResultRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  exportResultBtn: {
    flex: 1,
  },
});
