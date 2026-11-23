import {
  adjustDimsForRotation,
  componentsToColor,
  degrees,
  drawImage,
  drawRectangle,
  PDFBool,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFHexString,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  popGraphicsState,
  pushGraphicsState,
  reduceRotation,
  rotateInPlace,
  StandardFonts,
  type PDFFont,
  type PDFWidgetAnnotation,
} from '@cantoo/pdf-lib';

import { changedFields, isLatinOnly, normaliseRect, sameRect, type FormValue, type FormWidget } from './pdfForm';
import { validatePdfBytes } from './pdfValidation';

/** What a field's answer should look like, for {@link AppearanceRenderer}. */
export type AppearanceRequest = {
  text: string;
  /** Field size, in pt. */
  wPt: number;
  hPt: number;
  /** Font size, in pt; 0 means fit to the box. */
  fontSizePt: number;
  multiline: boolean;
  align: 0 | 1 | 2;
  color: string;
};

/**
 * Draws an answer the size of its field, as PNG bytes. In the app this is the browser's own text
 * rendering (Plan A: Devanagari is shaped by the browser, never by pdf-lib).
 */
export type AppearanceRenderer = (request: AppearanceRequest) => Promise<Uint8Array>;

export type FillOptions = {
  /** Draw the answers into the pages and remove the fields, so they can no longer be changed. */
  flatten: boolean;
};

/** Result of filling: the new file, and how many fields changed. */
export type FillResult = { bytes: Uint8Array; changed: number };

function widgetRect(widget: PDFWidgetAnnotation) {
  const r = widget.getRectangle();
  return normaliseRect([r.x, r.y, r.x + r.width, r.y + r.height]);
}

/**
 * Fills a PDF form and returns a new file; the source bytes are not changed. Answers that the
 * standard Helvetica font can encode get pdf-lib's own vector appearance; every other answer
 * (Hindi) gets an appearance drawn by `render`, and the field still stores the typed Unicode text
 * as its value. XFA data is removed so viewers show the filled AcroForm fields.
 *
 * @param bytes Bytes of the original PDF.
 * @param widgets Every widget read from the file (see `readFormWidgets`).
 * @param values Current values by field name.
 */
