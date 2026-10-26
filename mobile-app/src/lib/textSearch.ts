/** One occurrence of a query inside an OCR line, split so the UI can emphasise the match. */
export type TextMatch = {
  /** 0-based PDF page index. */
  pageIndex: number;
  /** 0-based index into that page's `lines`. */
  lineIndex: number;
  before: string;
  match: string;
  after: string;
};

const norm = (s: string) => s.normalize('NFC').toLocaleLowerCase('en');

/**
 * Finds every occurrence of `query` in OCR lines. Indices are 0-based page and line numbers.
 * Matching is NFC-normalised (so decomposed and precomposed nukta forms agree) and
 * case-insensitive for Latin text. No numeric parameters carry units.
 */
export function findMatches(
  pages: { pageIndex: number; lines: string[] }[],
  query: string,
): TextMatch[] {
  const q = norm(query.trim());
  if (!q) return [];
  const out: TextMatch[] = [];
  for (const page of pages) {
    page.lines.forEach((raw, lineIndex) => {
      const line = raw.normalize('NFC');
      const hay = norm(line);
      let from = 0;
      for (let at = hay.indexOf(q, from); at !== -1; at = hay.indexOf(q, from)) {
        out.push({
          pageIndex: page.pageIndex,
          lineIndex,
          before: line.slice(0, at),
          match: line.slice(at, at + q.length),
          after: line.slice(at + q.length),
        });
        from = at + q.length;
      }
    });
  }
  return out;
}

/**
 * Order to read pages in for search: `startPage` first, then the page after, the page before,
 * and so on outward. All values are 0-based page indices; `startPage` is clamped into the file.
 */
export function searchOrder(startPage: number, pageCount: number): number[] {
  if (pageCount <= 0) return [];
  const start = Math.min(Math.max(startPage, 0), pageCount - 1);
  const order = [start];
  for (let distance = 1; order.length < pageCount; distance++) {
    if (start + distance < pageCount) order.push(start + distance);
    if (start - distance >= 0) order.push(start - distance);
  }
  return order;
}
