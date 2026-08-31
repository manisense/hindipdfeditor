import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadows, spacing } from '../theme';

export type MainTab = 'home' | 'files' | 'tools' | 'profile';

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
    id: 'profile',
    labelEn: 'Profile',
    labelHi: 'प्रोफ़ाइल',
    iconName: 'person-outline',
    iconActiveName: 'person',
  },
];

/**
 * 4-Tab Bottom Navigation Bar matching the unified design system.
 * Features pill-shaped active state, subtle hairline top border, and equal bilingual typography.
 */
export function BottomNavBar({ activeTab, onSelectTab }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <View style={styles.bar}>
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
                size={22}
                color={isActive ? colors.brand : colors.textSecondary}
              />
              <Text style={[styles.tabLabelEn, isActive && styles.tabLabelEnActive]}>
                {tab.labelEn}
              </Text>
              <Text style={[styles.tabLabelHi, isActive && styles.tabLabelHiActive]}>
                {tab.labelHi}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 6,
    ...shadows.card,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    minWidth: 72,
    gap: 1,
  },
  tabItemActive: {
    backgroundColor: colors.brandTint,
  },
  tabItemPressed: {
    transform: [{ scale: 0.94 }],
  },
  tabLabelEn: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabLabelEnActive: {
    color: colors.brand,
    fontWeight: '800',
  },
  tabLabelHi: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  tabLabelHiActive: {
    color: colors.brand,
    fontWeight: '700',
  },
});
