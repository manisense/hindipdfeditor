/**
 * Weight of edit text: the toolbar's `normal`/`bold`, or a CSS weight (100–900) measured from the
 * original text's strokes (see strokeWeight.ts).
 */
export type FontWeight = 'normal' | 'bold' | number;

/** CSS numeric weight (100–900) for a {@link FontWeight}; undefined means normal. */
export function cssWeight(weight?: FontWeight): number {
  if (weight === undefined || weight === 'normal') return 400;
  if (weight === 'bold') return 700;
  return Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
}

/** Whether a weight reads as bold (the toolbar's Bold chip). */
export function isBoldWeight(weight?: FontWeight): boolean {
  return cssWeight(weight) >= 600;
}
