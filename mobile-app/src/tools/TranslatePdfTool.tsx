import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import type { TranslationDirection } from '@hindipdfeditor/translation-contract';

import { AppButton } from '../components/AppButton';
import { useAppPopup } from '../components/appPopupContext';
import { AppStatus } from '../components/AppStatus';
import { DropZone } from '../components/DropZone';
import { ptSizeToImagePx, ptToImagePx } from '../lib/coordinateMath';
import { exportPdf } from '../lib/exportPdf';
import { fontFaceWeight, getFontBase64, type DevanagariFontFamily } from '../lib/fontAsset';
import { containsDevanagari, containsLatin, translateOcrLines } from '../lib/geminiTranslate';
import { detectTextLines } from '../lib/ocr';
import { getPageCount, renderPage, sampleAverageColor } from '../lib/pdfToImages';
import { savePdfToPickedDirectory } from '../lib/savePdf';
import { geometryForTranslatedLine, successfulTranslations } from '../lib/translateEdits';
import type { DocumentState, PageState } from '../state/editStore';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { colors, radius, shadows, spacing } from '../theme';

type Props = {
  initialFileUri?: string;
  initialFileName?: string;
};

/**
 * Mobile Translate Tool - Translates entire Hindi/English documents into the other language.
 * Replaces recognized text boxes with accurately styled translations and exports via Plan A.
 */
