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
import { SettingsScreen } from '../screens/SettingsScreen';
import { ToolsScreen } from '../screens/ToolsScreen';
import { useAppTheme, useThemedStyles } from '../hooks/useAppTheme';
import type { RecentFile } from '../state/recentFilesStore';
import { colors, radius, shadows, spacing, type Theme } from '../theme';

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

const CORE_TABS: MainTab[] = ['home', 'files', 'tools', 'settings'];

type Props = {
  activeTool: ToolId | null;
  onSelectTool: (tool: ToolId | null) => void;
  onOpenFile?: (file: RecentFile, toolId?: ToolId) => void;
  children?: ReactNode;
};

/**
 * Modern ToolShell architecture supporting 4 slidable/swipeable bottom tabs (Home, Files, Tools, Settings)
 * and immersive full-screen tool workspaces.
 */
export function ToolShell({ activeTool, onSelectTool, onOpenFile, children }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const theme = useAppTheme();
  const styles = useThemedStyles(getStyles);

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 0,
  );
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
          { backgroundColor: currentTool ? currentTool.tint : theme.colors.brandTint },
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
              <Ionicons name="chevron-back" size={16} color={theme.colors.brand} />
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>

            {currentTool && (
              <View
                style={[
                  styles.activeToolBadge,
                  {
                    backgroundColor: currentTool.tint,
                    borderColor: currentTool.accent,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={currentTool.iconName}
                  size={16}
                  color={currentTool.accent}
                />
                <Text style={[styles.activeToolName, { color: currentTool.accent }]}>
                  {currentTool.name}
                </Text>
              </View>
            )}
          </View>

          {/* Active Tool Body */}
          <View style={styles.toolWorkspace}>{children}</View>
        </View>
      ) : (
        /* Swipeable / Slideable 4-Tab Interface (Home, Files, Tools, Settings) */
        <View style={styles.mainTabContainer}>
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleScrollEnd}
            style={styles.pagerScrollView}
          >
            {/* Tab 1: Home */}
            <View style={[styles.tabPage, { width: windowWidth }]}>
              <HomeScreen onOpenTool={onSelectTool} onOpenFile={handleOpenFile} />
            </View>

            {/* Tab 2: Files */}
            <View style={[styles.tabPage, { width: windowWidth }]}>
              <FilesScreen onOpenTool={onSelectTool} onOpenFile={handleOpenFile} />
            </View>

            {/* Tab 3: Tools */}
            <View style={[styles.tabPage, { width: windowWidth }]}>
              <ToolsScreen onOpenTool={onSelectTool} />
            </View>

            {/* Tab 4: Settings */}
            <View style={[styles.tabPage, { width: windowWidth }]}>
              <SettingsScreen />
            </View>
          </ScrollView>

          {/* 4-Tab Bottom Navigation Bar */}
          <BottomNavBar activeTab={activeTab} onSelectTab={handleSelectTab} />
        </View>
      )}
    </View>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    ambientAuraTopRight: {
      position: 'absolute',
      top: -50,
      right: -50,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: theme.colors.auraTopRight,
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
      backgroundColor: theme.colors.activeHeaderBg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
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
      backgroundColor: theme.colors.surfaceSubtle,
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 4,
    },
    backButtonPressed: {
      backgroundColor: theme.colors.borderStrong,
      transform: [{ scale: 0.97 }],
    },
    backLabel: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.textPrimary,
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
