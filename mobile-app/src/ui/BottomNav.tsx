import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { Icon, type IconName } from './Icon';
import { UiText } from './UiText';

export type MainTab = 'home' | 'files' | 'tools' | 'settings';

const TABS: { id: MainTab; icon: IconName; en: string; hi: string }[] = [
  { id: 'home', icon: 'home', en: 'Home', hi: 'होम' },
  { id: 'files', icon: 'folder', en: 'Files', hi: 'फ़ाइलें' },
  { id: 'tools', icon: 'apps', en: 'Tools', hi: 'टूल' },
  { id: 'settings', icon: 'settings', en: 'Settings', hi: 'सेटिंग्स' },
];

/**
 * Flat bottom navigation: 80dp plus the bottom inset. The active tab shows its icon in a
 * 64x32dp tinted pill; glyph and label weight are the same in both states, only colour changes.
 */
export function BottomNav({
  activeTab,
  onSelectTab,
}: {
  activeTab: MainTab;
  onSelectTab: (t: MainTab) => void;
}) {
  const ui = useUi();
  const theme = useAppTheme();
  const tx = useTx();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        height: 80 + insets.bottom,
        paddingBottom: insets.bottom,
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: ui.divider,
      }}
    >
      {TABS.map((tab) => {
        const selected = tab.id === activeTab;
        const label = tx(tab.en, tab.hi);
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onSelectTab(tab.id)}
            android_ripple={{ color: 'rgba(9,9,11,0.08)', borderless: true }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <View
              style={{
                width: 64,
                height: 32,
                borderRadius: 9999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? ui.brandTint : 'transparent',
              }}
            >
              <Icon name={tab.icon} size={24} color={selected ? ui.brand : ui.inkSecondary} />
            </View>
            <UiText
              color={selected ? ui.ink : ui.inkSecondary}
              style={{ fontSize: 12, fontWeight: '500' }}
              numberOfLines={1}
            >
              {label}
            </UiText>
          </Pressable>
        );
      })}
    </View>
  );
}
