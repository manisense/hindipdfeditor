import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from './AppButton';
import { colors, radius, shadows, spacing } from '../theme';

type Props = {
  title: string;
  subtitle: string;
  eyebrow?: string;
  buttonLabel?: string;
  iconSymbol?: string;
  badgeAccent?: string;
  badgeTint?: string;
  step?: 1 | 2 | 3;
  onSelect: () => void;
  loading?: boolean;
  disabled?: boolean;
  extraFooter?: ReactNode;
};

/**
 * High-polish file selection dropzone matching the user's design mockups.
 * Includes multi-step flow indicator (1 Select PDF -> 2 Edit -> 3 Download),
 * dashed container, cloud upload icon, and trust badges.
 */
export function DropZone({
  title,
  subtitle,
  eyebrow = 'READY WHEN YOU ARE',
  buttonLabel = 'Select PDF',
  badgeAccent = colors.brand,
  step = 1,
  onSelect,
  loading,
  disabled,
  extraFooter,
}: Props) {
  return (
    <View style={styles.outerContainer}>
      {/* Top Multi-step Indicator */}
      <View style={styles.stepHeader}>
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, step === 1 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, step === 1 && styles.stepNumberActive]}>1</Text>
          </View>
          <Text style={[styles.stepLabel, step === 1 && styles.stepLabelActive]}>Select PDF</Text>
        </View>

        <View style={styles.stepLine} />

        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, step === 2 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, step === 2 && styles.stepNumberActive]}>2</Text>
          </View>
          <Text style={[styles.stepLabel, step === 2 && styles.stepLabelActive]}>Edit</Text>
        </View>

        <View style={styles.stepLine} />

        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, step === 3 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, step === 3 && styles.stepNumberActive]}>3</Text>
          </View>
          <Text style={[styles.stepLabel, step === 3 && styles.stepLabelActive]}>Download</Text>
        </View>
      </View>

      {/* Main Dashed DropZone Card */}
      <View style={styles.dashedCard}>
        {/* Cloud Upload Icon */}
        <View style={styles.cloudIconWrapper}>
          <Ionicons name="cloud-upload-outline" size={48} color={badgeAccent} />
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <AppButton
          title={buttonLabel}
          icon={<Ionicons name="document-text-outline" size={18} color="#ffffff" />}
          variant="primary"
          onPress={onSelect}
          loading={loading}
          disabled={disabled}
          style={[styles.actionBtn, { backgroundColor: badgeAccent, borderColor: badgeAccent }]}
        />

        <Text style={styles.dropHint}>or drop PDF here</Text>

        {/* Reassurance trust chips */}
        <View style={styles.trustRow}>
          <View style={styles.trustChip}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
            <Text style={styles.trustText}>Private by default</Text>
          </View>
          <View style={styles.trustChip}>
            <Ionicons name="document-outline" size={14} color={colors.brand} />
            <Text style={styles.trustText}>PDF files only</Text>
          </View>
        </View>

        {extraFooter}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    gap: spacing.lg,
    paddingVertical: spacing.xs,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: 72,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    ...shadows.soft,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  stepNumberActive: {
    color: '#ffffff',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  stepLabelActive: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  stepLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.border,
    marginBottom: 18,
    marginHorizontal: 2,
  },
  dashedCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(24, 67, 221, 0.35)',
    paddingVertical: spacing.xl + 4,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  cloudIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 60,
  },
  cloudIcon: {
    fontSize: 46,
  },
  arrowBadge: {
    position: 'absolute',
    bottom: 2,
    backgroundColor: colors.brand,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  arrowText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    marginTop: -2,
  },
  textBlock: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.brand,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 290,
  },
  actionBtn: {
    minWidth: 220,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  dropHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: -4,
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  trustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  trustIcon: {
    fontSize: 12,
  },
  trustText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
