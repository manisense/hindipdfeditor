import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows, spacing } from '../theme';

type Props = {
  title: string;
  titleAccent?: string;
  subtitle: string;
};

/**
 * Standardized, fixed header across all main app tabs.
 * Guarantees identical top position, fixed alignment, icon size, height, and typography.
 * Completely free of buttons and immune to scroll events.
 */
export function ScreenHeader({ title, titleAccent, subtitle }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.leftRow}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          accessibilityLabel="Hindi PDF Editor logo"
        />
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
            {titleAccent ? <Text style={styles.titleAccent}> {titleAccent}</Text> : null}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: spacing.md,
    marginBottom: spacing.md + 2,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: radius.chip,
    ...shadows.soft,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  titleAccent: {
    color: colors.brand,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
  },
});
