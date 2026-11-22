// Writes mobile-app/fixtures/faux-bold-fixture.pdf: Latin lines emboldened the way Word does for a
// font with no bold face (text render mode 2, fill and stroke, with a line width of a few
// hundredths of the font size), next to a regular line and a real bold face. Latin only: pdf-lib
// cannot shape Devanagari, and the stroke is read and repainted the same way for every script.
//   node web-app/scripts/make-faux-bold-fixture.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pdfLib = await import(path.join(here, "../editor/node_modules/@cantoo/pdf-lib/es/index.js"));
const { PDFDocument, StandardFonts, TextRenderingMode, popGraphicsState, pushGraphicsState, setLineWidth, setTextRenderingMode } = pdfLib;

const SIZE_PT = 16;
const lines = [
  { text: "Regular line of sample words here", strokeEm: 0 },
  { text: "Faux bold line of sample words here", strokeEm: 0.025 },
  { text: "Heavy faux bold line of sample words", strokeEm: 0.05 },
];

const doc = await PDFDocument.create();
doc.setCreationDate(new Date("2026-11-23T00:00:00Z"));
doc.setModificationDate(new Date("2026-11-23T00:00:00Z"));
const page = doc.addPage([595, 842]);
const regular = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
let y = 760;
for (const { text, strokeEm } of lines) {
  page.pushOperators(
    pushGraphicsState(),
    setTextRenderingMode(strokeEm ? TextRenderingMode.FillAndOutline : TextRenderingMode.Fill),
    setLineWidth(strokeEm * SIZE_PT),
  );
  page.drawText(text, { x: 60, y, size: SIZE_PT, font: regular });
  page.pushOperators(popGraphicsState());
  y -= 50;
}
page.drawText("Real bold line of sample words here", { x: 60, y, size: SIZE_PT, font: bold });

const out = path.join(here, "../../mobile-app/fixtures/faux-bold-fixture.pdf");
fs.writeFileSync(out, await doc.save());
console.log("wrote", out);
