import * as fs from 'node:fs';
import * as path from 'node:path';
import { PDFDict, PDFDocument, PDFName, StandardFonts } from '@cantoo/pdf-lib';
import { detectLegacyFonts, isLegacyDevanagariFontName } from './legacyFontDetector';

const FIXTURE_PATH = path.join(__dirname, '..', '..', 'fixtures', 'devanagari-fixture.pdf');

describe('isLegacyDevanagariFontName', () => {
  const legacyExamples = [
    'KrutiDev010',
    'ABCDEF+KrutiDev060 Bold',
    'Shivaji01',
    'Chanakya',
    'DevLys010',
    'Walkman-Chanakya',
    'Agra',
    'AgraBold',
    'Amar',
    'ABCDEF+Amar-Bold',
  ];

  it.each(legacyExamples)('flags %s as a legacy font name', (fontName) => {
    expect(isLegacyDevanagariFontName(fontName)).toBe(true);
  });

  const unicodeExamples = [
    'NotoSansDevanagari-Regular',
    'ABCDEF+NotoSansDevanagari-Regular',
    'ABCDEF+KohinoorDevanagari-Regular',
    'Helvetica',
    'Times-Roman',
    'ABCDEF+Times-Roman',
    'ArialMT',
  ];

  it.each(unicodeExamples)('does not flag %s as a legacy font name', (fontName) => {
    expect(isLegacyDevanagariFontName(fontName)).toBe(false);
  });

  it('matches case-insensitively', () => {
    expect(isLegacyDevanagariFontName('krutidev010')).toBe(true);
    expect(isLegacyDevanagariFontName('KRUTIDEV010')).toBe(true);
  });

  it('matches by prefix, not by unrelated substring', () => {
    // "Amar" is a known-legacy prefix, but a font that merely *contains* it elsewhere
    // in its name (not at the start, once the subset tag is stripped) should not match.
    expect(isLegacyDevanagariFontName('ABCDEF+NotAmarFont')).toBe(false);
  });
});

describe('detectLegacyFonts', () => {
  it('finds no legacy fonts in the real Unicode fixture (Noto/Kohinoor Devanagari)', async () => {
    const bytes = fs.readFileSync(FIXTURE_PATH);
    const warnings = await detectLegacyFonts(new Uint8Array(bytes));
    expect(warnings).toEqual([]);
  });

  it('flags a page whose embedded font BaseFont matches a legacy pattern', async () => {
    // Build a minimal real PDF, then rename its embedded font's BaseFont to simulate a
    // legacy-encoded document - @cantoo/pdf-lib only resolves object references reliably
    // after a save/reload roundtrip, which also mirrors how a real file is actually read.
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('test', { x: 50, y: 50, size: 12, font });
    const reloaded = await PDFDocument.load(await doc.save());

    const resources = reloaded.getPages()[0].node.Resources()!;
    const fontDict = resources.lookupMaybe(PDFName.of('Font'), PDFDict)!;
    const [, ref] = fontDict.entries()[0];
    const resolvedFontDict = reloaded.context.lookup(ref, PDFDict);
    resolvedFontDict.set(PDFName.of('BaseFont'), PDFName.of('ABCDEF+KrutiDev010'));

    const finalBytes = await reloaded.save();
    const warnings = await detectLegacyFonts(finalBytes);

    expect(warnings).toEqual([{ page: 0, fontName: 'ABCDEF+KrutiDev010' }]);
  });

  it('does not flag an unrelated standard font', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('hello', { x: 50, y: 50, size: 12, font });
    const bytes = await doc.save();

    const warnings = await detectLegacyFonts(bytes);
    expect(warnings).toEqual([]);
  });

  it('accepts a base64-encoded string, the shape App.tsx actually reads from disk', async () => {
    // App.tsx reads a picked document via expo-file-system's Base64 encoding (same pattern
    // exportPdf.ts already uses for its own re-parse check) rather than a raw Uint8Array -
    // covering that exact input shape here, not just Uint8Array/Buffer.
    const bytes = fs.readFileSync(FIXTURE_PATH);
    const warnings = await detectLegacyFonts(bytes.toString('base64'));
    expect(warnings).toEqual([]);
  });
});
