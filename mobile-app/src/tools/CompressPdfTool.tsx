import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { AppButton } from '../components/AppButton';
import { DropZone } from '../components/DropZone';
import { getPageCount } from '../lib/pdfToImages';
import { compressPdfFile } from '../lib/pdfOps';
import { savePdfToPickedDirectory } from '../lib/savePdf';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { useTx } from '../i18n';
import { colors, radius, shadows, spacing } from '../theme';
import { useSnackbar } from '../ui/Snackbar';
import { commonErrors, useErrorDialog } from '../ui/useErrorDialog';

type SelectedDocument = {
  name: string;
  uri: string;
  pageCount: number;
  size?: number;
};

type CompressionLevel = 'balanced' | 'strong' | 'high_quality';

type Props = {
  initialFileUri?: string;
  initialFileName?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Mobile Compress PDF Tool - Shrinks scanned/image-heavy documents locally.
 */
export function CompressPdfTool({ initialFileUri, initialFileName }: Props = {}) {
  const tx = useTx();
  const snackbar = useSnackbar();
  const { errorDialog, showError } = useErrorDialog();
  const errors = commonErrors(tx);
  const addRecentFile = useRecentFilesStore((s) => s.addFile);
  const [document, setDocument] = useState<SelectedDocument | null>(null);
  const [level, setLevel] = useState<CompressionLevel>('balanced');
  const [compressing, setCompressing] = useState(false);
  const [result, setResult] = useState<{
    uri: string;
    originalBytes: number;
    compressedBytes: number;
  } | null>(null);

  useEffect(() => {
    if (!initialFileUri) return;
    let isMounted = true;
    async function loadInitial() {
      try {
        const count = await getPageCount(initialFileUri!);
        if (isMounted) {
          setDocument({
            name: initialFileName ?? 'document.pdf',
            uri: initialFileUri!,
            pageCount: count,
          });
          setResult(null);
        }
      } catch (err) {
        console.warn('Failed to load initial file in CompressPdfTool', err);
      }
    }
    void loadInitial();
    return () => {
      isMounted = false;
    };
  }, [initialFileUri, initialFileName]);

  const pickPdf = async () => {
    try {
      const pickResult = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (pickResult.canceled || !pickResult.assets || pickResult.assets.length === 0) return;
      const asset = pickResult.assets[0];

      const count = await getPageCount(asset.uri);
      setDocument({
        name: asset.name,
        uri: asset.uri,
        pageCount: count,
        size: asset.size,
      });
      setResult(null);
    } catch (error) {
      console.warn('Compress open failed', error);
      showError({ ...errors.open, onRetry: () => void pickPdf() });
    }
  };

  const runCompress = async () => {
    if (!document) return;

    setCompressing(true);
    try {
      const scale = level === 'high_quality' ? 2.5 : level === 'balanced' ? 1.8 : 1.3;
      const res = await compressPdfFile(document.uri, document.pageCount, scale);
      setResult({
        uri: res.uri,
        originalBytes: res.originalBytes || document.size || 1,
        compressedBytes: res.compressedBytes,
      });

      const compressedName = `${document.name.replace(/\.pdf$/i, '')}_compressed.pdf`;
      const fileData: Omit<RecentFile, 'id' | 'date'> = {
        name: compressedName,
        hindiName: `${document.name.replace(/\.pdf$/i, '')}_कंप्रेस्ड.pdf`,
        uri: res.uri,
        sizeBytes: res.compressedBytes,
        pageCount: res.pageCount,
        category: 'downloads',
        starred: false,
      };
      await addRecentFile(fileData);
      snackbar.show(tx('Saved', 'सेव हो गई'));
    } catch (error) {
      console.warn('Compression failed', error);
      showError({
        title: tx("Couldn't compress the PDF", 'PDF छोटी नहीं हो सकी'),
        body: tx(
          'The file may be damaged or too large for this phone. Try another level, or another file.',
          'फ़ाइल खराब या इस फ़ोन के लिए बहुत बड़ी हो सकती है। दूसरा लेवल या दूसरी फ़ाइल आज़माएँ।',
        ),
        onRetry: () => void runCompress(),
      });
    } finally {
      setCompressing(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf' });
    }
  };

  const handleSaveToDevice = async () => {
    if (!result) return;
    try {
      const saved = await savePdfToPickedDirectory(result.uri, 'compressed-document.pdf');
      if (saved) snackbar.show(tx('Saved', 'सेव हो गई'));
    } catch (error) {
      console.warn('Compress save failed', error);
      showError({ ...errors.save, onRetry: () => void handleSaveToDevice() });
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <DropZone
        title="Compress PDF file"
        subtitle="Reduce file size of scanned Devanagari pages while preserving readability."
        buttonLabel={document ? 'Change PDF' : 'Select PDF file'}
        badgeAccent={colors.amberInk}
        badgeTint={colors.amberTint}
        onSelect={pickPdf}
      />

      {document && (
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="document-text-outline" size={16} color={colors.brand} />
              <Text style={styles.docName} numberOfLines={1}>
                {document.name}
              </Text>
            </View>
            <Text style={styles.docMeta}>
              {document.pageCount} pages {document.size ? `· ${formatBytes(document.size)}` : ''}
            </Text>
          </View>

          {/* Compression Level Selector */}
          <View style={styles.levelsSection}>
            <Text style={styles.sectionTitle}>Compression strength</Text>

            <View style={styles.levelsRow}>
              <LevelCard
                title="Balanced"
                desc="Great quality & size reduction"
                selected={level === 'balanced'}
                onSelect={() => setLevel('balanced')}
              />
              <LevelCard
                title="Maximum"
                desc="Smallest file size"
                selected={level === 'strong'}
                onSelect={() => setLevel('strong')}
              />
              <LevelCard
                title="High Res"
                desc="Highest visual clarity"
                selected={level === 'high_quality'}
                onSelect={() => setLevel('high_quality')}
              />
            </View>
          </View>

          <AppButton
            title={compressing ? 'Compressing pages...' : 'Compress PDF'}
            variant="primary"
            loading={compressing}
            disabled={compressing}
            onPress={runCompress}
            style={{ backgroundColor: colors.amberInk, borderColor: colors.amberInk }}
          />
        </View>
      )}

      {result && (
        <View style={styles.resultCard}>
          <View style={styles.statsCard}>
            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>Original</Text>
              <Text style={styles.statValue}>{formatBytes(result.originalBytes)}</Text>
            </View>
            <Text style={styles.statArrow}>→</Text>
            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>Compressed</Text>
              <Text style={[styles.statValue, styles.statValueGreen]}>
                {formatBytes(result.compressedBytes)}
              </Text>
            </View>
          </View>

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
      {errorDialog}
    </ScrollView>
  );
}

function LevelCard({
  title,
  desc,
  selected,
  onSelect,
}: {
  title: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={[styles.levelCard, selected && styles.levelCardActive]}
    >
      <Text style={[styles.levelTitle, selected && styles.levelTitleActive]}>{title}</Text>
      <Text style={styles.levelDesc}>{desc}</Text>
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
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
  docMeta: {
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  levelsSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  levelsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  levelCard: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.chip,
    padding: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    gap: 4,
  },
  levelCardActive: {
    backgroundColor: colors.accentOrangeTint,
    borderColor: colors.accentOrange,
  },
  levelTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  levelTitleActive: {
    color: colors.accentOrange,
  },
  levelDesc: {
    fontSize: 10.5,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  resultCard: {
    gap: spacing.md,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.soft,
  },
  statColumn: {
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: 11.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statValueGreen: {
    color: colors.accentGreen,
  },
  statArrow: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  resultBtn: {
    flex: 1,
  },
});