export async function fillPdfForm(
  bytes: Uint8Array,
  widgets: readonly FormWidget[],
  values: Readonly<Record<string, FormValue>>,
  options: FillOptions,
  render: AppearanceRenderer,
): Promise<FillResult> {
  const doc = await PDFDocument.load(bytes.slice());
  const form = doc.getForm();
  if (form.hasXFA()) form.deleteXFA();
  let helvetica: PDFFont | null = null;
  const latinFont = async () => (helvetica ??= await doc.embedFont(StandardFonts.Helvetica));
  let drewImages = false;

  const imageAppearance = async (widget: PDFWidgetAnnotation, request: Omit<AppearanceRequest, 'wPt' | 'hPt'>) => {
    const [x1, y1, x2, y2] = widgetRect(widget);
    const rect = { width: x2 - x1, height: y2 - y1 };
    // A field turned by MK /R is drawn in its own turned box, as pdf-lib and viewers do.
    const look = widget.getAppearanceCharacteristics();
    const rotation = reduceRotation(look?.getRotation());
    const { width: wPt, height: hPt } = adjustDimsForRotation(rect, rotation);
    const png = await render({ ...request, wPt, hPt });
    const image = await doc.embedPng(png);
    const name = doc.context.addRandomSuffix('Answer', 10);
    // Keep the field's own background and border (MK, BS) under the answer, as viewers draw them.
    const background = componentsToColor(look?.getBackgroundColor());
    const borderColor = componentsToColor(look?.getBorderColor());
    const borderWidth = borderColor ? (widget.getBorderStyle()?.getWidth() ?? 1) : 0;
    const frame =
      background || (borderColor && borderWidth > 0)
        ? drawRectangle({
            x: borderWidth / 2,
            y: borderWidth / 2,
            width: wPt - borderWidth,
            height: hPt - borderWidth,
            color: background,
            borderColor: borderWidth > 0 ? borderColor : undefined,
            borderWidth,
            rotate: degrees(0),
            xSkew: degrees(0),
            ySkew: degrees(0),
          })
        : [];
    const stream = doc.context.formXObject(
      [
        pushGraphicsState(),
        ...rotateInPlace({ ...rect, rotation }),
        ...frame,
        ...drawImage(name, { x: 0, y: 0, width: wPt, height: hPt, rotate: degrees(0), xSkew: degrees(0), ySkew: degrees(0) }),
        popGraphicsState(),
      ],
      {
        Resources: { XObject: { [name]: image.ref } },
        BBox: doc.context.obj([0, 0, rect.width, rect.height]),
        Matrix: doc.context.obj([1, 0, 0, 1, 0, 0]),
      },
    );
    widget.setNormalAppearance(doc.context.register(stream));
    drewImages = true;
  };

  const styleOf = (name: string, widget: PDFWidgetAnnotation) => {
    const rect = widgetRect(widget);
    return widgets.find((w) => w.field === name && sameRect(w.pdfRect, rect)) ?? widgets.find((w) => w.field === name);
  };

  const changed = changedFields(widgets, values);
  for (const [name, value] of changed) {
    const field = form.getFieldMaybe(name);
    if (!field) continue;
    if (field instanceof PDFTextField && typeof value === 'string') {
      const max = field.getMaxLength();
      const text = max === undefined ? value : Array.from(value).slice(0, max).join('');
      let drawn = false;
      if (isLatinOnly(text)) {
        try {
          field.setText(text);
          field.updateAppearances(await latinFont());
          drawn = true;
        } catch (err) {
          // A field without a usable default appearance: the browser draws the answer instead.
          console.warn('Vector appearance failed for', name, err);
        }
      }
      if (!drawn) {
        field.acroField.setValue(PDFHexString.fromText(text));
        for (const widget of field.acroField.getWidgets()) {
          const style = styleOf(name, widget);
          await imageAppearance(widget, {
            text,
            fontSizePt: style?.fontSizePt ?? 0,
            multiline: field.isMultiline(),
            align: style?.align ?? 0,
            color: style?.color ?? '#000000',
          });
        }
      }
    } else if (field instanceof PDFCheckBox && typeof value === 'boolean') {
      if (value) field.check();
      else field.uncheck();
      if (field.needsAppearancesUpdate()) field.updateAppearances();
    } else if (field instanceof PDFRadioGroup && typeof value === 'string') {
      const chosen = widgets.find((w) => w.id === value);
      const widget = chosen && field.acroField.getWidgets().find((w) => sameRect(widgetRect(w), chosen.pdfRect));
      const onValue = widget?.getOnValue();
      if (onValue) field.acroField.setValue(onValue);
      else field.acroField.setValue(PDFName.of('Off'));
      if (field.needsAppearancesUpdate()) field.updateAppearances();
    } else if (field instanceof PDFOptionList && Array.isArray(value)) {
      const options = widgets.find((w) => w.field === name)?.options ?? [];
      const chosen = options.filter((o) => value.includes(o.value));
      field.acroField.setValues(chosen.map((o) => PDFHexString.fromText(o.value)));
      // /I lists the selected rows; viewers that read it would otherwise show the old choice.
      const indices = options.flatMap((o, i) => (value.includes(o.value) ? [i] : []));
      if (indices.length > 0) field.acroField.dict.set(PDFName.of('I'), doc.context.obj(indices));
      else field.acroField.dict.delete(PDFName.of('I'));
      if (options.every((o) => o.label === o.value && isLatinOnly(o.label))) {
        field.updateAppearances(await latinFont());
      } else {
        // The browser draws the selected choices, one per line (Plan A: no Hindi through pdf-lib).
        for (const widget of field.acroField.getWidgets()) {
          const style = styleOf(name, widget);
          await imageAppearance(widget, { text: chosen.map((o) => o.label).join('\n'), fontSizePt: style?.fontSizePt ?? 0, multiline: true, align: style?.align ?? 0, color: style?.color ?? '#000000' });
        }
      }
    } else if (field instanceof PDFDropdown && typeof value === 'string') {
      field.acroField.setValues([PDFHexString.fromText(value)]);
      const option = widgets.find((w) => w.field === name)?.options?.find((o) => o.value === value);
      const label = option?.label ?? value;
      if (label === value && isLatinOnly(label)) {
        field.updateAppearances(await latinFont());
      } else {
        for (const widget of field.acroField.getWidgets()) {
          const style = styleOf(name, widget);
          await imageAppearance(widget, { text: label, fontSizePt: style?.fontSizePt ?? 0, multiline: false, align: 0, color: style?.color ?? '#000000' });
        }
      }
    }
  }

  // Viewers that rebuild appearances themselves would redraw the Hindi answers without shaping.
  if (drewImages) form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.False);
  if (options.flatten) form.flatten({ updateFieldAppearances: false });
  const out = await doc.save({ updateFieldAppearances: false });
  await validatePdfBytes(out, doc.getPageCount());
  return { bytes: out, changed: changed.size };
}
