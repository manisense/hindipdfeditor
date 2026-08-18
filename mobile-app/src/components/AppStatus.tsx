import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing } from '../theme';

export type StatusTone = 'info' | 'success' | 'warning' | 'error' | 'loading';

type Props = {
  title: string;
  subtitle?: string;
  tone?: StatusTone;
};

const TONE_THEMES: Record<StatusTone, { bg: string; border: string; text: string; icon: string }> =
  {
    loading: {
      bg: colors.brandWash,
      border: colors.brandTint,
      text: colors.brandDark,
      icon: '⏳',
    },
    info: {
      bg: colors.brandWash,
      border: colors.brandTint,
      text: colors.brandDark,
      icon: 'ℹ️',
    },
    success: {
      bg: colors.accentTint,
      border: 'rgba(1, 135, 62, 0.25)',
      text: colors.accent,
      icon: '✅',
    },
    warning: {
      bg: colors.amberTint,
      border: 'rgba(181, 132, 0, 0.25)',
      text: colors.amberInk,
      icon: '⚠️',
    },
    error: {
      bg: colors.dangerSoft,
      border: 'rgba(198, 48, 62, 0.25)',
      text: colors.danger,
      icon: '❌',
    },
  };

/**
 * Clean status card for loading progress, processing feedback, or result alerts.
 */
export function AppStatus({ title, subtitle, tone = 'info' }: Props) {
  const theme = TONE_THEMES[tone];

  return (
    <View style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      <View style={styles.iconColumn}>
        {tone === 'loading' ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : (
          <Text style={styles.iconText}>{theme.icon}</Text>
        )}
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
    ...shadows.soft,
  },
  iconColumn: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
