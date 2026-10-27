/** "1 page" / "n pages" in the current language. `count` is a number of pages. */
export function pagesLabel(tx: (en: string, hi: string) => string, count: number): string {
  return count === 1 ? tx('1 page', '1 पृष्ठ') : tx(`${count} pages`, `${count} पृष्ठ`);
}
