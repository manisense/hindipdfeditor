import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useUi } from '../hooks/useAppTheme';
import { Icon, type IconName } from './Icon';
import { UiText } from './UiText';

/** List row: min height 64dp, 16dp padding, 20dp gap between leading, text and trailing. */
export function ListRow({
  icon,
  iconColor,
  leading,
  title,
  subtitle,
  trailing,
  onPress,
}: {
  icon?: IconName;
  iconColor?: string;
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const ui = useUi();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      disabled={!onPress}
      onPress={onPress}
      android_ripple={onPress ? { color: 'rgba(9,9,11,0.08)', borderless: false } : undefined}
      style={{ minHeight: 64, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 20 }}
    >
      {icon ? <Icon name={icon} size={24} color={iconColor ?? ui.inkSecondary} /> : leading}
      <View style={{ flex: 1 }}>
        <UiText variant="body">{title}</UiText>
        {subtitle ? (
          <UiText variant="meta" color={ui.inkSecondary}>
            {subtitle}
          </UiText>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}
