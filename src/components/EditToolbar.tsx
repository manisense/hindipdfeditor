import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from './AppButton';
import { colors, radius, spacing } from '../theme';

type Props = {
  /** Current font size of the focused edit, in PDF points (display + step base). */
  fontSizePt: number;
  onFontSizeChange: (fontSizePt: number) => void;
  onDelete: () => void;
  onDone: () => void;
};

/** Font size bounds, in PDF points - below 6pt text is unreadable, above 72pt it's a poster. */
const MIN_FONT_SIZE_PT = 6;
const MAX_FONT_SIZE_PT = 72;
const FONT_SIZE_STEP_PT = 1;

/**
 * Contextual controls shown while a `TextEdit` is focused: adjust its font size, delete it
 * (the caller decides what deletion restores - e.g. an OCR replacement brings the original
 * text back), or dismiss the keyboard. Purely presentational; all state stays in the caller.
 */
export function EditToolbar({ fontSizePt, onFontSizeChange, onDelete, onDone }: Props) {
  return (
    <View style={styles.bar}>
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
      <View style={styles.actions}>
        <AppButton title="Delete" small variant="danger" onPress={onDelete} />
        <AppButton title="Done" small variant="primary" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sizeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sizeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    minWidth: 38,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
