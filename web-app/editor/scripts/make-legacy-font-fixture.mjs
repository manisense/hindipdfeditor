// Generates mobile-app/fixtures/legacy-krutidev-fixture.pdf: a stand-in for a Kruti Dev PDF.
// Real Kruti Dev files store Hindi as ASCII ("d`fr nso" = कृति देव) in a font named
// KrutiDev010. We can't ship the proprietary font, so the text is drawn in Helvetica and the
// font's BaseFont is renamed; the legacy-font detector keys on that name, exactly as it would
// on a real file. Run from web-app/editor: node scripts/make-legacy-font-fixture.mjs
import { writeFileSync } from 'node:fs';
import { PDFDict, PDFDocument, PDFName, StandardFonts } from '@cantoo/pdf-lib';

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const page = doc.addPage([595, 842]);
page.drawText('d`fr nso 010 & ,d uewuk nLrkost', { x: 60, y: 760, size: 18, font });
page.drawText('(Kruti Dev encoded text: shows as Latin letters without the font)', {
  x: 60, y: 730, size: 10, font,
});
// pdf-lib writes the font dict at save time, so rename it on a reloaded copy.
const reloaded = await PDFDocument.load(await doc.save({ useObjectStreams: false }));
const fonts = reloaded.getPage(0).node.Resources().lookup(PDFName.of('Font'), PDFDict);
for (const [, ref] of fonts.entries()) {
  reloaded.context.lookup(ref, PDFDict).set(PDFName.of('BaseFont'), PDFName.of('KrutiDev010'));
}
writeFileSync(
  new URL('../../../mobile-app/fixtures/legacy-krutidev-fixture.pdf', import.meta.url),
  await reloaded.save({ useObjectStreams: false }),
);
console.log('wrote legacy-krutidev-fixture.pdf');
