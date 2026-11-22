import { baselineOffsetRatio, cssFontStack, ensureFontsLoaded, normalLineHeightRatio } from './fontAsset';
import {
  TEXT_FRAGMENT_PAD_RATIO,
  TEXT_RENDER_PX_PER_PT,
  textEditFragmentHtml,
} from './htmlCompositor';
import type { TextEdit } from '../state/editStore';
import { cssWeight } from './fontWeight';

/**
 * Horizontal shear for italic text. The bundled fonts have no italic face; CSS synthesises an
 * oblique of this slope in the editor, but Canvas 2D does not, so export applies it explicitly.
 */
const SYNTHETIC_ITALIC_SHEAR = 0.25;

/** A rendered text edit: PNG bytes and where the image goes, in editor space (pt, top-left). */
export type RasterisedText = { png: Uint8Array; xPt: number; yPt: number; wPt: number; hPt: number };

/** One laid-out grapheme: its text and the top/left of its box, in px. */
export type PlacedGrapheme = { text: string; top: number; left: number };

/**
 * Groups graphemes into the lines the browser laid them out on. Graphemes whose box tops are
 * within half a font size belong to the same line; trailing spaces at a wrap are dropped, as the
 * browser does not paint them.
 *
 * @param graphemes Graphemes in text order, positions in px.
 * @param fontPx Font size, in px.
 */
export function groupIntoLines(
  graphemes: readonly PlacedGrapheme[],
  fontPx: number,
): { text: string; left: number }[] {
  const lines: { text: string; left: number; top: number }[] = [];
  for (const g of graphemes) {
    if (g.text === '\n') continue;
    const line = lines[lines.length - 1];
    if (line && Math.abs(g.top - line.top) < fontPx / 2) {
      line.text += g.text;
    } else {
      lines.push({ text: g.text, left: g.left, top: g.top });
    }
  }
  return lines.map(({ text, left }) => ({ text: text.replace(/\s+$/u, ''), left }));
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

/**
 * Renders text edits to transparent PNGs. The text is laid out in the page with the same CSS as
 * the live editor, the browser's own line breaks are read back with DOM ranges, and each line is
 * painted with Canvas 2D `fillText` at the measured baseline. Shaping is the browser's (HarfBuzz),
 * so Devanagari conjuncts, matras and reph are correct (Plan A), and positions match the editor
 * exactly instead of depending on a re-implementation of CSS rendering.
 *
 * @param edits Text edits; positions and sizes in PDF points.
 */
export async function rasteriseTextEdits(edits: readonly TextEdit[]): Promise<Map<string, RasterisedText>> {
  const result = new Map<string, RasterisedText>();
  const visible = edits.filter((edit) => edit.text.trim().length > 0);
  if (visible.length === 0) return result;
  ensureFontsLoaded();

  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-100000px;top:0;width:100000px;pointer-events:none';
  host.innerHTML = visible.map((edit, i) => `<div>${textEditFragmentHtml(edit, `hpe-text-${i}`)}</div>`).join('');
  document.body.appendChild(host);
  try {
    // Intl.Segmenter is missing before Firefox 125; code points are close enough for grouping.
    const segmentsOf = (text: string): string[] =>
      typeof Intl.Segmenter === 'function'
        ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment)
        : Array.from(text);
    for (const [i, edit] of visible.entries()) {
      const family = edit.fontFamily;
      const weight = cssWeight(edit.fontWeight);
      const fontPx = edit.fontSizePt * TEXT_RENDER_PX_PER_PT;
      const fontShorthand = `${edit.fontStyle ?? 'normal'} ${weight} ${fontPx}px ${cssFontStack(family)}`;
      await document.fonts.load(fontShorthand, edit.text);
      const ratio = (await baselineOffsetRatio(family, weight, edit.fontStyle, edit.text)) ?? 1;

      const container = document.getElementById(`hpe-text-${i}`);
      const span = container?.firstElementChild as HTMLElement | null;
      const textNode = span?.firstChild;
      if (!container || !span || !textNode) continue;
      const containerBox = container.getBoundingClientRect();
      const spanBox = span.getBoundingClientRect();

      const graphemes: PlacedGrapheme[] = [];
      const range = document.createRange();
      let offset = 0;
      for (const segment of segmentsOf(textNode.textContent ?? '')) {
        range.setStart(textNode, offset);
        range.setEnd(textNode, offset + segment.length);
        offset += segment.length;
        const rect = range.getClientRects()[0];
        if (rect) graphemes.push({ text: segment, top: rect.top, left: rect.left - containerBox.left });
      }
      const lines = groupIntoLines(graphemes, fontPx);
      if (lines.length === 0) continue;
      const lineHeightPx = spanBox.height / lines.length;
      // An explicit line height adds half its extra leading above the first line, as CSS does.
      const normalRatio =
        edit.lineHeightPt === undefined ? undefined : await normalLineHeightRatio(family, weight, edit.fontStyle, edit.text);
      const halfLeading =
        edit.lineHeightPt === undefined || normalRatio === undefined
          ? 0
          : (edit.lineHeightPt * TEXT_RENDER_PX_PER_PT - normalRatio * fontPx) / 2;
      const firstBaseline = spanBox.top - containerBox.top + halfLeading + ratio * fontPx;

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(containerBox.width);
      canvas.height = Math.ceil(containerBox.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D context unavailable');
      context.font = `normal ${weight} ${fontPx}px ${cssFontStack(family)}`;
      context.fillStyle = getComputedStyle(span).color;
      context.textBaseline = 'alphabetic';
      // Faux bold: the glyphs are filled, then stroked in the same colour, as the original was.
      const strokePx = (edit.strokeEm ?? 0) * fontPx;
      context.strokeStyle = context.fillStyle;
      context.lineWidth = strokePx;
      const paint = (text: string, x: number, y: number) => {
        context.fillText(text, x, y);
        if (strokePx > 0) context.strokeText(text, x, y);
      };
      lines.forEach((line, index) => {
        const baseline = firstBaseline + index * lineHeightPx;
        if (edit.fontStyle !== 'italic') {
          paint(line.text, line.left, baseline);
          return;
        }
        context.save();
        context.setTransform(1, 0, -SYNTHETIC_ITALIC_SHEAR, 1, line.left + SYNTHETIC_ITALIC_SHEAR * baseline, 0);
        paint(line.text, 0, baseline);
        context.restore();
      });

      const padPt = edit.fontSizePt * TEXT_FRAGMENT_PAD_RATIO;
      result.set(edit.id, {
        png: dataUrlBytes(canvas.toDataURL('image/png')),
        xPt: edit.xPt - padPt,
        yPt: edit.yPt - padPt,
        wPt: canvas.width / TEXT_RENDER_PX_PER_PT,
        hPt: canvas.height / TEXT_RENDER_PX_PER_PT,
      });
    }
  } finally {
    host.remove();
  }
  return result;
}
