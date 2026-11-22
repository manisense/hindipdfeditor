/**
 * Order in which pages are read for text: the page on screen first, then the pages after it, then
 * the ones before it. Reading one page at a time in this order means a page the user opens is
 * read next, instead of waiting behind every page they skipped past.
 *
 * @param pageCount Number of pages in the document.
 * @param priorityPage Zero-based index of the page on screen.
 * @param isPending Whether a page still needs reading (not done, not running, not blocked).
 * @returns Zero-based index of the next page to read, or null when none is pending.
 */
export function nextOcrPage(
  pageCount: number,
  priorityPage: number,
  isPending: (pageIndex: number) => boolean,
): number | null {
  for (let offset = 0; offset < pageCount; offset++) {
    const pageIndex = (priorityPage + offset) % pageCount;
    if (isPending(pageIndex)) return pageIndex;
  }
  return null;
}
