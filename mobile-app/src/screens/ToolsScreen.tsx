import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  icon: string;
  color: string;
};

const ALL_TOOLS: ToolCatalogItem[] = [
  {
    id: 'viewer',
    titleEn: 'PDF Reader & Viewer',
    titleHi: 'पीडीएफ पढ़ें और देखें',
    badge: 'Reading Mode',
    desc: 'Read Hindi and English PDFs comfortably with night mode and zoom.',
    icon: '📖',
    color: colors.success,
  },
  {
    id: 'edit',
    titleEn: 'Edit Hindi PDF',
    titleHi: 'पीडीएफ संपादित करें',
    badge: 'Devanagari OCR',
    desc: 'Tap detected text to edit, add Hindi overlays, or erase lines.',
    icon: '✏️',
    color: colors.brand,
  },
  {
    id: 'translate',
    titleEn: 'Translate PDF',
    titleHi: 'पीडीएफ अनुवाद',
    badge: 'Bilingual AI',
    desc: 'Full document Hindi ↔ English bilingual translation.',
    icon: '🌐',
    color: colors.accent,
  },
  {
    id: 'merge',
    titleEn: 'Merge PDFs',
    titleHi: 'पीडीएफ मर्ज करें',
    badge: 'Multi-Document',
    desc: 'Combine multiple PDF documents into a single unified file.',
    icon: '📑',
    color: colors.lavender,
  },
  {
    id: 'split',
    titleEn: 'Split PDF',
    titleHi: 'पीडीएफ विभाजित करें',
    badge: 'Page Range',
    desc: 'Extract individual pages or custom page ranges visually.',
    icon: '✂️',
    color: colors.accent500,
  },
  {
    id: 'compress',
    titleEn: 'Compress PDF',
    titleHi: 'पीडीएफ कंप्रेस करें',
    badge: 'Size Reducer',
    desc: 'Reduce PDF file size up to 75% while maintaining clarity.',
    icon: '🗜️',
    color: colors.amberInk,
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
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerLogoBadge}>
            <Text style={styles.headerLogoHindi}>ह</Text>
          </View>
          <Text style={styles.headerTitle}>
            PDF Tools / <Text style={styles.headerTitleAccent}>उपकरण</Text>
          </Text>
        </View>
        <Text style={styles.headerSubtitle}>Complete Devanagari & English PDF utility suite.</Text>
      </View>

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
            <View style={[styles.iconBox, { backgroundColor: `${tool.color}15` }]}>
              <Text style={styles.toolIcon}>{tool.icon}</Text>
            </View>

            <View style={styles.cardContent}>
              <View style={styles.titleRow}>
                <Text style={styles.titleEn}>{tool.titleEn}</Text>
                <View style={[styles.badge, { backgroundColor: `${tool.color}18` }]}>
                  <Text style={[styles.badgeText, { color: tool.color }]}>{tool.badge}</Text>
                </View>
              </View>
              <Text style={styles.titleHi}>{tool.titleHi}</Text>
              <Text style={styles.desc}>{tool.desc}</Text>
            </View>

            <Text style={styles.arrowIcon}>›</Text>
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
    paddingVertical: spacing.md,
    gap: spacing.lg,
    paddingBottom: 60,
  },
  header: {
    gap: 4,
    paddingHorizontal: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerLogoBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoHindi: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerTitleAccent: {
    color: colors.brand,
  },
  headerSubtitle: {
    fontSize: 13.5,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  toolsList: {
    gap: spacing.md,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  toolCardPressed: {
    backgroundColor: colors.surfaceSubtle,
    transform: [{ scale: 0.98 }],
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIcon: {
    fontSize: 24,
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
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  titleHi: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  desc: {
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 16,
    marginTop: 2,
  },
  arrowIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textTertiary,
    paddingRight: 4,
  },
});
