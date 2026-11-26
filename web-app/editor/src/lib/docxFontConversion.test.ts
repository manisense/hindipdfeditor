import { Document, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { convertDocxFonts, isKrutiDevFamilyFont, NotDocxError } from './docxFontConversion';

async function makeDocx(paragraphs: TextRun[][]): Promise<Uint8Array> {
  const doc = new Document({
    sections: [{ children: paragraphs.map((children) => new Paragraph({ children })) }],
  });
  return new Uint8Array(await (await Packer.toBlob(doc)).arrayBuffer());
}

/** Each run of document.xml as [text, ascii font, cs font, sz, szCs]. */
async function readRuns(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml')!.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  // By local name: happy-dom drops the `w:` prefix of cloned elements (browsers keep it).
  const byName = (root: Document | Element, name: string) =>
    Array.from(root.getElementsByTagName('*')).filter((element) => element.localName === name);
  return byName(doc, 'r')
    .map((run) => {
      const get = (name: string) => byName(run, name)[0] ?? null;
      return {
        text: get('t')?.textContent ?? '',
        ascii: get('rFonts')?.getAttribute('w:ascii') ?? null,
        cs: get('rFonts')?.getAttribute('w:cs') ?? null,
        sz: get('sz')?.getAttribute('w:val') ?? null,
        szCs: get('szCs')?.getAttribute('w:val') ?? null,
      };
    })
    .filter((run) => run.text !== '');
}

describe('convertDocxFonts', () => {
  it('converts Unicode Hindi to KrutiDev and keeps English words in their own font', async () => {
    const input = await makeDocx([
      [new TextRun({ text: 'SSC परीक्षा का प्रमाण पत्र', font: 'Mangal', size: 28 })],
    ]);
    const result = await convertDocxFonts(input, 'unicode-to-krutidev');
    const runs = await readRuns(result.bytes);
    expect(runs.map((run) => run.text).join('')).toBe('SSC ijh{kk dk izek.k i=');
    expect(runs[0]).toMatchObject({ text: 'SSC', ascii: 'Mangal' });
    expect(runs[1]).toMatchObject({ ascii: 'Kruti Dev 010', sz: '28' });
    expect(result.converted).toBe(1);
  });

  it('keeps a syllable together when Word split it across runs', async () => {
    const input = await makeDocx([[new TextRun({ text: 'ह', font: 'Mangal' }), new TextRun({ text: 'िन्', font: 'Mangal' }), new TextRun({ text: 'दी', font: 'Mangal' })]]);
    const result = await convertDocxFonts(input, 'unicode-to-krutidev');
    const runs = await readRuns(result.bytes);
    expect(runs.map((run) => run.text).join('|')).toBe('fg|Unh');
    expect(result.unsupported).toEqual([]);
  });

  it('converts only KrutiDev-font runs to Unicode and sets Mangal with the complex-script size', async () => {
    const input = await makeDocx([
      [
        new TextRun({ text: 'Notice: ', font: 'Arial', size: 24 }),
        new TextRun({ text: 'Hkkjr ljdkj', font: 'Kruti Dev 010', size: 32, bold: true }),
      ],
    ]);
    const result = await convertDocxFonts(input, 'krutidev-to-unicode');
    const runs = await readRuns(result.bytes);
    expect(runs[0]).toMatchObject({ text: 'Notice: ', ascii: 'Arial' });
    expect(runs[1]).toMatchObject({ text: 'भारत सरकार', ascii: 'Mangal', cs: 'Mangal', szCs: '32' });
    expect(result.converted).toBe(1);
  });

  it('moves a ि key typed at the end of a run to the next run', async () => {
    const input = await makeDocx([[new TextRun({ text: 'f', font: 'Kruti Dev 010' }), new TextRun({ text: 'gUnh', font: 'Kruti Dev 010' })]]);
    const runs = await readRuns((await convertDocxFonts(input, 'krutidev-to-unicode')).bytes);
    expect(runs.map((run) => run.text).join('')).toBe('हिन्दी');
  });

  it('reports nothing to convert when no run uses a KrutiDev font', async () => {
    const input = await makeDocx([[new TextRun({ text: 'Hkkjr', font: 'Arial' })]]);
    const result = await convertDocxFonts(input, 'krutidev-to-unicode');
    expect(result.converted).toBe(0);
    expect((await readRuns(result.bytes))[0].text).toBe('Hkkjr');
  });

  it('rejects files that are not .docx', async () => {
    await expect(convertDocxFonts(new TextEncoder().encode('%PDF-1.7'), 'unicode-to-krutidev')).rejects.toBeInstanceOf(NotDocxError);
  });

  it.each([
    ['Kruti Dev 010', true],
    ['KrutiDev010', true],
    ['DevLys 010', true],
    ['Kruti_Dev_040_Wide', true],
    ['Mangal', false],
    ['Chanakya', false],
  ])('isKrutiDevFamilyFont(%s)', (name, expected) => {
    expect(isKrutiDevFamilyFont(name)).toBe(expected);
  });
});
