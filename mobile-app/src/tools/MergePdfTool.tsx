import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { AppButton } from '../components/AppButton';
import { AppStatus } from '../components/AppStatus';
import { DropZone } from '../components/DropZone';
import { mergePdfFiles } from '../lib/pdfOps';
import { getPageCount, renderPage } from '../lib/pdfToImages';
import { savePdfToPickedDirectory } from '../lib/savePdf';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { useTx } from '../i18n';
import { colors, radius, shadows, spacing } from '../theme';
import { useUi } from '../hooks/useAppTheme';
import { useSnackbar } from '../ui/Snackbar';
import { UiText } from '../ui/UiText';
import { commonErrors, useErrorDialog } from '../ui/useErrorDialog';

type MergeItem = {
  id: string;
  name: string;
  uri: string;
  thumbnailUri?: string;
  pageCount?: number;
  size?: number;
};

/** Display name for a merged output, suffixed with the last 4 digits of the current ms time. */
function mergedOutputName(): string {
  return `Merged_${Date.now().toString().slice(-4)}.pdf`;
}

/** Random-suffixed id for a queued merge item. */
function newMergeItemId(): string {
  return `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

type Props = {
  initialFileUri?: string;
  initialFileName?: string;
};

export function MergePdfTool({ initialFileUri, initialFileName }: Props = {}) {
  const tx = useTx();
  const ui = useUi();
  const snackbar = useSnackbar();
  const { errorDialog, showError } = useErrorDialog();
  const errors = commonErrors(tx);
  const addRecentFile = useRecentFilesStore((s) => s.addFile);
  const [files, setFiles] = useState<MergeItem[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergedUri, setMergedUri] = useState<string | null>(null);

  useEffect(() => {
    if (!initialFileUri) return;
    let isMounted = true;
    async function loadInitial() {
      try {
        const count = await getPageCount(initialFileUri!);
        let thumbUri: string | undefined;
        try {
          const thumb = await renderPage(initialFileUri!, 0, 0.5);
          thumbUri = thumb.uri;
        } catch {
          // optional
        }
        if (isMounted) {
          setFiles([
            {
              id: `pdf-${Date.now()}`,
              name: initialFileName ?? 'document.pdf',
              uri: initialFileUri!,
              thumbnailUri: thumbUri,
              pageCount: count,
            },
          ]);
          setMergedUri(null);
        }
      } catch (err) {
        console.warn('Failed to load initial file in MergePdfTool', err);
      }
    }
    void loadInitial();
    return () => {
      isMounted = false;
    };
  }, [initialFileUri, initialFileName]);

  const pickMoreFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const newItems: MergeItem[] = [];
      for (const asset of res.assets) {
        let count = 1;
        let thumbUri: string | undefined;
        try {
          count = await getPageCount(asset.uri);
          const thumb = await renderPage(asset.uri, 0, 0.5);
          thumbUri = thumb.uri;
        } catch {
          // optional
        }

        newItems.push({
          id: newMergeItemId(),
          name: asset.name,
          uri: asset.uri,
          thumbnailUri: thumbUri,
          pageCount: count,
          size: asset.size,
        });
      }

      setFiles((prev) => [...prev, ...newItems]);
      setMergedUri(null);
    } catch (error) {
      console.warn('Merge file pick failed', error);
      showError({
        title: tx("Couldn't add the files", 'फ़ाइलें नहीं जुड़ सकीं'),
        body: tx(
          'The file picker closed with an error. Try picking the PDFs again.',
          'फ़ाइल चुनते समय गड़बड़ी हुई। PDF फिर से चुनें।',
        ),
        onRetry: () => void pickMoreFiles(),
      });
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setFiles((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index >= files.length - 1) return;
    setFiles((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const runMerge = async () => {
    const validUris = files.map((f) => f.uri).filter((uri) => uri.length > 0);
    if (validUris.length < 2) return;

    setMerging(true);
    try {
      const outUri = await mergePdfFiles(validUris);
      setMergedUri(outUri);

      // Save to recent files store
      const mergedFileName = mergedOutputName();
      const fileData: Omit<RecentFile, 'id' | 'date'> = {
        name: mergedFileName,
        hindiName: 'मर्ज_दस्तावेज़.pdf',
        uri: outUri,
        thumbnailUri: files[0]?.thumbnailUri,
        sizeBytes: 0,
        pageCount: files.reduce((acc, f) => acc + (f.pageCount ?? 1), 0),
        category: 'downloads',
        starred: false,
      };
      await addRecentFile(fileData);
    } catch (error) {
      console.warn('Merge failed', error);
      showError({
        title: tx("Couldn't merge the PDFs", 'PDF नहीं जुड़ सकीं'),
        body: tx(
          'One of the files may be locked or damaged. Check the files, then try again.',
          'कोई फ़ाइल लॉक या खराब हो सकती है। फ़ाइलें जाँचें, फिर से करें।',
        ),
        onRetry: () => void runMerge(),
      });
    } finally {
      setMerging(false);
    }
  };

  const handleShare = async () => {
    if (!mergedUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(mergedUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share merged PDF',
        });
      }
    } catch (error) {
      console.warn('Merge share failed', error);
      showError({ ...errors.share, onRetry: () => void handleShare() });
    }
  };

  const handleSaveToDevice = async () => {
    if (!mergedUri) return;
    try {
      const saved = await savePdfToPickedDirectory(mergedUri, 'merged-document.pdf');
      if (saved) snackbar.show(tx('Saved', 'सेव हो गई'));
    } catch (error) {
      console.warn('Merge save failed', error);
      showError({ ...errors.save, onRetry: () => void handleSaveToDevice() });
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {files.length === 0 ? (
        <DropZone
          title="Merge PDF / मर्ज करें"
          subtitle="Combine multiple Hindi and English PDF files into a single unified document."
          buttonLabel="Select PDF files to merge"
          badgeAccent={colors.brand}
          onSelect={pickMoreFiles}
        />
      ) : (
        <View style={styles.workspace}>
          {/* Header Subtitle Bar */}
          <View style={styles.docHeader}>
            <Text style={styles.docTitleHi}>Merge PDF / पीडीएफ मर्ज करें</Text>
            <Text style={styles.docSub}>{files.length} document(s) in queue</Text>
          </View>

          {/* Files List Cards */}
          <View style={styles.filesList}>
            {files.map((file, idx) => (
              <View key={file.id} style={styles.fileCard}>
                {/* PDF Thumbnail */}
                <View style={styles.fileThumbnail}>
                  {file.thumbnailUri ? (
                    <Image
                      source={{ uri: file.thumbnailUri }}
                      style={styles.thumbImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <Text style={styles.thumbPdfText}>PDF</Text>
                      <View style={styles.thumbLines}>
                        <View style={styles.thumbLine} />
                        <View style={[styles.thumbLine, { width: '60%' }]} />
                        <View style={[styles.thumbLine, { width: '80%' }]} />
                      </View>
                    </View>
                  )}
                </View>

                {/* File Title */}
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  {file.pageCount ? (
                    <Text style={styles.filePages}>{file.pageCount} page(s)</Text>
                  ) : null}
                </View>

                {/* Reorder & Action Controls */}
                <View style={styles.actionControls}>
                  <Pressable
                    accessibilityLabel="Move up"
                    disabled={idx === 0}
                    onPress={() => moveUp(idx)}
                    style={[styles.arrowBtn, idx === 0 && styles.arrowBtnDisabled]}
                  >
                    <Ionicons
                      name="chevron-up"
                      size={14}
                      color={idx === 0 ? colors.textTertiary : colors.textPrimary}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Move down"
                    disabled={idx === files.length - 1}
                    onPress={() => moveDown(idx)}
                    style={[styles.arrowBtn, idx === files.length - 1 && styles.arrowBtnDisabled]}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={14}
                      color={idx === files.length - 1 ? colors.textTertiary : colors.textPrimary}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Remove"
                    onPress={() => removeFile(file.id)}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="close" size={14} color={colors.danger} />
                  </Pressable>
                  <Ionicons name="reorder-two-outline" size={16} color={colors.textTertiary} />
                </View>
              </View>
            ))}
          </View>

          {/* Add More Files Pill Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add More Files"
            onPress={pickMoreFiles}
            style={({ pressed }) => [styles.addMoreBtn, pressed && styles.addMoreBtnPressed]}
          >
            <View style={styles.addIconCircle}>
              <Ionicons name="add" size={14} color={colors.brand} />
            </View>
            <Text style={styles.addMoreText}>Add More Files / और फ़ाइलें जोड़ें</Text>
          </Pressable>

          {/* Primary CTA Button */}
          <AppButton
            title={merging ? 'Merging files...' : `Merge ${files.length} Files / फ़ाइलें मर्ज करें`}
            variant="primary"
            loading={merging}
            disabled={merging || files.length < 2}
            onPress={runMerge}
            style={styles.mainMergeBtn}
          />
          {files.length < 2 && (
            <UiText variant="meta" color={ui.inkSecondary} style={styles.mergeHint}>
              {tx('Add at least 2 PDFs to merge', 'मर्ज करने के लिए कम से कम 2 PDF जोड़ें')}
            </UiText>
          )}

          {/* Result Actions */}
          {mergedUri && (
            <View style={styles.resultCard}>
              <AppStatus
                title="PDF merged and ready"
                subtitle="Combined file is ready to share or save."
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
      {errorDialog}
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
    gap: 2,
    ...shadows.soft,
  },
  docTitleHi: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  docSub: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filesList: {
    gap: spacing.sm,
  },
  fileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    ...shadows.soft,
  },
  fileThumbnail: {
    width: 44,
    height: 54,
    borderRadius: radius.chip,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 4,
    gap: 2,
  },
  thumbPdfText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.brand,
  },
  thumbLines: {
    width: '100%',
    gap: 2,
    alignItems: 'center',
  },
  thumbLine: {
    width: '80%',
    height: 2,
    backgroundColor: 'rgba(21, 23, 44, 0.15)',
    borderRadius: 1,
  },
  fileDetails: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  filePages: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  actionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {
    opacity: 0.3,
  },
  arrowText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.danger,
  },
  dragHandle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textTertiary,
    marginLeft: 2,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E7FF',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    gap: spacing.sm,
    justifyContent: 'center',
    ...shadows.soft,
  },
  addMoreBtnPressed: {
    backgroundColor: '#D1DBFF',
    transform: [{ scale: 0.98 }],
  },
  addIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: -1,
  },
  addMoreText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.brand,
  },
  mainMergeBtn: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    marginTop: spacing.xs,
  },
  mergeHint: {
    textAlign: 'center',
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
