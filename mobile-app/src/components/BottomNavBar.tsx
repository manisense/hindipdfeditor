import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useThemedStyles } from '../hooks/useAppTheme';
import { useSettingsStore } from '../state/settingsStore';
import { type Theme, radius, spacing } from '../theme';

export type MainTab = 'home' | 'files' | 'tools' | 'settings';

type Props = {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
};

const TABS: {
  id: MainTab;
  labelEn: string;
  labelHi: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconActiveName: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: 'home',
    labelEn: 'Home',
    labelHi: 'होम',
    iconName: 'home-outline',
    iconActiveName: 'home',
  },
  {
    id: 'files',
    labelEn: 'Files',
    labelHi: 'फाइलें',
    iconName: 'folder-outline',
    iconActiveName: 'folder',
  },
  {
    id: 'tools',
    labelEn: 'Tools',
    labelHi: 'उपकरण',
    iconName: 'grid-outline',
    iconActiveName: 'grid',
  },
  {
    id: 'settings',
    labelEn: 'Settings',
    labelHi: 'सेटिंग्स',
    iconName: 'settings-outline',
    iconActiveName: 'settings',
  },
];

/**
 * 4-Tab iOS-Style Floating Dock Navigation Bar.
 * Strictly adheres to design-system.md:
 * - Brand Primary (#1843DD) & Brand Tint (#EEF2FF)
 * - Full-pill active segment highlight with vector icons
 * - Equal typographic weight for Latin & Devanagari labels
 * - Soft layered elevation shadow
 */
export function BottomNavBar({ activeTab, onSelectTab }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = useThemedStyles(getStyles);
  const language = useSettingsStore((s) => s.language);
  const bottomPadding = Math.max(insets.bottom, 10);

  const showEn = language === 'bilingual' || language === 'english';
  const showHi = language === 'bilingual' || language === 'hindi';

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <View style={styles.floatingDock}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.labelEn} - ${tab.labelHi}`}
              onPress={() => onSelectTab(tab.id)}
              style={({ pressed }) => [
                styles.tabItem,
                isActive && styles.tabItemActive,
                pressed && styles.tabItemPressed,
              ]}
            >
              <Ionicons
                name={isActive ? tab.iconActiveName : tab.iconName}
                size={21}
                color={isActive ? theme.colors.brand : theme.colors.textSecondary}
              />
              <View style={styles.labelWrapper}>
                {showEn && (
                  <Text style={[styles.tabLabelEn, isActive && styles.tabLabelEnActive]}>
                    {tab.labelEn}
                  </Text>
                )}
                {showHi && (
                  <Text style={[styles.tabLabelHi, isActive && styles.tabLabelHiActive]}>
                    {tab.labelHi}
                  </Text>
                )}
              </View>
              {isActive && <View style={styles.activeDot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: spacing.md,
      paddingTop: 4,
      backgroundColor: 'transparent',
      zIndex: 100,
    },
    floatingDock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderRadius: 30,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 5,
      paddingHorizontal: 6,
      shadowColor: '#14161F',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 10,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRadius: radius.full,
      gap: 1,
      minHeight: 52,
    },
    tabItemActive: {
      backgroundColor: theme.colors.brandTint,
    },
    tabItemPressed: {
      transform: [{ scale: 0.94 }],
      opacity: 0.85,
    },
    labelWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabLabelEn: {
      fontSize: 10.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      lineHeight: 13,
    },
    tabLabelEnActive: {
      color: theme.colors.brand,
      fontWeight: '800',
    },
    tabLabelHi: {
      fontSize: 9.5,
      fontWeight: '600',
      color: theme.colors.textTertiary,
      lineHeight: 12,
    },
    tabLabelHiActive: {
      color: theme.colors.brand,
      fontWeight: '700',
    },
    activeDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.brand,
      marginTop: 2,
    },
  });
