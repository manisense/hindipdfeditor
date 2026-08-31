import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, shadows, spacing } from '../theme';

export type StatusTone = 'info' | 'success' | 'warning' | 'error' | 'loading';

type Props = {
  title: string;
  subtitle?: string;
  tone?: StatusTone;
};

const TONE_THEMES: Record<
  StatusTone,
  {
    bg: string;
    border: string;
    text: string;
    iconName?: keyof typeof Ionicons.glyphMap;
  }
> = {
  loading: {
    bg: colors.brandTint,
    border: colors.brandTint,
    text: colors.brandDeep,
  },
  info: {
    bg: colors.brandTint,
    border: colors.brandTint,
    text: colors.brandDeep,
    iconName: 'information-circle-outline',
  },
  success: {
    bg: colors.accentGreenTint,
    border: 'rgba(22, 163, 74, 0.25)',
    text: colors.accentGreen,
    iconName: 'checkmark-circle-outline',
  },
  warning: {
    bg: colors.accentOrangeTint,
    border: 'rgba(240, 112, 15, 0.25)',
    text: colors.accentOrange,
    iconName: 'warning-outline',
  },
  error: {
    bg: colors.dangerSoft,
    border: 'rgba(198, 48, 62, 0.25)',
    text: colors.danger,
    iconName: 'close-circle-outline',
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
        ) : theme.iconName ? (
          <Ionicons name={theme.iconName} size={20} color={theme.text} />
        ) : null}
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
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.md,
    ...shadows.soft,
  },
  iconColumn: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
