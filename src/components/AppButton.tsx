import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = {
  title: string;
  onPress: () => void;
  /** Visual weight: `primary` filled, `secondary` tinted, `danger` destructive, `ghost` text-only. */
  variant?: Variant;
  disabled?: boolean;
  /** Compact height/padding for toolbar placement. */
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's one button. Replaces React Native's unstylable platform `Button` so every action
 * shares the same visual language from `theme.ts` (RN's `Button` ignores style props entirely,
 * which is why the pre-polish UI looked like a developer tool).
 */
export function AppButton({ title, onPress, variant = 'primary', disabled, small, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        variantStyles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[styles.label, small && styles.labelSmall, labelStyles[variant]]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  labelSmall: {
    fontSize: 13,
  },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primarySoft },
  danger: { backgroundColor: colors.dangerSoft },
  ghost: { backgroundColor: 'transparent' },
};

const labelStyles = StyleSheet.create({
  primary: { color: colors.textOnPrimary },
  secondary: { color: colors.primaryDark },
  danger: { color: colors.danger },
  ghost: { color: colors.primaryDark },
});
