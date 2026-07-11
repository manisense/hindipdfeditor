/**
 * happy-dom has no Canvas 2D; polyfill with node-canvas so imageColor tests can run.
 */
import { createCanvas, Image as CanvasImage, ImageData as CanvasImageData } from 'canvas';

const OrigCreateElement = document.createElement.bind(document);

document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
  if (tagName.toLowerCase() === 'canvas') {
    const c = createCanvas(300, 150) as unknown as HTMLCanvasElement;
    return c;
  }
  return OrigCreateElement(tagName, options);
}) as typeof document.createElement;

// Image used by imageColor.loadImage must decode data URLs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test polyfill
(globalThis as any).Image = CanvasImage;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test polyfill
(globalThis as any).ImageData = CanvasImageData;
