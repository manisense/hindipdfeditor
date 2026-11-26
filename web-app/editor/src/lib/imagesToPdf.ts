import { PDFDocument } from "@cantoo/pdf-lib";

import { validatePdfBytes } from "./pdfValidation";

/** A4 in PDF points. */
const A4_PT = { width: 595.28, height: 841.89 };
/** Margin around an image on an A4 page, in pt (10 mm). */
const A4_MARGIN_PT = 28.35;
/** Image pixels per PDF point for "image size" pages (96 px per inch, as browsers show images). */
const IMAGE_PX_PER_PT = 96 / 72;
/** JPEG quality (0–1) for images that have to be re-encoded (WebP, turned photos). */
const REENCODE_QUALITY = 0.92;

export type ImagePageSize = "a4" | "image";

/**
 * The EXIF orientation (1–8) stored in a JPEG, or 1 when there is none. Phones save photos as
 * taken and record the turn here; pdf-lib ignores it, so a phone photo would come out sideways.
 *
 * @param bytes JPEG file bytes.
 */
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    if (marker === 0xffe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
      const tiff = offset + 10;
      if (tiff + 8 > view.byteLength) return 1;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      if (ifd + 2 > view.byteLength) return 1;
      const entries = view.getUint16(ifd, little);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 10 > view.byteLength) return 1;
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return 1;
    offset += 2 + length;
  }
  return 1;
}

/**
 * Where an image of `widthPx` × `heightPx` goes on its page, in pt.
 *
 * @param widthPx Image width, in px.
 * @param heightPx Image height, in px.
 * @param size A4 (portrait or landscape to suit the image, 10 mm margin, image scaled to fit and
 *   centred, never enlarged past 96 px per inch) or the image's own size at 96 px per inch.
 */
export function imagePlacement(
  widthPx: number,
  heightPx: number,
  size: ImagePageSize,
): { pageWidthPt: number; pageHeightPt: number; xPt: number; yPt: number; widthPt: number; heightPt: number } {
  const naturalW = widthPx / IMAGE_PX_PER_PT;
  const naturalH = heightPx / IMAGE_PX_PER_PT;
  if (size === "image") {
    return { pageWidthPt: naturalW, pageHeightPt: naturalH, xPt: 0, yPt: 0, widthPt: naturalW, heightPt: naturalH };
  }
  const landscape = widthPx > heightPx;
  const pageWidthPt = landscape ? A4_PT.height : A4_PT.width;
  const pageHeightPt = landscape ? A4_PT.width : A4_PT.height;
  const scale = Math.min(1, (pageWidthPt - 2 * A4_MARGIN_PT) / naturalW, (pageHeightPt - 2 * A4_MARGIN_PT) / naturalH);
  const widthPt = naturalW * scale;
  const heightPt = naturalH * scale;
  return { pageWidthPt, pageHeightPt, xPt: (pageWidthPt - widthPt) / 2, yPt: (pageHeightPt - heightPt) / 2, widthPt, heightPt };
}

type PreparedImage = { kind: "jpg" | "png"; bytes: Uint8Array; widthPx: number; heightPx: number };

/** The image as JPEG or PNG bytes pdf-lib can embed, upright. */
async function prepareImage(file: File): Promise<PreparedImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  // Decoded by the browser with its EXIF turn applied, so sizes are as shown.
  const bitmap = await createImageBitmap(new Blob([bytes]), { imageOrientation: "from-image" });
  try {
    if (isPng || (isJpeg && jpegOrientation(bytes) === 1)) {
      return { kind: isPng ? "png" : "jpg", bytes, widthPx: bitmap.width, heightPx: bitmap.height };
    }
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", REENCODE_QUALITY));
    if (!blob) throw new Error("Image could not be encoded");
    return { kind: "jpg", bytes: new Uint8Array(await blob.arrayBuffer()), widthPx: bitmap.width, heightPx: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/**
 * Makes a new PDF with one image per page, in the given order. JPEG and PNG files are embedded
 * as they are (no quality loss); WebP and turned phone photos are re-encoded as JPEG.
 *
 * @param files Images, in page order.
 * @param size Page size (see {@link imagePlacement}).
 * @param onProgress Called after each image with (done, total).
 */
export async function imagesToPdf(
  files: readonly File[],
  size: ImagePageSize,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  if (files.length === 0) throw new Error("No images");
  const pdf = await PDFDocument.create();
  for (const [index, file] of files.entries()) {
    const image = await prepareImage(file);
    const embedded = image.kind === "png" ? await pdf.embedPng(image.bytes) : await pdf.embedJpg(image.bytes);
    const place = imagePlacement(image.widthPx, image.heightPx, size);
    const page = pdf.addPage([place.pageWidthPt, place.pageHeightPt]);
    page.drawImage(embedded, { x: place.xPt, y: place.yPt, width: place.widthPt, height: place.heightPt });
    onProgress?.(index + 1, files.length);
  }
  const bytes = await pdf.save();
  await validatePdfBytes(bytes, files.length);
  return bytes;
}
