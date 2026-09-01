import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { ScreenHeader } from '../components/ScreenHeader';
import type { ToolId } from '../components/ToolShell';
import { useThemedStyles } from '../hooks/useAppTheme';
import { getPageCount, renderPage } from '../lib/pdfToImages';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { useSettingsStore } from '../state/settingsStore';
import { type Theme, colors, radius, shadows, spacing } from '../theme';

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

/**
 * 6-Tool Catalog aligned strictly with design-system.md Section 2 category accents.
 */
const QUICK_TOOLS: QuickTool[] = [
  {
    id: 'edit',
    titleEn: 'Edit PDF',
    titleHi: 'संपादित करें',
    desc: 'OCR & Devanagari edits',
    iconName: 'file-document-edit-outline',
    accent: colors.accentBlue,
    tint: colors.accentBlueTint,
    badge: 'Popular',
  },
  {
    id: 'translate',
    titleEn: 'Translate',
    titleHi: 'अनुवाद करें',
    desc: 'Hindi ↔ English AI',
    iconName: 'translate',
    accent: colors.accentGreen,
    tint: colors.accentGreenTint,
    badge: 'AI',
  },
  {
    id: 'merge',
    titleEn: 'Merge PDFs',
    titleHi: 'पीडीएफ जोड़ें',
    desc: 'Combine multiple files',
    iconName: 'layers-triple-outline',
    accent: colors.accentPurple,
    tint: colors.accentPurpleTint,
  },
  {
    id: 'split',
    titleEn: 'Split PDF',
    titleHi: 'विभाजित करें',
    desc: 'Extract page ranges',
    iconName: 'content-cut',
    accent: colors.accentPurple,
    tint: colors.accentPurpleTint,
  },
  {
    id: 'compress',
    titleEn: 'Compress',
    titleHi: 'कंप्रेस करें',
    desc: 'Reduce file size',
    iconName: 'archive-arrow-down-outline',
    accent: colors.accentOrange,
    tint: colors.accentOrangeTint,
  },
  {
    id: 'viewer',
    titleEn: 'PDF Reader',
    titleHi: 'रीडर व व्यूअर',
    desc: 'Crisp page reading',
    iconName: 'book-open-page-variant-outline',
    accent: colors.accentTeal,
    tint: colors.accentTealTint,
  },
];

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HomeScreen({ onOpenTool, onOpenFile }: Props) {
  const styles = useThemedStyles(getStyles);
  const language = useSettingsStore((state) => state.language);
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

  const showEn = language === 'bilingual' || language === 'english';
  const showHi = language === 'bilingual' || language === 'hindi';

  return (
    <View style={styles.container}>
      {/* Brand Top Header */}
      {language === 'hindi' ? (
        <ScreenHeader title="हिंदी पीडीएफ" titleAccent="संपादक" />
      ) : (
        <ScreenHeader title="Hindi PDF" titleAccent="Editor" />
      )}

      {/* Hero Welcome Banner */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroGreetingWrap}>
            {language === 'bilingual' ? (
              <>
                <Text style={styles.heroGreeting}>नमस्ते!</Text>
                <Text style={styles.heroSubGreeting}>Welcome back</Text>
              </>
            ) : language === 'hindi' ? (
              <Text style={styles.heroGreeting}>नमस्ते!</Text>
            ) : (
              <Text style={styles.heroGreeting}>Welcome back!</Text>
            )}
          </View>
          <View style={styles.privacyPill}>
            <Ionicons name="shield-checkmark" size={13} color={colors.accentGreen} />
            <Text style={styles.privacyText}>100% Offline</Text>
          </View>
        </View>
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
            {/* 12px Rounded Square Category Icon Chip */}
            <View style={[styles.toolIconWrapper, { backgroundColor: tool.tint }]}>
              <MaterialCommunityIcons name={tool.iconName} size={24} color={tool.accent} />
            </View>

            {/* Tool Info with Adaptive Language Prominence */}
            <View style={styles.toolTextContainer}>
              <View style={styles.toolTitleRow}>
                {showEn && (
                  <Text style={styles.toolTitleEn} numberOfLines={1}>
                    {tool.titleEn}
                  </Text>
                )}
                {tool.badge && (
                  <View style={[styles.toolBadge, { backgroundColor: tool.tint }]}>
                    <Text style={[styles.toolBadgeText, { color: tool.accent }]}>{tool.badge}</Text>
                  </View>
                )}
              </View>

              {showHi && (
                <Text
                  style={[
                    styles.toolTitleHi,
                    { color: tool.accent },
                    !showEn && { fontSize: 14, fontWeight: '800' },
                  ]}
                  numberOfLines={1}
                >
                  {tool.titleHi}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>

      {/* Recent Documents Section */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeaderRow}>
          <Text style={styles.recentSectionTitle}>
            {language === 'hindi'
              ? 'हाल की फाइलें'
              : language === 'english'
                ? 'Recent Documents'
                : 'Recent Documents / हाल की फाइलें'}
          </Text>
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
              <Text style={styles.quickStartTitle}>Tap to open and edit any PDF</Text>
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      gap: spacing.xs,
      paddingBottom: 85,
    },
    heroCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
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
      color: theme.colors.textPrimary,
      letterSpacing: -0.4,
    },
    heroSubGreeting: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    privacyPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.accentGreenTint,
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: radius.full,
      gap: 4,
    },
    privacyText: {
      fontSize: 9.5,
      fontWeight: '800',
      color: theme.colors.accentGreen,
      letterSpacing: 0.2,
    },
    heroCaption: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.colors.textSecondary,
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
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      ...shadows.soft,
    },
    toolCardPressed: {
      transform: [{ scale: 0.97 }],
      backgroundColor: theme.colors.surfaceSubtle,
    },
    toolIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
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
      color: theme.colors.textPrimary,
      letterSpacing: -0.2,
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
      color: theme.colors.textTertiary,
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
      color: theme.colors.textPrimary,
      letterSpacing: -0.2,
    },
    recentCountText: {
      fontSize: 11,
      color: theme.colors.textTertiary,
      fontWeight: '600',
    },
    recentList: {
      gap: spacing.xs + 2,
    },
    recentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      ...shadows.soft,
    },
    recentCardPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
      transform: [{ scale: 0.98 }],
    },
    resumeThumbWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.chip,
      backgroundColor: theme.colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    resumeThumbImage: {
      width: '100%',
      height: '100%',
    },
    resumeDetails: {
      flex: 1,
      gap: 1,
    },
    resumeFileName: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    resumeMeta: {
      fontSize: 10.5,
      color: theme.colors.textSecondary,
    },
    resumeArrowBtn: {
      width: 24,
      height: 24,
      borderRadius: radius.full,
      backgroundColor: theme.colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickStartCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.md,
      ...shadows.soft,
    },
    quickStartCardPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    quickStartIconCircle: {
      width: 36,
      height: 36,
      borderRadius: radius.chip,
      backgroundColor: theme.colors.brandTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickStartTextGroup: {
      flex: 1,
      gap: 2,
    },
    quickStartTitle: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    quickStartSub: {
      fontSize: 10.5,
      color: theme.colors.textSecondary,
      lineHeight: 14,
    },
  });
