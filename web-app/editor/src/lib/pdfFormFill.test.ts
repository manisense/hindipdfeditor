import { PDFDocument, PDFName, PDFTextField, StandardFonts } from '@cantoo/pdf-lib';
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

const base = { kind: 'text', page: 0, xPt: 0, yPt: 0, wPt: 0, hPt: 0, readOnly: false, multiline: false, align: 0, fontSizePt: 0, color: '#000000', initial: '' } as const;
const widgetsFor = (r: Map<string, PdfRect[]>): FormWidget[] => [
  { ...base, id: '0:0', field: 'name', label: 'name', pdfRect: r.get('name')![0] },
  { ...base, id: '0:1', field: 'city', label: 'city', pdfRect: r.get('city')![0] },
  { ...base, id: '0:2', field: 'agree', label: 'agree', kind: 'checkbox', pdfRect: r.get('agree')![0], initial: false },
  { ...base, id: '0:3', field: 'gender', label: 'gender', kind: 'radio', pdfRect: r.get('gender')![0] },
  { ...base, id: '0:4', field: 'gender', label: 'gender', kind: 'radio', pdfRect: r.get('gender')![1] },
  { ...base, id: '0:5', field: 'state', label: 'state', kind: 'dropdown', pdfRect: r.get('state')![0], options: [{ value: 'UP', label: 'UP' }, { value: 'MP', label: 'MP' }] },
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
});
