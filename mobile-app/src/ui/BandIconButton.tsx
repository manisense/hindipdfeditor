import { Pressable } from 'react-native';

import { Icon, type IconName } from './Icon';

/** 48x48dp white icon button for the brand band. */
export function BandIconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 24 }}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={24} color="#FFFFFF" />
    </Pressable>
  );
}
