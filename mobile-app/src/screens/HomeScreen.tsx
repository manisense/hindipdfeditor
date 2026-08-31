import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  tint: string;
  badge?: string;
};

const QUICK_TOOLS: QuickTool[] = [
  {
    id: 'edit',
    titleEn: 'Edit PDF',
    titleHi: 'संपादित करें',
    desc: 'OCR & Devanagari edits',
    iconName: 'file-document-edit-outline',
    accent: colors.brand,
    tint: colors.brandWash,
    badge: 'Popular',
  },
  {
    id: 'translate',
    titleEn: 'Translate',
    titleHi: 'अनुवाद करें',
    desc: 'Hindi ↔ English AI',
    iconName: 'translate',
    accent: colors.accent,
    tint: colors.accentTint,
    badge: 'AI',
  },
  {
    id: 'merge',
    titleEn: 'Merge PDFs',
    titleHi: 'पीडीएफ जोड़ें',
    desc: 'Combine multiple files',
    iconName: 'layers-triple-outline',
    accent: colors.lavender,
    tint: colors.lavenderTint,
  },
  {
    id: 'split',
    titleEn: 'Split PDF',
    titleHi: 'विभाजित करें',
    desc: 'Extract page ranges',
    iconName: 'content-cut',
    accent: '#E05322',
    tint: '#FFEBE4',
  },
  {
    id: 'compress',
    titleEn: 'Compress',
    titleHi: 'कंप्रेस करें',
    desc: 'Reduce file size',
    iconName: 'archive-arrow-down-outline',
    accent: colors.amberInk,
    tint: colors.amberTint,
  },
  {
    id: 'viewer',
    titleEn: 'PDF Reader',
    titleHi: 'रीडर व व्यूअर',
    desc: 'Crisp page reading',
    iconName: 'book-open-page-variant-outline',
    accent: '#0284C7',
    tint: '#E0F2FE',
  },
];

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
    <View style={styles.container}>
      {/* Brand Top Header */}
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            accessibilityLabel="Hindi PDF Editor logo"
          />
          <View style={styles.brandTextContainer}>
            <Text style={styles.brandTitle}>
              Hindi PDF <Text style={styles.brandTitleAccent}>Editor</Text>
            </Text>
            <Text style={styles.brandSubtitle}>हिंदी पीडीएफ संपादक</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open PDF document from device"
          onPress={handlePickAndOpenPdf}
          style={({ pressed }) => [styles.quickPickBtn, pressed && styles.quickPickBtnPressed]}
        >
          <Ionicons name="folder-open-outline" size={16} color={colors.brand} />
          <Text style={styles.quickPickText}>+ Open PDF</Text>
        </Pressable>
      </View>

      {/* Hero Welcome Banner */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroGreetingWrap}>
            <Text style={styles.heroGreeting}>नमस्ते!</Text>
            <Text style={styles.heroSubGreeting}>Welcome back</Text>
          </View>
          <View style={styles.privacyPill}>
            <Ionicons name="shield-checkmark" size={12} color={colors.success} />
            <Text style={styles.privacyText}>100% Offline</Text>
          </View>
        </View>
        <Text style={styles.heroCaption}>
          Edit, translate, split, and merge Hindi documents directly on your phone.
        </Text>
      </View>

      {/* 6-Tool Quick Action Grid (2 columns x 3 rows) */}
      <View style={styles.toolsGrid}>
        {QUICK_TOOLS.map((tool, idx) => (
          <Pressable
            key={`${tool.id}-${idx}`}
            accessibilityRole="button"
            accessibilityLabel={`${tool.titleEn} - ${tool.titleHi}`}
            onPress={() => onOpenTool(tool.id)}
            style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]}
          >
            {/* Tool Icon Badge */}
            <View style={[styles.toolIconWrapper, { backgroundColor: tool.tint }]}>
              <MaterialCommunityIcons name={tool.iconName} size={22} color={tool.accent} />
            </View>

            {/* Tool Info */}
            <View style={styles.toolTextContainer}>
              <View style={styles.toolTitleRow}>
                <Text style={styles.toolTitleEn} numberOfLines={1}>
                  {tool.titleEn}
                </Text>
                {tool.badge && (
                  <View style={[styles.toolBadge, { backgroundColor: tool.tint }]}>
                    <Text style={[styles.toolBadgeText, { color: tool.accent }]}>{tool.badge}</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.toolTitleHi, { color: tool.accent }]} numberOfLines={1}>
                {tool.titleHi}
              </Text>
              <Text style={styles.toolDesc} numberOfLines={1}>
                {tool.desc}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Recent Documents Section */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeaderRow}>
          <Text style={styles.recentSectionTitle}>Recent Documents / हाल की फाइलें</Text>
          {recentFiles.length > 0 && (
            <Text style={styles.recentCountText}>{recentFiles.length} file(s)</Text>
          )}
        </View>

        {recentFiles.length > 0 ? (
          <View style={styles.recentList}>
            {recentFiles.slice(0, 2).map((file) => (
              <Pressable
                key={file.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${file.name}`}
                onPress={() => onOpenFile(file)}
                style={({ pressed }) => [styles.recentCard, pressed && styles.recentCardPressed]}
              >
                <View style={styles.resumeThumbWrap}>
                  {file.thumbnailUri ? (
                    <Image source={{ uri: file.thumbnailUri }} style={styles.resumeThumbImage} />
                  ) : (
                    <Ionicons name="document-text-outline" size={20} color={colors.brand} />
                  )}
                </View>

                <View style={styles.resumeDetails}>
                  <Text style={styles.resumeFileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.resumeMeta}>
                    {file.pageCount} page{file.pageCount > 1 ? 's' : ''}
                    {file.sizeBytes > 0 ? ` • ${formatBytes(file.sizeBytes)}` : ''} • {file.date}
                  </Text>
                </View>

                <View style={styles.resumeArrowBtn}>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open a PDF to start editing"
            onPress={handlePickAndOpenPdf}
            style={({ pressed }) => [
              styles.quickStartCard,
              pressed && styles.quickStartCardPressed,
            ]}
          >
            <View style={styles.quickStartIconCircle}>
              <Ionicons name="sparkles-outline" size={18} color={colors.brand} />
            </View>
            <View style={styles.quickStartTextGroup}>
              <Text style={styles.quickStartTitle}>Ready to edit or translate?</Text>
              <Text style={styles.quickStartSub}>
                Tap &apos;+ Open PDF&apos; or select any tool above to get started
              </Text>
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.sm,
    gap: spacing.sm + 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoImage: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    ...shadows.soft,
  },
  brandTextContainer: {
    gap: 1,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  brandTitleAccent: {
    color: colors.brand,
  },
  brandSubtitle: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  quickPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandWash,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.brandTint,
    gap: 5,
    ...shadows.soft,
  },
  quickPickBtnPressed: {
    backgroundColor: colors.brandTint,
    transform: [{ scale: 0.96 }],
  },
  quickPickIcon: {
    fontSize: 13,
  },
  quickPickText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.brand,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
    gap: 2,
    ...shadows.soft,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroGreetingWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroGreeting: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  heroSubGreeting: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    gap: 4,
  },
  privacyDot: {
    fontSize: 7,
    color: colors.success,
  },
  privacyText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.success,
    letterSpacing: 0.2,
  },
  heroCaption: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 14,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  toolCard: {
    width: '48.3%',
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    ...shadows.soft,
  },
  toolCardPressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: colors.surfaceSubtle,
  },
  toolIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIcon: {
    fontSize: 19,
  },
  toolTextContainer: {
    flex: 1,
    gap: 1,
  },
  toolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  toolTitleEn: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  toolBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  toolBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  toolTitleHi: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  toolDesc: {
    fontSize: 9,
    color: colors.textTertiary,
    lineHeight: 11,
  },
  recentSection: {
    flex: 1,
    gap: spacing.xs + 2,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  recentSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  recentCountText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  recentList: {
    gap: spacing.xs + 2,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    ...shadows.soft,
  },
  recentCardPressed: {
    backgroundColor: colors.surfaceSubtle,
    transform: [{ scale: 0.98 }],
  },
  resumeThumbWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  resumeThumbImage: {
    width: '100%',
    height: '100%',
  },
  resumeThumbIcon: {
    fontSize: 18,
  },
  resumeDetails: {
    flex: 1,
    gap: 2,
  },
  resumeFileName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resumeMeta: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  resumeArrowBtn: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeArrowIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textSecondary,
    marginTop: -2,
  },
  quickStartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    ...shadows.soft,
  },
  quickStartCardPressed: {
    backgroundColor: colors.surfaceSubtle,
    transform: [{ scale: 0.98 }],
  },
  quickStartIconCircle: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.brandWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStartIcon: {
    fontSize: 16,
  },
  quickStartTextGroup: {
    flex: 1,
    gap: 1,
  },
  quickStartTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  quickStartSub: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});
