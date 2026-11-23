import { PDFDocument } from '@cantoo/pdf-lib';
import { renderAsync } from 'docx-preview';
import { toCanvas } from 'html-to-image';

import { ensureFontsLoaded } from './fontAsset';
import { pageCuts } from './pageCuts';

/** Capture scale, in device px per CSS px: sharp text at a reasonable file size. */
const CAPTURE_PIXEL_RATIO = 2;
/** CSS px per PDF point. */
const PX_PER_PT = 96 / 72;
/** JPEG quality of captured pages. */
const PAGE_JPEG_QUALITY = 0.9;
/** A row is blank when every sampled pixel is at least this light. */
const BLANK_LUMA = 245;

/**
 * Lays out a Word (.docx) file in `host` with docx-preview: one `section.docx` per page or
 * section, sized like the document's pages. Office fonts fall back to their bundled
 * metric-compatible matches and Devanagari to the bundled Noto font when not installed.
 *
 * @returns The rendered page sections, in order.
 */
export async function renderWordDocument(file: Blob, host: HTMLElement): Promise<HTMLElement[]> {
  ensureFontsLoaded();
  host.innerHTML = '';
  await renderAsync(file, host, host, {
    inWrapper: false,
    breakPages: true,
    ignoreLastRenderedPageBreak: false,
    experimental: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    useBase64URL: true,
  });
  for (const element of host.querySelectorAll<HTMLElement>('section.docx, section.docx *')) {
    const family = getComputedStyle(element).fontFamily;
    if (/NotoSansDevanagari/u.test(family)) continue;
    element.style.fontFamily = `${withBundledFonts(family)}, 'NotoSansDevanagari', sans-serif`;
  }
  await document.fonts.ready;
  return [...host.querySelectorAll<HTMLElement>('section.docx')];
}

/**
 * Common Office fonts and the bundled fonts with the same metrics (see fontAsset.ts), so text
 * wraps and paginates as in Word on devices without the Office fonts.
 */
const OFFICE_FONT_MATCHES: [RegExp, string][] = [
  [/^calibri$/i, 'Carlito'],
  [/^cambria$/i, 'Caladea'],
  [/^(arial|helvetica|liberation sans)$/i, 'Arimo'],
  [/^(times new roman|times|liberation serif)$/i, 'Tinos'],
];

/** A CSS font-family list with each Office font followed by its bundled match. */
function withBundledFonts(family: string): string {
  return family
    .split(',')
    .map((name) => name.trim())
    .flatMap((name) => {
      const bare = name.replace(/^['"]|['"]$/g, '');
      const match = OFFICE_FONT_MATCHES.find(([pattern]) => pattern.test(bare))?.[1];
      return match ? [name, `'${match}'`] : [name];
    })
    .join(', ');
}

/** Size of a rendered section's page, in PDF points (docx-preview sets it in pt). */
function sectionPageSize(section: HTMLElement): { widthPt: number; heightPt: number } {
  const width = parseFloat(section.style.width) || section.offsetWidth / PX_PER_PT;
  const height = parseFloat(section.style.minHeight) || width * Math.SQRT2;
  return { widthPt: width, heightPt: height };
}

/** Which pixel rows of a canvas are blank (white). */
function blankRows(canvas: HTMLCanvasElement): boolean[] {
  const context = canvas.getContext('2d');
  if (!context) return new Array(canvas.height).fill(false);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const rows: boolean[] = [];
  const step = Math.max(1, Math.floor(canvas.width / 400));
  for (let y = 0; y < canvas.height; y++) {
    let blank = true;
    for (let x = 0; x < canvas.width && blank; x += step) {
      const i = (y * canvas.width + x) * 4;
      if (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < BLANK_LUMA) blank = false;
    }
    rows.push(blank);
  }
  return rows;
}

/**
 * Makes a PDF from rendered Word pages: each section is captured as an image at its page size,
 * and a section longer than a page (documents saved without page-break marks) is cut into pages
 * at blank rows. The PDF's pages are images, so their text is not selectable or searchable.
 *
 * @param onProgress Called after each section with sections done and total.
 */
export async function sectionsToPdf(
  sections: readonly HTMLElement[],
  onProgress: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setProducer('Hindi PDF Editor');
  for (const [index, section] of sections.entries()) {
    const { widthPt, heightPt } = sectionPageSize(section);
    const canvas = await toCanvas(section, { pixelRatio: CAPTURE_PIXEL_RATIO, backgroundColor: '#ffffff', cacheBust: true });
    const pxPerPt = canvas.width / widthPt;
    for (const [top, bottom] of pageCuts(blankRows(canvas), Math.round(heightPt * pxPerPt))) {
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.round(heightPt * pxPerPt);
      const context = slice.getContext('2d');
      if (!context) throw new Error('Canvas 2D context unavailable');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, slice.width, slice.height);
      context.drawImage(canvas, 0, top, canvas.width, bottom - top, 0, 0, canvas.width, bottom - top);
      const jpeg = await pdf.embedJpg(await (await fetch(slice.toDataURL('image/jpeg', PAGE_JPEG_QUALITY))).arrayBuffer());
      pdf.addPage([widthPt, heightPt]).drawImage(jpeg, { x: 0, y: 0, width: widthPt, height: heightPt });
    }
    onProgress(index + 1, sections.length);
  }
  const bytes = await pdf.save();
  // Validate before reporting success: the file must re-open with its pages.
  const check = await PDFDocument.load(bytes);
  if (check.getPageCount() === 0) throw new Error('The PDF has no pages');
  return bytes;
}

/**
 * Opens the browser's print dialog for a Word file laid out as above, so it can be saved as a
 * PDF with real, selectable text (shaped by the browser). Each page section prints as one page.
 */
export async function printWordDocument(file: Blob): Promise<void> {
  ensureFontsLoaded();
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) throw new Error('Print frame unavailable');
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Print</title></head><body></body></html>');
  doc.close();
  const fonts = document.getElementById('hindi-pdf-editor-fonts');
  if (fonts) doc.head.appendChild(doc.importNode(fonts, true));
  const sections = await renderWordDocument(file, doc.body);
  const first = sections[0] ? sectionPageSize(sections[0]) : { widthPt: 595, heightPt: 842 };
  const style = doc.createElement('style');
  style.textContent = `@page { size: ${first.widthPt}pt ${first.heightPt}pt; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    section.docx { box-shadow: none !important; margin: 0 !important; break-after: page; page-break-after: always; }`;
  doc.head.appendChild(style);
  await doc.fonts.ready;
  win.focus();
  win.print();
  // The dialog blocks in most browsers; remove the frame once it closes.
  window.setTimeout(() => frame.remove(), 60_000);
}
