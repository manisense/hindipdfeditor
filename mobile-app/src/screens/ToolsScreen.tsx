import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { ScreenHeader } from '../components/ScreenHeader';
import type { ToolId } from '../components/ToolShell';
import { colors, radius, shadows, spacing } from '../theme';

type Props = {
  onOpenTool: (toolId: ToolId) => void;
};

type ToolCatalogItem = {
  id: ToolId;
  titleEn: string;
  titleHi: string;
  badge: string;
  desc: string;
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
    desc: 'Tap detected text to edit, add Hindi overlays, or erase lines.',
    iconName: 'file-document-edit-outline',
    accent: colors.accentBlue,
    tint: colors.accentBlueTint,
  },
  {
    id: 'translate',
    titleEn: 'Translate PDF',
    titleHi: 'पीडीएफ अनुवाद',
    badge: 'Bilingual AI',
    desc: 'Full document Hindi ↔ English bilingual translation.',
    iconName: 'translate',
    accent: colors.accentGreen,
    tint: colors.accentGreenTint,
  },
  {
    id: 'merge',
    titleEn: 'Merge PDFs',
    titleHi: 'पीडीएफ मर्ज करें',
    badge: 'Multi-Document',
    desc: 'Combine multiple PDF documents into a single unified file.',
    iconName: 'layers-triple-outline',
    accent: colors.accentPurple,
    tint: colors.accentPurpleTint,
  },
  {
    id: 'split',
    titleEn: 'Split PDF',
    titleHi: 'पीडीएफ विभाजित करें',
    badge: 'Page Range',
    desc: 'Extract individual pages or custom page ranges visually.',
    iconName: 'content-cut',
    accent: colors.accentPurple,
    tint: colors.accentPurpleTint,
  },
  {
    id: 'compress',
    titleEn: 'Compress PDF',
    titleHi: 'पीडीएफ कंप्रेस करें',
    badge: 'Size Reducer',
    desc: 'Reduce PDF file size while maintaining high visual clarity.',
    iconName: 'archive-arrow-down-outline',
    accent: colors.accentOrange,
    tint: colors.accentOrangeTint,
  },
  {
    id: 'viewer',
    titleEn: 'PDF Reader & Viewer',
    titleHi: 'पीडीएफ पढ़ें और देखें',
    badge: 'Reading Mode',
    desc: 'Read Hindi and English PDFs comfortably with night mode and zoom.',
    iconName: 'book-open-page-variant-outline',
    accent: colors.accentTeal,
    tint: colors.accentTealTint,
  },
];

export function ToolsScreen({ onOpenTool }: Props) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <ScreenHeader
        title="PDF Tools /"
        titleAccent="उपकरण"
        subtitle="Complete Devanagari & English PDF utility suite"
      />

      {/* Tools List */}
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
                <Text style={styles.titleEn}>{tool.titleEn}</Text>
                <View style={[styles.badge, { backgroundColor: tool.tint }]}>
                  <Text style={[styles.badgeText, { color: tool.accent }]}>{tool.badge}</Text>
                </View>
              </View>
              <Text style={[styles.titleHi, { color: tool.accent }]}>{tool.titleHi}</Text>
              <Text style={styles.desc}>{tool.desc}</Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: spacing.xs,
    gap: spacing.md,
    paddingBottom: 60,
  },
  toolsList: {
    gap: spacing.sm + 2,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.soft,
  },
  toolCardPressed: {
    backgroundColor: colors.surfaceSubtle,
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
    color: colors.textPrimary,
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
  desc: {
    fontSize: 11.5,
    color: colors.textTertiary,
    lineHeight: 15,
    marginTop: 1,
  },
});
