import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from './AppButton';
import { colors, radius, shadows, spacing } from '../theme';
import type { DevanagariFontFamily } from '../lib/fontAsset';

/** Preset ink colors matching web editor palette. */
export const TEXT_COLOR_PRESETS = [
  { label: 'Black', value: '#15172c' },
  { label: 'White', value: '#ffffff' },
  { label: 'Blue', value: '#1843dd' },
  { label: 'Red', value: '#c6303e' },
  { label: 'Green', value: '#01873e' },
] as const;

type Props = {
  fontSizePt: number;
  fontFamily: DevanagariFontFamily;
  color: string;
  fontWeight: 'normal' | 'bold';
  onFontSizeChange: (fontSizePt: number) => void;
  onFontFamilyChange: (fontFamily: DevanagariFontFamily) => void;
  onOpenFontPicker: () => void;
  onColorChange: (color: string) => void;
  onFontWeightChange: (fontWeight: 'normal' | 'bold') => void;
  onDelete: () => void;
  onDone: () => void;
};

const MIN_FONT_SIZE_PT = 6;
const MAX_FONT_SIZE_PT = 72;
const FONT_SIZE_STEP_PT = 1;

/**
 * Modern floating formatting bar shown while a TextEdit is focused.
 * Matches web app EditToolbar with heading, typography chips, size stepper,
 * double-ring swatches, and pill actions.
 */
export function EditToolbar({
  fontSizePt,
  fontFamily,
  color,
  fontWeight,
  onFontSizeChange,
  onFontFamilyChange,
  onOpenFontPicker,
  onColorChange,
  onFontWeightChange,
  onDelete,
  onDone,
}: Props) {
  return (
    <View style={styles.wrapper}>
      {/* Header info */}
      <View style={styles.headingRow}>
        <Text style={styles.headingTitle}>Text style</Text>
        <Text style={styles.headingSubtitle}>Applies to selected text</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.controlsRow}
        keyboardShouldPersistTaps="handled"
      >
        {/* Typeface & Bold Chips */}
        <View style={styles.group}>
          <Chip
            label="Sans"
            active={fontFamily === 'NotoSansDevanagari'}
            onPress={() => onFontFamilyChange('NotoSansDevanagari')}
          />
          <Chip label="Fonts ▾" active={false} onPress={onOpenFontPicker} />
          <Chip
            label="B"
            accessibilityLabel="Bold"
            active={fontWeight === 'bold'}
            bold
            onPress={() => onFontWeightChange(fontWeight === 'bold' ? 'normal' : 'bold')}
          />
        </View>

        {/* Font Size Stepper */}
        <View style={styles.sizeGroup}>
          <AppButton
            title="A−"
            accessibilityLabel="Decrease font size"
            small
            variant="subtle"
            disabled={fontSizePt <= MIN_FONT_SIZE_PT}
            onPress={() =>
              onFontSizeChange(Math.max(MIN_FONT_SIZE_PT, fontSizePt - FONT_SIZE_STEP_PT))
            }
          />
          <Text style={styles.sizeLabel}>{Math.round(fontSizePt)}pt</Text>
          <AppButton
            title="A+"
            accessibilityLabel="Increase font size"
            small
            variant="subtle"
            disabled={fontSizePt >= MAX_FONT_SIZE_PT}
            onPress={() =>
              onFontSizeChange(Math.min(MAX_FONT_SIZE_PT, fontSizePt + FONT_SIZE_STEP_PT))
            }
          />
        </View>

        {/* Color Swatches */}
        <View style={styles.swatchGroup}>
          {TEXT_COLOR_PRESETS.map((preset) => {
            const isActive = color.toLowerCase() === preset.value.toLowerCase();
            return (
              <Pressable
                key={preset.value}
                accessibilityRole="button"
                accessibilityLabel={preset.label}
                accessibilityState={{ selected: isActive }}
                onPress={() => onColorChange(preset.value)}
                hitSlop={6}
                style={[styles.colorSwatchOuter, isActive && styles.colorSwatchOuterActive]}
              >
                <View style={[styles.colorSwatchInner, { backgroundColor: preset.value }]} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <AppButton
          title="Delete"
          small
          variant="danger"
          onPress={onDelete}
          style={styles.actionBtn}
        />
        <AppButton title="Done" small variant="primary" onPress={onDone} style={styles.actionBtn} />
      </View>
    </View>
  );
}

function Chip({
  label,
  accessibilityLabel,
  active,
  bold,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  active: boolean;
  bold?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
    >
      <Text
        style={[styles.chipLabel, bold && styles.chipLabelBold, active && styles.chipLabelActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.xs + 2,
    ...shadows.card,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  headingTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headingSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.full,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: {
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandTint,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipLabelBold: {
    fontWeight: '800',
  },
  chipLabelActive: {
    color: colors.brand,
    fontWeight: '700',
  },
  sizeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.full,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizeLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
    minWidth: 34,
    textAlign: 'center',
  },
  swatchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 2,
  },
  colorSwatchOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchOuterActive: {
    borderColor: colors.brand,
  },
  colorSwatchInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: 2,
  },
  actionBtn: {
    minWidth: 70,
  },
});
