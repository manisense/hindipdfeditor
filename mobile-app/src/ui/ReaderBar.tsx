import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { Icon } from './Icon';
import { UiText } from './UiText';

/** Dark reading-mode top bar: 72dp plus the top inset, with a 48dp leading icon button. */
export function ReaderBar({
  title,
  leadingIcon,
  onLeading,
  actions,
}: {
  title: string;
  leadingIcon: 'arrow-back' | 'close';
  onLeading: () => void;
  actions?: ReactNode;
}) {
  const ui = useUi();
  const tx = useTx();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: ui.chrome,
        paddingTop: insets.top,
        height: 72 + insets.top,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        gap: 4,
      }}
    >
      <StatusBar style="light" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={leadingIcon === 'close' ? tx('Close', 'बंद करें') : tx('Back', 'वापस')}
        onPress={onLeading}
        android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 24 }}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={leadingIcon} size={24} color="#FFFFFF" />
      </Pressable>
      <UiText
        color="#FFFFFF"
        style={{ flex: 1, fontSize: 17, fontWeight: '500' }}
        accessibilityRole="header"
        numberOfLines={1}
      >
        {title}
      </UiText>
      {actions}
    </View>
  );
}
