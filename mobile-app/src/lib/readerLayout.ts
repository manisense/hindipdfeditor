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

/**
 * Zero-based page at a point of the list content.
 *
 * @param offsets Top of each page from the top of the list content, in dp (from `readerPageLayout`).
 * @param probeDp Point to look up, in dp from the top of the list content.
 * @returns The last page whose top is at or above `probeDp` (0 above the first page).
 */
export function pageAtOffset(offsets: readonly number[], probeDp: number): number {
  let low = 0;
  let high = offsets.length - 1;
  let found = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (offsets[mid] <= probeDp) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/**
 * The page the Reader is on, from its scroll position. The probe sits 40% down the part of the
 * screen below the bar; at the very end of the list it is the last page.
 *
 * @param offsets Page tops from `readerPageLayout`, in dp.
 * @param scrollYDp Scroll offset, in dp.
 * @param viewportDp Visible list height, in dp.
 * @param contentDp Total list content height, in dp.
 * @param topPadDp Height covered by the bar at the top, in dp.
 */
export function currentPageAt(
  offsets: readonly number[],
  scrollYDp: number,
  viewportDp: number,
  contentDp: number,
  topPadDp: number,
): number {
  if (offsets.length === 0) return 0;
  if (scrollYDp + viewportDp >= contentDp - 1) return offsets.length - 1;
  return pageAtOffset(offsets, scrollYDp + topPadDp + (viewportDp - topPadDp) * 0.4);
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
