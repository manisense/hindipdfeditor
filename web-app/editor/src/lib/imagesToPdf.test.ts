import { describe, expect, it } from 'vitest';

import { imagePlacement, jpegOrientation } from './imagesToPdf';

/** A JPEG header with an EXIF orientation tag (big- or little-endian TIFF). */
function jpegWithOrientation(orientation: number, little: boolean): Uint8Array {
  const u16 = (n: number) => (little ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff]);
  const u32 = (n: number) => (little ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24] : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
  const tiff = [...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0, ...u32(0)];
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const length = exif.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 0xff, ...exif, 0xff, 0xd9]);
}

describe('jpegOrientation', () => {
  it('reads the EXIF orientation in either byte order', () => {
    expect(jpegOrientation(jpegWithOrientation(6, false))).toBe(6);
    expect(jpegOrientation(jpegWithOrientation(3, true))).toBe(3);
  });

  it('is 1 for a JPEG without EXIF, other files and broken data', () => {
    expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 4, 0, 0, 0xff, 0xd9]))).toBe(1);
    expect(jpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(1);
    expect(jpegOrientation(jpegWithOrientation(6, false).slice(0, 14))).toBe(1);
  });
});

describe('imagePlacement', () => {
  it('fits a large portrait photo on A4 inside the margin, centred', () => {
    const place = imagePlacement(3000, 4000, 'a4');
    expect(place.pageWidthPt).toBeCloseTo(595.28);
    expect(place.widthPt).toBeCloseTo(595.28 - 2 * 28.35);
    expect(place.heightPt).toBeCloseTo(place.widthPt * 4 / 3);
    expect(place.xPt).toBeCloseTo((595.28 - place.widthPt) / 2);
  });

  it('turns the A4 page for a landscape image and never enlarges a small one', () => {
    const place = imagePlacement(400, 300, 'a4');
    expect(place.pageWidthPt).toBeCloseTo(841.89);
    expect(place.widthPt).toBeCloseTo(300);
  });

  it('makes the page the image size at 96 px per inch', () => {
    expect(imagePlacement(960, 480, 'image')).toMatchObject({ pageWidthPt: 720, pageHeightPt: 360, xPt: 0, yPt: 0 });
  });
});
