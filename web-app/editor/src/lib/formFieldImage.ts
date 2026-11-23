import { autoFontSizePt, fitFontSizePt, fitWrappedFontSizePt, FIELD_PADDING_PT, placeInField } from './pdfForm';
import type { AppearanceRequest } from './pdfFormFill';
import { TEXT_FRAGMENT_PAD_RATIO, TEXT_RENDER_PX_PER_PT } from './htmlCompositor';
import { rasteriseTextEdits, type RasterisedText } from './textRaster';
import type { TextEdit } from '../state/editStore';

async function rasterise(request: AppearanceRequest, fontSizePt: number): Promise<RasterisedText | undefined> {
  const edit: TextEdit = {
    type: 'text',
    id: 'answer',
    page: 0,
    xPt: 0,
    yPt: 0,
    fontSizePt,
    text: request.text,
    color: request.color,
    fontFamily: 'NotoSansDevanagari',
    widthPt: request.multiline ? Math.max(1, request.wPt - 2 * FIELD_PADDING_PT) : undefined,
  };
  return (await rasteriseTextEdits([edit])).get('answer');
}

/**
 * Draws a form answer the size of its field, as a transparent PNG, with the browser's own text
 * shaping (Plan A): the same path as edited text in Edit PDF. One-line answers shrink to fit.
 *
 * @param request The answer, and the field's size in pt.
 * @returns PNG bytes, {@link TEXT_RENDER_PX_PER_PT} px per pt.
 */
export async function renderFieldAppearance(request: AppearanceRequest): Promise<Uint8Array> {
  const scale = TEXT_RENDER_PX_PER_PT;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(request.wPt * scale));
  canvas.height = Math.max(1, Math.ceil(request.hPt * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');

  let fontSizePt = request.fontSizePt > 0 ? request.fontSizePt : autoFontSizePt(request.hPt, request.multiline);
  let raster = await rasterise(request, fontSizePt);
  const inner = (r: RasterisedText, size: number) => {
    const padPt = size * TEXT_FRAGMENT_PAD_RATIO;
    return { wPt: r.wPt - 2 * padPt, hPt: r.hPt - 2 * padPt, padPt };
  };
  if (raster && !request.multiline) {
    const box = inner(raster, fontSizePt);
    const fitted = fitFontSizePt(fontSizePt, box.wPt, box.hPt, request.wPt, request.hPt);
    if (fitted < fontSizePt) {
      fontSizePt = fitted;
      raster = await rasterise(request, fontSizePt);
    }
  }
  // A wrapped answer taller than its field shrinks; wrapping changes with size, so a few passes.
  for (let pass = 0; raster && request.multiline && pass < 6; pass++) {
    const next = fitWrappedFontSizePt(fontSizePt, inner(raster, fontSizePt).hPt, request.hPt);
    if (next >= fontSizePt) break;
    fontSizePt = next;
    raster = await rasterise(request, fontSizePt);
  }
  if (raster) {
    const box = inner(raster, fontSizePt);
    const at = placeInField(request, box, request.align, request.multiline);
    const bitmap = await createImageBitmap(new Blob([raster.png.slice()], { type: 'image/png' }));
    context.drawImage(bitmap, (at.xPt - box.padPt) * scale, (at.yPt - box.padPt) * scale);
    bitmap.close();
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not draw the answer');
  return new Uint8Array(await blob.arrayBuffer());
}
