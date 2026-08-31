import { useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
  hindiName: string;
  desc: string;
  badge: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  tint: string;
};

export const TOOLS: ToolDef[] = [
  {
    id: 'edit',
    name: 'Edit Hindi PDF',
    hindiName: 'संपादित करें',
    badge: 'Devanagari OCR',
    desc: 'Tap detected text to edit, add Hindi overlays, or erase lines.',
    iconName: 'file-document-edit-outline',
    accent: colors.accentBlue,
    tint: colors.accentBlueTint,
  },
  {
    id: 'translate',
    name: 'Translate PDF',
    hindiName: 'अनुवाद',
    badge: 'Bilingual AI',
    desc: 'Full document Hindi ↔ English bilingual translation.',
    iconName: 'translate',
    accent: colors.accentGreen,
    tint: colors.accentGreenTint,
  },
  {
    id: 'merge',
    name: 'Merge PDFs',
    hindiName: 'मर्ज करें',
    badge: 'Multi-Document',
    desc: 'Combine multiple PDF documents into a single unified file.',
    iconName: 'layers-triple-outline',
    accent: colors.accentPurple,
    tint: colors.accentPurpleTint,
  },
  {
    id: 'split',
    name: 'Split PDF',
    hindiName: 'विभाजित करें',
    badge: 'Page Range',
    desc: 'Extract individual pages or custom page ranges visually.',
    iconName: 'content-cut',
    accent: colors.accentPurple,
    tint: colors.accentPurpleTint,
  },
  {
    id: 'compress',
    name: 'Compress PDF',
    hindiName: 'कंप्रेस करें',
    badge: 'Size Reducer',
    desc: 'Reduce PDF file size while maintaining high visual clarity.',
    iconName: 'archive-arrow-down-outline',
    accent: colors.accentOrange,
    tint: colors.accentOrangeTint,
  },
  {
    id: 'viewer',
    name: 'PDF Reader',
    hindiName: 'पढ़ें और देखें',
    badge: 'Reading Mode',
    desc: 'Read Hindi and English PDFs comfortably with night mode and zoom.',
    iconName: 'book-open-page-variant-outline',
    accent: colors.accentTeal,
    tint: colors.accentTealTint,
  },
];

const CORE_TABS: MainTab[] = ['home', 'files', 'tools', 'profile'];

type Props = {
  activeTool: ToolId | null;
  onSelectTool: (tool: ToolId | null) => void;
  onOpenFile?: (file: RecentFile, toolId?: ToolId) => void;
  children?: ReactNode;
};

/**
 * Modern ToolShell architecture supporting 4 slidable/swipeable bottom tabs (Home, Files, Tools, Profile)
 * and immersive full-screen tool workspaces.
 */
export function ToolShell({ activeTool, onSelectTool, onOpenFile, children }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 0,
  );
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 18 : 10);
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const currentTool = TOOLS.find((t) => t.id === activeTool) ?? null;

  const handleOpenFile = (file: RecentFile, toolId?: ToolId) => {
    if (onOpenFile) {
      onOpenFile(file, toolId);
    } else {
      onSelectTool(toolId ?? 'edit');
    }
  };

  const handleSelectTab = (tab: MainTab) => {
    setActiveTab(tab);
    const index = CORE_TABS.indexOf(tab);
    if (index >= 0 && pagerRef.current) {
      pagerRef.current.scrollTo({ x: index * windowWidth, animated: true });
    }
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / windowWidth);
    const tab = CORE_TABS[pageIndex];
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Background ambient glowing orbs */}
      <View style={styles.ambientAuraTopRight} pointerEvents="none" />
      <View
        style={[
          styles.ambientAuraLeft,
          { backgroundColor: currentTool ? currentTool.tint : colors.brandTint },
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
              <Ionicons name="chevron-back" size={16} color={colors.brand} />
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>

            {currentTool && (
              <View
                style={[
                  styles.activeToolBadge,
                  { backgroundColor: currentTool.tint, borderColor: currentTool.accent },
                ]}
              >
                <MaterialCommunityIcons
                  name={currentTool.iconName}
                  size={15}
                  color={currentTool.accent}
                />
                <Text style={[styles.activeToolName, { color: currentTool.accent }]}>
                  {currentTool.name}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.toolWorkspace, { paddingBottom: bottomInset + spacing.xs }]}>
            {children}
          </View>
        </View>
      ) : (
        /* Main 4-Tab Screen with Slidable Horizontal Pager and Bottom Navigation Bar */
        <View style={styles.mainTabContainer}>
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            onMomentumScrollEnd={handleScrollEnd}
            style={styles.pagerScrollView}
            scrollEventThrottle={16}
          >
            <View style={[styles.tabPage, { width: windowWidth }]}>
              <HomeScreen onOpenTool={onSelectTool} onOpenFile={handleOpenFile} />
            </View>
            <View style={[styles.tabPage, { width: windowWidth }]}>
              <FilesScreen onOpenFile={handleOpenFile} />
            </View>
            <View style={[styles.tabPage, { width: windowWidth }]}>
              <ToolsScreen onOpenTool={onSelectTool} />
            </View>
            <View style={[styles.tabPage, { width: windowWidth }]}>
              <ProfileScreen />
            </View>
          </ScrollView>

          {/* 4-Tab Bottom Navigation Bar */}
          <BottomNavBar activeTab={activeTab} onSelectTab={handleSelectTab} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfacePage,
  },
  ambientAuraTopRight: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(238, 242, 255, 0.7)',
  },
  ambientAuraLeft: {
    position: 'absolute',
    top: 180,
    left: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.45,
  },
  mainTabContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  pagerScrollView: {
    flex: 1,
  },
  tabPage: {
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm + 2,
    marginBottom: spacing.sm + 2,
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
    borderColor: colors.borderSubtle,
    gap: 4,
  },
  backButtonPressed: {
    backgroundColor: colors.borderSubtle,
    transform: [{ scale: 0.97 }],
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
  activeToolName: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  toolWorkspace: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});
