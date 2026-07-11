import { ptToImagePx } from './coordinateMath';
import type { DevanagariFontFamily } from './fontAsset';
import type { DocumentState, MaskEdit, PageState, TextEdit } from '../state/editStore';

/**
 * Escapes text before it is interpolated into the HTML string this module builds.
 * `htmlCompositor.ts` assembles raw HTML strings that get loaded into a WebView for
 * printing (AGENTS.md's security rule): every `TextEdit.text` value must go through this
 * before reaching the template, since unescaped `<script>`/`<img onerror=...>`-style input
 * would otherwise execute inside that WebView.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function maskLayerHtml(edit: MaskEdit, page: PageState): string {
  const { x, y } = ptToImagePx(edit.xPt, edit.yPt, page.imagePxWidth, page.widthPt);
  const scale = page.imagePxWidth / page.widthPt;
  const wPx = edit.wPt * scale;
  const hPx = edit.hPt * scale;
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${wPx}px;height:${hPx}px;background:${edit.color}"></div>`;
}

function textLayerHtml(edit: TextEdit, page: PageState): string {
  const { x, y } = ptToImagePx(edit.xPt, edit.yPt, page.imagePxWidth, page.widthPt);
  const scale = page.imagePxWidth / page.widthPt;
  const fontPx = edit.fontSizePt * scale;
  // A width-constrained edit (OCR-assisted replacement) wraps inside its fixed box, exactly
  // like the live TextInput does at the same width - see TextEdit.widthPt's docstring. An
  // unconstrained edit keeps white-space:pre: a single line unless the user typed newlines.
  const widthStyle =
    edit.widthPt === undefined
      ? 'white-space:pre'
      : `width:${edit.widthPt * scale}px;white-space:pre-wrap;overflow-wrap:break-word`;
  const weightStyle = edit.fontWeight === 'bold' ? 'font-weight:700;' : '';
  return `<span style="position:absolute;left:${x}px;top:${y}px;font-size:${fontPx}px;font-family:'${edit.fontFamily}',system-ui,sans-serif;color:${edit.color};line-height:1.15;${weightStyle}${widthStyle}">${escapeHtml(edit.text)}</span>`;
}

/**
 * Builds the HTML for a single page: its rasterized background image, with every edit
 * layered on top as an absolutely-positioned element in image-pixel coordinates.
 *
 * Per spec Section 8, masks always render before text at export time - regardless of the
 * order edits were created in `editStore` - so a mask's fill color never paints over new
 * replacement text sitting at the same coordinate.
 *
 * @param backgroundImageDataUrl The page's rasterized background (`page.backgroundImageUri`) as
 *   a `data:` URI, already read and encoded by the caller (`exportPdf.ts`). Confirmed on a real
 *   device that Android's print WebView does not reliably resolve a local `file://` path used
 *   as a CSS `background-image` - the same class of failure as the font (spec Section 8's "do
 *   this, not a file path" note), just not caught until an actual exported PDF was inspected.
 *   See CHANGELOG for the on-device repro (background rendered blank; text alone was fine).
 */
export function pageHtml(page: PageState, backgroundImageDataUrl: string): string {
  const masks = page.edits.filter((e): e is MaskEdit => e.type === 'mask');
  const texts = page.edits.filter((e): e is TextEdit => e.type === 'text');
  const layers = [
    ...masks.map((e) => maskLayerHtml(e, page)),
    ...texts.map((e) => textLayerHtml(e, page)),
  ].join('');
  return `<div style="position:relative;width:${page.imagePxWidth}px;height:${page.imagePxHeight}px;background-image:url('${backgroundImageDataUrl}');background-size:cover;overflow:hidden">${layers}</div>`;
}

/**
 * Builds the full multi-page HTML document for export. Every page in the document gets its
 * background image rendered (even pages with no edits), since export regenerates the whole
 * document in one `expo-print` call rather than only the page that was last edited.
 *
 * @param fontBase64ByFamily Base64-encoded font data keyed by family name, inlined into
 *   `@font-face` rules. Every family referenced by a `TextEdit` on the document must be present.
 * @param backgroundImageDataUrls One `data:` URI per entry in `doc.pages`, same index order -
 *   see `pageHtml`'s docstring for why this can't be a `file://` reference either.
 */
export function documentHtml(
  doc: DocumentState,
  fontBase64ByFamily: Record<DevanagariFontFamily, string>,
  backgroundImageDataUrls: string[],
): string {
  const pages = doc.pages
    .map(
      (page, i) =>
        `<div style="${i > 0 ? 'page-break-before:always;' : ''}">${pageHtml(page, backgroundImageDataUrls[i])}</div>`,
    )
    .join('');

  const fontFaces = (Object.entries(fontBase64ByFamily) as [DevanagariFontFamily, string][])
    .map(
      ([family, base64]) => `@font-face {
    font-family: '${family}';
    src: url('data:font/ttf;base64,${base64}') format('truetype');
    font-weight: 100 900;
  }`,
    )
    .join('\n  ');

  return `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  ${fontFaces}
  body { font-family: 'NotoSansDevanagari', sans-serif; }
</style>
</head>
<body>${pages}</body>
</html>`;
}
