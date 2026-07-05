import { ptToImagePx } from './coordinateMath';
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
  const fontPx = edit.fontSizePt * (page.imagePxWidth / page.widthPt);
  return `<span style="position:absolute;left:${x}px;top:${y}px;font-size:${fontPx}px;font-family:'${edit.fontFamily}';color:${edit.color};white-space:pre">${escapeHtml(edit.text)}</span>`;
}

/**
 * Builds the HTML for a single page: its rasterized background image, with every edit
 * layered on top as an absolutely-positioned element in image-pixel coordinates.
 *
 * Per spec Section 8, masks always render before text at export time - regardless of the
 * order edits were created in `editStore` - so a mask's fill color never paints over new
 * replacement text sitting at the same coordinate.
 */
export function pageHtml(page: PageState): string {
  const masks = page.edits.filter((e): e is MaskEdit => e.type === 'mask');
  const texts = page.edits.filter((e): e is TextEdit => e.type === 'text');
  const layers = [
    ...masks.map((e) => maskLayerHtml(e, page)),
    ...texts.map((e) => textLayerHtml(e, page)),
  ].join('');
  return `<div style="position:relative;width:${page.imagePxWidth}px;height:${page.imagePxHeight}px;background-image:url('${page.backgroundImageUri}');background-size:cover;overflow:hidden">${layers}</div>`;
}

/**
 * Builds the full multi-page HTML document for export. Every page in the document gets its
 * background image rendered (even pages with no edits), since export regenerates the whole
 * document in one `expo-print` call rather than only the page that was last edited.
 *
 * @param devanagariFontBase64 Base64-encoded font data from `fontAsset.ts`'s `getFontBase64`,
 *   inlined directly into an `@font-face` rule. Per spec Section 8, this must be base64-inlined
 *   rather than referenced by `file://` path, since WebView print does not reliably resolve
 *   local file paths for CSS assets.
 */
export function documentHtml(doc: DocumentState, devanagariFontBase64: string): string {
  const pages = doc.pages
    .map(
      (page, i) =>
        `<div style="${i > 0 ? 'page-break-before:always;' : ''}">${pageHtml(page)}</div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @font-face {
    font-family: 'NotoSansDevanagari';
    src: url('data:font/ttf;base64,${devanagariFontBase64}') format('truetype');
    font-weight: 100 900;
  }
  body { font-family: 'NotoSansDevanagari', sans-serif; }
</style>
</head>
<body>${pages}</body>
</html>`;
}
