const DEVANAGARI_DIGITS = '०१२३४५६७८९';

/**
 * The page number a typed value names, kept inside the document.
 *
 * @param text What was typed; Hindi digits count too.
 * @param count Pages in the document.
 * @returns Zero-based page index, or null when the text is not a number.
 */
export function pageFromInput(text: string, count: number): number | null {
  const digits = text.replace(/[०-९]/gu, (d) => String(DEVANAGARI_DIGITS.indexOf(d))).trim();
  if (!/^\d+$/u.test(digits)) return null;
  return Math.min(count, Math.max(1, Number(digits))) - 1;
}
