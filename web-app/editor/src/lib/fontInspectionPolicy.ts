import {
  isLegacyDevanagariFontName,
  type LegacyFontWarning,
} from "./legacyFontDetector";

/** Unknown inspection must block before AI requests or replacement editing. */
export async function inspectFontsOrBlock(
  inspect: () => Promise<LegacyFontWarning[]>,
): Promise<LegacyFontWarning[]> {
  try {
    const warnings = await inspect();
    if (
      warnings.some((warning) => !isLegacyDevanagariFontName(warning.fontName))
    )
      throw new Error("Unknown font result");
    return warnings;
  } catch {
    throw new Error(
      "Font inspection failed. Translation is blocked for this unknown-encoding PDF. Obtain a readable source copy and try again.",
    );
  }
}
