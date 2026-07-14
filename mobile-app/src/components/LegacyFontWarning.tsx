import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from './AppButton';
import { colors, radius, spacing } from '../theme';

type Props = {
  /** Distinct legacy font names detected on the current page (spec Section 9). */
  fontNames: string[];
  inspectionFailed?: boolean;
  safeReplacementEnabled?: boolean;
  onEnableSafeReplacement?: () => void;
  onChooseUnicodeFont?: () => void;
};

/**
 * Banner shown instead of letting the user add or mask text on a page whose embedded font
 * matches a known pre-Unicode Devanagari pattern (KrutiDev, Shivaji, Chanakya, DevLys, etc.) -
 * spec Section 8/9. Inspection failures stay blocked. A known legacy match can enter the
 * explicit raster-only Unicode replacement path: the source remains immutable and the legacy
 * byte mapping is never interpreted as Unicode.
 */
export function LegacyFontWarning({
  fontNames,
  inspectionFailed,
  safeReplacementEnabled,
  onEnableSafeReplacement,
  onChooseUnicodeFont,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {inspectionFailed
          ? '⚠ Font encoding could not be verified — editing disabled on this page'
          : safeReplacementEnabled
            ? `✓ Unicode replacement mode enabled (${fontNames.join(', ')})`
            : `⚠ Legacy font detected (${fontNames.join(', ')})`}
      </Text>
      <Text style={styles.body}>
        {inspectionFailed
          ? "This page's font could not be inspected, so it can't be confirmed safe to edit. " +
            "Per this app's safety rule, an unverifiable page is treated the same as a known " +
            'legacy font rather than assumed safe.'
          : safeReplacementEnabled
            ? 'The source page stays immutable. Edits use mask + real Unicode overlays on the ' +
              'rasterized page, so the legacy byte mapping is never treated as Unicode text.'
            : 'This page uses pre-Unicode visual glyph mapping. Downloading that legacy font ' +
              'would not convert its Latin-mapped bytes. You can explicitly switch to safe ' +
              'Unicode replacement mode, which edits only the rasterized page with Unicode text.'}
      </Text>
      {!inspectionFailed && (
        <View style={styles.actions}>
          {!safeReplacementEnabled && onEnableSafeReplacement && (
            <AppButton
              title="Enable Unicode replacement"
              small
              variant="secondary"
              onPress={onEnableSafeReplacement}
            />
          )}
          {onChooseUnicodeFont && (
            <AppButton
              title="Choose Unicode font"
              small
              variant="ghost"
              onPress={onChooseUnicodeFont}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  title: {
    fontWeight: '700',
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  body: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
