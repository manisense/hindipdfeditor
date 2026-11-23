import { PDFArray, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFTextField, StandardFonts, decodePDFRawStream } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';

import type { FormWidget, PdfRect } from './pdfForm';
import { fillPdfForm, type AppearanceRequest } from './pdfFormFill';

// 1×1 transparent PNG.
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

async function makeForm() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 300]);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  form.createTextField('name').addToPage(page, { x: 20, y: 240, width: 200, height: 20, font });
  form.createTextField('city').addToPage(page, { x: 20, y: 200, width: 200, height: 20, font });
  form.createCheckBox('agree').addToPage(page, { x: 20, y: 160, width: 12, height: 12 });
  const radio = form.createRadioGroup('gender');
  radio.addOptionToPage('m', page, { x: 20, y: 120, width: 12, height: 12 });
  radio.addOptionToPage('f', page, { x: 60, y: 120, width: 12, height: 12 });
  const state = form.createDropdown('state');
  state.addOptions(['UP', 'MP']);
  state.addToPage(page, { x: 20, y: 80, width: 100, height: 20, font });
  const langs = form.createOptionList('langs');
  langs.addOptions(['Hindi', 'English', 'Urdu']);
  langs.enableMultiselect();
  langs.addToPage(page, { x: 200, y: 40, width: 100, height: 50, font });
  const hindiList = form.createOptionList('hindiList');
  hindiList.addOptions(['a', 'b']);
  hindiList.addToPage(page, { x: 200, y: 200, width: 100, height: 40, font });
  hindiList.acroField.setOptions([
    { value: PDFHexString.fromText('hi'), display: PDFHexString.fromText('हिंदी') },
    { value: PDFHexString.fromText('en'), display: PDFHexString.fromText('अंग्रेज़ी') },
  ]);
  return doc.save();
}

async function rectsOf(bytes: Uint8Array): Promise<Map<string, PdfRect[]>> {
  const rects = new Map<string, PdfRect[]>();
  for (const field of (await PDFDocument.load(bytes)).getForm().getFields()) {
    rects.set(
      field.getName(),
      field.acroField.getWidgets().map((w) => {
        const r = w.getRectangle();
        return [r.x, r.y, r.x + r.width, r.y + r.height];
      }),
    );
  }
  return rects;
}

const base = { kind: 'text', textRotation: 0, page: 0, xPt: 0, yPt: 0, wPt: 0, hPt: 0, readOnly: false, multiline: false, align: 0, fontSizePt: 0, color: '#000000', initial: '' } as const;
const widgetsFor = (r: Map<string, PdfRect[]>): FormWidget[] => [
  { ...base, id: '0:0', field: 'name', label: 'name', pdfRect: r.get('name')![0] },
  { ...base, id: '0:1', field: 'city', label: 'city', pdfRect: r.get('city')![0] },
  { ...base, id: '0:2', field: 'agree', label: 'agree', kind: 'checkbox', pdfRect: r.get('agree')![0], initial: false },
  { ...base, id: '0:3', field: 'gender', label: 'gender', kind: 'radio', pdfRect: r.get('gender')![0] },
  { ...base, id: '0:4', field: 'gender', label: 'gender', kind: 'radio', pdfRect: r.get('gender')![1] },
  { ...base, id: '0:5', field: 'state', label: 'state', kind: 'dropdown', pdfRect: r.get('state')![0], options: [{ value: 'UP', label: 'UP' }, { value: 'MP', label: 'MP' }] },
  {
    ...base,
    id: '0:6',
    field: 'langs',
    label: 'langs',
    kind: 'list',
    multiSelect: true,
    pdfRect: r.get('langs')![0],
    initial: [],
    options: ['Hindi', 'English', 'Urdu'].map((v) => ({ value: v, label: v })),
  },
  {
    ...base,
    id: '0:7',
    field: 'hindiList',
    label: 'hindiList',
    kind: 'list',
    pdfRect: r.get('hindiList')![0],
    initial: [],
    options: [
      { value: 'hi', label: 'हिंदी' },
      { value: 'en', label: 'अंग्रेज़ी' },
    ],
  },
];

