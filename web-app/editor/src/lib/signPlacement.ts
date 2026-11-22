/** Where a signature goes on each page when it is placed automatically. */
export type SignPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export const SIGN_POSITIONS: readonly SignPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

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
  for (const part of normal.split(',')) {
    const match = /^\s*(\d+)\s*(?:[-–]\s*(\d+)\s*)?$/u.exec(part);
    if (!match) return { error: 'format' };
    const first = Number(match[1]);
    const last = match[2] === undefined ? first : Number(match[2]);
    if (first < 1 || last > pageCount || last < first) return { error: 'range' };
    for (let page = first; page <= last; page++) if (!pages.includes(page - 1)) pages.push(page - 1);
  }
  return { pages };
}

/**
 * The signature's box on a page for a preset position: `widthPt` wide (narrowed to fit inside
 * the margins), keeping the signature's shape, `marginPt` from the page edges.
 *
 * @param page Page size, in PDF points (editor space, rotation applied).
 * @param aspect Signature height divided by its width (unitless).
 * @param widthPt Wanted width, in PDF points.
 * @param marginPt Distance from the page edges, in PDF points.
 * @returns The box, in PDF points (top-left origin).
 */
export function presetRect(
  page: { widthPt: number; heightPt: number },
  aspect: number,
  position: SignPosition,
  widthPt: number,
  marginPt: number,
): { xPt: number; yPt: number; wPt: number; hPt: number } {
  const maxWidth = Math.min(page.widthPt - 2 * marginPt, (page.heightPt - 2 * marginPt) / aspect);
  const wPt = Math.max(1, Math.min(widthPt, maxWidth));
  const hPt = wPt * aspect;
  const [vertical, horizontal] = position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
  const xPt =
    horizontal === 'left' ? marginPt : horizontal === 'right' ? page.widthPt - marginPt - wPt : (page.widthPt - wPt) / 2;
  const yPt = vertical === 'top' ? marginPt : page.heightPt - marginPt - hPt;
  return { xPt, yPt, wPt, hPt };
}
