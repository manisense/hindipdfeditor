import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

type Props = {
  /** Distinct legacy font names detected on the current page (spec Section 9). */
  fontNames: string[];
};

/**
 * Banner shown instead of letting the user add or mask text on a page whose embedded font
 * matches a known pre-Unicode Devanagari pattern (KrutiDev, Shivaji, Chanakya, DevLys, etc.) -
 * spec Section 8/9. `App.tsx` is responsible for actually blocking `handleTap`/`handleMaskDrawn`
 * on an affected page; this component only surfaces *why* those are disabled, per AGENTS.md's
 * "warn, don't silently allow" rule - it never renders a way to dismiss or bypass the block,
 * since there is no safe fallback if the detector's font-name match is correct.
 */
export function LegacyFontWarning({ fontNames }: Props) {
  const isUnknown = fontNames.length === 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isUnknown
          ? '⚠ Font encoding could not be verified — editing disabled on this page'
          : `⚠ Legacy font detected (${fontNames.join(', ')}) — editing disabled on this page`}
      </Text>
      <Text style={styles.body}>
        {isUnknown
          ? "This page's font could not be inspected, so it can't be confirmed safe to edit. " +
            "Per this app's safety rule, an unverifiable page is treated the same as a known " +
            'legacy font rather than assumed safe.'
          : "This page's text was set in a pre-Unicode Devanagari font. That font maps plain " +
            'Latin keystrokes to Devanagari shapes purely visually - the bytes actually stored ' +
            'in the page are not real Devanagari characters, even though they display as some. '}
        {!isUnknown &&
          'Masking or adding text here would build on top of that already-mismatched text ' +
            'layer, so editing is disabled on this page.'}
      </Text>
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
});
