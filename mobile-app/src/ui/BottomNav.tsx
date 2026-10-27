import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { UiText } from './UiText';

export type MainTab = 'home' | 'files' | 'tools' | 'settings';

type NavGlyph = keyof typeof MaterialCommunityIcons.glyphMap;

const TABS: { id: MainTab; icon: NavGlyph; activeIcon: NavGlyph; en: string; hi: string }[] = [
  { id: 'home', icon: 'home-outline', activeIcon: 'home', en: 'Home', hi: 'होम' },
  { id: 'files', icon: 'folder-outline', activeIcon: 'folder', en: 'Files', hi: 'फ़ाइलें' },
  { id: 'tools', icon: 'view-grid-outline', activeIcon: 'view-grid', en: 'Tools', hi: 'टूल' },
  { id: 'settings', icon: 'cog-outline', activeIcon: 'cog', en: 'Settings', hi: 'सेटिंग्स' },
];

const PILL_SPRING = { damping: 18, stiffness: 260, reduceMotion: ReduceMotion.System };

/**
 * Bottom navigation: 64dp plus the bottom inset. Idle tabs show an outline glyph; the active
 * tab fills its glyph and grows a 56x32dp tinted pill behind it, and its label turns brand blue.
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
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        height: 64 + insets.bottom,
        paddingBottom: insets.bottom,
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: ui.divider,
      }}
    >
      {TABS.map((tab) => (
        <NavTab
          key={tab.id}
          tab={tab}
          selected={tab.id === activeTab}
          onPress={() => onSelectTab(tab.id)}
        />
      ))}
    </View>
  );
}

function NavTab({
  tab,
  selected,
  onPress,
}: {
  tab: (typeof TABS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const ui = useUi();
  const tx = useTx();
  const label = tx(tab.en, tab.hi);
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, PILL_SPRING);
  }, [selected, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: 0.5 + 0.5 * progress.value }],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      android_ripple={{ color: 'rgba(9,9,11,0.08)', borderless: true, radius: 40 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}
    >
      <View style={{ width: 56, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: 16, backgroundColor: ui.brandTint },
            pillStyle,
          ]}
        />
        <MaterialCommunityIcons
          name={selected ? tab.activeIcon : tab.icon}
          size={24}
          color={selected ? ui.brandOnSurface : ui.inkSecondary}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        />
      </View>
      <UiText
        color={selected ? ui.brandOnSurface : ui.inkSecondary}
        style={{ fontSize: 12, fontWeight: '600' }}
        numberOfLines={1}
      >
        {label}
      </UiText>
    </Pressable>
  );
}
