import { useEffect, useReducer } from 'react';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@shopify/restyle';

import { ToolShell, type ToolId } from './src/components/ToolShell';
import { useOrientationPolicy } from './src/hooks/useOrientationPolicy';
import { NO_TOOL, toolSessionReducer } from './src/navigation/backStack';
import { useRecentFilesStore, type RecentFile } from './src/state/recentFilesStore';
import { useSettingsStore } from './src/state/settingsStore';
import { darkTheme, lightTheme } from './src/theme';
import { CompressPdfTool } from './src/tools/CompressPdfTool';
import { EditPdfTool } from './src/tools/EditPdfTool';
import { MergePdfTool } from './src/tools/MergePdfTool';
import { SplitPdfTool } from './src/tools/SplitPdfTool';
import { TranslatePdfTool } from './src/tools/TranslatePdfTool';
import { ViewPdfTool } from './src/tools/ViewPdfTool';
import { SnackbarProvider } from './src/ui/Snackbar';

/**
 * Hindi PDF Editor - Mobile App Root Component
 * Modern 4-tab mobile navigation (Home, Files, Tools, Settings)
 * with dedicated full-screen PDF utility tools and Shopify Restyle theme system.
 */
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansDevanagari: require('./assets/fonts/NotoSansDevanagari-Variable.ttf'),
    Inter: require('./assets/fonts/Inter-Variable.ttf'),
  });

  useOrientationPolicy();
  const systemColorScheme = useColorScheme();
  const initSettings = useSettingsStore((s) => s.initStore);
  const theme = useSettingsStore((s) => s.theme);

  const initStore = useRecentFilesStore((s) => s.initStore);
  const [session, dispatch] = useReducer(toolSessionReducer, NO_TOOL);
  const { activeTool, file: openedFile } = session;

  useEffect(() => {
    void initStore();
    void initSettings();
  }, [initStore, initSettings]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#1843DD" />
      </View>
    );
  }

  // Resolve effective theme: 'system' delegates to the OS color scheme
  const isDark = theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark');
  const activeTheme = isDark ? darkTheme : lightTheme;
  const statusBarStyle = isDark ? 'light' : 'dark';

  const handleOpenFile = (file: RecentFile, toolId: ToolId = 'viewer') =>
    dispatch({ type: 'open', tool: toolId, file });

  /** Opens Edit or Translate from the Reader; closing it comes back to the Reader. */
  const openFromReader = (file: RecentFile, toolId: ToolId) =>
    dispatch({ type: 'open', tool: toolId, file, fromReader: true });

  const closeTool = () => dispatch({ type: 'close' });

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider theme={activeTheme}>
          <SnackbarProvider>
            <StatusBar style={statusBarStyle} />
            <View style={[styles.root, { backgroundColor: activeTheme.colors.background }]}>
              <ToolShell
                activeTool={activeTool}
                onSelectTool={(tool) =>
                  tool ? dispatch({ type: 'open', tool, file: null }) : closeTool()
                }
                onOpenFile={handleOpenFile}
              >
                {activeTool === 'viewer' && (
                  <ViewPdfTool
                    initialFile={openedFile ?? undefined}
                    onClose={closeTool}
                    onOpenEditor={(file) => openFromReader(file, 'edit')}
                    onOpenTranslate={(file) => openFromReader(file, 'translate')}
                  />
                )}
                {activeTool === 'edit' && (
                  <EditPdfTool
                    initialFileUri={openedFile?.uri}
                    initialFileName={openedFile?.name}
                    onClose={closeTool}
                    onOpenFile={handleOpenFile}
                  />
                )}
                {activeTool === 'translate' && (
                  <TranslatePdfTool
                    initialFileUri={openedFile?.uri}
                    initialFileName={openedFile?.name}
                    onClose={closeTool}
                    onOpenFile={handleOpenFile}
                  />
                )}
                {activeTool === 'merge' && (
                  <MergePdfTool
                    initialFileUri={openedFile?.uri}
                    initialFileName={openedFile?.name}
                    onClose={closeTool}
                    onOpenFile={handleOpenFile}
                  />
                )}
                {activeTool === 'split' && (
                  <SplitPdfTool
                    initialFileUri={openedFile?.uri}
                    initialFileName={openedFile?.name}
                    onClose={closeTool}
                    onOpenFile={handleOpenFile}
                  />
                )}
                {activeTool === 'compress' && (
                  <CompressPdfTool
                    initialFileUri={openedFile?.uri}
                    initialFileName={openedFile?.name}
                    onClose={closeTool}
                    onOpenFile={handleOpenFile}
                  />
                )}
              </ToolShell>
            </View>
          </SnackbarProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#FBFBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
