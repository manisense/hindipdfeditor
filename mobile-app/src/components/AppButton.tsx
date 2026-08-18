import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadows, spacing } from '../theme';

export type ButtonVariant =
  'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'subtle' | 'warning';

type Props = {
  title: string;
  onPress: () => void;
  /** Spoken label for icon-only or symbol-led buttons; defaults to `title`. */
  accessibilityLabel?: string;
  /** Visual weight variant */
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Announces a persistent toggle/mode selection to accessibility services. */
  selected?: boolean;
  /** Announces that the action is currently processing. */
  busy?: boolean;
  /** Shows spinning loading indicator */
  loading?: boolean;
  /** Compact height/padding for toolbar and header placement. */
  small?: boolean;
  /** Optional leading icon component */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

/**
 * Modern pill-shaped button matching the web app design system.
 * Features tactile spring-like press response, crisp typography, and full color variants.
 */
export function AppButton({
  title,
  onPress,
  accessibilityLabel,
  variant = 'primary',
  disabled,
  selected,
  busy,
  loading,
  small,
  icon,
  style,
  labelStyle,
}: Props) {
  const isActionDisabled = disabled === true || loading === true;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{
        disabled: isActionDisabled,
        selected: selected === true,
        busy: busy === true || loading === true,
      }}
      onPress={onPress}
      disabled={isActionDisabled}
      hitSlop={small ? 6 : undefined}
      android_ripple={{
        color: variant === 'primary' ? 'rgba(255,255,255,0.2)' : 'rgba(24,67,221,0.1)',
        borderless: false,
      }}
      style={({ pressed }) => [
        styles.base,
        small ? styles.small : styles.normal,
        variantStyles[variant],
        variant === 'primary' && !disabled && styles.primaryShadow,
        selected && styles.selected,
        pressed && !isActionDisabled && styles.pressed,
        isActionDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {loading ? (
          <ActivityIndicator
            size={small ? 14 : 18}
            color={variant === 'primary' ? colors.textOnPrimary : colors.brand}
            style={styles.spinner}
          />
        ) : (
          icon && <View style={styles.iconWrapper}>{icon}</View>
        )}
        <Text
          style={[styles.label, small && styles.labelSmall, labelStyles[variant], labelStyle]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  normal: {
    minHeight: 46,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
  },
  small: {
    minHeight: 34,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  primaryShadow: {
    ...shadows.brand,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm - 2,
  },
  iconWrapper: {
    marginRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 4,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.45,
  },
  selected: {
    borderWidth: 2,
    borderColor: colors.brand,
  },
  label: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  labelSmall: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.brand,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  secondary: {
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandTint,
  },
  subtle: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(198, 48, 62, 0.2)',
  },
  success: {
    backgroundColor: colors.accentTint,
    borderWidth: 1,
    borderColor: 'rgba(1, 135, 62, 0.2)',
  },
  warning: {
    backgroundColor: colors.amberTint,
    borderWidth: 1,
    borderColor: 'rgba(181, 132, 0, 0.2)',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
};

const labelStyles = StyleSheet.create({
  primary: { color: colors.textOnPrimary },
  secondary: { color: colors.brandDark },
  subtle: { color: colors.textPrimary },
  danger: { color: colors.danger },
  success: { color: colors.accent },
  warning: { color: colors.amberInk },
  ghost: { color: colors.brand },
});
