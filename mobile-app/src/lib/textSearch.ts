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

/**
 * Stable identity of one match: page and line (0-based) plus which occurrence in that line
 * (0-based). Unlike a list index, it survives results arriving for earlier pages.
 */
export type MatchKey = { pageIndex: number; lineIndex: number; occurrence: number };

/** Key of `matches[index]`; null when `index` is out of range. */
export function matchKeyAt(matches: readonly TextMatch[], index: number): MatchKey | null {
  const m = matches[index];
  if (!m) return null;
  let occurrence = 0;
  for (let i = index - 1; i >= 0; i--) {
    const prev = matches[i];
    if (prev.pageIndex !== m.pageIndex || prev.lineIndex !== m.lineIndex) break;
    occurrence++;
  }
  return { pageIndex: m.pageIndex, lineIndex: m.lineIndex, occurrence };
}

/** Index in `matches` of the match `key` names, or -1 when `key` is null or not found. */
export function indexOfMatch(matches: readonly TextMatch[], key: MatchKey | null): number {
  if (!key) return -1;
  const first = matches.findIndex(
    (m) => m.pageIndex === key.pageIndex && m.lineIndex === key.lineIndex,
  );
  if (first === -1) return -1;
  const at = matches[first + key.occurrence];
  return at && at.pageIndex === key.pageIndex && at.lineIndex === key.lineIndex
    ? first + key.occurrence
    : -1;
}

/**
 * Key of the match `delta` steps (+1 next, -1 previous) from `key`, wrapping around. Without a
 * found key, next starts at the first match and previous at the last. Null when there are none.
 */
export function stepMatch(
  matches: readonly TextMatch[],
  key: MatchKey | null,
  delta: 1 | -1,
): MatchKey | null {
  const count = matches.length;
  if (count === 0) return null;
  const at = indexOfMatch(matches, key);
  const next = at === -1 ? (delta === 1 ? 0 : count - 1) : (at + delta + count) % count;
  return matchKeyAt(matches, next);
}
