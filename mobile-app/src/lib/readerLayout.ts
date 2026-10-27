/** Page width / height used when no page of the file has rendered yet (A4 portrait). */
export const A4_ASPECT = 1 / 1.414;

/**
 * Lets a value through at most once per `intervalMs` (ms), skips repeats of the last value, and
 * always lets a new value through when `force` is set. `now` returns the time in ms.
 */
export function createThrottle(intervalMs: number, now: () => number = Date.now) {
  let lastValue: number | null = null;
  let lastAt = -Infinity;
  return {
    reset() {
      lastValue = null;
      lastAt = -Infinity;
    },
    pass(value: number, force: boolean): boolean {
      const at = now();
      if (value === lastValue || (!force && at - lastAt < intervalMs)) return false;
      lastValue = value;
      lastAt = at;
      return true;
    },
  };
}

/**
 * Next page to render around `center` (zero-based): the center first, then the page after, then
 * the page before, out to `radius` pages away. Returns null when every page in reach is `done`.
 */
export function nextPageToRender(
  center: number,
  pageCount: number,
  radius: number,
  done: (page: number) => boolean,
): number | null {
  for (let distance = 0; distance <= radius; distance++) {
    for (const page of distance === 0 ? [center] : [center + distance, center - distance]) {
      if (page >= 0 && page < pageCount && !done(page)) return page;
    }
  }
  return null;
}

/** True when zero-based `page` is at most `radius` pages from `center`. */
export function isWithin(page: number, center: number, radius: number): boolean {
  return Math.abs(page - center) <= radius;
}

/** Copy of `byPage` keeping only pages at most `radius` pages from `center` (all zero-based). */
export function keepNear<T>(
  byPage: Readonly<Record<number, T>>,
  center: number,
  radius: number,
): Record<number, T> {
  const kept: Record<number, T> = {};
  for (const [key, value] of Object.entries(byPage)) {
    if (isWithin(Number(key), center, radius)) kept[Number(key)] = value;
  }
  return kept;
}