export function TranslatePdfTool({ initialFileUri, initialFileName }: Props = {}) {
  const { showPopup } = useAppPopup();
  const addRecentFile = useRecentFilesStore((s) => s.addFile);
  const [selectedDoc, setSelectedDoc] = useState<{
    name: string;
    uri: string;
    pageCount: number;
  } | null>(null);

  const [direction, setDirection] = useState<TranslationDirection>('hi-en');
  const [translating, setTranslating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [outputPdfUri, setOutputPdfUri] = useState<string | null>(null);
  const aiJobIdRef = useRef(`translate-${Crypto.randomUUID()}`);

  useEffect(() => {
    if (!initialFileUri) return;
    let isMounted = true;
    async function loadInitial() {
      try {
        const count = await getPageCount(initialFileUri!);
        if (isMounted) {
          setSelectedDoc({
            name: initialFileName ?? 'document.pdf',
            uri: initialFileUri!,
            pageCount: count,
          });
          setOutputPdfUri(null);
          aiJobIdRef.current = `translate-${Crypto.randomUUID()}`;
        }
      } catch (err) {
        console.warn('Failed to load initial file in TranslatePdfTool', err);
      }
    }
    void loadInitial();
    return () => {
      isMounted = false;
    };
  }, [initialFileUri, initialFileName]);

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];

      const count = await getPageCount(asset.uri);
      setSelectedDoc({
        name: asset.name,
        uri: asset.uri,
        pageCount: count,
      });
      setOutputPdfUri(null);
      aiJobIdRef.current = `translate-${Crypto.randomUUID()}`;
    } catch (error) {
      await showPopup({
        title: 'Could not open PDF',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    }
  };

  const runTranslation = async () => {
    if (!selectedDoc) return;

    setTranslating(true);
    setProgressMsg('Rasterizing pages...');
    try {
      // 1. Rasterize pages
      const pages: PageState[] = [];
      for (let i = 0; i < selectedDoc.pageCount; i++) {
        setProgressMsg(`Reading page ${i + 1} of ${selectedDoc.pageCount}...`);
        const img = await renderPage(selectedDoc.uri, i, 3);
        pages.push({
          pageIndex: i,
          widthPt: img.pxWidth / 3,
          heightPt: img.pxHeight / 3,
          backgroundImageUri: img.uri,
          imagePxWidth: img.pxWidth,
          imagePxHeight: img.pxHeight,
          edits: [],
          ocrLines: [],
        });
      }

      // 2. Perform OCR and translation for each page
      let totalTranslatedLines = 0;
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const pageState = pages[pageIndex];
        setProgressMsg(`Detecting text on page ${pageIndex + 1}...`);

        let lines: PageState['ocrLines'] = [];
        try {
          lines = await detectTextLines(pageState);
        } catch {
          lines = [];
        }

        // Filter lines matching source direction
        const translatable = lines.filter((l) =>
          direction === 'hi-en' ? containsDevanagari(l.text) : containsLatin(l.text),
        );

        if (translatable.length > 0) {
          setProgressMsg(`Translating ${translatable.length} lines on page ${pageIndex + 1}...`);
          const translationMap = await translateOcrLines(
            aiJobIdRef.current,
            direction,
            translatable.map((l) => ({ id: l.id, page: pageIndex, text: l.text })),
          );

          const successful = successfulTranslations(lines, translationMap);
          totalTranslatedLines += successful.length;

          // Commit masks and translated text overlays
          for (const item of successful) {
            const geom = geometryForTranslatedLine(
              item.line,
              pageState.widthPt,
              pageState.heightPt,
            );
            const { x: xPx, y: yPx } = ptToImagePx(
              geom.mask.xPt,
              geom.mask.yPt,
              pageState.imagePxWidth,
              pageState.widthPt,
            );
            const { wPx, hPx } = ptSizeToImagePx(
              geom.mask.wPt,
              geom.mask.hPt,
              pageState.imagePxWidth,
              pageState.widthPt,
            );
            const maskColor = await sampleAverageColor(
              pageState.backgroundImageUri,
              xPx,
              yPx,
              wPx,
              hPx,
              16,
            ).catch(() => '#ffffff');

            const maskId = `mask-${Crypto.randomUUID()}`;
            const textId = `text-${Crypto.randomUUID()}`;

            pageState.edits.push({
              type: 'mask',
              id: maskId,
              page: pageIndex,
              xPt: geom.mask.xPt,
              yPt: geom.mask.yPt,
              wPt: geom.mask.wPt,
              hPt: geom.mask.hPt,
              color: maskColor,
            });

            pageState.edits.push({
              type: 'text',
              id: textId,
              page: pageIndex,
              xPt: geom.text.xPt,
              yPt: geom.text.yPt,
              fontSizePt: geom.text.fontSizePt,
              text: item.translated,
              color: '#15172C',
              fontFamily: 'NotoSansDevanagari',
              widthPt: geom.text.widthPt,
              fontWeight: geom.text.fontWeight,
              replacement: { maskId, ocrLine: item.line },
            });
          }
        }
      }

      // 3. Assemble and export the translated PDF
      setProgressMsg('Assembling final translated document...');
      const usedFamilies = new Set<DevanagariFontFamily>(['NotoSansDevanagari']);
      for (const p of pages) {
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

      const docState: DocumentState = {
        sourceUri: selectedDoc.uri,
        displayName: selectedDoc.name,
        pageCount: pages.length,
        pages,
        legacyFontWarnings: [],
      };

      const resultPdf = await exportPdf(docState, embeddedFonts);
      setOutputPdfUri(resultPdf);

      const translatedDocName = `${selectedDoc.name.replace(/\.pdf$/i, '')}_${
        direction === 'hi-en' ? 'English' : 'Hindi'
      }.pdf`;
      const fileData: Omit<RecentFile, 'id' | 'date'> = {
        name: translatedDocName,
        hindiName: `${selectedDoc.name.replace(/\.pdf$/i, '')}_अनुवादित.pdf`,
        uri: resultPdf,
        thumbnailUri: pages[0]?.backgroundImageUri,
        sizeBytes: 0,
        pageCount: pages.length,
        category: 'downloads',
        starred: false,
      };
      await addRecentFile(fileData);

      await showPopup({
        title: 'Translation complete!',
        message: `Translated ${totalTranslatedLines} text lines across ${pages.length} page(s).`,
        tone: 'success',
      });
    } catch (error) {
      await showPopup({
        title: 'Translation failed',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    } finally {
      setTranslating(false);
      setProgressMsg('');
    }
  };

  const handleShare = async () => {
    if (!outputPdfUri) return;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(outputPdfUri, { mimeType: 'application/pdf' });
    }
  };

  const handleSaveToDevice = async () => {
    if (!outputPdfUri) return;
    try {
      const saved = await savePdfToPickedDirectory(outputPdfUri, 'translated-document.pdf');
      if (saved) {
        await showPopup({
          title: 'Saved to Files',
          message: 'Translated PDF successfully saved to your chosen folder.',
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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <DropZone
        title="Translate Hindi PDF"
        subtitle="Translate Hindi documents to English or English documents to Hindi seamlessly."
        buttonLabel={selectedDoc ? 'Change PDF' : 'Select PDF file'}
        badgeAccent={colors.accent}
        badgeTint={colors.accentTint}
        onSelect={pickPdf}
      />

      {selectedDoc && (
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="document-text-outline" size={16} color={colors.brand} />
              <Text style={styles.docName} numberOfLines={1}>
                {selectedDoc.name}
              </Text>
            </View>
            <Text style={styles.docPages}>{selectedDoc.pageCount} page(s) detected</Text>
          </View>

          {/* Direction Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Translation direction</Text>
            <View style={styles.choiceRow}>
              <ChoiceChip
                label="Hindi → English"
                sub="हिंदी से अंग्रेजी"
                selected={direction === 'hi-en'}
                onSelect={() => setDirection('hi-en')}
              />
              <ChoiceChip
                label="English → Hindi"
                sub="अंग्रेजी से हिंदी"
                selected={direction === 'en-hi'}
                onSelect={() => setDirection('en-hi')}
              />
            </View>
          </View>

          {translating && (
            <AppStatus title="Translating document..." subtitle={progressMsg} tone="loading" />
          )}

          <AppButton
            title={translating ? 'Processing...' : 'Translate & Export PDF'}
            variant="primary"
            loading={translating}
            disabled={translating}
            onPress={runTranslation}
            style={{ backgroundColor: colors.accent, borderColor: colors.accent }}
          />
        </View>
      )}

      {outputPdfUri && (
        <View style={styles.resultCard}>
          <AppStatus
            title="Translation complete & ready"
            subtitle="Your translated PDF is ready to share or save."
            tone="success"
          />
          <View style={styles.resultActions}>
            <AppButton
              title="Share PDF"
              variant="primary"
              onPress={handleShare}
              style={styles.resultBtn}
            />
            <AppButton
              title="Save to folder"
              variant="secondary"
              onPress={handleSaveToDevice}
              style={styles.resultBtn}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function ChoiceChip({
  label,
  sub,
  selected,
  onSelect,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={[styles.choiceChip, selected && styles.choiceChipActive]}
    >
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelActive]}>{label}</Text>
      <Text style={styles.choiceSub}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.card,
  },
  header: {
    gap: 3,
  },
  docName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  docPages: {
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choiceChip: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 3,
  },
  choiceChipActive: {
    backgroundColor: colors.accentTint,
    borderColor: colors.accent,
  },
  choiceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  choiceLabelActive: {
    color: colors.accent,
  },
  choiceSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  resultCard: {
    gap: spacing.sm,
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  resultBtn: {
    flex: 1,
  },
});
