export type DevanagariFontFamily = 'NotoSansDevanagari' | 'NotoSerifDevanagari';

const FONT_URLS: Record<DevanagariFontFamily, string> = {
  NotoSansDevanagari: '/edit/fonts/NotoSansDevanagari-Variable.ttf',
  NotoSerifDevanagari: '/edit/fonts/NotoSerifDevanagari-Variable.ttf',
};

/** Registers `@font-face` rules in the document so live editing shapes Devanagari correctly. */
export function ensureFontsLoaded(): void {
  const styleId = 'hindi-pdf-editor-fonts';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @font-face {
      font-family: 'NotoSansDevanagari';
      src: url('${FONT_URLS.NotoSansDevanagari}') format('truetype');
      font-weight: 100 900;
    }
    @font-face {
      font-family: 'NotoSerifDevanagari';
      src: url('${FONT_URLS.NotoSerifDevanagari}') format('truetype');
      font-weight: 100 900;
    }
  `;
  document.head.appendChild(style);
}

const baselineRatioCache = new Map<string, number>();

/**
 * Where the baseline sits inside a `line-height: normal` text box of the given font, as a
 * fraction of the font size (unitless). Measured in the live browser, because line-height
 * metrics differ between platforms; the editor and the export frame both use the same rule.
 *
 * @param family Bundled font family.
 * @param fontWeight CSS weight keyword.
 * @param fontStyle CSS style, or undefined for normal.
 */
export async function baselineOffsetRatio(
  family: DevanagariFontFamily,
  fontWeight: 'normal' | 'bold',
  fontStyle?: 'italic',
): Promise<number | undefined> {
  const key = `${family}|${fontWeight}|${fontStyle ?? 'normal'}`;
  const cached = baselineRatioCache.get(key);
  if (cached !== undefined) return cached;
  if (typeof document === 'undefined') return undefined;
  ensureFontsLoaded();
  const sizePx = 100;
  const weight = fontWeight === 'bold' ? 700 : 400;
  await document.fonts.load(`${fontStyle ?? 'normal'} ${weight} ${sizePx}px '${family}'`, 'क');
  const box = document.createElement('div');
  box.style.cssText = `position:absolute;left:-10000px;top:0;font-family:'${family}';font-size:${sizePx}px;font-weight:${weight};font-style:${fontStyle ?? 'normal'};line-height:normal;white-space:pre`;
  const marker = document.createElement('span');
  marker.style.cssText = 'display:inline-block;width:1px;height:0;vertical-align:baseline';
  box.append('क', marker);
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
 * Width of `text` set in a bundled font, measured with Canvas 2D.
 *
 * @param fontSizePt Font size, in PDF points; the result is in PDF points too.
 */
export function measureTextWidthPt(
  text: string,
  family: DevanagariFontFamily,
  fontWeight: 'normal' | 'bold',
  fontSizePt: number,
): number {
  if (typeof document === 'undefined') return 0;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return 0;
  context.font = `${fontWeight === 'bold' ? 700 : 400} ${fontSizePt}px '${family}'`;
  return context.measureText(text).width;
}