describe('fillPdfForm', () => {
  it('stores every answer and draws Hindi through the renderer only', async () => {
    const requests: AppearanceRequest[] = [];
    const render = async (request: AppearanceRequest) => {
      requests.push(request);
      return PNG;
    };
    const source = await makeForm();
    const before = source.slice();
    const result = await fillPdfForm(
      source,
      widgetsFor(await rectsOf(source)),
      { name: 'मनीष शर्मा', city: 'Lucknow', agree: true, gender: '0:4', state: 'MP' },
      { flatten: false },
      render,
    );
    expect(source).toEqual(before);
    expect(result.changed).toBe(5);
    expect(requests.map((r) => [r.text, r.wPt, r.hPt])).toEqual([['मनीष शर्मा', 201, 21]]);

    const doc = await PDFDocument.load(result.bytes);
    const form = doc.getForm();
    expect(form.getTextField('name').getText()).toBe('मनीष शर्मा');
    expect(form.getTextField('city').getText()).toBe('Lucknow');
    expect(form.getCheckBox('agree').isChecked()).toBe(true);
    expect(form.getRadioGroup('gender').getSelected()).toBe('f');
    expect(form.getDropdown('state').getSelected()).toEqual(['MP']);
    expect(form.acroForm.dict.get(PDFName.of('NeedAppearances'))?.toString()).toBe('false');
    const appearance = form.getTextField('name').acroField.getWidgets()[0].getNormalAppearance();
    expect(appearance).toBeDefined();
  });

  it('flattens the answers into the page', async () => {
    const source = await makeForm();
    const result = await fillPdfForm(source, widgetsFor(await rectsOf(source)), { name: 'राम', city: 'Agra' }, { flatten: true }, async () => PNG);
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getForm().getFields()).toHaveLength(0);
    expect(doc.getPageCount()).toBe(1);
  });

  it('cuts answers to the field length limit', async () => {
    const doc = await PDFDocument.load(await makeForm());
    (doc.getForm().getField('city') as PDFTextField).setMaxLength(3);
    const source = await doc.save();
    const result = await fillPdfForm(source, widgetsFor(await rectsOf(source)), { city: 'Lucknow' }, { flatten: false }, async () => PNG);
    expect((await PDFDocument.load(result.bytes)).getForm().getTextField('city').getText()).toBe('Luc');
  });

  it('selects list box choices, with their row numbers', async () => {
    const requests: AppearanceRequest[] = [];
    const source = await makeForm();
    const result = await fillPdfForm(
      source,
      widgetsFor(await rectsOf(source)),
      { langs: ['Hindi', 'Urdu'], hindiList: ['en'] },
      { flatten: false },
      async (request) => {
        requests.push(request);
        return PNG;
      },
    );
    expect(result.changed).toBe(2);
    // Latin choices keep pdf-lib's own list appearance; Hindi ones are drawn by the browser.
    expect(requests.map((r) => [r.text, r.multiline])).toEqual([['अंग्रेज़ी', true]]);
    const form = (await PDFDocument.load(result.bytes)).getForm();
    expect(form.getOptionList('langs').getSelected()).toEqual(['Hindi', 'Urdu']);
    const indices = form.getOptionList('langs').acroField.dict.lookup(PDFName.of('I'), PDFArray);
    expect(indices.asArray().map(String)).toEqual(['0', '2']);
    const hindi = form.getOptionList('hindiList').acroField.getValues().map((v) => (v as PDFHexString).decodeText());
    expect(hindi).toEqual(['en']);
  });

  it('draws a turned field in its own turned box', async () => {
    const doc = await PDFDocument.load(await makeForm());
    const name = doc.getForm().getTextField('name').acroField.getWidgets()[0];
    name.getOrCreateAppearanceCharacteristics().setRotation(90);
    const source = await doc.save();
    const requests: AppearanceRequest[] = [];
    const result = await fillPdfForm(source, widgetsFor(await rectsOf(source)), { name: 'राम' }, { flatten: false }, async (request) => {
      requests.push(request);
      return PNG;
    });
    expect(requests.map((r) => [r.wPt, r.hPt])).toEqual([[21, 201]]);
    const out = await PDFDocument.load(result.bytes);
    const widget = out.getForm().getTextField('name').acroField.getWidgets()[0];
    const stream = out.context.lookup(widget.getNormalAppearance() as never);
    const raw = stream instanceof PDFRawStream ? stream : undefined;
    expect(raw).toBeDefined();
    const content = new TextDecoder().decode(decodePDFRawStream(raw!).decode());
    expect(content).toContain('1 0 0 1 201 0 cm');
    expect(content).toMatch(/^[-0-9.e]+ 1 -1 [-0-9.e]+ 0 0 cm$/m);
  });
});
