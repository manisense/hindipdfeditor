import { eraseInkKeepingLines } from './inkEraser';

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load page image for the edit preview'));
    image.src = dataUrl;
  });
}

/**
 * Cleans the text out of one region of the page background so the editor previews what export
 * produces (borders kept, text removed) instead of a flat patch.
 *
 * @param backgroundUri Page background data URL.
 * @param xPx Left edge, in background-image px.
 * @param yPx Top edge, in background-image px.
 * @param wPx Width, in background-image px.
 * @param hPx Height, in background-image px.
 * @returns A PNG data URL of the cleaned region.
 */
export async function cleanedRegionPreview(
  backgroundUri: string,
  xPx: number,
  yPx: number,
  wPx: number,
  hPx: number,
): Promise<string> {
  const image = await loadImage(backgroundUri);
  const width = Math.max(1, Math.round(wPx));
  const height = Math.max(1, Math.round(hPx));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.drawImage(image, Math.round(xPx), Math.round(yPx), width, height, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  eraseInkKeepingLines(pixels.data, width, height);
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}
