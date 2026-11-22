import { cssFontStack, ensureFontsLoaded } from './fontAsset';

/** Lightness above which a pixel is paper (fully transparent), and below which it is ink. */
const PAPER_LUMA = 215;
const INK_LUMA = 150;

/**
 * Makes the paper of a photographed or scanned signature transparent: light pixels become clear,
 * dark ones stay, and the edge between them fades so strokes stay smooth.
 *
 * @param rgba RGBA bytes, changed in place.
 */
export function clearLightBackground(rgba: Uint8ClampedArray): void {
  for (let i = 0; i < rgba.length; i += 4) {
    const luma = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    const alpha = luma >= PAPER_LUMA ? 0 : luma <= INK_LUMA ? 1 : (PAPER_LUMA - luma) / (PAPER_LUMA - INK_LUMA);
    rgba[i + 3] = Math.round(rgba[i + 3] * alpha);
  }
}

/** A signature image ready to place: PNG data URL and its size in image px. */
export type SignatureImage = { uri: string; pxWidth: number; pxHeight: number };

/**
 * The same image with its light background made transparent (see {@link clearLightBackground}).
 *
 * @param uri Image data URL.
 */
export async function withClearBackground(uri: string): Promise<SignatureImage> {
  const image = new Image();
  image.src = uri;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  clearLightBackground(pixels.data);
  context.putImageData(pixels, 0, 0);
  return { uri: canvas.toDataURL('image/png'), pxWidth: canvas.width, pxHeight: canvas.height };
}

/** Size typed signatures are drawn at, in px (scaled down when placed). */
const TYPED_FONT_PX = 96;

/**
 * Draws a typed name as a signature image, shaped by the browser (Devanagari conjuncts and
 * matras included), slanted, on a transparent background.
 *
 * @param family Bundled font family (see fontAsset.ts).
 * @param color CSS colour of the ink.
 */
export async function typedSignature(text: string, family: string, color: string): Promise<SignatureImage> {
  ensureFontsLoaded();
  const font = `italic 500 ${TYPED_FONT_PX}px ${cssFontStack(family)}`;
  await document.fonts.load(font, text);
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('Canvas 2D context unavailable');
  measure.font = font;
  const metrics = measure.measureText(text);
  const pad = TYPED_FONT_PX * 0.35;
  const ascent = metrics.actualBoundingBoxAscent || TYPED_FONT_PX;
  const descent = metrics.actualBoundingBoxDescent || TYPED_FONT_PX * 0.3;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(metrics.width + 2 * pad);
  canvas.height = Math.ceil(ascent + descent + 2 * pad);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.font = font;
  context.fillStyle = color;
  context.textBaseline = 'alphabetic';
  // A slight extra slant reads as handwriting; the italic face (or the browser's oblique) adds more.
  context.setTransform(1, 0, -0.12, 1, pad + 0.12 * (pad + ascent), 0);
  context.fillText(text, 0, pad + ascent);
  return { uri: canvas.toDataURL('image/png'), pxWidth: canvas.width, pxHeight: canvas.height };
}
