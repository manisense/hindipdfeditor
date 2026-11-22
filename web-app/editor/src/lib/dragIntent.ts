/** Shortest side of a long drag, in screen px: a thinner box is a stray swipe, not a box. */
const MIN_THIN_SIDE_PX = 3;
/** Longest side below which a drag is a click, in screen px. */
const MIN_LONG_SIDE_PX = 12;

/**
 * Whether a pointer drag drew a box rather than being a click. A box over one line of small text
 * on a phone is long and thin, so only one side has to be long.
 *
 * @param widthPx Drag width, in screen px.
 * @param heightPx Drag height, in screen px.
 */
export function isBoxDrag(widthPx: number, heightPx: number): boolean {
  return Math.max(widthPx, heightPx) >= MIN_LONG_SIDE_PX && Math.min(widthPx, heightPx) >= MIN_THIN_SIDE_PX;
}
