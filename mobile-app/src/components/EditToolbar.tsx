import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from './AppButton';
import { colors, radius, spacing } from '../theme';
import type { DevanagariFontFamily } from '../lib/fontAsset';

/** Preset ink colors matching common Hindi textbook / form styling. */
export const TEXT_COLOR_PRESETS = [
  { label: 'Black', value: '#111111' },
  { label: 'Blue', value: '#1843DD' },
  { label: 'Red', value: '#C6303E' },
  { label: 'Green', value: '#1E7B34' },
] as const;

type Props = {
  fontSizePt: number;
  fontFamily: DevanagariFontFamily;
  color: string;
  fontWeight: 'normal' | 'bold';
  onFontSizeChange: (fontSizePt: number) => void;
  onFontFamilyChange: (fontFamily: DevanagariFontFamily) => void;
  onColorChange: (color: string) => void;
  onFontWeightChange: (fontWeight: 'normal' | 'bold') => void;
  onDelete: () => void;
  onDone: () => void;
};

/** Font size bounds, in PDF points - below 6pt text is unreadable, above 72pt it's a poster. */
const MIN_FONT_SIZE_PT = 6;
const MAX_FONT_SIZE_PT = 72;
const FONT_SIZE_STEP_PT = 1;

/**
 * Office-style formatting bar shown while a `TextEdit` is focused: font family, size, color,
 * bold, delete, and done. Purely presentational; all state stays in the caller.
 */
export function EditToolbar({
  fontSizePt,
  fontFamily,
  color,
  fontWeight,
  onFontSizeChange,
  onFontFamilyChange,
  onColorChange,
  onFontWeightChange,
  onDelete,
  onDone,
}: Props) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.chipGroup}>
          <Chip
            label="Sans"
            active={fontFamily === 'NotoSansDevanagari'}
            onPress={() => onFontFamilyChange('NotoSansDevanagari')}
          />
          <Chip
            label="Serif"
            active={fontFamily === 'NotoSerifDevanagari'}
            onPress={() => onFontFamilyChange('NotoSerifDevanagari')}
          />
        </View>

        <View style={styles.chipGroup}>
          <Chip
            label="B"
            active={fontWeight === 'bold'}
            bold
            onPress={() => onFontWeightChange(fontWeight === 'bold' ? 'normal' : 'bold')}
          />
        </View>

        <View style={styles.sizeGroup}>
          <AppButton
            title="A−"
            small
            variant="secondary"
            disabled={fontSizePt <= MIN_FONT_SIZE_PT}
            onPress={() =>
              onFontSizeChange(Math.max(MIN_FONT_SIZE_PT, fontSizePt - FONT_SIZE_STEP_PT))
            }
          />
          <Text style={styles.sizeLabel}>{Math.round(fontSizePt)}pt</Text>
          <AppButton
            title="A+"
            small
            variant="secondary"
            disabled={fontSizePt >= MAX_FONT_SIZE_PT}
            onPress={() =>
              onFontSizeChange(Math.min(MAX_FONT_SIZE_PT, fontSizePt + FONT_SIZE_STEP_PT))
            }
          />
        </View>

        <View style={styles.chipGroup}>
          {TEXT_COLOR_PRESETS.map((preset) => (
            <Pressable
              key={preset.value}
              accessibilityLabel={preset.label}
              onPress={() => onColorChange(preset.value)}
              style={[
                styles.colorSwatch,
                { backgroundColor: preset.value },
                color.toLowerCase() === preset.value && styles.colorSwatchActive,
              ]}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <AppButton title="Delete" small variant="danger" onPress={onDelete} />
        <AppButton title="Done" small variant="primary" onPress={onDone} />
      </View>
    </View>
  );
}

function Chip({
  label,
  active,
  bold,
  onPress,
}: {
  label: string;
  active: boolean;
  bold?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
    >
      <Text style={[styles.chipLabel, bold && styles.chipLabelBold, active && styles.chipLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  chipGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chip: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minWidth: 36,
    alignItems: 'center',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipLabelBold: {
    fontWeight: '800',
  },
  chipLabelActive: {
    color: colors.primaryDark,
  },
  sizeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sizeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    minWidth: 38,
    textAlign: 'center',
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
  },
  colorSwatchActive: {
    borderColor: colors.primary,
    borderWidth: 3,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
