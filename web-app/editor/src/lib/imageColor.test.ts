import { sampleAverageColorFromDataUrl, samplePagePaperColorFromDataUrl } from './imageColor';

/** Builds a PNG data URL of solid white with a black ink rectangle in the center. */
function makePageDataUrl(
  width: number,
  height: number,
  opts?: { ink?: { x: number; y: number; w: number; h: number; color?: string }; paper?: string },
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.fillStyle = opts?.paper ?? '#ffffff';
  ctx.fillRect(0, 0, width, height);
  if (opts?.ink) {
    ctx.fillStyle = opts.ink.color ?? '#111111';
    ctx.fillRect(opts.ink.x, opts.ink.y, opts.ink.w, opts.ink.h);
  }
  return canvas.toDataURL('image/png');
}

describe('sampleAverageColorFromDataUrl', () => {
  it('returns white when sampling a white page around a black text box', async () => {
    const uri = makePageDataUrl(200, 100, {
      ink: { x: 40, y: 30, w: 120, h: 20 },
    });
    const color = await sampleAverageColorFromDataUrl(uri, 40, 30, 120, 20, 16);
    expect(color.toLowerCase()).toBe('#ffffff');
  });

  it('does not average ink into a grey mask color', async () => {
    // Old bug: averaging margin that included ink edges → grey slabs behind English.
    const uri = makePageDataUrl(200, 100, {
      ink: { x: 50, y: 40, w: 100, h: 16 },
    });
    const color = await sampleAverageColorFromDataUrl(uri, 50, 40, 100, 16, 8);
    expect(color.toLowerCase()).toBe('#ffffff');
  });
});

describe('samplePagePaperColorFromDataUrl', () => {
  it('samples white from page corners even when the body has dark ink', async () => {
    const uri = makePageDataUrl(400, 560, {
      ink: { x: 80, y: 100, w: 240, h: 300 },
    });
    const color = await samplePagePaperColorFromDataUrl(uri, 400, 560);
    expect(color.toLowerCase()).toBe('#ffffff');
  });
});
