import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PDFDocument,
  StandardFonts,
  TextRenderingMode,
  popGraphicsState,
  pushGraphicsState,
  setTextRenderingMode,
} from '@cantoo/pdf-lib';
import { describe, expect, it, vi } from 'vitest';

// pdfToImages sets GlobalWorkerOptions.workerSrc to an http:// URL under happy-dom; sampleTextLayer
// reads the PDF via sharedPdfDocument directly and does not call pdfToImages.
vi.mock('./pdfToImages', () => ({
  getPageCount: vi.fn(),
  getPageSize: vi.fn(),
  getPdfBytes: vi.fn(),
  renderPage: vi.fn(),
  renderPageCanvas: vi.fn(),
  renderRegion: vi.fn(),
  setPdfBytes: vi.fn(),
}));

import { sampleTextLayer } from './convertPdfToWord';
import {
  hasOnlyInvisibleText,
  isEnglishOcrJunk,
  scanImageCoverage,
  scoreEnglishOcrText,
  type InvisibleTextOps,
} from './invisibleOcrLayer';
import { extractEmbeddedTextLines } from './pdfTextExtract';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, '../../../../mobile-app/fixtures/invisible-english-ocr-fixture.pdf');
const noticeDigitalPath = path.resolve(here, '../../../benchmark/notice-digital.pdf');
const noticeScannedPath = path.resolve(here, '../../../benchmark/notice-scanned.pdf');

// Minimal valid 1x1 white JPEG for synthetic scan PDFs in tests.
const WHITE_JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  ),
  (c) => c.charCodeAt(0),
);

const TEST_OPS: InvisibleTextOps = {
  save: 10,
  restore: 11,
  transform: 12,
  setTextRenderingMode: 38,
  showText: 44,
  showSpacedText: 45,
  nextLineShowText: 46,
  nextLineSetSpacingShowText: 47,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
  paintImageMaskXObject: 83,
  paintImageXObjectRepeat: 88,
};

const glyphs = (text: string) => [...text].map((unicode) => ({ unicode }));

