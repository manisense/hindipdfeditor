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

import { useAppTheme } from '../hooks/useAppTheme';
import { type Theme, radius, shadows, spacing } from '../theme';

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
 * Features brand primary (#1843DD), full pill shape (9999px),
 * tactile spring press feedback, dynamic theme awareness, and crisp 600-weight typography.
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
  const theme = useAppTheme();
  const isActionDisabled = disabled === true || loading === true;

  const variantStyle = getVariantStyle(theme, variant);
  const labelColor = getLabelColor(theme, variant);

  const content = (
    <View style={styles.contentRow}>
      {loading ? (
        <ActivityIndicator
          size={small ? 14 : 18}
          color={variant === 'primary' ? theme.colors.textOnPrimary : theme.colors.brand}
          style={styles.spinner}
        />
      ) : (
        icon && <View style={styles.iconWrapper}>{icon}</View>
      )}
      <Text
        style={[styles.label, small && styles.labelSmall, { color: labelColor }, labelStyle]}
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
        small ? styles.small : styles.normal,
        variantStyle,
        variant === 'primary' && !disabled && styles.primaryShadow,
        selected && { borderWidth: 2, borderColor: theme.colors.brand },
        pressed && !isActionDisabled && styles.pressed,
        isActionDisabled && styles.disabled,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const getVariantStyle = (theme: Theme, variant: ButtonVariant): ViewStyle => {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: theme.colors.brand,
        borderWidth: 0,
      };
    case 'secondary':
      return {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...shadows.soft,
      };
    case 'subtle':
      return {
        backgroundColor: theme.colors.surfaceSubtle,
        borderWidth: 1,
        borderColor: theme.colors.border,
      };
    case 'danger':
      return {
        backgroundColor: theme.colors.dangerSoft,
        borderWidth: 1,
        borderColor: 'rgba(198, 48, 62, 0.25)',
      };
    case 'success':
      return {
        backgroundColor: theme.colors.accentGreenTint,
        borderWidth: 1,
        borderColor: 'rgba(22, 163, 74, 0.25)',
      };
    case 'warning':
      return {
        backgroundColor: theme.colors.accentOrangeTint,
        borderWidth: 1,
        borderColor: 'rgba(240, 112, 15, 0.25)',
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        borderWidth: 0,
      };
  }
};

const getLabelColor = (theme: Theme, variant: ButtonVariant): string => {
  switch (variant) {
    case 'primary':
      return theme.colors.textOnPrimary;
    case 'secondary':
    case 'subtle':
      return theme.colors.textPrimary;
    case 'danger':
      return theme.colors.danger;
    case 'success':
      return theme.colors.accentGreen;
    case 'warning':
      return theme.colors.accentOrange;
    case 'ghost':
      return theme.colors.brand;
  }
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
