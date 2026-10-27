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

/** Row key → 0-based slot (unitless index) in a sortable list. */
export type Positions = Record<string, number>;

/**
 * Returns a new slot map with `key` moved to slot `to` and the rows between its old and new slot
 * shifted by one. Slots are 0-based indices (unitless). Runs on the UI thread during a drag.
 */
export function moveSlot(positions: Positions, key: string, to: number): Positions {
  'worklet';
  const from = positions[key];
  const next: Positions = {};
  for (const k of Object.keys(positions)) {
    const slot = positions[k];
    if (k === key) next[k] = to;
    else if (from < to && slot > from && slot <= to) next[k] = slot - 1;
    else if (to < from && slot >= to && slot < from) next[k] = slot + 1;
    else next[k] = slot;
  }
  return next;
}
