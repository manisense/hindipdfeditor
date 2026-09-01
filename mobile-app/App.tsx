import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@shopify/restyle';

import { AppPopupProvider } from './src/components/AppPopup';
import { ToolShell, type ToolId } from './src/components/ToolShell';
import { useRecentFilesStore, type RecentFile } from './src/state/recentFilesStore';
import { useSettingsStore } from './src/state/settingsStore';
import { darkTheme, lightTheme } from './src/theme';
import { CompressPdfTool } from './src/tools/CompressPdfTool';
import { EditPdfTool } from './src/tools/EditPdfTool';
import { MergePdfTool } from './src/tools/MergePdfTool';
import { SplitPdfTool } from './src/tools/SplitPdfTool';
import { TranslatePdfTool } from './src/tools/TranslatePdfTool';
import { ViewPdfTool } from './src/tools/ViewPdfTool';

/**
 * Hindi PDF Editor - Mobile App Root Component
 * Modern 4-tab mobile navigation (Home, Files, Tools, Settings)
 * with dedicated full-screen PDF utility tools and Shopify Restyle theme system.
 */
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansDevanagari: require('./assets/fonts/NotoSansDevanagari-Variable.ttf'),
  });

  const systemColorScheme = useColorScheme();
  const initSettings = useSettingsStore((s) => s.initStore);
  const theme = useSettingsStore((s) => s.theme);

  const initStore = useRecentFilesStore((s) => s.initStore);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [openedFile, setOpenedFile] = useState<RecentFile | null>(null);

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

  const handleOpenFile = (file: RecentFile, toolId: ToolId = 'viewer') => {
    setOpenedFile(file);
    setActiveTool(toolId);
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider theme={activeTheme}>
        <AppPopupProvider>
          <StatusBar style={statusBarStyle} />
          <View style={[styles.root, { backgroundColor: activeTheme.colors.background }]}>
            <ToolShell
              activeTool={activeTool}
              onSelectTool={(tool) => {
                setActiveTool(tool);
                if (!tool) setOpenedFile(null);
              }}
              onOpenFile={handleOpenFile}
            >
              {activeTool === 'viewer' && (
                <ViewPdfTool
                  initialFileUri={openedFile?.uri}
                  initialFileName={openedFile?.name}
                  onOpenEditor={(file) => handleOpenFile(file, 'edit')}
                  onOpenTranslate={(file) => handleOpenFile(file, 'translate')}
                />
              )}
              {activeTool === 'edit' && (
                <EditPdfTool initialFileUri={openedFile?.uri} initialFileName={openedFile?.name} />
              )}
              {activeTool === 'translate' && (
                <TranslatePdfTool
                  initialFileUri={openedFile?.uri}
                  initialFileName={openedFile?.name}
                />
              )}
              {activeTool === 'merge' && (
                <MergePdfTool initialFileUri={openedFile?.uri} initialFileName={openedFile?.name} />
              )}
              {activeTool === 'split' && (
                <SplitPdfTool initialFileUri={openedFile?.uri} initialFileName={openedFile?.name} />
              )}
              {activeTool === 'compress' && (
                <CompressPdfTool
                  initialFileUri={openedFile?.uri}
                  initialFileName={openedFile?.name}
                />
              )}
            </ToolShell>
          </View>
        </AppPopupProvider>
      </ThemeProvider>
    </SafeAreaProvider>
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
