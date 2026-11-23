/**
 * Where images are painted on a page, from pdf.js's operator list, and which of them look like
 * lines of text. Word exports often draw words with effects, or text in shapes, as small images
 * (one line tall, at 600 ppi) with no text behind them. Without OCR of those images the words are
 * lost when the page is read from its text layer.
 */

/** The pdf.js operator codes this module reads. */
export type ImageOps = {
  save: number;
  restore: number;
  transform: number;
  paintFormXObjectBegin: number;
  paintFormXObjectEnd: number;
  paintImageXObject: number;
  paintInlineImageXObject: number;
  paintImageMaskXObject: number;
  paintImageXObjectRepeat: number;
};

type Matrix = [number, number, number, number, number, number];

/** A box in PDF user space, in pt (bottom-left origin): [x1, y1, x2, y2]. */
export type UserRect = [number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
  // n applied first, then m (PDF's "cm" pre-multiplies the current matrix).
  return [
    n[0] * m[0] + n[1] * m[2],
    n[0] * m[1] + n[1] * m[3],
    n[2] * m[0] + n[3] * m[2],
    n[2] * m[1] + n[3] * m[3],
    n[4] * m[0] + n[5] * m[2] + m[4],
    n[4] * m[1] + n[5] * m[3] + m[5],
  ];
}

function unitSquare(m: Matrix): UserRect {
  const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]];
  const ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * Every painted image's box, following the graphics state through save/restore, `cm` and form
 * XObjects. Images are painted into the unit square of the current matrix.
 *
 * @returns Boxes in PDF user space, in pt.
 */
