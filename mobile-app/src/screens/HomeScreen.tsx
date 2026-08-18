import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import type { ToolId } from '../components/ToolShell';
import { getPageCount, renderPage } from '../lib/pdfToImages';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { colors, radius, shadows, spacing } from '../theme';

type Props = {
  onOpenTool: (toolId: ToolId) => void;
  onOpenFile: (file: RecentFile) => void;
};

type QuickTool = {
  id: ToolId;
  titleEn: string;
  titleHi: string;
  desc: string;
  icon: string;
  iconBg: string;
};

const QUICK_TOOLS: QuickTool[] = [
  {
    id: 'edit',
    titleEn: 'Edit PDF',
    titleHi: 'पीडीएफ संपादित करें',
    desc: 'Edit text, images in Hindi/English PDFs.',
    icon: '✏️',
    iconBg: '#EEF2FF',
  },
  {
    id: 'translate',
    titleEn: 'Translate',
    titleHi: 'अनुवाद',
    desc: 'Translate Hindi & English PDFs.',
    icon: '🌐',
    iconBg: '#EFF6FF',
  },
  {
    id: 'merge',
    titleEn: 'Merge',
    titleHi: 'मर्ज',
    desc: 'Merge and join multiple PDFs.',
    icon: '📑',
    iconBg: '#F5F3FF',
  },
  {
    id: 'split',
    titleEn: 'Split',
    titleHi: 'विभाजित करें',
    desc: 'Extract pages or split ranges.',
    icon: '✂️',
    iconBg: '#FFF7ED',
  },
  {
    id: 'compress',
    titleEn: 'Compress',
    titleHi: 'कंप्रेस',
    desc: 'Compress and reduce file size.',
    icon: '🗜️',
    iconBg: '#ECFDF5',
  },
  {
    id: 'viewer',
    titleEn: 'PDF Viewer',
    titleHi: 'पीडीएफ व्यूअर',
    desc: 'View and read PDFs in Hindi and English.',
    icon: '📖',
    iconBg: '#F0FDF4',
  },
];

