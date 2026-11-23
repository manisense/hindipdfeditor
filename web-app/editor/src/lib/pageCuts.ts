/** How far above a page's bottom a cut may move to find a blank row, as a share of the page. */
const SEARCH_SHARE = 0.15;

/**
 * Where to cut a tall rendered section into pages: at most `pageHeightPx` each, cut in the last
 * blank row within the bottom 15 % of each page so a line of text is never split; at the page
 * height when there is none.
 *
 * @param blankRows Whether each pixel row of the section is blank.
 * @param pageHeightPx Page height, in the same pixels.
 * @returns [start, end) pixel rows of each page.
 */
export function pageCuts(blankRows: readonly boolean[], pageHeightPx: number): [number, number][] {
  const cuts: [number, number][] = [];
  let start = 0;
  const total = blankRows.length;
  while (total - start > pageHeightPx) {
    let end = start + pageHeightPx;
    const floor = Math.max(start + 1, end - Math.round(pageHeightPx * SEARCH_SHARE));
    for (let y = end - 1; y >= floor; y--) {
      if (blankRows[y]) {
        end = y + 1;
        break;
      }
    }
    cuts.push([start, end]);
    start = end;
  }
  cuts.push([start, total]);
  return cuts;
}