async function makeScanWithTextLayer(
  lines: readonly string[],
  options: { invisible: boolean; imageShare?: number },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const share = options.imageShare ?? 1;
  if (share > 0) {
    const img = await doc.embedJpg(WHITE_JPEG);
    const side = Math.sqrt(share);
    page.drawImage(img, { x: 0, y: 0, width: 595 * side, height: 842 * side });
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.pushOperators(
    pushGraphicsState(),
    setTextRenderingMode(options.invisible ? TextRenderingMode.Invisible : TextRenderingMode.Fill),
  );
  let y = 760;
  for (const text of lines) {
    page.drawText(text, { x: 48, y, size: 11, font });
    y -= 20;
  }
  page.pushOperators(popGraphicsState());
  return new Uint8Array(await doc.save());
}

describe('isEnglishOcrJunk / scoreEnglishOcrText', () => {
  it('keeps real English OCR text, even with realistic OCR typos and abbreviations', () => {
    const realEnglishNotice = [
      'l/?7o564/ 2o?5 In pursuance of the provision of clause (3) of Article 348 of "the constitution of India",',
      'the Govemor is pleased to order the publication of the following English translation of Notification',
      'No.\\oZ IXX-5/25-03(10)2024-T.C-il 12025 Detuailtn, dated 27 January 2025 for general information.',
      'Goverment of Uttarakhand IIome Scction-S NOTIFICATION In exercise of the powers conferred by sub-rule (2)',
      'of rule 1 of The Uniform Civil Code Rules, Uttarakhand, 2025 the Govemor hereby appoints the date',
      '27 January, 2025 as the date on which the said Rules shall come into force. Chief Secretary of Uttarakhand',
      'Additional Chief Secretary/Principal Secretary/Secretary Director General of Police District Magistrates',
      'Inspector General, Stamp and Registration Department,Uttarakhand. Additional Secretary.',
    ].join(' ');
    expect(scoreEnglishOcrText(realEnglishNotice).plausibleShare).toBeGreaterThan(0.8);
    expect(isEnglishOcrJunk(realEnglishNotice)).toBe(false);

    const englishInvoice = [
      'TAX INVOICE Invoice No: INV-2026-00482 Date: 15/11/2026 GSTIN: 09AAACH1234F1Z5 PAN: ABCDE1234F',
      'Customer Name: Rajesh Sharma Address: Sector 18, Noida, Uttar Pradesh Description Quantity Rate Amount',
      'Consulting Services 10 2500.00 25000.00 CGST 9% 2250.00 Total Payable Rs. 29500.00 Bank IFSC: SBIN0001234',
      'Authorized Signatory',
    ].join(' ');
    expect(isEnglishOcrJunk(englishInvoice)).toBe(false);
  });

  it('rejects English-OCR junk produced by scanners on Hindi pages (corpus report samples)', () => {
    const samples = [
      // 03_uppsc_cal (OmniPage / HP Smart Document Scan)
      "wi ict T 3ITl''I FTh 2920/14/Th1/-1/2000-01 LThi qii'ci: f'iiq, 30 11q, 2026 Jc1'ILc1 '3cc1 i1p 1clt 31IHl TT c1-2O26 3II'1Ilc1 c) 'ili1 1T1 1T3fT ct1 CçjU PICIcI :- siwiIci tii fMi L11f 5T 1TT",
      // 11_rj_doit (Canon MFP)
      `t IT tluNeII;T 1!lf6'R r1_a-{r EleYFIfrt ofh rial-t f{+rnr 5.ffi: q.z(zoos)/SdoTr$-& /rowtT / rc / 5126 &g IW tE sqg{, tuno /o/o f /la f g 6r-qfd-q 3TraYI {rw{efl"Io-qe{ cfq vq srefrfl{r +qT d 1Ts-fl ir6'rqm`,
      // 19_hr_1 (HP Smart Document Scan / iLovePDF)
      "6Rqlull *164)14) - iTYRTF - 4 - 81 31f4ftzili, 1984 (6Rqlull 3TrUftzili st) 22 1984) 10 1 14 2013 Oct)=1 - TIIf4d Uct)RIch: 3a - r gziEr a[Un Zif Tr6WZI 0172-2560340 ltaa: 0172-2560332 harcofed@ymail.com",
      // 22_cg_mahatari (Canon MFP)
      `trffig-.'tE qrr{rq qEdT G erd fr-f,rs frrlr +iTrdq, qEr.rft ?rc=L Gn-ed r{rt, =r{r {rqg( (u.T) ::: CITty[ ::: Tfl {qg{, fr=n-fr oz / oz / zozq m-qI.F gw 3-23 / zozs / so : RTw yrNrl rfl{gtrr s-tyT`,
      // 16_uk_ucc p1 (with English digital signature stamp mixed in)
      "03(r0)?024 v 270565/ 202s ERttlIg {FFI T6 3[gqFr-5 riqn lo z / xx-s / 2ffis(rolzoe*-Eo$o-rr tflIq+ fui5 2lqqqfi. zozs s]ft{q-{r qremrd. qqtq ffTfto {itrdT 1i:rqqr+fi vflrq!-s Signed by Shailesh Bagauli Date: 27-01-2025",
      // 28_dist_gbnagar p1 (Adobe Scan calendar: real English months + Hindi holiday table OCR junk)
      "SUN MON TUE WED THU FRI SAT January February March April 1 2 3 4 5 6 7 2026 |*$-B-fhcR 17*quET (4Ie) *-Ga-fbR ga--fMlG/RIqEIT 03GT, 2026 15 5aT, 2026 04 H14, 2026 15 34T4, 2026 28 3441T, 2026 04 fIGHr, 2026 02 344CR, 2026 20 344CqR, 2026 09 Tqgr, 2026 11 graN 2026 24 HqR, 2026 23 iTCRT, 2026 24 GgT, 2026 01 bNgI, 2026 04 hqT, 2026 04 31À 2026 11 344<4R, 2026 19 344cR, 2026 26 344cqr, 2026 31 344¢4, 2026 3T4IG 05,1948 1quT 24.1948 H1G4< 13,1948 3TNAT 28,1948 olfcco 17,1948 CptÍGo 18,1948 ptftco 20,1948 3T9ET4UT 3,1948",
    ];
    for (const sample of samples) {
      expect(isEnglishOcrJunk(sample)).toBe(true);
    }
  });

  it('leaves Devanagari text layers untouched', () => {
    expect(
      isEnglishOcrJunk(`सूचना 6Rqlull *164)14) 31f4ftzili tluNeII;T 1!lf6'R trffig-.'tE qrr{rq ERttlIg {FFI 3[gqFr-5 3441T fIGHr 344CR 344CqR`),
    ).toBe(false);
    expect(
      isEnglishOcrJunk('विद्यालय प्रबंधन समिति, आदर्श नगर। सभी अभिभावकों को सूचित किया जाता है।'),
    ).toBe(false);
  });

  it('is conservative when there are too few word tokens to judge', () => {
    expect(isEnglishOcrJunk('6Rqlull 31f4ftzili tluNeII;T 2026 10 20 30')).toBe(false);
    expect(isEnglishOcrJunk('1 2 3 4 5 6 7 8 9 10 2026')).toBe(false);
  });
});

describe('hasOnlyInvisibleText & scanImageCoverage', () => {
  it('returns true only when all drawn non-whitespace text uses render mode 3', () => {
    expect(
      hasOnlyInvisibleText(
        [TEST_OPS.save, TEST_OPS.setTextRenderingMode, TEST_OPS.showText, TEST_OPS.restore],
        [null, [3], [glyphs('6Rqlull')], null],
        TEST_OPS,
      ),
    ).toBe(true);

    // Mixed visible (mode 0) and invisible (mode 3) -> false
    expect(
      hasOnlyInvisibleText(
        [TEST_OPS.setTextRenderingMode, TEST_OPS.showText, TEST_OPS.setTextRenderingMode, TEST_OPS.showText],
        [[3], [glyphs('6Rqlull')], [0], [glyphs('Visible')]],
        TEST_OPS,
      ),
    ).toBe(false);

    // Restored state back to mode 0 -> visible text -> false
    expect(
      hasOnlyInvisibleText(
        [TEST_OPS.save, TEST_OPS.setTextRenderingMode, TEST_OPS.showText, TEST_OPS.restore, TEST_OPS.showText],
        [null, [3], [glyphs('6Rqlull')], null, [glyphs('Visible')]],
        TEST_OPS,
      ),
    ).toBe(false);

    // Visible text only -> false
    expect(hasOnlyInvisibleText([TEST_OPS.showText], [[glyphs('Plain')]], TEST_OPS)).toBe(false);

    // No text -> false
    expect(hasOnlyInvisibleText([TEST_OPS.setTextRenderingMode], [[3]], TEST_OPS)).toBe(false);
  });

  it('computes union image coverage accurately for full-page, stripped, overlapping, and small images', () => {
    const viewport = {
      width: 595,
      height: 842,
      convertToViewportRectangle: (r: [number, number, number, number]) => [r[0], 842 - r[3], r[2], 842 - r[1]],
    };
    // Full-page single image
    expect(
      scanImageCoverage(
        [TEST_OPS.transform, TEST_OPS.paintImageXObject],
        [[595, 0, 0, 842, 0, 0], ['im0']],
        viewport,
        TEST_OPS,
      ),
    ).toBeCloseTo(1, 3);

    // Two overlapping full-page images (MRC style) should still have union coverage 1.0, not 2.0
    expect(
      scanImageCoverage(
        [TEST_OPS.save, TEST_OPS.transform, TEST_OPS.paintImageXObject, TEST_OPS.restore, TEST_OPS.save, TEST_OPS.transform, TEST_OPS.paintImageXObject, TEST_OPS.restore],
        [null, [595, 0, 0, 842, 0, 0], ['im0'], null, null, [595, 0, 0, 842, 0, 0], ['im1'], null],
        viewport,
        TEST_OPS,
      ),
    ).toBeCloseTo(1, 3);

    // Four horizontal strips covering the page
    const stripFn: number[] = [];
    const stripArgs: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      stripFn.push(TEST_OPS.save, TEST_OPS.transform, TEST_OPS.paintImageXObject, TEST_OPS.restore);
      stripArgs.push(null, [595, 0, 0, 210.5, 0, i * 210.5], [`s${i}`], null);
    }
    expect(scanImageCoverage(stripFn, stripArgs, viewport, TEST_OPS)).toBeCloseTo(1, 3);

    // Small 100x100 logo (~2% of page)
    expect(
      scanImageCoverage(
        [TEST_OPS.transform, TEST_OPS.paintImageXObject],
        [[100, 0, 0, 100, 40, 700], ['logo']],
        viewport,
        TEST_OPS,
      ),
    ).toBeLessThan(0.05);
  });
});

