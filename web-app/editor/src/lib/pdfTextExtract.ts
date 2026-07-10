import * as pdfjs from 'pdfjs-dist';

import type { OcrLine } from '../state/editStore';

type TextRun = {
  text: string;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
};

const LINE_Y_TOLERANCE_RATIO = 0.55;

/**
 * Extracts selectable text runs from an embedded (non-scanned) PDF page via pdf.js, converted
 * into reading-order line boxes in PDF points (top-left origin, same space as `OcrLine`).
 *
 * Prefer this over Tesseract for Word/exported digital PDFs — coordinates match the real text
 * layer. Returns an empty array when the page has no extractable text (image-only scans).
 *
 * @param pdfBytes Full PDF file bytes.
 * @param pageIndex Zero-based page index.
 */
export async function extractEmbeddedTextLines(
  pdfBytes: Uint8Array,
  pageIndex: number,
): Promise<OcrLine[]> {
  const doc = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
  try {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const runs: TextRun[] = [];

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const text = item.str.replace(/\s+/g, ' ').trim();
      if (text.length === 0) continue;

      const [, , , , pdfX, pdfY] = item.transform;
      const fontHeightPdf = Math.max(4, Math.hypot(item.transform[2], item.transform[3]));
      const xScale = Math.max(0.01, Math.hypot(item.transform[0], item.transform[1]));
      const wPdf = Math.max(fontHeightPdf * 0.35, item.width * xScale);

      // convertToViewport* maps PDF bottom-left space → top-left viewport (pt at scale 1).
      const [xPt, baselineY] = viewport.convertToViewportPoint(pdfX, pdfY);
      const [, topY] = viewport.convertToViewportPoint(pdfX, pdfY + fontHeightPdf);
      const yPt = Math.min(baselineY, topY);
      const hPt = Math.abs(baselineY - topY) * 1.1;
      const wPt = wPdf * viewport.scale;

      runs.push({
        text,
        xPt,
        yPt: Math.max(0, yPt),
        wPt: Math.max(4, wPt),
        hPt: Math.max(4, hPt),
      });
    }

    return clusterRunsIntoLines(runs).map((line) => ({
      id: crypto.randomUUID(),
      text: line.text,
      xPt: line.xPt,
      yPt: line.yPt,
      wPt: line.wPt,
      hPt: line.hPt,
    }));
  } finally {
    await doc.destroy();
  }
}

/** Groups nearby pdf.js text runs into line-level boxes for tap-to-edit. */
function clusterRunsIntoLines(runs: TextRun[]): TextRun[] {
  if (runs.length === 0) return [];

  const sorted = runs.slice().sort((a, b) => a.yPt - b.yPt || a.xPt - b.xPt);
  const lines: TextRun[][] = [];

  for (const run of sorted) {
    const last = lines[lines.length - 1];
    if (!last) {
      lines.push([run]);
      continue;
    }
    const sample = last[0];
    const yTol = Math.max(3, sample.hPt * LINE_Y_TOLERANCE_RATIO);
    const sameLine = Math.abs(run.yPt + run.hPt / 2 - (sample.yPt + sample.hPt / 2)) <= yTol;
    if (sameLine) last.push(run);
    else lines.push([run]);
  }

  return lines.map((group) => {
    const ordered = group.slice().sort((a, b) => a.xPt - b.xPt);
    const xPt = Math.min(...ordered.map((r) => r.xPt));
    const yPt = Math.min(...ordered.map((r) => r.yPt));
    const right = Math.max(...ordered.map((r) => r.xPt + r.wPt));
    const bottom = Math.max(...ordered.map((r) => r.yPt + r.hPt));
    return {
      text: ordered.map((r) => r.text).join(' ').replace(/\s+/g, ' ').trim(),
      xPt,
      yPt,
      wPt: Math.max(4, right - xPt),
      hPt: Math.max(4, bottom - yPt),
    };
  });
}
