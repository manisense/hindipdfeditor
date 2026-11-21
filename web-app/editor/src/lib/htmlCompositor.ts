import type { DevanagariFontFamily } from './fontAsset';
import { TEXT_LINE_HEIGHT, TEXT_OVERFLOW_WRAP } from './textLayout';
import type { TextEdit } from '../state/editStore';

/** CSS px per PDF point used when rasterising edited text: sharp, and far above any browser minimum font size. */
export const TEXT_RENDER_PX_PER_PT = 4;

/** Padding around each text fragment, as a fraction of its font size, so marks above and below the line are not clipped. */
export const TEXT_FRAGMENT_PAD_RATIO = 0.6;

/**
 * Escapes text before it is interpolated into the HTML string this module builds.
 * The fragments are rendered by the browser; unescaped `<script>`/`<img onerror=...>`-style input
 * would otherwise execute (AGENTS.md security rule). Every `TextEdit.text` value goes through this.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$|^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/;
const SAFE_FAMILY = /^[A-Za-z0-9 _-]+$/;

/**
 * Builds the HTML for one text edit, positioned at the top-left of a padded container. Layout
 * matches the live editor: same font, size, weight, `line-height: normal` and wrapping width.
 *
 * @param edit The text edit; its `fontSizePt` and `widthPt` are in PDF points.
 * @param id DOM id for the container, used to find it for rasterising.
 */
export function textEditFragmentHtml(edit: TextEdit, id: string): string {
  const scale = TEXT_RENDER_PX_PER_PT;
  const fontPx = edit.fontSizePt * scale;
  const padPx = fontPx * TEXT_FRAGMENT_PAD_RATIO;
  const color = SAFE_COLOR.test(edit.color) ? edit.color : '#111111';
  const family = SAFE_FAMILY.test(edit.fontFamily) ? edit.fontFamily : 'NotoSansDevanagari';
  // A width-constrained edit (OCR-assisted replacement) wraps inside its fixed box, exactly like
  // the live editor at the same width. An unconstrained edit stays on one line unless the user
  // typed newlines.
  const widthStyle =
    edit.widthPt === undefined
      ? 'white-space:pre;'
      : `width:${edit.widthPt * scale}px;white-space:pre-wrap;overflow-wrap:${TEXT_OVERFLOW_WRAP};`;
  const weightStyle = edit.fontWeight === 'bold' ? 'font-weight:700;' : '';
  return `<div id="${id}" style="display:inline-block;padding:${padPx}px;background:transparent"><span style="display:block;font-size:${fontPx}px;font-family:'${family}',system-ui,sans-serif;color:${color};line-height:${TEXT_LINE_HEIGHT};word-break:normal;writing-mode:horizontal-tb;overflow:visible;${weightStyle}${widthStyle}">${escapeHtml(edit.text)}</span></div>`;
}

/**
 * Builds the document that hosts text fragments for rasterising, with the bundled Devanagari
 * fonts inlined as `data:` URIs (file paths do not resolve reliably in an export frame).
 *
 * @param fragments HTML from `textEditFragmentHtml`.
 * @param fontBase64ByFamily Base64 font data keyed by family name.
 */
export function textFragmentsDocumentHtml(
  fragments: string[],
  fontBase64ByFamily: Record<DevanagariFontFamily, string>,
): string {
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
  * { margin: 0; padding: 0; box-sizing: content-box; }
  ${fontFaces}
  body { background: transparent; }
  body > div { margin-bottom: 8px; }
</style>
</head>
<body>${fragments.map((fragment) => `<div>${fragment}</div>`).join('')}</body>
</html>`;
}
