/** Kinds of form field this app fills. List boxes, push buttons and signature fields are skipped. */
export type FormFieldKind = 'text' | 'checkbox' | 'radio' | 'dropdown';

/** Rectangle in PDF user space (pt, bottom-left origin), normalised so x1 < x2 and y1 < y2. */
export type PdfRect = [number, number, number, number];

/** One widget (the box on the page) of a fillable form field. */
export type FormWidget = {
  /** Unique per widget: `page:index`. */
  id: string;
  /** Fully qualified field name; widgets of one field share it and its value. */
  field: string;
  kind: FormFieldKind;
  /** Zero-based page index. */
  page: number;
  /** Position on the page in editor space (pt, top-left origin, page rotation applied). */
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  /** The widget's own rectangle, to find it again when writing. */
  pdfRect: PdfRect;
  /** The field's tooltip (TU) when it has one, else its name. */
  label: string;
  readOnly: boolean;
  multiline: boolean;
  /** Maximum characters, for text fields that set one. */
  maxLength?: number;
  /** 0 left, 1 centre, 2 right. */
  align: 0 | 1 | 2;
  /** Font size from the field's default appearance, in pt; 0 means "fit to the box". */
  fontSizePt: number;
  /** Text colour from the default appearance, as `#rrggbb`. */
  color: string;
  /** For a radio button: the name of its choice (its export value). */
  optionLabel?: string;
  /** Dropdown choices. */
  options?: { value: string; label: string }[];
  /** Value when the file was opened (see {@link FormValue}). */
  initial: FormValue;
};

/**
 * A field's value: text or the chosen option's export value for text fields and dropdowns,
 * on/off for check boxes, and the chosen widget's `id` (or '') for radio groups.
 */
export type FormValue = string | boolean;

/** Inner margin between a field's border and its text, in pt. */
export const FIELD_PADDING_PT = 2;
/** Smallest font size a long answer is shrunk to, in pt. */
export const MIN_FIELD_FONT_PT = 4;

/**
 * Whether the text can be drawn with the PDF standard Helvetica font (WinAnsi encoding). Such
 * answers keep a vector, selectable appearance; anything else (Devanagari above all) is shaped
 * and drawn by the browser instead (Plan A).
 */
export function isLatinOnly(text: string): boolean {
  return /^[\t\n\r\x20-\x7E\u00A0-\u00FF]*$/u.test(text);
}

/**
 * Font size for an answer in a field whose appearance says "auto" (size 0).
 *
 * @param heightPt Field height, in pt.
 * @param multiline Whether the field wraps onto several lines.
 * @returns Font size, in pt.
 */
export function autoFontSizePt(heightPt: number, multiline: boolean): number {
  if (multiline) return 10;
  return Math.max(MIN_FIELD_FONT_PT, Math.min(12, heightPt * 0.55));
}

/**
 * Font size that makes one line of text fit its field.
 *
 * @param fontSizePt Wanted size, in pt.
 * @param textWidthPt Width of the text at that size, in pt.
 * @param textHeightPt Height of its line box at that size, in pt.
 * @param fieldWidthPt Field width, in pt.
 * @param fieldHeightPt Field height, in pt.
 * @returns The wanted size, or a smaller one (never below {@link MIN_FIELD_FONT_PT}), in pt.
 */
export function fitFontSizePt(
  fontSizePt: number,
  textWidthPt: number,
  textHeightPt: number,
  fieldWidthPt: number,
  fieldHeightPt: number,
): number {
  const room = Math.max(1, fieldWidthPt - 2 * FIELD_PADDING_PT);
  const byWidth = textWidthPt > room ? room / textWidthPt : 1;
  const byHeight = textHeightPt > fieldHeightPt ? fieldHeightPt / textHeightPt : 1;
  return Math.max(MIN_FIELD_FONT_PT, fontSizePt * Math.min(byWidth, byHeight));
}

/**
 * Smaller font size for wrapped text that is taller than its field. Text area grows with the
 * square of the size, so the size shrinks by the square root of the overflow (a little more, so
 * the passes converge).
 *
 * @param fontSizePt Current size, in pt.
 * @param textHeightPt Height of the wrapped text at that size, in pt.
 * @param fieldHeightPt Field height, in pt.
 * @returns A smaller size when the text overflows, else `fontSizePt`; never below {@link MIN_FIELD_FONT_PT}.
 */
export function fitWrappedFontSizePt(fontSizePt: number, textHeightPt: number, fieldHeightPt: number): number {
  const room = Math.max(1, fieldHeightPt - 2 * FIELD_PADDING_PT);
  if (textHeightPt <= room || fontSizePt <= MIN_FIELD_FONT_PT) return fontSizePt;
  return Math.max(MIN_FIELD_FONT_PT, fontSizePt * Math.sqrt(room / textHeightPt) * 0.95);
}

/**
 * Where a laid-out answer goes inside its field: aligned horizontally, centred vertically when it
 * is one line, from the top when it wraps.
 *
 * @param field Field size, in pt.
 * @param text Size of the laid-out text (without padding), in pt.
 * @returns Top-left of the text inside the field, in pt from the field's top-left.
 */
export function placeInField(
  field: { wPt: number; hPt: number },
  text: { wPt: number; hPt: number },
  align: 0 | 1 | 2,
  multiline: boolean,
): { xPt: number; yPt: number } {
  const xPt =
    align === 1
      ? (field.wPt - text.wPt) / 2
      : align === 2
        ? field.wPt - FIELD_PADDING_PT - text.wPt
        : FIELD_PADDING_PT;
  const yPt = multiline ? FIELD_PADDING_PT : (field.hPt - text.hPt) / 2;
  return { xPt: Math.max(multiline ? FIELD_PADDING_PT : 0, xPt), yPt };
}

/**
 * Whether two PDF rectangles are the same widget box.
 *
 * @param a Rectangle, in pt.
 * @param b Rectangle, in pt.
 * @param tolerancePt Allowed difference per edge, in pt.
 */
export function sameRect(a: PdfRect, b: PdfRect, tolerancePt = 0.5): boolean {
  return a.every((value, i) => Math.abs(value - b[i]) <= tolerancePt);
}

/**
 * Normalises a rectangle so its first corner is the lower-left one.
 *
 * @param rect `[x1, y1, x2, y2]` in pt, corners in any order.
 */
export function normaliseRect(rect: readonly number[]): PdfRect {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = rect;
  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
}

/**
 * CSS colour for a default-appearance colour.
 *
 * @param rgb Red, green and blue, 0–255 each, or null when the field sets none.
 */
export function cssColor(rgb: ArrayLike<number> | null | undefined): string {
  if (!rgb || rgb.length < 3) return '#000000';
  return `#${Array.from({ length: 3 }, (_, i) => Math.round(Math.min(255, Math.max(0, rgb[i]))).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Values that differ from what the file had when it was opened.
 *
 * @param widgets Every widget read from the file.
 * @param values Current values by field name.
 */
export function changedFields(
  widgets: readonly FormWidget[],
  values: Readonly<Record<string, FormValue>>,
): Map<string, FormValue> {
  const changed = new Map<string, FormValue>();
  for (const widget of widgets) {
    const value = values[widget.field];
    if (value !== undefined && value !== widget.initial && !widget.readOnly) changed.set(widget.field, value);
  }
  return changed;
}
