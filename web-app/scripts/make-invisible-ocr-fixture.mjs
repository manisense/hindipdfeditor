// Writes mobile-app/fixtures/invisible-english-ocr-fixture.pdf: copies
// web-app/benchmark/notice-scanned.pdf (a scanned Hindi notice) and adds an invisible (3 Tr)
// Helvetica text layer of English-OCR-style junk over its page image, reproducing what scanners
// and mobile apps (OmniPage, Canon MFPs, HP Smart Document Scan, Adobe Scan) produce when their
// OCR language defaults to English on a Hindi scan.
//   node web-app/scripts/make-invisible-ocr-fixture.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pdfLib = await import(path.join(here, "../editor/node_modules/@cantoo/pdf-lib/es/index.js"));
const { PDFDocument, StandardFonts, TextRenderingMode, popGraphicsState, pushGraphicsState, setTextRenderingMode } = pdfLib;

const sourcePath = path.join(here, "../benchmark/notice-scanned.pdf");
const outPath = path.join(here, "../../mobile-app/fixtures/invisible-english-ocr-fixture.pdf");

// Realistic English-only OCR junk over the scanned Hindi notice (ASCII only; never draws
// Devanagari with pdf-lib).
const junkLines = [
  "tluNeII;T 1!lf6'R - 3ITl''I FTh / Sample document for testing only",
  "LThi",
  "6Rqlull *164)14) 31f4ftzili, 3TrUftzili qrr{rq",
  "qii'ci: f'iiq./2026/47",
  'f\'iiq: 12/11/2026',
  'r1_a-{r EleYFIfrt ofh rial-t f{+rnr 6r-qfd-q 3TraYI {rw{efl"Io-qe{ cfq vq srefrfl{r +qT d 1Ts-fl ir6\'rqm',
  "trffig-.'tE qrr{rq erd fr-f,rs fqqrq 28 11q, 2026 q-t{r< qrrtr{{R 10 f'iiq, fu+i ftqr",
  "ERttlIg {FFI 3[gqFr-5 riqn 9 d 12 2ffis(rolzoe*-Eo$o-rr tflIq+ fui5 2lqqqfi s]ft{q-{r qqtq ffTfto",
  "sqfrqq (z) em q-{f, effit 6T sqtT 6{A'gs zz qrqfr 3441T fIGHr 344CR 344CqR Tqgr graN",
  "iTYRTF 10:00 TIIf4d Uct)RIch",
  "3T4IG 11:30 H1G4< 3tf10",
  "3TNAT 01:00 olfcco ptftco",
  "3T9ET4UT fMGqR 98765 43210 HHIR Tq4R oIftc WhatsApp fIRR 3TIBIU |*$-B-fhcR *-Ga-fbR",
  "qRRrE-or ffiTrft Tfr frsTr",
  'u-$s.ra q-tqr d r+r.Trfu"fi qcnT',
];

const sourceBytes = fs.readFileSync(sourcePath);
const doc = await PDFDocument.load(sourceBytes);
doc.setCreationDate(new Date("2026-11-27T00:00:00Z"));
doc.setModificationDate(new Date("2026-11-27T00:00:00Z"));
const page = doc.getPage(0);
const font = await doc.embedFont(StandardFonts.Helvetica);

let y = 760;
page.pushOperators(pushGraphicsState(), setTextRenderingMode(TextRenderingMode.Invisible));
for (const text of junkLines) {
  page.drawText(text, { x: 48, y, size: 11, font });
  y -= 42;
}
page.pushOperators(popGraphicsState());

fs.writeFileSync(outPath, await doc.save());
console.log("wrote", outPath);