describe('PDF extraction and sampleTextLayer integration', () => {
  it('ignores the invisible English-OCR junk layer on invisible-english-ocr-fixture.pdf and counts it as needing OCR', async () => {
    const bytes = new Uint8Array(fs.readFileSync(fixturePath));
    expect(await extractEmbeddedTextLines(bytes, 0)).toEqual([]);
    expect(await sampleTextLayer(bytes)).toEqual({ pages: 1, sampled: 1, withoutText: 1 });
  });

  it('keeps a real English invisible OCR layer over a full-page scan image', async () => {
    const bytes = await makeScanWithTextLayer(
      [
        'GOVERNMENT OF INDIA Ministry of Education Notice dated 12 November 2026.',
        'All students are informed that the annual examination will be held on Friday at 10:00 AM.',
        'Please bring your identity card and admit card to the main auditorium.',
        'Principal, Model Higher Secondary School',
      ],
      { invisible: true, imageShare: 1 },
    );
    const lines = await extractEmbeddedTextLines(bytes, 0);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.map((l) => l.text).join(' ')).toContain('GOVERNMENT OF INDIA');
    expect(await sampleTextLayer(bytes)).toEqual({ pages: 1, sampled: 1, withoutText: 0 });
  });

  it('keeps visible (mode 0) junk text over a full-page image and invisible junk without a scan image', async () => {
    const junk = [
      `6Rqlull *164)14) 31f4ftzili tluNeII;T 1!lf6'R trffig-.'tE qrr{rq`,
      'ERttlIg {FFI 3[gqFr-5 riqn 2ffis(rolzoe*-Eo$o-rr s]ft{q-{r 3441T fIGHr 344CR 344CqR',
    ];
    const visibleOverImage = await makeScanWithTextLayer(junk, { invisible: false, imageShare: 1 });
    expect((await extractEmbeddedTextLines(visibleOverImage, 0)).length).toBeGreaterThan(0);
    expect((await sampleTextLayer(visibleOverImage)).withoutText).toBe(0);

    const invisibleNoImage = await makeScanWithTextLayer(junk, { invisible: true, imageShare: 0 });
    expect((await extractEmbeddedTextLines(invisibleNoImage, 0)).length).toBeGreaterThan(0);
    expect((await sampleTextLayer(invisibleNoImage)).withoutText).toBe(0);

    const invisibleSmallImage = await makeScanWithTextLayer(junk, { invisible: true, imageShare: 0.25 });
    expect((await extractEmbeddedTextLines(invisibleSmallImage, 0)).length).toBeGreaterThan(0);
    expect((await sampleTextLayer(invisibleSmallImage)).withoutText).toBe(0);
  });

  it('leaves notice-digital.pdf and notice-scanned.pdf unchanged', async () => {
    const digital = new Uint8Array(fs.readFileSync(noticeDigitalPath));
    const digitalLines = await extractEmbeddedTextLines(digital, 0);
    expect(digitalLines.length).toBeGreaterThan(0);
    expect(digitalLines.map((l) => l.text).join(' ')).toContain('विद्यालय प्रबंधन समिति');
    expect(await sampleTextLayer(digital)).toEqual({ pages: 1, sampled: 1, withoutText: 0 });

    const scanned = new Uint8Array(fs.readFileSync(noticeScannedPath));
    expect(await extractEmbeddedTextLines(scanned, 0)).toEqual([]);
    expect(await sampleTextLayer(scanned)).toEqual({ pages: 1, sampled: 1, withoutText: 1 });
  });
});
