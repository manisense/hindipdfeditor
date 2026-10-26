import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { BottomNav, type MainTab } from '../ui/BottomNav';
import { FilesScreen } from '../screens/FilesScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ToolsScreen } from '../screens/ToolsScreen';
import { resolveBack } from '../navigation/backStack';
import { useHardwareBack } from '../navigation/useHardwareBack';
import { useThemedStyles } from '../hooks/useAppTheme';
import type { RecentFile } from '../state/recentFilesStore';
import { colors, type Theme } from '../theme';

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
  const { width: windowWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const styles = useThemedStyles(getStyles);

  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [focusSearchToken, setFocusSearchToken] = useState(0);
  const activeTabOffsetX = Math.max(CORE_TABS.indexOf(activeTab), 0) * windowWidth;

  // Keep the pager on the active tab when the width changes (rotation, foldable, split screen);
  // offsets are multiples of the window width, so the old offset would land between tabs.
  // Tab changes scroll themselves (animated), so this only acts when the width moved.
  const lastPagerWidthRef = useRef(windowWidth);
  useEffect(() => {
    if (lastPagerWidthRef.current === windowWidth) return;
    lastPagerWidthRef.current = windowWidth;
    pagerRef.current?.scrollTo({ x: activeTabOffsetX, animated: false });
  }, [windowWidth, activeTabOffsetX]);

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

  useHardwareBack(() => {
    const action = resolveBack({ activeTool, tab: activeTab });
    if (action.type === 'closeTool') {
      onSelectTool(null);
      return true;
    }
    if (action.type === 'goHome') {
      handleSelectTab('home');
      return true;
    }
    return false;
  });

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / windowWidth);
    const tab = CORE_TABS[pageIndex];
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  };

  return (
    <View style={styles.container}>
      {/* Every tool draws its own top bar and back button (`ToolScaffold` or `ReaderBar`). */}
      {activeTool ? (
        <View style={styles.fullScreenToolContainer}>{children}</View>
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
            // The pager remounts when a tool closes; start it on the tab the nav bar shows.
            contentOffset={{ x: activeTabOffsetX, y: 0 }}
            style={styles.pagerScrollView}
          >
            {/* Tab 1: Home */}
            <View style={{ width: windowWidth }}>
              {activeTab === 'home' && <StatusBar style="light" />}
              <HomeScreen
                onOpenTool={onSelectTool}
                onOpenFile={handleOpenFile}
                onSeeAll={() => handleSelectTab('files')}
                onOpenSearch={() => {
                  setFocusSearchToken((token) => token + 1);
                  handleSelectTab('files');
                }}
              />
            </View>

            {/* Tab 2: Files */}
            <View style={{ width: windowWidth }}>
              {activeTab === 'files' && <StatusBar style="light" />}
              <FilesScreen
                onOpenTool={onSelectTool}
                onOpenFile={handleOpenFile}
                focusSearchToken={focusSearchToken}
              />
            </View>

            {/* Tab 3: Tools */}
            <View style={{ width: windowWidth }}>
              {activeTab === 'tools' && <StatusBar style="light" />}
              <ToolsScreen onOpenTool={onSelectTool} />
            </View>

            {/* Tab 4: Settings */}
            <View style={{ width: windowWidth }}>
              {activeTab === 'settings' && <StatusBar style="light" />}
              <SettingsScreen />
            </View>
          </ScrollView>

          {/* Flat bottom navigation */}
          <BottomNav activeTab={activeTab} onSelectTab={handleSelectTab} />
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
    mainTabContainer: {
      flex: 1,
      justifyContent: 'space-between',
    },
    pagerScrollView: {
      flex: 1,
    },
    fullScreenToolContainer: {
      flex: 1,
    },
  });
