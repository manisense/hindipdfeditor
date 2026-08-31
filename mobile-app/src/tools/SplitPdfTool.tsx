import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { AppButton } from '../components/AppButton';
import { AppStatus } from '../components/AppStatus';
import { DropZone } from '../components/DropZone';
import { useAppPopup } from '../components/appPopupContext';
import { extractPdfPages, splitPdfFile } from '../lib/pdfOps';
import { getPageCount, renderPage } from '../lib/pdfToImages';
import { savePdfToPickedDirectory } from '../lib/savePdf';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { colors, radius, shadows, spacing } from '../theme';

type SelectedDocument = {
  name: string;
  uri: string;
  pageCount: number;
  pageImages: string[];
};

type SplitMode = 'all' | 'range' | 'custom';

type Props = {
  initialFileUri?: string;
  initialFileName?: string;
};

export function SplitPdfTool({ initialFileUri, initialFileName }: Props = {}) {
  const { showPopup } = useAppPopup();
  const addRecentFile = useRecentFilesStore((s) => s.addFile);
  const [document, setDocument] = useState<SelectedDocument | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [splitMode, setSplitMode] = useState<SplitMode>('all');
  const [fromPage, setFromPage] = useState('1');
  const [toPage, setToPage] = useState('1');
  const [splitting, setSplitting] = useState(false);
  const [splitUri, setSplitUri] = useState<string | null>(null);

  useEffect(() => {
    if (!initialFileUri) return;
    let isMounted = true;
    async function loadInitial() {
      try {
        const count = await getPageCount(initialFileUri!);
        const images: string[] = [];
        for (let i = 0; i < count; i++) {
          const pageImg = await renderPage(initialFileUri!, i, 1);
          images.push(pageImg.uri);
        }
        if (isMounted) {
          setDocument({
            name: initialFileName ?? 'document.pdf',
            uri: initialFileUri!,
            pageCount: count,
            pageImages: images,
          });
          setFromPage('1');
          setToPage(String(count));
          const initial = new Set<number>();
          for (let i = 0; i < count; i++) initial.add(i);
          setSelectedPages(initial);
          setSplitMode('all');
          setSplitUri(null);
        }
      } catch (err) {
        console.warn('Failed to load initial file in SplitPdfTool', err);
      }
    }
    void loadInitial();
    return () => {
      isMounted = false;
    };
  }, [initialFileUri, initialFileName]);

  const pickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      const count = await getPageCount(asset.uri);
      const images: string[] = [];
      for (let i = 0; i < count; i++) {
        const pageImg = await renderPage(asset.uri, i, 1);
        images.push(pageImg.uri);
      }

      setDocument({
        name: asset.name,
        uri: asset.uri,
        pageCount: count,
        pageImages: images,
      });
      setFromPage('1');
      setToPage(String(count));
      const initial = new Set<number>();
      for (let i = 0; i < count; i++) initial.add(i);
      setSelectedPages(initial);
      setSplitMode('all');
      setSplitUri(null);
    } catch (error) {
      await showPopup({
        title: 'Error opening PDF',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    }
  };

  const togglePageSelection = (pageIdx: number) => {
    setSplitMode('custom');
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageIdx)) {
        next.delete(pageIdx);
      } else {
        next.add(pageIdx);
      }
      return next;
    });
  };

  const runSplit = async () => {
    if (!document) return;
    setSplitting(true);
    try {
      let outUri: string;
      let outputPageCount: number;
      let thumbnailUri: string | undefined;
      let splitDocName: string;

      if (splitMode === 'range') {
        const from = Math.max(1, parseInt(fromPage, 10) || 1);
        const to = Math.min(document.pageCount, parseInt(toPage, 10) || document.pageCount);
        if (from > to) {
          throw new Error('From page cannot be greater than To page');
        }
        outUri = await splitPdfFile(document.uri, from, to);
        outputPageCount = to - from + 1;
        thumbnailUri = document.pageImages[from - 1];
        splitDocName = `${document.name.replace(/\.pdf$/i, '')}_p${from}-p${to}.pdf`;
      } else if (splitMode === 'custom') {
        const sorted = Array.from(selectedPages).sort((a, b) => a - b);
        if (sorted.length === 0) {
          throw new Error('Please select at least 1 page to extract');
        }
        outUri = await extractPdfPages(document.uri, sorted);
        outputPageCount = sorted.length;
        thumbnailUri = document.pageImages[sorted[0]];
        const pageListStr = sorted.map((p) => p + 1).join('-');
        splitDocName = `${document.name.replace(/\.pdf$/i, '')}_pages_${pageListStr}.pdf`;
      } else {
        const allIndices = Array.from({ length: document.pageCount }, (_, i) => i);
        outUri = await extractPdfPages(document.uri, allIndices);
        outputPageCount = document.pageCount;
        thumbnailUri = document.pageImages[0];
        splitDocName = `${document.name.replace(/\.pdf$/i, '')}_extracted.pdf`;
      }

      setSplitUri(outUri);

      // Save to recent files store under downloads
      const fileData: Omit<RecentFile, 'id' | 'date'> = {
        name: splitDocName,
        hindiName: `${document.name.replace(/\.pdf$/i, '')}_विभाजित.pdf`,
        uri: outUri,
        thumbnailUri,
        sizeBytes: 0,
        pageCount: outputPageCount,
        category: 'downloads',
        starred: false,
      };
      await addRecentFile(fileData);
    } catch (error) {
      await showPopup({
        title: 'Split failed',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    } finally {
      setSplitting(false);
    }
  };

  const handleShare = async () => {
    if (!splitUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(splitUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share extracted PDF',
        });
      }
    } catch (error) {
      await showPopup({
        title: 'Share failed',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    }
  };

  const handleSaveToDevice = async () => {
    if (!splitUri) return;
    try {
      const saved = await savePdfToPickedDirectory(splitUri, 'split-pages.pdf');
      if (saved) {
        await showPopup({
          title: 'Saved to Files',
          message: 'Extracted PDF successfully saved to your chosen folder.',
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
      showsVerticalScrollIndicator={false}
    >
      {!document ? (
        <DropZone
          title="Split PDF / विभाजित करें"
          subtitle="Select a PDF from your device to extract specific page ranges or select individual pages visually."
          buttonLabel="Select PDF file"
          badgeAccent={colors.brand}
          onSelect={pickPdf}
        />
      ) : (
        <View style={styles.workspace}>
          {/* Header Subtitle Bar */}
          <View style={styles.docHeader}>
            <View style={styles.docTitleRow}>
              <Text style={styles.docTitleHi}>Split PDF / पीडीएफ विभाजित करें</Text>
              <Pressable onPress={pickPdf} style={styles.changeBtn}>
                <Text style={styles.changeBtnText}>Change PDF</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="document-text-outline" size={16} color={colors.brand} />
              <Text style={styles.docName} numberOfLines={1}>
                {document.name} ({document.pageCount} pages)
              </Text>
            </View>
          </View>

          {/* 4-Column Page Thumbnail Grid */}
          <View style={styles.gridCard}>
            <View style={styles.pageGrid}>
              {Array.from({ length: document.pageCount }).map((_, idx) => {
                const isSelected =
                  splitMode === 'all'
                    ? true
                    : splitMode === 'range'
                      ? idx >= (parseInt(fromPage, 10) || 1) - 1 &&
                        idx <= (parseInt(toPage, 10) || document.pageCount) - 1
                      : selectedPages.has(idx);

                const imageUri = document.pageImages[idx];

                return (
                  <Pressable
                    key={idx}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`Page ${idx + 1}`}
                    onPress={() => togglePageSelection(idx)}
                    style={styles.pageCell}
                  >
                    <View style={[styles.thumbnailBox, isSelected && styles.thumbnailBoxSelected]}>
                      {imageUri ? (
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.pageThumbnailImg}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.placeholderPage}>
                          <View style={styles.placeholderLine} />
                          <View style={[styles.placeholderLine, { width: '60%' }]} />
                          <View style={[styles.placeholderLine, { width: '75%' }]} />
                        </View>
                      )}

                      {/* Selected Blue Checkmark Overlay */}
                      {isSelected && (
                        <View style={styles.selectedOverlay}>
                          <Text style={styles.checkIcon}>✓</Text>
                        </View>
                      )}
                    </View>

                    {/* Page Number Pill */}
                    <View style={[styles.pagePill, isSelected && styles.pagePillSelected]}>
                      <Text style={[styles.pageNumberText, isSelected && styles.pageNumberActive]}>
                        {idx + 1}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Split Mode Options */}
          <View style={styles.controlsCard}>
            {/* Option 1: Extract All Pages */}
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: splitMode === 'all' }}
              onPress={() => setSplitMode('all')}
              style={styles.optionRow}
            >
              <View style={[styles.radioCircle, splitMode === 'all' && styles.radioCircleSelected]}>
                {splitMode === 'all' && <Text style={styles.radioCheck}>✓</Text>}
              </View>
              <Text style={styles.optionLabel}>Extract all pages</Text>
            </Pressable>

            {/* Option 2: Split by range */}
            <View style={styles.rangeRow}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: splitMode === 'range' }}
                onPress={() => setSplitMode('range')}
                style={styles.rangeSelectTouch}
              >
                <View
                  style={[styles.radioCircle, splitMode === 'range' && styles.radioCircleSelected]}
                >
                  {splitMode === 'range' && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.optionLabel}>Split by range</Text>
              </Pressable>

              <View style={styles.rangeInputs}>
                <Text style={styles.rangeText}>From</Text>
                <TextInput
                  value={fromPage}
                  onChangeText={(t) => {
                    setFromPage(t);
                    setSplitMode('range');
                  }}
                  keyboardType="numeric"
                  style={styles.pageInput}
                  selectTextOnFocus
                />
                <Text style={styles.rangeText}>To</Text>
                <TextInput
                  value={toPage}
                  onChangeText={(t) => {
                    setToPage(t);
                    setSplitMode('range');
                  }}
                  keyboardType="numeric"
                  style={styles.pageInput}
                  selectTextOnFocus
                />
              </View>
            </View>

            {/* Primary Action Button */}
            <AppButton
              title={splitting ? 'Processing...' : 'Split PDF / विभाजित करें'}
              variant="primary"
              loading={splitting}
              disabled={splitting}
              onPress={runSplit}
              style={styles.mainSplitBtn}
            />
          </View>

          {/* Result Actions */}
          {splitUri && (
            <View style={styles.resultCard}>
              <AppStatus
                title="Pages extracted successfully"
                subtitle="Your new PDF is ready to share or save."
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
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
    paddingBottom: 40,
  },
  workspace: {
    gap: spacing.md,
  },
  docHeader: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 4,
    ...shadows.soft,
  },
  docTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docTitleHi: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  changeBtn: {
    backgroundColor: colors.brandTint,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  changeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand,
  },
  docName: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  gridCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    ...shadows.card,
  },
  pageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  pageCell: {
    width: '22%',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  thumbnailBox: {
    width: '100%',
    aspectRatio: 0.72,
    borderRadius: radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailBoxSelected: {
    borderColor: colors.brand,
    ...shadows.soft,
  },
  pageThumbnailImg: {
    width: '100%',
    height: '100%',
  },
  placeholderPage: {
    width: '80%',
    gap: 4,
    alignItems: 'center',
  },
  placeholderLine: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(21, 23, 44, 0.12)',
    borderRadius: 1,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(24, 67, 221, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    fontSize: 22,
    color: '#ffffff',
    fontWeight: '900',
  },
  pagePill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagePillSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  pageNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pageNumberActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  controlsCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rangeSelectTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  radioCheck: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rangeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rangeText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pageInput: {
    width: 44,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 2,
  },
  mainSplitBtn: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    marginTop: spacing.xs,
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  resultBtn: {
    flex: 1,
  },
});
