/**
 * Samples colors from a rasterized page image using Canvas 2D — web equivalent of the native
 * `sampleAverageColor` / `sampleTextColor` calls in the mobile `pdf-page-image` module.
 */

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load page image for color sampling'));
    img.src = dataUrl;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lumaOf(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Samples paper/background color from a band around a rectangle.
 * Uses the median RGB channels so glyph antialiasing and other sparse foreground pixels do not
 * tint the result. Unlike the old light-pixel filter, this preserves grey and colored backgrounds
 * instead of coercing every light surface to white.
 *
 * @param dataUrl Page background JPEG as a data URL.
 * @param xPx Left edge of inner rectangle, in px.
 * @param yPx Top edge of inner rectangle, in px.
 * @param wPx Width of inner rectangle, in px.
 * @param hPx Height of inner rectangle, in px.
 * @param marginPx Band width around the rectangle, in px.
 */
export async function sampleAverageColorFromDataUrl(
  dataUrl: string,
  xPx: number,
  yPx: number,
  wPx: number,
  hPx: number,
  marginPx: number,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  const outer = {
    x0: Math.max(0, Math.floor(xPx - marginPx)),
    y0: Math.max(0, Math.floor(yPx - marginPx)),
    x1: Math.min(width, Math.ceil(xPx + wPx + marginPx)),
    y1: Math.min(height, Math.ceil(yPx + hPx + marginPx)),
  };
  const inner = {
    x0: Math.max(0, Math.floor(xPx)),
    y0: Math.max(0, Math.floor(yPx)),
    x1: Math.min(width, Math.ceil(xPx + wPx)),
    y1: Math.min(height, Math.ceil(yPx + hPx)),
  };

  const red = new Uint32Array(256);
  const green = new Uint32Array(256);
  const blue = new Uint32Array(256);
  let sampleCount = 0;
  const sampleIfInBand = (x: number, y: number) => {
    const inInner = x >= inner.x0 && x < inner.x1 && y >= inner.y0 && y < inner.y1;
    if (inInner) return;
    const i = (y * width + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    red[r] += 1;
    green[g] += 1;
    blue[b] += 1;
    sampleCount += 1;
  };

  for (let y = outer.y0; y < outer.y1; y++) {
    for (let x = outer.x0; x < outer.x1; x++) {
      sampleIfInBand(x, y);
    }
  }

  if (sampleCount > 0) {
    const medianChannel = (histogram: Uint32Array): number => {
      const midpoint = Math.ceil(sampleCount / 2);
      let seen = 0;
      for (let value = 0; value < histogram.length; value += 1) {
        seen += histogram[value];
        if (seen >= midpoint) return value;
      }
      return 255;
    };
    return rgbToHex(medianChannel(red), medianChannel(green), medianChannel(blue));
  }

  return '#ffffff';
}

/**
 * Samples paper color from the four corners of a page image (away from body text).
 * Prefer this for full-page translate masks on typical white forms.
 *
 * @param dataUrl Page background JPEG as a data URL.
 * @param pxWidth Page image width, in px.
 * @param pxHeight Page image height, in px.
 */
export async function samplePagePaperColorFromDataUrl(
  dataUrl: string,
  pxWidth: number,
  pxHeight: number,
): Promise<string> {
  const patch = Math.max(24, Math.round(Math.min(pxWidth, pxHeight) * 0.04));
  const samples = await Promise.all([
    sampleAverageColorFromDataUrl(dataUrl, patch, patch, 1, 1, patch),
    sampleAverageColorFromDataUrl(dataUrl, pxWidth - patch - 1, patch, 1, 1, patch),
    sampleAverageColorFromDataUrl(dataUrl, patch, pxHeight - patch - 1, 1, 1, patch),
    sampleAverageColorFromDataUrl(dataUrl, pxWidth - patch - 1, pxHeight - patch - 1, 1, 1, patch),
  ]);
  // Any near-white corner wins — forms are almost always white paper.
  if (samples.some((c) => c.toLowerCase() === '#ffffff')) return '#ffffff';
  return samples[0] ?? '#ffffff';
}

/**
 * Estimates the dominant dark ink color inside a text region (for OCR replacement pre-fill).
 *
 * @param dataUrl Page background JPEG as a data URL.
 * @param xPx Left edge, in px.
 * @param yPx Top edge, in px.
 * @param wPx Width, in px.
 * @param hPx Height, in px.
 */
export async function sampleTextColorFromDataUrl(
  dataUrl: string,
  xPx: number,
  yPx: number,
  wPx: number,
  hPx: number,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0);
  const { data, width } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const left = Math.max(0, Math.floor(xPx));
  const top = Math.max(0, Math.floor(yPx));
  const right = Math.min(width, Math.ceil(xPx + wPx));
  const bottom = Math.min(canvas.height, Math.ceil(yPx + hPx));

  let bestLuma = 255;
  let best = { r: 17, g: 17, b: 17 };

  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = lumaOf(r, g, b);
      if (luma < bestLuma) {
        bestLuma = luma;
        best = { r, g, b };
      }
    }
  }

  return rgbToHex(best.r, best.g, best.b);
}
