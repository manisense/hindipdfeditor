import replacementFonts from '../../public/fonts/replacement/manifest.json';
import { cssWeight, type FontWeight } from './fontWeight';

/** Bundled Noto families: full Devanagari and Latin coverage. */
export type DevanagariFontFamily = 'NotoSansDevanagari' | 'NotoSerifDevanagari';

/**
 * Families bundled to match a document's original typeface (pinned in
 * `public/fonts/replacement/manifest.json`): Hind exactly, and metric-compatible substitutes for
 * Times (Tinos), Arial/Helvetica (Arimo), Calibri (Carlito) and Cambria (Caladea).
 */
export type MatchedFontFamily = 'Hind' | 'Tinos' | 'Arimo' | 'Carlito' | 'Caladea';

export type EditFontFamily = DevanagariFontFamily | MatchedFontFamily;

const NOTO_URLS: Record<DevanagariFontFamily, string> = {
  NotoSansDevanagari: '/edit/fonts/NotoSansDevanagari-Variable.ttf',
  NotoSerifDevanagari: '/edit/fonts/NotoSerifDevanagari-Variable.ttf',
};

const SERIF_FAMILIES = new Set<string>(['NotoSerifDevanagari', 'Tinos', 'Caladea']);

/** Whether a family is a serif face (drives the toolbar chip and the Devanagari fallback). */
export function isSerifFamily(family: string): boolean {
  return SERIF_FAMILIES.has(family);
}

/**
 * Weights a family can be drawn in without the browser faking them (CSS 100–900, ascending). The
 * Noto faces are variable fonts; matched families ship the weights listed in the manifest.
 */
export function availableWeights(family: string): number[] {
  if (family in NOTO_URLS) return [300, 400, 500, 600, 700];
  const weights = new Set<number>();
  for (const font of replacementFonts) {
    if (font.family !== family || font.style !== 'normal') continue;
    const [low, high = low] = font.weight.split(' ').map(Number);
    for (let weight = low; weight <= high; weight += 100) weights.add(weight);
  }
  return [...weights].sort((a, b) => a - b);
}

/**
 * CSS font stack for a family. Latin-only matched fonts fall back per character to the Noto face
 * of the same style, so Hindi inside a Times line still renders and shapes correctly.
 */
export function cssFontStack(family: string): string {
  const fallback = isSerifFamily(family) ? 'NotoSerifDevanagari' : 'NotoSansDevanagari';
  return family === fallback
    ? `'${family}', system-ui, sans-serif`
    : `'${family}', '${fallback}', system-ui, sans-serif`;
}

/** Registers `@font-face` rules in the document so live editing shapes Devanagari correctly. */
export function ensureFontsLoaded(): void {
  const styleId = 'hindi-pdf-editor-fonts';
  if (document.getElementById(styleId)) return;

  const noto = (Object.entries(NOTO_URLS) as [DevanagariFontFamily, string][]).map(
    ([family, url]) => `@font-face {
      font-family: '${family}';
      src: url('${url}') format('truetype');
      font-weight: 100 900;
    }`,
  );
  const matched = replacementFonts.map(
    (font) => `@font-face {
      font-family: '${font.family}';
      src: url('/edit/fonts/replacement/${font.file}') format('woff2');
      font-style: ${font.style};
      font-weight: ${font.weight};
      unicode-range: ${font.unicodeRange};
    }`,
  );
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = [...noto, ...matched].join('\n');
  document.head.appendChild(style);
}

const baselineRatioCache = new Map<string, number>();

/**
 * Where the baseline sits inside a `line-height: normal` text box of the given font, as a
 * fraction of the font size (unitless). Measured in the live browser, because line-height
 * metrics differ between platforms; the editor and the export use the same layout rule. The
 * sample decides whether the Devanagari fallback takes part in the line box.
 *
 * @param family Font family.
 * @param fontWeight Toolbar keyword or CSS weight (100–900).
 * @param fontStyle CSS style, or undefined for normal.
 * @param sample Text the box will hold; only its script matters.
 */
export async function baselineOffsetRatio(
  family: string,
  fontWeight: FontWeight,
  fontStyle?: 'italic',
  sample = 'क',
): Promise<number | undefined> {
  const probe = /[ऀ-ॿ]/u.test(sample) ? 'कA' : 'A';
  const key = `${family}|${cssWeight(fontWeight)}|${fontStyle ?? 'normal'}|${probe}`;
  const cached = baselineRatioCache.get(key);
  if (cached !== undefined) return cached;
  if (typeof document === 'undefined') return undefined;
  ensureFontsLoaded();
  const sizePx = 100;
  const weight = cssWeight(fontWeight);
  const stack = cssFontStack(family);
  await document.fonts.load(`${fontStyle ?? 'normal'} ${weight} ${sizePx}px ${stack}`, probe);
  const box = document.createElement('div');
  box.style.cssText = `position:absolute;left:-10000px;top:0;font-family:${stack};font-size:${sizePx}px;font-weight:${weight};font-style:${fontStyle ?? 'normal'};line-height:normal;white-space:pre`;
  const marker = document.createElement('span');
  marker.style.cssText = 'display:inline-block;width:1px;height:0;vertical-align:baseline';
  box.append(probe, marker);
  document.body.appendChild(box);
  try {
    const ratio = (marker.getBoundingClientRect().top - box.getBoundingClientRect().top) / sizePx;
    if (!Number.isFinite(ratio) || ratio <= 0) return undefined;
    baselineRatioCache.set(key, ratio);
    return ratio;
  } finally {
    box.remove();
  }
}

/**
 * Width of `text` set in a font, measured with Canvas 2D. The font must already be loaded.
 *
 * @param fontSizePt Font size, in PDF points; the result is in PDF points too.
 */
export function measureTextWidthPt(
  text: string,
  family: string,
  fontWeight: FontWeight,
  fontSizePt: number,
): number {
  if (typeof document === 'undefined') return 0;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return 0;
  context.font = `${cssWeight(fontWeight)} ${fontSizePt}px ${cssFontStack(family)}`;
  return context.measureText(text).width;
}

/**
 * Loads the faces needed to set `text` in a font, so later measuring and drawing use the real font.
 *
 * @param fontSizePx Any positive size, in px; only the faces matter.
 */
export async function loadFontFor(
  text: string,
  family: string,
  fontWeight: FontWeight,
  fontStyle?: 'italic',
  fontSizePx = 16,
): Promise<void> {
  if (typeof document === 'undefined') return;
  ensureFontsLoaded();
  const weight = cssWeight(fontWeight);
  await document.fonts.load(`${fontStyle ?? 'normal'} ${weight} ${fontSizePx}px ${cssFontStack(family)}`, text);
}