export function imageRectsFromOperators(fnArray: readonly number[], argsArray: readonly unknown[], ops: ImageOps): UserRect[] {
  const rects: UserRect[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = IDENTITY;
  fnArray.forEach((fn, i) => {
    const args = argsArray[i] as unknown[] | null;
    if (fn === ops.save) stack.push(ctm);
    else if (fn === ops.restore) ctm = stack.pop() ?? ctm;
    else if (fn === ops.transform && args) ctm = multiply(ctm, args.slice(0, 6).map(Number) as Matrix);
    else if (fn === ops.paintFormXObjectBegin) {
      stack.push(ctm);
      const matrix = args?.[0] as ArrayLike<number> | null | undefined;
      if (matrix && matrix.length >= 6) ctm = multiply(ctm, Array.from(matrix).slice(0, 6) as Matrix);
    } else if (fn === ops.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === ops.paintImageXObject || fn === ops.paintInlineImageXObject || fn === ops.paintImageMaskXObject) {
      rects.push(unitSquare(ctm));
    } else if (fn === ops.paintImageXObjectRepeat && args) {
      const [, scaleX, scaleY, positions] = args as [unknown, number, number, ArrayLike<number>];
      for (let k = 0; k + 1 < positions.length; k += 2) {
        rects.push(unitSquare(multiply(ctm, [scaleX, 0, 0, scaleY, positions[k], positions[k + 1]])));
      }
    }
  });
  return rects;
}

/** A box in editor space, in pt (top-left origin). */
export type PtBox = { xPt: number; yPt: number; wPt: number; hPt: number };

/** Images this tall (pt) can be a line of text: a 6 pt footnote up to a 40 pt heading. */
const MIN_TEXT_IMAGE_PT = 5;
const MAX_TEXT_IMAGE_PT = 40;
/** Most text-image rows read per page; more is a picture-heavy page, not text. */
export const MAX_TEXT_IMAGE_ROWS = 40;

function overlapArea(a: PtBox, b: PtBox): number {
  const w = Math.min(a.xPt + a.wPt, b.xPt + b.wPt) - Math.max(a.xPt, b.xPt);
  const h = Math.min(a.yPt + a.hPt, b.yPt + b.hPt) - Math.max(a.yPt, b.yPt);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Rows of line-height images that may hold text the text layer does not have: images joined when
 * they share a line and nearly touch, without the rows the page's own text already covers.
 *
 * @param images Image boxes in editor space, in pt.
 * @param textLines The page's text-layer lines, in pt.
 * @returns Rows to read with OCR, top to bottom, at most {@link MAX_TEXT_IMAGE_ROWS}.
 */
export function textImageRows(images: readonly PtBox[], textLines: readonly PtBox[]): PtBox[] {
  const candidates = images
    .filter((box) => box.hPt >= MIN_TEXT_IMAGE_PT && box.hPt <= MAX_TEXT_IMAGE_PT && box.wPt >= 2)
    .sort((a, b) => a.yPt - b.yPt || a.xPt - b.xPt);
  const rows: PtBox[] = [];
  for (const box of candidates) {
    const row = rows.find((r) => {
      const sameLine = Math.abs(r.yPt + r.hPt / 2 - (box.yPt + box.hPt / 2)) < Math.min(r.hPt, box.hPt) / 2;
      const gap = Math.max(box.xPt - (r.xPt + r.wPt), r.xPt - (box.xPt + box.wPt));
      return sameLine && gap < Math.max(r.hPt, box.hPt);
    });
    if (!row) {
      rows.push({ ...box });
      continue;
    }
    const x1 = Math.min(row.xPt, box.xPt);
    const y1 = Math.min(row.yPt, box.yPt);
    row.wPt = Math.max(row.xPt + row.wPt, box.xPt + box.wPt) - x1;
    row.hPt = Math.max(row.yPt + row.hPt, box.yPt + box.hPt) - y1;
    row.xPt = x1;
    row.yPt = y1;
  }
  // A row whose area is mostly under the page's own text is a background or underline, not text.
  return rows
    .filter((row) => textLines.reduce((sum, line) => sum + overlapArea(row, line), 0) < 0.5 * row.wPt * row.hPt)
    .slice(0, MAX_TEXT_IMAGE_ROWS);
}

/** Where one area is cut from the page render and where it sits on the stacked sheet, in px. */
export type Strip = { sx: number; sy: number; w: number; h: number; top: number };

/**
 * Lays areas out one under another on a single sheet, so one OCR call reads them all. Each area
 * is padded and cut from a page render at `scale`; strips are `gapPx` apart and `marginPx` from the
 * sheet's left edge.
 *
 * @param boxes Areas, in pt (top-left origin).
 * @param page Page render size, in px.
 * @param scale Render scale, in px per pt.
 * @param padPt Padding around each area, in pt.
 */
export function stackStrips(
  boxes: readonly PtBox[],
  page: { widthPx: number; heightPx: number },
  scale: number,
  padPt: number,
  gapPx = 24,
  marginPx = 16,
): { strips: Strip[]; widthPx: number; heightPx: number } {
  let top = gapPx;
  let widest = 1;
  const strips = boxes.map((box) => {
    const sx = Math.max(0, Math.floor((box.xPt - padPt) * scale));
    const sy = Math.max(0, Math.floor((box.yPt - padPt) * scale));
    const w = Math.max(1, Math.min(page.widthPx, Math.ceil((box.xPt + box.wPt + padPt) * scale)) - sx);
    const h = Math.max(1, Math.min(page.heightPx, Math.ceil((box.yPt + box.hPt + padPt) * scale)) - sy);
    const strip = { sx, sy, w, h, top };
    top += h + gapPx;
    widest = Math.max(widest, w);
    return strip;
  });
  return { strips, widthPx: widest + 2 * marginPx, heightPx: top };
}

/**
 * The strip a line read from the sheet belongs to: the one containing the line's vertical centre.
 *
 * @param yPx Line centre on the sheet, in px.
 * @returns The strip's index, or -1 when the line falls in a gap.
 */
export function stripAt(strips: readonly Strip[], yPx: number): number {
  return strips.findIndex((strip) => yPx >= strip.top && yPx < strip.top + strip.h);
}
