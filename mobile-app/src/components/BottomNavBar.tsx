import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing } from '../theme';

export type MainTab = 'home' | 'files' | 'tools' | 'profile';

type Props = {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
};

const TABS: { id: MainTab; labelEn: string; labelHi: string; icon: string }[] = [
  { id: 'home', labelEn: 'Home', labelHi: 'होम', icon: '🏠' },
  { id: 'files', labelEn: 'Files', labelHi: 'फाइलें', icon: '📁' },
  { id: 'tools', labelEn: 'Tools', labelHi: 'उपकरण', icon: '🛠️' },
  { id: 'profile', labelEn: 'Profile', labelHi: 'प्रोफ़ाइल', icon: '👤' },
];

export function BottomNavBar({ activeTab, onSelectTab }: Props) {
  return (
    <View style={styles.container}>
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
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{tab.icon}</Text>
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
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 4,
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
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    minWidth: 70,
    gap: 1,
  },
  tabItemActive: {
    backgroundColor: colors.brandWash,
  },
  tabItemPressed: {
    transform: [{ scale: 0.94 }],
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.65,
  },
  tabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
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
    fontWeight: '500',
    color: colors.textTertiary,
  },
  tabLabelHiActive: {
    color: colors.brand,
    fontWeight: '700',
  },
});
