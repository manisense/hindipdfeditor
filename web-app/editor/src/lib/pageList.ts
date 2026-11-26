const DEVANAGARI_DIGITS = '०१२३४५६७८९';

/**
 * Pages named in text like "1, 3-5" (Hindi digits too), as zero-based indexes in reading order
 * without repeats.
 *
 * @param pageCount Pages in the document.
 */
export function parsePageList(
  text: string,
  pageCount: number,
): { pages: number[] } | { error: 'empty' | 'format' | 'range' } {
  const normal = text.replace(/[०-९]/gu, (digit) => String(DEVANAGARI_DIGITS.indexOf(digit))).trim();
  if (!normal) return { error: 'empty' };
  const pages: number[] = [];
  const seen = new Set<number>();
  for (const part of normal.split(',')) {
    const match = /^\s*(\d+)\s*(?:[-–]\s*(\d+)\s*)?$/u.exec(part);
    if (!match) return { error: 'format' };
    const first = Number(match[1]);
    const last = match[2] === undefined ? first : Number(match[2]);
    if (first < 1 || last > pageCount || last < first) return { error: 'range' };
    for (let page = first; page <= last; page++) {
      if (!seen.has(page - 1)) pages.push(page - 1);
      seen.add(page - 1);
    }
  }
  return { pages };
}

