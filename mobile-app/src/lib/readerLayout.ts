/** Page width / height used when no page of the file has rendered yet (A4 portrait). */
export const A4_ASPECT = 1 / 1.414;

/**
 * Heights and scroll offsets for the Reader's page list.
 *
 * @param pageCount Number of pages.
 * @param sizes Rendered size per zero-based page, in px (only the width / height ratio is used).
 *   Pages without a size borrow the first known page's ratio, else `A4_ASPECT`.
 * @param widthDp Page width on screen, in dp.
 * @param topPadDp Space above the first page, in dp.
 * @param gapDp Space after each page, in dp.
 * @returns `heights[i]` and `offsets[i]` (top of page i from the top of the list content), in dp.
 */
export function readerPageLayout(
  pageCount: number,
  sizes: Record<number, { width?: number; height?: number }>,
  widthDp: number,
  topPadDp: number,
  gapDp: number,
): { heights: number[]; offsets: number[] } {
  const known = Object.values(sizes).find((s) => s.width && s.height);
  const fallback = known?.width && known.height ? known.width / known.height : A4_ASPECT;
  const heights: number[] = [];
  const offsets: number[] = [];
  let y = topPadDp;
  for (let i = 0; i < pageCount; i++) {
    const size = sizes[i];
    const aspect = size?.width && size.height ? size.width / size.height : fallback;
    const height = widthDp / aspect;
    heights.push(height);
    offsets.push(y);
    y += height + gapDp;
  }
  return { heights, offsets };
}

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
