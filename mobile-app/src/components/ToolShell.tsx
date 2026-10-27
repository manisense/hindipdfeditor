import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
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
import type { Theme } from '../theme';

export type ToolId = 'edit' | 'translate' | 'merge' | 'split' | 'compress' | 'viewer';

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
