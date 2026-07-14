export const UNKNOWN_ENCODING_FONT_NAME = 'unknown (font inspection failed)';

export type LegacyEditingPolicy = {
  inspectionFailed: boolean;
  knownLegacyFontNames: string[];
  editingBlocked: boolean;
};

/**
 * Converts detector warnings into the page editing policy. Unknown/inconclusive inspection is
 * always blocked. Known legacy fonts are blocked until the user explicitly enables raster-only
 * Unicode replacement for that page.
 */
export function legacyEditingPolicy(
  warningFontNames: string[],
  safeReplacementEnabled: boolean,
): LegacyEditingPolicy {
  const inspectionFailed = warningFontNames.includes(UNKNOWN_ENCODING_FONT_NAME);
  const knownLegacyFontNames = warningFontNames.filter(
    (fontName) => fontName !== UNKNOWN_ENCODING_FONT_NAME,
  );
  return {
    inspectionFailed,
    knownLegacyFontNames,
    editingBlocked:
      inspectionFailed || (knownLegacyFontNames.length > 0 && !safeReplacementEnabled),
  };
}
