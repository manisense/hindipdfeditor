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

function averageRgb(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { r: number; g: number; b: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const right = Math.min(width, Math.ceil(x1));
  const bottom = Math.ceil(y1);

  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
  }
  if (count === 0) return { r: 255, g: 255, b: 255 };
  return { r: r / count, g: g / count, b: b / count };
}

/**
 * Samples the average color in a band surrounding (but excluding) the given rectangle.
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

  const outer = {
    x0: xPx - marginPx,
    y0: yPx - marginPx,
    x1: xPx + wPx + marginPx,
    y1: yPx + hPx + marginPx,
  };
  const inner = { x0: xPx, y0: yPx, x1: xPx + wPx, y1: yPx + hPx };

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const { data, width } = imageData;

  const addRegion = (rx0: number, ry0: number, rx1: number, ry1: number) => {
    const avg = averageRgb(data, width, rx0, ry0, rx1, ry1);
    const area = Math.max(0, rx1 - rx0) * Math.max(0, ry1 - ry0);
    if (area <= 0) return;
    r += avg.r * area;
    g += avg.g * area;
    b += avg.b * area;
    count += area;
  };

  addRegion(outer.x0, outer.y0, outer.x1, inner.y0);
  addRegion(outer.x0, inner.y1, outer.x1, outer.y1);
  addRegion(outer.x0, inner.y0, inner.x0, inner.y1);
  addRegion(inner.x1, inner.y0, outer.x1, inner.y1);

  if (count === 0) return '#ffffff';
  return rgbToHex(r / count, g / count, b / count);
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
  const bottom = Math.ceil(yPx + hPx);

  let bestLuma = 255;
  let best = { r: 17, g: 17, b: 17 };

  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma < bestLuma) {
        bestLuma = luma;
        best = { r, g, b };
      }
    }
  }

  return rgbToHex(best.r, best.g, best.b);
}
