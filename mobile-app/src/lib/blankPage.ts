import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import type { PageState } from '../state/editStore';

// A valid opaque-white 1x1 PNG. The live view and print compositor stretch it to the page's
// declared point dimensions; keeping the actual file tiny avoids allocating a pointless blank
// 3x bitmap. Unlike the formerly problematic full-page PNG backgrounds, this is 68 bytes.
const WHITE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=';

/**
 * Creates a new white page background in app cache without changing the source PDF.
 *
 * @param widthPt New page width in PDF points.
 * @param heightPt New page height in PDF points.
 * @param rasterScalePxPerPt Logical background resolution in px per PDF point. The stored
 *   dimensions keep page/edit coordinate conversion consistent even though the white image
 *   itself is a stretchable 1x1 PNG.
 */
export async function createBlankPage(
  widthPt: number,
  heightPt: number,
  rasterScalePxPerPt: number,
): Promise<Omit<PageState, 'pageIndex'>> {
  if (!FileSystem.cacheDirectory) {
    throw new Error('createBlankPage: app cache directory is unavailable');
  }
  if (widthPt <= 0 || heightPt <= 0 || rasterScalePxPerPt <= 0) {
    throw new Error('createBlankPage: width, height, and raster scale must be positive');
  }

  const backgroundImageUri = `${FileSystem.cacheDirectory}blank-page-${Crypto.randomUUID()}.png`;
  await FileSystem.writeAsStringAsync(backgroundImageUri, WHITE_PNG_BASE64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return {
    widthPt,
    heightPt,
    backgroundImageUri,
    imagePxWidth: Math.round(widthPt * rasterScalePxPerPt),
    imagePxHeight: Math.round(heightPt * rasterScalePxPerPt),
    edits: [],
    ocrLines: [],
    isBlank: true,
  };
}
