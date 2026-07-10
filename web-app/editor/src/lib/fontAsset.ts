export type DevanagariFontFamily = 'NotoSansDevanagari' | 'NotoSerifDevanagari';

const FONT_URLS: Record<DevanagariFontFamily, string> = {
  NotoSansDevanagari: '/edit/fonts/NotoSansDevanagari-Variable.ttf',
  NotoSerifDevanagari: '/edit/fonts/NotoSerifDevanagari-Variable.ttf',
};

const base64Cache = new Map<DevanagariFontFamily, string>();

/**
 * Loads a bundled Devanagari variable font and returns it as a base64 string for inlining
 * into `@font-face` rules at export time.
 */
export async function getFontBase64(family: DevanagariFontFamily): Promise<string> {
  const cached = base64Cache.get(family);
  if (cached) return cached;

  const response = await fetch(FONT_URLS[family]);
  if (!response.ok) {
    throw new Error(`Failed to load font ${family}: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  base64Cache.set(family, base64);
  return base64;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

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
