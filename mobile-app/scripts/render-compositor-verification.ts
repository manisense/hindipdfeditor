import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { documentHtml } from '../src/lib/htmlCompositor';
import type { DocumentState, PageState, TextEdit } from '../src/state/editStore';

async function main() {
  const [backgroundPath, outputDirectory, documentFontPath, documentFontFamily = 'Mukta'] =
    process.argv.slice(2);
  if (!backgroundPath || !outputDirectory || !documentFontPath) {
    throw new Error(
      'Usage: render-compositor-verification <background.jpg> <output-directory> <document-font.ttf>',
    );
  }

  await mkdir(outputDirectory, { recursive: true });
  const [backgroundBase64, sansBase64, documentFontBase64] = await Promise.all([
    readFile(resolve(backgroundPath), 'base64'),
    readFile(resolve('assets/fonts/NotoSansDevanagari-Variable.ttf'), 'base64'),
    readFile(resolve(documentFontPath), 'base64'),
  ]);

  for (let index = 0; index < 3; index++) {
    const fontFamily =
      index % 2 === 0 ? 'NotoSansDevanagari' : (documentFontFamily as TextEdit['fontFamily']);
    const edit: TextEdit = {
      type: 'text',
      id: `verification-${index}`,
      page: 0,
      xPt: 72,
      yPt: 620 + index * 18,
      fontSizePt: 18,
      text: `पृष्ठ ${index + 1}: धर्म क्षेत्र ज्ञान सूर्य`,
      color: '#1843DD',
      fontFamily,
      widthPt: 300,
    };
    const page: PageState = {
      pageIndex: 0,
      widthPt: 612,
      heightPt: 792,
      backgroundImageUri: backgroundPath,
      imagePxWidth: 1836,
      imagePxHeight: 2376,
      edits: [edit],
      ocrLines: [],
    };
    const doc: DocumentState = {
      sourceUri: 'verification.pdf',
      pageCount: 1,
      pages: [page],
      legacyFontWarnings: [],
    };
    const html = documentHtml(
      doc,
      fontFamily === 'NotoSansDevanagari'
        ? { NotoSansDevanagari: { base64: sansBase64, cssFontWeight: '100 900' } }
        : { [fontFamily]: { base64: documentFontBase64, cssFontWeight: '400' } },
      [`data:image/jpeg;base64,${backgroundBase64}`],
    );
    await writeFile(resolve(outputDirectory, `page-${index + 1}.html`), html, 'utf8');
  }
}

void main();