export function HomeScreen({ onOpenTool, onOpenFile }: Props) {
  const recentFiles = useRecentFilesStore((state) => state.files);
  const addFile = useRecentFilesStore((state) => state.addFile);

  const handlePickAndOpenPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      const pageCount = await getPageCount(asset.uri);
      let thumbUri: string | undefined;
      try {
        const thumb = await renderPage(asset.uri, 0, 0.5);
        thumbUri = thumb.uri;
      } catch {
        // Thumbnail generation optional
      }

      const fileData: Omit<RecentFile, 'id' | 'date'> = {
        name: asset.name,
        hindiName: asset.name.replace(/\.pdf$/i, '') + '_हिंदी.pdf',
        uri: asset.uri,
        thumbnailUri: thumbUri,
        sizeBytes: asset.size ?? 0,
        pageCount,
        category: 'all',
        starred: false,
      };

      await addFile(fileData);
      onOpenFile({
        ...fileData,
        id: `picked-${Date.now()}`,
        date: 'Today',
      });
    } catch (err) {
      console.warn('Pick PDF failed', err);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Brand Header */}
      <View style={styles.brandRow}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoHindi}>ह</Text>
        </View>
        <Text style={styles.brandTitle}>
          Hindi PDF <Text style={styles.brandTitleAccent}>Editor</Text>
        </Text>
      </View>

      {/* Hero Greeting */}
      <View style={styles.heroSection}>
        <Text style={styles.heroGreeting}>नमस्ते!</Text>
        <Text style={styles.heroSub}>Welcome to Hindi PDF Editor.</Text>
      </View>

      {/* 6-Grid Tool Cards */}
      <View style={styles.toolsGrid}>
        {QUICK_TOOLS.map((tool, idx) => (
          <Pressable
            key={`${tool.id}-${idx}`}
            accessibilityRole="button"
            accessibilityLabel={`${tool.titleEn} - ${tool.titleHi}`}
            onPress={() => onOpenTool(tool.id)}
            style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]}
          >
            <View style={[styles.toolIconWrapper, { backgroundColor: tool.iconBg }]}>
              <Text style={styles.toolIcon}>{tool.icon}</Text>
            </View>
            <View style={styles.toolTextContainer}>
              <Text style={styles.toolTitleEn}>{tool.titleEn}</Text>
              <Text style={styles.toolTitleHi}>{tool.titleHi}</Text>
              <Text style={styles.toolDesc} numberOfLines={2}>
                {tool.desc}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Recent Files Section */}
      <View style={styles.recentSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Recent Files / हाल की फाइलें</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pick and open new PDF"
            onPress={handlePickAndOpenPdf}
            style={({ pressed }) => [styles.quickPickBtn, pressed && styles.quickPickBtnPressed]}
          >
            <Text style={styles.quickPickText}>+ Open PDF</Text>
          </Pressable>
        </View>

        {recentFiles.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyTitle}>No recent documents yet</Text>
            <Text style={styles.emptyDesc}>
              Open a PDF file to edit Devanagari text, translate, merge, split, or compress.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={handlePickAndOpenPdf}
              style={styles.emptyActionBtn}
            >
              <Text style={styles.emptyActionBtnText}>Select a PDF file</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.recentList}>
            {recentFiles.slice(0, 5).map((file) => (
              <Pressable
                key={file.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${file.name}`}
                onPress={() => onOpenFile(file)}
                style={({ pressed }) => [styles.recentCard, pressed && styles.recentCardPressed]}
              >
                {/* Document Thumbnail Preview */}
                <View style={styles.fileThumbnail}>
                  {file.thumbnailUri ? (
                    <Image
                      source={{ uri: file.thumbnailUri }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.placeholderThumb}>
                      <Text style={styles.thumbPdfLabel}>PDF</Text>
                      <View style={styles.thumbLines}>
                        <View style={styles.thumbLine} />
                        <View style={[styles.thumbLine, { width: '65%' }]} />
                        <View style={[styles.thumbLine, { width: '80%' }]} />
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.fileDetails}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.fileDate}>
                    {file.pageCount} page(s) • {file.date}
                  </Text>
                </View>

                <Text style={styles.openArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  logoHindi: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: -2,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandTitleAccent: {
    color: colors.brand,
  },
  heroSection: {
    gap: 2,
    paddingHorizontal: 2,
  },
  heroGreeting: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  heroSub: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  toolCard: {
    width: '31%',
    backgroundColor: '#ffffff',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs + 2,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 145,
    ...shadows.soft,
  },
  toolCardPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: colors.surfaceSubtle,
  },
  toolIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIcon: {
    fontSize: 22,
  },
  toolTextContainer: {
    alignItems: 'center',
    gap: 2,
  },
  toolTitleEn: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  toolTitleHi: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  toolDesc: {
    fontSize: 9.5,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 12,
    marginTop: 2,
  },
  recentSection: {
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionHeader: {
    fontSize: 16.5,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  quickPickBtn: {
    backgroundColor: colors.brandWash,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.brandTint,
  },
  quickPickBtnPressed: {
    backgroundColor: colors.brandTint,
  },
  quickPickText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    ...shadows.soft,
  },
  emptyIcon: {
    fontSize: 36,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 260,
  },
  emptyActionBtn: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  recentList: {
    gap: spacing.sm,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    gap: spacing.md,
    ...shadows.soft,
  },
  recentCardPressed: {
    backgroundColor: colors.surfaceSubtle,
  },
  fileThumbnail: {
    width: 44,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  placeholderThumb: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 3,
    gap: 3,
  },
  thumbPdfLabel: {
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
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fileDate: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  openArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textTertiary,
    paddingRight: 4,
  },
});
