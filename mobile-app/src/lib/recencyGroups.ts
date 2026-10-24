const DAY_MS = 86_400_000;

export type RecencyKey = 'today' | 'week' | 'earlier';

/**
 * Groups items by age relative to `now` (epoch ms, local midnight boundaries).
 * `getTime` returns epoch ms; items whose time is NaN land in `earlier`.
 * Empty groups are omitted and item order is kept inside each group.
 */
export function groupByRecency<T>(
  items: T[],
  getTime: (t: T) => number,
  now: number,
): { key: RecencyKey; items: T[] }[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const weekMs = todayMs - 6 * DAY_MS;
  const buckets = { today: [] as T[], week: [] as T[], earlier: [] as T[] };
  for (const item of items) {
    const t = getTime(item);
    if (t >= todayMs) buckets.today.push(item);
    else if (t >= weekMs) buckets.week.push(item);
    else buckets.earlier.push(item);
  }
  return (['today', 'week', 'earlier'] as const)
    .map((key) => ({ key, items: buckets[key] }))
    .filter((g) => g.items.length > 0);
}
