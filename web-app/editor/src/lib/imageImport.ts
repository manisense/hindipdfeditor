/** Longest side an inserted image is stored at, in image px: sharp at print size, small in memory. */
const MAX_IMAGE_SIDE_PX = 1600;
/** Largest image file accepted, in bytes. */
export const MAX_IMAGE_FILE_BYTES = 20 * 1024 * 1024;

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** File types the image picker offers. */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

export type ImportedImage = {
  /** PNG (when the source can be transparent) or JPEG data URL. */
  uri: string;
  /** Stored width, in image px. */
  pxWidth: number;
  /** Stored height, in image px. */
  pxHeight: number;
};

export class ImageImportError extends Error {
  constructor(readonly reason: 'type' | 'size' | 'decode') {
    super(`image import failed: ${reason}`);
  }
}

/**
 * Reads an image file for placing on a page, downscaled so its longest side is at most 1600 px.
 * JPEG stays JPEG; PNG and WebP become PNG so transparency survives (signature scans, logos).
 *
 * @throws ImageImportError when the file is not PNG, JPEG or WebP, is over 20 MB, or cannot be
 *   decoded.
 */
export async function readImageFile(file: File): Promise<ImportedImage> {
  if (!ACCEPTED_TYPES.has(file.type)) throw new ImageImportError('type');
  if (file.size > MAX_IMAGE_FILE_BYTES) throw new ImageImportError('size');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageImportError('decode');
  }
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new ImageImportError('decode');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const uri =
      file.type === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.92) : canvas.toDataURL('image/png');
    return { uri, pxWidth: canvas.width, pxHeight: canvas.height };
  } finally {
    bitmap.close();
  }
}
