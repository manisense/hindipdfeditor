import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNavBar, type MainTab } from './BottomNavBar';
import { FilesScreen } from '../screens/FilesScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ToolsScreen } from '../screens/ToolsScreen';
import type { RecentFile } from '../state/recentFilesStore';
import { colors, radius, shadows, spacing } from '../theme';

export type ToolId = 'edit' | 'translate' | 'merge' | 'split' | 'compress' | 'viewer';

export type ToolDef = {
  id: ToolId;
  name: string;
  shortName: string;
  icon: string;
  badge: string;
  accent: string;
  tint: string;
  description: string;
};

export const TOOLS: ToolDef[] = [
  {
    id: 'viewer',
    name: 'PDF Reader & Viewer',
    shortName: 'Reader',
    icon: '📖',
    badge: 'Reading Mode',
    accent: colors.success,
    tint: '#ECFDF5',
    description: 'Read and view PDF documents with zoom, page navigation, and night mode.',
  },
  {
    id: 'edit',
    name: 'Edit Hindi PDF',
    shortName: 'Edit',
    icon: '✏️',
    badge: 'Devanagari OCR',
    accent: colors.brand,
    tint: colors.brandWash,
    description: 'Tap to edit existing Hindi text, mask burned-in lines, or add new text.',
  },
  {
    id: 'translate',
    name: 'Translate PDF',
    shortName: 'Translate',
    icon: '🌐',
    badge: 'Bilingual AI',
    accent: colors.accent,
    tint: colors.accentTint,
    description: 'Full document or per-page bilingual Hindi ↔ English translation.',
  },
  {
    id: 'merge',
    name: 'Merge PDFs',
    shortName: 'Merge',
    icon: '📑',
    badge: 'Multi-Document',
    accent: colors.lavender,
    tint: colors.lavenderTint,
    description: 'Combine multiple PDF documents into a single organized file.',
  },
  {
    id: 'split',
    name: 'Split PDF',
    shortName: 'Split',
    icon: '✂️',
    badge: 'Page Range',
    accent: colors.coral,
    tint: '#FFEBE4',
    description: 'Extract specific page ranges or split into separate documents.',
  },
  {
    id: 'compress',
    name: 'Compress PDF',
    shortName: 'Compress',
    icon: '🗜️',
    badge: 'Size Reducer',
    accent: colors.amberInk,
    tint: colors.amberTint,
    description: 'Reduce file size of scanned and image-heavy Hindi documents.',
  },
];

type Props = {
  activeTool: ToolId | null;
  onSelectTool: (tool: ToolId | null) => void;
  onOpenFile?: (file: RecentFile, toolId?: ToolId) => void;
  children?: ReactNode;
};

/**
 * Modern ToolShell architecture supporting 4 bottom tabs (Home, Files, Tools, Profile)
 * and immersive full-screen tool workspaces.
 */
export function ToolShell({ activeTool, onSelectTool, onOpenFile, children }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const currentTool = TOOLS.find((t) => t.id === activeTool) ?? null;

  const handleOpenFile = (file: RecentFile, toolId?: ToolId) => {
    if (onOpenFile) {
      onOpenFile(file, toolId);
    } else {
      onSelectTool(toolId ?? 'edit');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background ambient glowing orbs */}
      <View style={styles.ambientAuraTopRight} pointerEvents="none" />
      <View
        style={[
          styles.ambientAuraLeft,
          { backgroundColor: currentTool ? currentTool.tint : colors.brandWash },
        ]}
        pointerEvents="none"
      />

      {/* Main View Area */}
      {activeTool ? (
        /* Full Screen Tool Workspace */
        <View style={styles.fullScreenToolContainer}>
          {/* Active Tool Header with Back Navigation */}
          <View style={styles.activeHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to home"
              onPress={() => onSelectTool(null)}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
              hitSlop={8}
            >
              <Text style={styles.backArrow}>‹</Text>
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>

            {currentTool && (
              <View
                style={[
                  styles.activeToolBadge,
                  { backgroundColor: currentTool.tint, borderColor: currentTool.accent },
                ]}
              >
                <Text style={styles.activeToolIcon}>{currentTool.icon}</Text>
                <Text style={[styles.activeToolName, { color: currentTool.accent }]}>
                  {currentTool.name}
                </Text>
              </View>
            )}
          </View>

          <View
            style={[styles.toolWorkspace, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}
          >
            {children}
          </View>
        </View>
      ) : (
        /* Main 4-Tab Screen with Bottom Navigation Bar */
        <View style={styles.mainTabContainer}>
          <View style={styles.tabContentArea}>
            {activeTab === 'home' && (
              <HomeScreen onOpenTool={onSelectTool} onOpenFile={handleOpenFile} />
            )}
            {activeTab === 'files' && <FilesScreen onOpenFile={handleOpenFile} />}
            {activeTab === 'tools' && <ToolsScreen onOpenTool={onSelectTool} />}
            {activeTab === 'profile' && <ProfileScreen />}
          </View>

          {/* 4-Tab Bottom Navigation Bar */}
          <BottomNavBar activeTab={activeTab} onSelectTab={setActiveTab} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  ambientAuraTopRight: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(215, 231, 255, 0.45)',
  },
  ambientAuraLeft: {
    position: 'absolute',
    top: 180,
    left: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.35,
  },
  mainTabContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  tabContentArea: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  fullScreenToolContainer: {
    flex: 1,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    ...shadows.soft,
    zIndex: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  backButtonPressed: {
    backgroundColor: colors.border,
    transform: [{ scale: 0.97 }],
  },
  backArrow: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.brand,
    marginTop: -2,
  },
  backLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  activeToolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 5,
  },
  activeToolIcon: {
    fontSize: 13,
  },
  activeToolName: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  toolWorkspace: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});
