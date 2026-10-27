import { ActivityIndicator, Pressable, View } from 'react-native';

import { useUi } from '../hooks/useAppTheme';
import { Icon, type IconName } from './Icon';
import { UiText } from './UiText';

type Kind = 'primary' | 'tonal' | 'text';

/** Full-pill button. Primary is 52dp tall, tonal and text are 48dp. */
export function PillButton({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  kind?: Kind;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
}) {
  const ui = useUi();
  const bg = kind === 'primary' ? ui.brand : kind === 'tonal' ? ui.fill : 'transparent';
  const fg = kind === 'primary' ? '#FFFFFF' : kind === 'tonal' ? ui.ink : ui.brandOnSurface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      android_ripple={{
        color: kind === 'primary' ? 'rgba(255,255,255,0.2)' : 'rgba(9,9,11,0.08)',
        borderless: false,
      }}
      style={{
        height: kind === 'primary' ? 52 : 48,
        borderRadius: 9999,
        backgroundColor: bg,
        overflow: 'hidden',
        opacity: disabled ? 0.4 : 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : icon ? (
          <Icon name={icon} size={20} color={fg} />
        ) : null}
        <UiText variant="body" color={fg} style={{ fontWeight: '600' }}>
          {title}
        </UiText>
      </View>
    </Pressable>
  );
}
