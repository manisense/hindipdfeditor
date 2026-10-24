import { MaterialIcons } from '@expo/vector-icons';

export type IconName = keyof typeof MaterialIcons.glyphMap;

/** Material icon. `size` in dp; `label` makes it announce to TalkBack, otherwise it is hidden. */
export function Icon({
  name,
  size = 24,
  color,
  label,
}: {
  name: IconName;
  size?: number;
  color: string;
  label?: string;
}) {
  return (
    <MaterialIcons
      name={name}
      size={size}
      color={color}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}
