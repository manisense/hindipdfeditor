import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { ScreenHeader } from '../components/ScreenHeader';
import type { ToolId } from '../components/ToolShell';
import { useAppTheme, useThemedStyles } from '../hooks/useAppTheme';
import { useSettingsStore } from '../state/settingsStore';
import { type Theme, colors, radius, shadows, spacing } from '../theme';

type Props = {
  onOpenTool: (toolId: ToolId) => void;
};

type ToolCatalogItem = {
  id: ToolId;
  titleEn: string;
  titleHi: string;
  badge: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  tint: string;
};

/**
 * PDF Tools catalog strictly aligned with design-system.md Section 2 category accents.
 */
const ALL_TOOLS: ToolCatalogItem[] = [
  {
    id: 'edit',
    titleEn: 'Edit Hindi PDF',
    titleHi: 'पीडीएफ संपादित करें',
    badge: 'Devanagari OCR',
    iconName: 'file-document-edit-outline',
    accent: colors.accentBlue,
    tint: colors.accentBlueTint,
  },
  {
    id: 'translate',
    titleEn: 'Translate PDF',
    titleHi: 'पीडीएफ अनुवाद',
    badge: 'Bilingual AI',
    iconName: 'translate',
    accent: colors.accentGreen,
    tint: colors.accentGreenTint,
  },
  {
    id: 'merge',
    titleEn: 'Merge PDFs',
    titleHi: 'पीडीएफ मर्ज करें',
    badge: 'Multi-Document',
    iconName: 'layers-triple-outline',
    accent: colors.accentPurple,
    tint: colors.accentPurpleTint,
  },
  {
    id: 'split',
    titleEn: 'Split PDF',
    titleHi: 'पीडीएफ विभाजित करें',
    badge: 'Page Range',
    iconName: 'content-cut',
    accent: colors.accentPurple,
    tint: colors.accentPurpleTint,
  },
  {
    id: 'compress',
    titleEn: 'Compress PDF',
    titleHi: 'पीडीएफ कंप्रेस करें',
    badge: 'Size Reducer',
    iconName: 'archive-arrow-down-outline',
    accent: colors.accentOrange,
    tint: colors.accentOrangeTint,
  },
  {
    id: 'viewer',
    titleEn: 'PDF Reader & Viewer',
    titleHi: 'पीडीएफ पढ़ें और देखें',
    badge: 'Reading Mode',
    iconName: 'book-open-page-variant-outline',
    accent: colors.accentTeal,
    tint: colors.accentTealTint,
  },
];

export function ToolsScreen({ onOpenTool }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(getStyles);
  const language = useSettingsStore((s) => s.language);
  const showEn = language === 'bilingual' || language === 'english';
  const showHi = language === 'bilingual' || language === 'hindi';

  return (
    <View style={styles.container}>
      {/* Fixed Header (Never Scrolls) */}
      {language === 'hindi' ? (
        <ScreenHeader title="पीडीएफ उपकरण" />
      ) : language === 'english' ? (
        <ScreenHeader title="PDF Tools" />
      ) : (
        <ScreenHeader title="PDF Tools /" titleAccent="उपकरण" />
      )}

      {/* Scrollable Tools List */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.toolsList}>
          {ALL_TOOLS.map((tool) => (
            <Pressable
              key={tool.id}
              accessibilityRole="button"
              accessibilityLabel={`${tool.titleEn} - ${tool.titleHi}`}
              onPress={() => onOpenTool(tool.id)}
              style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]}
            >
              {/* 12px Rounded Square Category Icon Chip */}
              <View style={[styles.iconBox, { backgroundColor: tool.tint }]}>
                <MaterialCommunityIcons name={tool.iconName} size={24} color={tool.accent} />
              </View>

              <View style={styles.cardContent}>
                <View style={styles.titleRow}>
                  {showEn && <Text style={styles.titleEn}>{tool.titleEn}</Text>}
                  {tool.badge && (
                    <View style={[styles.badge, { backgroundColor: tool.tint }]}>
                      <Text style={[styles.badgeText, { color: tool.accent }]}>{tool.badge}</Text>
                    </View>
                  )}
                </View>
                {showHi && (
                  <Text
                    style={[
                      styles.titleHi,
                      { color: tool.accent },
                      !showEn && { fontSize: 14, fontWeight: '800' },
                    ]}
                  >
                    {tool.titleHi}
                  </Text>
                )}
              </View>

              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      gap: spacing.xs,
    },
    scrollArea: {
      flex: 1,
    },
    content: {
      paddingBottom: 95,
    },
    toolsList: {
      gap: spacing.sm + 2,
    },
    toolCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: spacing.md,
      gap: spacing.md,
      ...shadows.soft,
    },
    toolCardPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
      transform: [{ scale: 0.98 }],
    },
    iconBox: {
      width: 46,
      height: 46,
      borderRadius: radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardContent: {
      flex: 1,
      gap: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    titleEn: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.2,
    },
    badge: {
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: radius.full,
    },
    badgeText: {
      fontSize: 9.5,
      fontWeight: '800',
      letterSpacing: 0.2,
      textTransform: 'uppercase',
    },
    titleHi: {
      fontSize: 12,
      fontWeight: '700',
    },
  });
