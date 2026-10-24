/**
 * Returns a new array with the item at `from` moved to index `to` (clamped to the list).
 * Both are 0-based list indices (unitless), not pixels or points.
 */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const target = Math.max(0, Math.min(next.length - 1, to));
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}
