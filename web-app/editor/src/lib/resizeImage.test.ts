import { describe, expect, it } from 'vitest';

import { cleanSignaturePixels, cmToPx, placeImage, searchJpegQuality, withJpegDpi } from './resizeImage';

describe('cmToPx', () => {
  it('converts a 3.5 × 4.5 cm photo at 200 dpi', () => {
    expect([cmToPx(3.5, 200), cmToPx(4.5, 200)]).toEqual([276, 354]);
  });
});

describe('placeImage', () => {
  it('fill crops a landscape photo to a portrait box, centred or at the chosen spot', () => {
    expect(placeImage(400, 300, 200, 300, 'fill', 0.5)).toMatchObject({ sx: 100, sy: 0, sw: 200, sh: 300, dw: 200, dh: 300 });
    expect(placeImage(400, 300, 200, 300, 'fill', 0).sx).toBe(0);
    expect(placeImage(400, 300, 200, 300, 'fill', 1).sx).toBe(200);
  });

  it('fit keeps the whole image and centres it with a border', () => {
    expect(placeImage(400, 200, 200, 200, 'fit', 0.5)).toMatchObject({ sx: 0, sw: 400, dx: 0, dy: 50, dw: 200, dh: 100 });
  });
});

describe('cleanSignaturePixels', () => {
  it('whitens paper and darkens ink', () => {
    const pixels = new Uint8ClampedArray([200, 205, 215, 255, 30, 40, 160, 255]);
    cleanSignaturePixels(pixels);
    expect(Array.from(pixels.slice(0, 4))).toEqual([255, 255, 255, 255]);
    expect(pixels[6]).toBe(96);
    expect(pixels[4]).toBe(18);
  });
});

describe('withJpegDpi', () => {
  it('writes the resolution into the JFIF header', () => {
    const header = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
    const out = withJpegDpi(header, 200);
    expect(Array.from(out.slice(13, 18))).toEqual([1, 0, 200, 0, 200]);
    expect(header[13]).toBe(0);
  });

  it('leaves a JPEG without JFIF alone', () => {
    const exif = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 8, 0x45, 0x78, 0x69, 0x66, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xd9]);
    expect(withJpegDpi(exif, 200)).toBe(exif);
  });
});

describe('searchJpegQuality', () => {
  /** A fake encoder: size grows with quality, 5–105 KB. */
  const encode = async (quality: number) => new Blob([new Uint8Array(Math.round(5000 + quality * 100000))]);

  it('finds the best quality under the maximum', async () => {
    const found = await searchJpegQuality(encode, 20000, 50000);
    expect(found.miss).toBeNull();
    expect(found.blob.size).toBeLessThanOrEqual(50000);
    expect(found.blob.size).toBeGreaterThan(49000);
  });

  it('uses full quality when that already fits', async () => {
    expect((await searchJpegQuality(encode, 0, 200000)).quality).toBe(1);
  });

  it('reports a range it cannot reach', async () => {
    expect((await searchJpegQuality(encode, 0, 4000)).miss).toBe('too-big');
    expect((await searchJpegQuality(encode, 150000, 200000)).miss).toBe('too-small');
  });
});
