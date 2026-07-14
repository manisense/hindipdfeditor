import type { DocumentState, MaskEdit, PageState, TextEdit } from '../state/editStore';

export type EmbeddedFontData = {
  base64: string;
  /** CSS `@font-face` weight descriptor matching the embedded file. */
  cssFontWeight: '100 900' | '400';
};

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

function maskLayerHtml(edit: MaskEdit): string {
  return `<div style="position:absolute;left:${edit.xPt}pt;top:${edit.yPt}pt;width:${edit.wPt}pt;height:${edit.hPt}pt;background:${edit.color}"></div>`;
}

function textLayerHtml(edit: TextEdit): string {
  // A width-constrained edit (OCR-assisted replacement) wraps inside its fixed box, exactly
  // like the live TextInput does at the same width - see TextEdit.widthPt's docstring. An
  // unconstrained edit keeps white-space:pre: a single line unless the user typed newlines.
  // Never break inside a Devanagari word merely to satisfy a narrow OCR box: that is the
  // "vertical text" failure where one shaped cluster is stacked per line. The box may grow
  // visually past its stored width, but the text stays horizontal and readable.
  const widthStyle =
    edit.widthPt === undefined
      ? 'white-space:pre'
      : `width:${edit.widthPt}pt;white-space:pre-wrap;overflow-wrap:normal;word-break:normal`;
  const weightStyle = edit.fontWeight === 'bold' ? 'font-weight:700;' : '';
  return `<span style="display:block;position:absolute;left:${edit.xPt}pt;top:${edit.yPt}pt;font-size:${edit.fontSizePt}pt;font-family:'${edit.fontFamily}';color:${edit.color};line-height:1;writing-mode:horizontal-tb;text-orientation:mixed;direction:ltr;unicode-bidi:plaintext;${weightStyle}${widthStyle}">${escapeHtml(edit.text)}</span>`;
}

/**
 * Builds the HTML for a single page: its rasterized background image, with every edit
 * layered on top as absolutely-positioned elements in canonical PDF-point coordinates.
 *
 * Per spec Section 8, masks always render before text at export time - regardless of the
 * order edits were created in `editStore` - so a mask's fill color never paints over new
 * replacement text sitting at the same coordinate.
 *
 * @param backgroundImageDataUrl The page's rasterized background (`page.backgroundImageUri`) as
 *   a `data:` URI, already read and encoded by the caller (`exportPdf.ts`). Confirmed on a real
 *   device that Android's print WebView does not reliably resolve a local `file://` path. The
 *   image is an `<img>` content layer instead of CSS background paint so print renderers treat
 *   it consistently with the shaped text above it.
 *   See CHANGELOG for the on-device repro (background rendered blank; text alone was fine).
 */
export function pageHtml(page: PageState, backgroundImageDataUrl: string): string {
  const masks = page.edits.filter((e): e is MaskEdit => e.type === 'mask');
  const texts = page.edits.filter((e): e is TextEdit => e.type === 'text');
  const layers = [...masks.map(maskLayerHtml), ...texts.map(textLayerHtml)].join('');
  return `<section class="pdf-page" style="position:relative;width:${page.widthPt}pt;height:${page.heightPt}pt;overflow:hidden"><img src="${backgroundImageDataUrl}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill" />${layers}</section>`;
}

/**
 * Builds an HTML print document for the supplied pages. Production export currently calls this
 * with one page at a time, then merges the validated printed pages. Keeping this function able
 * to represent several pages is useful for deterministic compositor fixture checks.
 *
 * @param embeddedFonts Font data keyed by family name and its real CSS weight descriptor.
 *   Static fonts must be declared `400`; falsely declaring a variable range can create broken
 *   transparency masks in some PDF viewers. Every family used by an edit must be present.
 * @param backgroundImageDataUrls One `data:` URI per entry in `doc.pages`, same index order -
 *   see `pageHtml`'s docstring for why this can't be a `file://` reference either.
 */
export function documentHtml(
  doc: DocumentState,
  embeddedFonts: Record<string, EmbeddedFontData>,
  backgroundImageDataUrls: string[],
): string {
  const pages = doc.pages.map((page, i) => pageHtml(page, backgroundImageDataUrls[i])).join('');

  const fontFaces = Object.entries(embeddedFonts)
    .map(
      ([family, font]) => `@font-face {
    font-family: '${family}';
    src: url('data:font/ttf;base64,${font.base64}') format('truetype');
    font-weight: ${font.cssFontWeight};
  }`,
    )
    .join('\n  ');

  return `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${fontFaces}
  html, body { width: 100%; height: 100%; }
  body { font-family: 'NotoSansDevanagari', sans-serif; }
  .pdf-page + .pdf-page { break-before: page; page-break-before: always; }
</style>
</head>
<body>${pages}</body>
</html>`;
}
