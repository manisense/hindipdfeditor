import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument } from '@cantoo/pdf-lib';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';

import { instantiateHarfBuzz } from './harfbuzzWasm';
import { extractEmbeddedTextLines } from './pdfTextExtract';
import {
  assignClusterToUnicode,
  buildToUnicodeCMap,
  drawVectorTextEdits,
  encodeActualTextHex,
  parseCssColorRgb,
} from './pdfVectorText';

const HB_DIR = path.resolve(__dirname, '../../node_modules/harfbuzzjs/dist');
const NOTO_SANS_PATH = path.resolve(__dirname, '../../public/fonts/NotoSansDevanagari-Variable.ttf');

function hasPopplerTools(): boolean {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
    execFileSync('pdftoppm', ['-v'], { stdio: 'ignore' });
    execFileSync('pdffonts', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('pdfVectorText helpers', () => {
  it('parses CSS hex and rgb colors into normalized RGB', () => {
    expect(parseCssColorRgb('#000000')).toEqual([0, 0, 0]);
    expect(parseCssColorRgb('#fff')).toEqual([1, 1, 1]);
    expect(parseCssColorRgb('rgb(24, 67, 221)')).toEqual([24 / 255, 67 / 255, 221 / 255]);
  });

  it('encodes UTF-16BE /ActualText hex with BOM', () => {
    expect(encodeActualTextHex('धर्म')).toBe('FEFF09270930094D092E');
  });

  it('chunks ToUnicode bfchar blocks to at most 100 entries', () => {
    const map = new Map<number, string>();
    for (let gid = 1; gid <= 125; gid++) map.set(gid, 'क');
    const cmap = buildToUnicodeCMap(map);
    expect(cmap).toContain('100 beginbfchar');
    expect(cmap).toContain('25 beginbfchar');
  });

  it('maps every glyph in single-glyph, multi-glyph, reph, pre-base ि, and unsplittable clusters', () => {
    const nominal = new Map<number, string>([
      [56, 'क'],
      [80, 'म'],
      [31, 'ा'],
    ]);
    const toUnicode = new Map<number, string>();
    const glyph = (gid: number, charCluster: number) => ({
      gid,
      cluster: 0,
      charCluster,
      xAdvance: 500,
      yAdvance: 0,
      xOffset: 0,
      yOffset: 0,
    });

    // Single-glyph conjunct ligature: त्र -> GID 304.
    assignClusterToUnicode({ text: 'त्र', glyphs: [glyph(304, 0)] }, nominal, toUnicode);
    expect(toUnicode.get(304)).toBe('त्र');

    // Reph cluster: र्म -> म (nominal 80) + reph (506 at charCluster 0).
    assignClusterToUnicode({ text: 'र्म', glyphs: [glyph(80, 2), glyph(506, 0)] }, nominal, toUnicode);
    expect(toUnicode.get(80)).toBe('म');
    expect(toUnicode.get(506)).toBe('र्');

    // Conjunct + matra: ज्ञा -> ज्ञ (91 at charCluster 0) + ा (nominal 31 at charCluster 3).
    assignClusterToUnicode({ text: 'ज्ञा', glyphs: [glyph(91, 0), glyph(31, 3)] }, nominal, toUnicode);
    expect(toUnicode.get(91)).toBe('ज्ञ');
    expect(toUnicode.get(31)).toBe('ा');

    // Pre-base ि: कि -> ि (545 at charCluster 1) + क (nominal 56 at charCluster 0).
    assignClusterToUnicode({ text: 'कि', glyphs: [glyph(545, 1), glyph(56, 0)] }, nominal, toUnicode);
    expect(toUnicode.get(545)).toBe('ि');
    expect(toUnicode.get(56)).toBe('क');

    // Orphaned reph ligated onto matra: र्मी -> म (nominal 80 at 2) + ीर् (643 at 3).
    assignClusterToUnicode({ text: 'र्मी', glyphs: [glyph(80, 2), glyph(643, 3)] }, nominal, toUnicode);
    expect(toUnicode.get(643)).toBe('ीर्');

    // Unsplittable 1-to-2 non-nominal decomposition: first gets text, second gets U+FEFF (never Identity).
    assignClusterToUnicode({ text: 'क', glyphs: [glyph(700, 0), glyph(701, 0)] }, nominal, toUnicode);
    expect(toUnicode.get(700)).toBe('क');
    expect(toUnicode.get(701)).toBe('\uFEFF');
  });
});

describe('drawVectorTextEdits end-to-end with Poppler and pdf.js', () => {
  it('embeds CID/Identity-H subsets with exact pdftotext Unicode and matching pdf.js/Poppler rendering', async () => {
    const engine = await instantiateHarfBuzz({
      shapeWasm: new Uint8Array(readFileSync(path.join(HB_DIR, 'harfbuzz.wasm'))),
      subsetWasm: new Uint8Array(readFileSync(path.join(HB_DIR, 'harfbuzz-subset.wasm'))),
    });
    const notoBytes = new Uint8Array(readFileSync(NOTO_SANS_PATH));

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const editorToUser: [number, number, number, number, number, number] = [1, 0, 0, -1, 0, 842];

    const line1 = 'धर्म और क्षेत्र में गुरुजी ने ज्ञान दिया।';
    const line2 = 'विद्यालय में सूर्य की रोशनी आती है।';
    const line3 = 'प्रकृति क्षितिज किताब — Bold 2026';

    const drawn = await drawVectorTextEdits(
      pdfDoc,
      [
        {
          page,
          editorToUser,
          items: [
            {
              id: 'edit-regular',
              fontFamily: 'NotoSansDevanagari',
              fontWeight: 400,
              fontSizePt: 24,
              color: '#111111',
              lines: [
                { text: line1, xPt: 48, baselinePt: 120 },
                { text: line2, xPt: 48, baselinePt: 170 },
              ],
            },
            {
              id: 'edit-bold',
              fontFamily: 'NotoSansDevanagari',
              fontWeight: 700,
              fontSizePt: 20,
              color: '#1843dd',
              lines: [{ text: line3, xPt: 48, baselinePt: 230 }],
            },
            {
              id: 'edit-fallback-woff2',
              fontFamily: 'Arimo',
              fontWeight: 400,
              fontSizePt: 14,
              color: '#111111',
              lines: [{ text: 'Fallback test', xPt: 48, baselinePt: 280 }],
            },
          ],
        },
      ],
      {
        engine,
        loadFontBytes: async (family) => (family === 'NotoSansDevanagari' ? notoBytes : null),
      },
    );

    expect(drawn.has('edit-regular')).toBe(true);
    expect(drawn.has('edit-bold')).toBe(true);
    expect(drawn.has('edit-fallback-woff2')).toBe(false);

    const pdfBytes = await pdfDoc.save();
    // Subsetted PDF with two weights (400 & 700) stays small (far below the 647 KB full font).
    expect(pdfBytes.byteLength).toBeLessThan(80_000);

    if (!hasPopplerTools()) return;

    const dir = mkdtempSync(path.join(os.tmpdir(), 'plan-b-unit-'));
    try {
      const pdfPath = path.join(dir, 'out.pdf');
      writeFileSync(pdfPath, pdfBytes);

      // 1. pdftotext must return exact Unicode for every canonical Devanagari word & line.
      const extracted = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' })
        .replace(/\s+/g, ' ')
        .trim();
      expect(extracted).toContain(line1);
      expect(extracted).toContain(line2);
      expect(extracted).toContain(line3);

      // 2. pdffonts must show embedded, subsetted CID TrueType Identity-H fonts with ToUnicode.
      const fontsOut = execFileSync('pdffonts', [pdfPath], { encoding: 'utf8' });
      const cidLines = fontsOut
        .split('\n')
        .filter((l) => l.includes('CID TrueType') && l.includes('Identity-H') && /\byes\s+yes\s+yes\b/.test(l));
      expect(cidLines.length).toBe(2);

      // 3. Render with Poppler (pdftoppm) and pdf.js at 150 DPI and compare pixel diff.
      const dpi = 150;
      const prefix = path.join(dir, 'poppler');
      execFileSync('pdftoppm', ['-png', '-r', String(dpi), '-singlefile', pdfPath, prefix]);
      const popImg = await loadImage(`${prefix}.png`);
      const popCanvas = createCanvas(popImg.width, popImg.height);
      popCanvas.getContext('2d').drawImage(popImg, 0, 0);
      const popRgba = popCanvas.getContext('2d').getImageData(0, 0, popImg.width, popImg.height).data;

      const doc = await pdfjs.getDocument({ data: pdfBytes.slice(), verbosity: 0 }).promise;
      const pdfPage = await doc.getPage(1);
      const textContent = await pdfPage.getTextContent();
      const pdfJsRaw = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ');
      const pdfJsCompact = pdfJsRaw.replace(/\s+/g, '');
      expect(pdfJsRaw).not.toContain('\u0000');
      expect(pdfJsRaw).not.toMatch(/[\u0100-\u02FF]/);
      for (const token of ['धमर्', 'क्षेत्र', 'में', 'गुरुजी', 'ज्ञान', 'िदया।', 'िवद्यालय', 'सूयर्', 'की', 'रोशनी', 'प्रकृित', 'िक्षितज', 'िकताब', 'Bold2026']) {
        expect(pdfJsCompact).toContain(token);
      }

      // Editor's own extraction (pdf.js + /ActualText) must read back every line in exact logical order.
      const extractedLines = await extractEmbeddedTextLines(pdfBytes.slice(), 0);
      expect(extractedLines.every((line) => line.source === 'embedded')).toBe(true);
      expect(extractedLines.map((line) => line.text)).toEqual([line1, line2, line3]);

      const viewport = pdfPage.getViewport({ scale: dpi / 72 });
      const jsCanvas = createCanvas(popImg.width, popImg.height);
      const jsCtx = jsCanvas.getContext('2d');
      jsCtx.fillStyle = '#ffffff';
      jsCtx.fillRect(0, 0, jsCanvas.width, jsCanvas.height);
      await pdfPage.render({
        canvasContext: jsCtx as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: jsCanvas as unknown as HTMLCanvasElement,
      }).promise;
      await doc.destroy();
      const jsRgba = jsCtx.getImageData(0, 0, jsCanvas.width, jsCanvas.height).data;

      const w = popImg.width;
      const h = popImg.height;
      const isDark = (buf: Uint8ClampedArray, x: number, y: number) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return false;
        const idx = (y * w + x) * 4;
        return buf[idx] + buf[idx + 1] + buf[idx + 2] < 600;
      };
      const hasNearDark = (buf: Uint8ClampedArray, x: number, y: number) => {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (isDark(buf, x + dx, y + dy)) return true;
          }
        }
        return false;
      };
      let diffPx = 0;
      let structuralDiffPx = 0;
      let inkPx = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const pDark = popRgba[i] + popRgba[i + 1] + popRgba[i + 2] < 600;
          const jDark = jsRgba[i] + jsRgba[i + 1] + jsRgba[i + 2] < 600;
          if (pDark) inkPx++;
          const delta =
            Math.abs(popRgba[i] - jsRgba[i]) +
            Math.abs(popRgba[i + 1] - jsRgba[i + 1]) +
            Math.abs(popRgba[i + 2] - jsRgba[i + 2]);
          if (delta > 120) {
            diffPx++;
            if ((pDark && !hasNearDark(jsRgba, x, y)) || (jDark && !hasNearDark(popRgba, x, y))) {
              structuralDiffPx++;
            }
          }
        }
      }
      expect(inkPx).toBeGreaterThan(2000);
      const diffShare = diffPx / (w * h);
      const structuralShare = structuralDiffPx / (w * h);
      expect(diffShare).toBeLessThan(0.015);
      expect(structuralShare).toBeLessThan(0.001);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('re-extracts exact edited Hindi lines via pdf.js + ActualText after editing devanagari-fixture.pdf', async () => {
    const engine = await instantiateHarfBuzz({
      shapeWasm: new Uint8Array(readFileSync(path.join(HB_DIR, 'harfbuzz.wasm'))),
      subsetWasm: new Uint8Array(readFileSync(path.join(HB_DIR, 'harfbuzz-subset.wasm'))),
    });
    const notoBytes = new Uint8Array(readFileSync(NOTO_SANS_PATH));
    const fixturePath = path.resolve(__dirname, '../../../../mobile-app/fixtures/devanagari-fixture.pdf');
    const pdfDoc = await PDFDocument.load(readFileSync(fixturePath));
    const page = pdfDoc.getPage(0);
    const { removePageText } = await import('./pdfTextRemoval');
    removePageText(pdfDoc, 0, [
      { x0: 50, y0: 585, x1: 540, y1: 630 },
      { x0: 50, y0: 525, x1: 540, y1: 570 },
    ]);

    const line1 = 'सूर्य, धर्म और क्षेत्र में गुरुजी ने ज्ञान प्रकृति दिया।';
    const line2 = 'किताब, विद्यालय में सूर्य की रोशनी क्षितिज है।';
    const heightPt = page.getHeight();
    await drawVectorTextEdits(
      pdfDoc,
      [
        {
          page,
          editorToUser: [1, 0, 0, -1, 0, heightPt],
          items: [
            {
              id: 'edit-1',
              fontFamily: 'NotoSansDevanagari',
              fontWeight: 400,
              fontSizePt: 14,
              color: '#111111',
              lines: [{ text: line1, xPt: 54, baselinePt: heightPt - 604 }],
            },
            {
              id: 'edit-2',
              fontFamily: 'NotoSansDevanagari',
              fontWeight: 400,
              fontSizePt: 14,
              color: '#111111',
              lines: [{ text: line2, xPt: 54, baselinePt: heightPt - 544 }],
            },
          ],
        },
      ],
      {
        engine,
        loadFontBytes: async (family) => (family === 'NotoSansDevanagari' ? notoBytes : null),
      },
    );

    const exported = await pdfDoc.save();
    const lines = await extractEmbeddedTextLines(exported.slice(), 0);
    const texts = lines.map((l) => l.text);
    expect(texts).toContain(line1);
    expect(texts).toContain(line2);
  });
});
