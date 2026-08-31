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
import { LinearGradient } from 'expo-linear-gradient';

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
 * Modern pill-shaped button matching the unified design system.
 * Features blue→indigo gradient for primary variant, full pill shape (9999px),
 * tactile spring press feedback, and crisp 600-weight typography.
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

  const content = (
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
  );

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
        variant !== 'primary' && (small ? styles.small : styles.normal),
        variant !== 'primary' && variantStyles[variant],
        variant === 'primary' && !disabled && styles.primaryShadow,
        selected && styles.selected,
        pressed && !isActionDisabled && styles.pressed,
        isActionDisabled && styles.disabled,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[colors.brand, colors.brandDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradientFill, small ? styles.small : styles.normal]}
        >
          {content}
        </LinearGradient>
      ) : (
        content
      )}
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
  gradientFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  normal: {
    minHeight: 48,
    paddingVertical: spacing.sm + 4,
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
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.45,
  },
  selected: {
    borderWidth: 2,
    borderColor: colors.brand,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
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
    borderWidth: 0,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.soft,
  },
  subtle: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(198, 48, 62, 0.2)',
  },
  success: {
    backgroundColor: colors.accentGreenTint,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  warning: {
    backgroundColor: colors.accentOrangeTint,
    borderWidth: 1,
    borderColor: 'rgba(240, 112, 15, 0.2)',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
};

const labelStyles = StyleSheet.create({
  primary: { color: colors.textOnPrimary },
  secondary: { color: colors.textPrimary },
  subtle: { color: colors.textPrimary },
  danger: { color: colors.danger },
  success: { color: colors.accentGreen },
  warning: { color: colors.accentOrange },
  ghost: { color: colors.brand },
});
