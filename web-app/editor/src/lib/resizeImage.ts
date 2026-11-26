/**
 * Resizes a photo or signature to an exact size in px and a file size in KB, as online
 * application forms ask, in the browser. The image is never sent anywhere.
 */

export type FitMode = "fill" | "fit";

export type ResizeOptions = {
  /** Output width, in px. */
  widthPx: number;
  /** Output height, in px. */
  heightPx: number;
  /** Fill crops the edges to keep the shape; fit adds a white border instead. */
  mode: FitMode;
  /** Where the crop sits along the cropped side, 0 (top or left) to 1 (bottom or right). */
  position: number;
  /** Turn a signature's paper white and its ink dark. */
  cleanSignature: boolean;
  /** Smallest file size wanted, in bytes (0 for none). */
  minBytes: number;
  /** Largest file size allowed, in bytes. */
  maxBytes: number;
  /** Resolution written into the JPEG, in dots per inch. */
  dpi: number;
};

export type ResizeResult = {
  blob: Blob;
  /** JPEG quality used, 0–1. */
  quality: number;
  /** Whether the size landed in the wanted range; when not, the closest file is given. */
  inRange: boolean;
  /** Which way the range was missed. */
  miss: "too-big" | "too-small" | null;
};

/** px for a length in cm at a resolution in dpi. */
export function cmToPx(cm: number, dpi: number): number {
  return Math.round((cm / 2.54) * dpi);
}

/**
 * The part of the source drawn and where it goes in the output, in px.
 *
 * @param srcW Source width, in px.
 * @param srcH Source height, in px.
 * @param dstW Output width, in px.
 * @param dstH Output height, in px.
 * @param mode Fill (crop to the output's shape) or fit (whole image, white border).
 * @param position Crop position along the cropped side, 0–1.
 */
export function placeImage(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  mode: FitMode,
  position: number,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const at = Math.min(1, Math.max(0, position));
  if (mode === "fill") {
    const scale = Math.max(dstW / srcW, dstH / srcH);
    const sw = dstW / scale;
    const sh = dstH / scale;
    return { sx: (srcW - sw) * at, sy: (srcH - sh) * at, sw, sh, dx: 0, dy: 0, dw: dstW, dh: dstH };
  }
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: (dstW - dw) / 2, dy: (dstH - dh) / 2, dw, dh };
}

/** Lighter than this (0–255 luma), a signature pixel is paper and turns white. */
const PAPER_LUMA = 170;

/**
 * Whitens a signature's paper (shadows, grey or blue tint from a phone photo) and darkens its
 * strokes, keeping the stroke colour's hue. Changes the pixels in place.
 *
 * @param pixels RGBA pixels.
 */
export function cleanSignaturePixels(pixels: Uint8ClampedArray): void {
  for (let k = 0; k < pixels.length; k += 4) {
    const luma = 0.299 * pixels[k] + 0.587 * pixels[k + 1] + 0.114 * pixels[k + 2];
    if (luma >= PAPER_LUMA) {
      pixels[k] = pixels[k + 1] = pixels[k + 2] = 255;
    } else {
      const darken = 0.6;
      pixels[k] *= darken;
      pixels[k + 1] *= darken;
      pixels[k + 2] *= darken;
    }
    pixels[k + 3] = 255;
  }
}

/**
 * Writes a resolution into a JPEG's JFIF header (browsers save 1:1 with no unit), so the image
 * prints at its intended size in cm. Returns the bytes unchanged when there is no JFIF header.
 *
 * @param bytes JPEG bytes; not changed.
 * @param dpi Dots per inch.
 */
export function withJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  const isJfif =
    bytes.length > 18 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[3] === 0xe0 &&
    String.fromCharCode(...bytes.subarray(6, 11)) === "JFIF\0";
  if (!isJfif) return bytes;
  const out = bytes.slice();
  const value = Math.max(1, Math.min(65535, Math.round(dpi)));
  out[13] = 1;
  out[14] = value >> 8;
  out[15] = value & 0xff;
  out[16] = value >> 8;
  out[17] = value & 0xff;
  return out;
}

/** Steps of the quality search; each halves the gap, so 8 steps resolve quality to 0.4 %. */
const QUALITY_STEPS = 8;
const MIN_QUALITY = 0.05;
const MAX_QUALITY = 1;

/**
 * Finds the JPEG quality whose file lands in [minBytes, maxBytes], preferring the best quality
 * that fits. When no quality fits, returns the nearest miss.
 *
 * @param encode Encodes at a quality (0–1) and returns the file.
 * @param minBytes Smallest wanted size, in bytes.
 * @param maxBytes Largest allowed size, in bytes.
 */
export async function searchJpegQuality(
  encode: (quality: number) => Promise<Blob>,
  minBytes: number,
  maxBytes: number,
): Promise<{ blob: Blob; quality: number; miss: "too-big" | "too-small" | null }> {
  const best = await encode(MAX_QUALITY);
  if (best.size <= maxBytes) {
    return { blob: best, quality: MAX_QUALITY, miss: best.size >= minBytes ? null : "too-small" };
  }
  const smallest = await encode(MIN_QUALITY);
  if (smallest.size > maxBytes) return { blob: smallest, quality: MIN_QUALITY, miss: "too-big" };
  let low = MIN_QUALITY;
  let high = MAX_QUALITY;
  let fit = { blob: smallest, quality: MIN_QUALITY };
  for (let step = 0; step < QUALITY_STEPS; step++) {
    const quality = (low + high) / 2;
    const blob = await encode(quality);
    if (blob.size <= maxBytes) {
      fit = { blob, quality };
      low = quality;
    } else {
      high = quality;
    }
  }
  return { ...fit, miss: fit.blob.size >= minBytes ? null : "too-small" };
}

/**
 * Resizes an image file (upright, as its EXIF says) to the options' size and file size.
 *
 * @param file JPG, PNG or WebP image.
 * @param options Size, fit, signature cleaning, file size range and resolution.
 */
export async function resizeImage(file: Blob, options: ResizeOptions): Promise<ResizeResult> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  canvas.width = options.widthPx;
  canvas.height = options.heightPx;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  try {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = "high";
    const p = placeImage(bitmap.width, bitmap.height, options.widthPx, options.heightPx, options.mode, options.position);
    context.drawImage(bitmap, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
  } finally {
    bitmap.close();
  }
  if (options.cleanSignature) {
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    cleanSignaturePixels(data.data);
    context.putImageData(data, 0, 0);
  }
  const encode = async (quality: number) => {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Image could not be encoded");
    return new Blob([new Uint8Array(withJpegDpi(new Uint8Array(await blob.arrayBuffer()), options.dpi))], { type: "image/jpeg" });
  };
  const found = await searchJpegQuality(encode, options.minBytes, options.maxBytes);
  return { blob: found.blob, quality: found.quality, inRange: found.miss === null, miss: found.miss };
}
