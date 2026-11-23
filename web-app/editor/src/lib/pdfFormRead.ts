import { PDFDocument, PDFName, PDFRadioGroup, PDFString, PDFHexString } from '@cantoo/pdf-lib';

import { cssColor, normaliseRect, sameRect, type FormFieldKind, type FormValue, type FormWidget } from './pdfForm';
import { sharedPdfDocument } from './sharedPdfDocument';

/** The parts of pdf.js widget annotation data this module reads. */
type WidgetData = {
  annotationType: number;
  subtype?: string;
  id?: string;
  rect: number[];
  fieldName?: string;
  fieldType?: string;
  fieldValue?: string | string[] | null;
  alternativeText?: string;
  readOnly?: boolean;
  hidden?: boolean;
  checkBox?: boolean;
  radioButton?: boolean;
  pushButton?: boolean;
  exportValue?: string;
  buttonValue?: string | null;
  combo?: boolean;
  multiSelect?: boolean;
  multiLine?: boolean;
  maxLen?: number | null;
  textAlignment?: number | null;
  options?: { exportValue: string; displayValue: string }[];
  defaultAppearanceData?: { fontSize?: number; fontColor?: ArrayLike<number> | null };
};

function kindOf(data: WidgetData): FormFieldKind | null {
  if (data.fieldType === 'Tx') return 'text';
  if (data.fieldType === 'Btn' && data.checkBox) return 'checkbox';
  if (data.fieldType === 'Btn' && data.radioButton) return 'radio';
  if (data.fieldType === 'Ch' && data.combo && !data.multiSelect) return 'dropdown';
  return null;
}

function firstValue(value: WidgetData['fieldValue']): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/** Result of reading a PDF's form. */
export type FormReadResult = {
  widgets: FormWidget[];
  /** Fields this tool cannot fill (list boxes, multi-select lists, signature fields). */
  skipped: number;
};

/**
 * Reads every fillable widget of the PDF, page by page, with its position on the rendered page.
 *
 * @param bytes Bytes of the opened PDF.
 */
export async function readFormWidgets(bytes: Uint8Array): Promise<FormReadResult> {
  const pdf = await sharedPdfDocument(bytes);
  const widgets: FormWidget[] = [];
  const skippedFields = new Set<string>();
  for (let page = 0; page < pdf.numPages; page++) {
    const pdfPage = await pdf.getPage(page + 1);
    const viewport = pdfPage.getViewport({ scale: 1 });
    // pdf.js annotation data is untyped; WidgetData names the fields read here.
    const annotations = (await pdfPage.getAnnotations({ intent: 'display' })) as WidgetData[];
    annotations.forEach((data, index) => {
      if (data.subtype !== 'Widget' || !data.fieldName || data.hidden) return;
      const kind = kindOf(data);
      if (!kind) {
        if (!data.pushButton) skippedFields.add(data.fieldName);
        return;
      }
      const pdfRect = normaliseRect(data.rect);
      const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle(pdfRect);
      const id = `${page}:${index}`;
      const value = firstValue(data.fieldValue);
      let initial: FormValue = value;
      if (kind === 'checkbox') initial = value !== '' && value !== 'Off' && value === data.exportValue;
      if (kind === 'radio') {
        initial = value !== '' && value !== 'Off' && value === data.buttonValue ? id : '';
      }
      const fontSize = data.defaultAppearanceData?.fontSize ?? 0;
      widgets.push({
        id,
        field: data.fieldName,
        kind,
        page,
        xPt: Math.min(vx1, vx2),
        yPt: Math.min(vy1, vy2),
        wPt: Math.abs(vx2 - vx1),
        hPt: Math.abs(vy2 - vy1),
        pdfRect,
        label: data.alternativeText?.trim() || data.fieldName,
        readOnly: Boolean(data.readOnly),
        multiline: Boolean(data.multiLine),
        maxLength: data.maxLen && data.maxLen > 0 ? data.maxLen : undefined,
        align: data.textAlignment === 1 || data.textAlignment === 2 ? data.textAlignment : 0,
        fontSizePt: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 0,
        color: cssColor(data.defaultAppearanceData?.fontColor),
        optionLabel: kind === 'radio' ? (data.buttonValue ?? undefined) : undefined,
        options: kind === 'dropdown' ? (data.options ?? []).map((o) => ({ value: o.exportValue, label: o.displayValue || o.exportValue })) : undefined,
        initial,
      });
    });
    pdfPage.cleanup();
  }
  // A radio group whose chosen button is on a widget we saw: every widget of it starts with that id.
  for (const widget of widgets) {
    if (widget.kind !== 'radio') continue;
    const chosen = widgets.find((w) => w.field === widget.field && w.initial !== '');
    widget.initial = chosen ? chosen.id : '';
  }
  await addAcroFormNames(bytes, widgets);
  return { widgets, skipped: skippedFields.size };
}

/**
 * Fills in what pdf.js leaves out: a tooltip (TU) set on a parent field rather than on the widget,
 * and the names of radio choices kept in the field's /Opt array. Best effort: a file pdf-lib
 * cannot read keeps the pdf.js names.
 */
async function addAcroFormNames(bytes: Uint8Array, widgets: FormWidget[]): Promise<void> {
  try {
    const form = (await PDFDocument.load(bytes.slice(), { ignoreEncryption: true })).getForm();
    for (const field of form.getFields()) {
      const name = field.getName();
      const mine = widgets.filter((w) => w.field === name);
      if (mine.length === 0) continue;
      const tooltip = field.acroField.dict.lookup(PDFName.of('TU'));
      if ((tooltip instanceof PDFString || tooltip instanceof PDFHexString) && tooltip.decodeText().trim()) {
        for (const w of mine) if (w.label === name) w.label = tooltip.decodeText().trim();
      }
      if (!(field instanceof PDFRadioGroup)) continue;
      const options = field.getOptions();
      field.acroField.getWidgets().forEach((widget, i) => {
        const r = widget.getRectangle();
        const match = mine.find((w) => sameRect(w.pdfRect, normaliseRect([r.x, r.y, r.x + r.width, r.y + r.height])));
        if (match && options[i]) match.optionLabel = options[i];
      });
    }
  } catch (err) {
    console.warn('Reading form field names failed', err);
  }
}

/**
 * Starting values by field name, from what the file holds.
 *
 * @param widgets Every widget read from the file.
 */
export function initialValues(widgets: readonly FormWidget[]): Record<string, FormValue> {
  const values: Record<string, FormValue> = {};
  for (const widget of widgets) if (!(widget.field in values)) values[widget.field] = widget.initial;
  return values;
}
