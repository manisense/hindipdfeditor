import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { DropZone } from "../components/DropZone";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { ToolShell } from "../components/ToolShell";
import { trackToolEvent } from "../lib/analytics";
import { downloadPdfBlob } from "../lib/exportPdf";
import { ensureFontsLoaded } from "../lib/fontAsset";
import { renderFieldAppearance } from "../lib/formFieldImage";
import { useLanguage, useTx } from "../lib/i18n";
import { changedFields, type FormValue, type FormWidget } from "../lib/pdfForm";
import { fillPdfForm } from "../lib/pdfFormFill";
import { initialValues, readFormWidgets } from "../lib/pdfFormRead";
import { getPageCount, getPageSize, renderPage, setPdfBytes } from "../lib/pdfToImages";
import { transliterateBeforeCaret } from "../lib/romanToHindi";
import { getTool, toolHref } from "../lib/tools";
import "./UtilityTool.css";
import "./FillFormTool.css";

const tool = getTool("fill-form")!;

type PageSize = { widthPt: number; heightPt: number };

/** Preview render scale, in px per PDF point. */
const PREVIEW_PX_PER_PT = 1.5;
/** Largest PDF accepted, in pages. */
const MAX_PAGES = 200;

type ControlProps = {
  widget: FormWidget;
  value: FormValue | undefined;
  romanTyping: boolean;
  onChange: (value: FormValue) => void;
  /** Accessible name; the on-page controls sit on the form's own printed labels. */
  label: string;
  className?: string;
  style?: CSSProperties;
};

/** One form control, bound to a field's value: on the page preview and in the side list. */
function FieldControl({ widget, value, romanTyping, onChange, label, className, style }: ControlProps) {
  const pending = useRef<{ element: HTMLInputElement | HTMLTextAreaElement; caret: number } | null>(null);
  useLayoutEffect(() => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    next.element.setSelectionRange(next.caret, next.caret);
  });
  const onText = (element: HTMLInputElement | HTMLTextAreaElement) => {
    const converted = romanTyping ? transliterateBeforeCaret(element.value, element.selectionStart ?? element.value.length) : null;
    if (converted) pending.current = { element, caret: converted.caret };
    onChange(converted ? converted.value : element.value);
  };
  const common = { "aria-label": label, disabled: widget.readOnly, className, style };

  if (widget.kind === "checkbox") {
    return <input type="checkbox" {...common} checked={value === true} onChange={(event) => onChange(event.target.checked)} />;
  }
  if (widget.kind === "radio") {
    return (
      <input
        type="radio"
        {...common}
        name={`${className ?? "field"}-${widget.field}`}
        checked={value === widget.id}
        onChange={(event) => event.target.checked && onChange(widget.id)}
      />
    );
  }
  if (widget.kind === "list") {
    const options = widget.options ?? [];
    const selected = Array.isArray(value) ? value : [];
    return (
      <select
        {...common}
        multiple={widget.multiSelect}
        size={Math.max(2, Math.min(5, options.length))}
        value={widget.multiSelect ? [...selected] : (selected[0] ?? "")}
        onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (widget.kind === "dropdown") {
    return (
      <select {...common} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}>
        <option value="" />
        {(widget.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  const text = typeof value === "string" ? value : "";
  return widget.multiline ? (
    <textarea {...common} lang="hi" value={text} maxLength={widget.maxLength} onChange={(event) => onText(event.target)} />
  ) : (
    <input {...common} lang="hi" value={text} maxLength={widget.maxLength} onChange={(event) => onText(event.target)} />
  );
}

/**
 * Fill PDF form: type into a PDF's own form fields, in Hindi or English, and download the filled
 * copy. Hindi answers are drawn by the browser (Plan A); everything runs on this device.
 */
export function FillFormTool() {
  const tx = useTx();
  const { lang } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [widgets, setWidgets] = useState<FormWidget[]>([]);
  const [skipped, setSkipped] = useState({ fields: 0, signatures: 0 });
  const [values, setValues] = useState<Record<string, FormValue>>({});
  const [opening, setOpening] = useState(false);
  const [romanTyping, setRomanTyping] = useState(false);
  const [flatten, setFlatten] = useState(false);
  const [current, setCurrent] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ filename: string; count: number } | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [viewWidthPx, setViewWidthPx] = useState(0);

  const pageCount = pageSizes.length;
  const changed = changedFields(widgets, values).size;
  const step = done ? 3 : file ? 2 : 1;

  const reset = () => {
    setFile(null);
    setBytes(null);
    setPageSizes([]);
    setWidgets([]);
    setValues({});
    setDone(null);
    setError(null);
  };

  const openFile = async (next: File) => {
    setOpening(true);
    setError(null);
    setDone(null);
    try {
      const data = new Uint8Array(await next.arrayBuffer());
      setPdfBytes(data);
      const count = await getPageCount();
      if (count > MAX_PAGES) throw new Error(tx(`This PDF has ${count} pages; forms up to ${MAX_PAGES} pages can be filled.`, `इस पीडीएफ में ${count} पेज हैं; ${MAX_PAGES} पेज तक के फॉर्म भरे जा सकते हैं।`));
      const sizes: PageSize[] = [];
      for (let i = 0; i < count; i++) {
        const size = await getPageSize(i, 1);
        sizes.push({ widthPt: size.pxWidth, heightPt: size.pxHeight });
      }
      const form = await readFormWidgets(data);
      setFile(next);
      setBytes(data);
      setPageSizes(sizes);
      setWidgets(form.widgets);
      setSkipped({ fields: form.skipped, signatures: form.signatures });
      setValues(initialValues(form.widgets));
      const first = form.widgets[0]?.page ?? 0;
      setCurrent(first);
      trackToolEvent("pdf_open_success", "fill-form");
    } catch (err) {
      console.error("Opening the PDF failed", err);
      setError(err instanceof Error && err.message ? err.message : tx("This PDF could not be opened.", "यह पीडीएफ नहीं खुल सकी।"));
    } finally {
      setOpening(false);
    }
  };

  // The on-page controls show Hindi in the same font the answers are drawn with.
  useEffect(() => ensureFontsLoaded(), []);

  useEffect(() => {
    if (!bytes || pageCount === 0) return;
    let cancelled = false;
    setPreview(null);
    // The page's own field drawings are left out: the controls laid over them show each value.
    void renderPage(current, PREVIEW_PX_PER_PT, { withoutFormFields: true })
      .then((image) => {
        if (!cancelled) setPreview(image.uri);
      })
      .catch((err: unknown) => console.warn("Page preview failed", err));
    return () => {
      cancelled = true;
    };
  }, [bytes, current, pageCount]);

  useLayoutEffect(() => {
    const element = pageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewWidthPx(element.clientWidth));
    observer.observe(element);
    setViewWidthPx(element.clientWidth);
    return () => observer.disconnect();
  }, [file, widgets.length]);

  const setValue = (field: string, value: FormValue) => {
    setValues((all) => ({ ...all, [field]: value }));
    setDone(null);
  };

  const download = async () => {
    if (!file || !bytes || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await fillPdfForm(bytes, widgets, values, { flatten }, renderFieldAppearance);
      const filename = `${file.name.replace(/\.pdf$/i, "") || "form"}-filled.pdf`;
      downloadPdfBlob(new Blob([result.bytes.slice()], { type: "application/pdf" }), filename);
      setDone({ filename, count: result.changed });
      trackToolEvent("export_success", "fill-form");
    } catch (err) {
      console.error("Filling the form failed", err);
      trackToolEvent("export_failed", "fill-form");
      const locked = err instanceof Error && /encrypt/i.test(err.message);
      setError(
        locked
          ? tx("This PDF is password-protected or locked against changes, so its form cannot be filled here.", "यह पीडीएफ पासवर्ड से सुरक्षित है या इसमें बदलाव बंद हैं, इसलिए इसका फॉर्म यहाँ नहीं भरा जा सकता।")
          : tx("The filled PDF could not be made. Try again, or try another copy of the PDF.", "भरी हुई पीडीएफ नहीं बन सकी। फिर कोशिश करें या पीडीएफ की दूसरी कॉपी आज़माएं।"),
      );
    } finally {
      setBusy(false);
    }
  };

  const size = pageSizes[current];
  const onPage = widgets.filter((widget) => widget.page === current);
  const listed = onPage.filter((widget, i) => onPage.findIndex((w) => w.field === widget.field) === i);
  const fieldPages = [...new Set(widgets.map((widget) => widget.page))];
  const scale = size && viewWidthPx > 0 ? viewWidthPx / size.widthPt : 0;
  const optionName = (widget: FormWidget, k: number) =>
    widget.optionLabel && widget.optionLabel !== "Off" && !/^\d+$/.test(widget.optionLabel) ? widget.optionLabel : tx(`Choice ${k + 1}`, `विकल्प ${k + 1}`);

  return (
    <ToolShell
      tool={tool}
      compact={Boolean(file)}
      steps={[
        { label: tx("Select PDF", "पीडीएफ चुनें"), active: step === 1, done: step > 1 },
        { label: tx("Fill", "भरें"), active: step === 2, done: step > 2 },
        { label: tx("Download", "डाउनलोड"), active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool fill-form">
        {!file ? (
          <DropZone
            accent={tool.accent}
            title={tx("Fill a PDF form", "पीडीएफ फॉर्म भरें")}
            subtitle={tx(
              "Type into the form's own fields in Hindi or English, tick boxes and choose options. Your file stays on this device.",
              "फॉर्म के अपने खानों में हिंदी या अंग्रेज़ी में लिखें, बॉक्स पर टिक करें और विकल्प चुनें। फाइल इसी डिवाइस पर रहती है।",
            )}
            buttonLabel={opening ? tx("Opening…", "खुल रही है…") : tx("Select PDF", "पीडीएफ चुनें")}
            disabled={opening}
            onFiles={(files) => void openFile(files[0])}
          />
        ) : widgets.length === 0 ? (
          <div className="fill-form__empty">
            <SelectedFileSummary name={file.name} meta={tx(`${pageCount} ${pageCount === 1 ? "page" : "pages"}`, `${pageCount} पेज`)} />
            <AppStatus tone="info" title={tx("This PDF has no fillable fields", "इस पीडीएफ में भरने लायक खाने नहीं हैं")}>
              {tx(
                "It may be a scanned or printed form. Open it in Edit PDF and use Add text to type on it.",
                "यह स्कैन किया या छपा हुआ फॉर्म हो सकता है। इसे एडिट पीडीएफ में खोलें और “टेक्स्ट जोड़ें” से इस पर लिखें।",
              )}
            </AppStatus>
            <div className="utility-tool__actions">
              <AppButton title={tx("Choose another", "दूसरी फाइल चुनें")} variant="ghost" small onClick={reset} />
              <a className="app-button app-button--primary app-button--small" href={`${toolHref("edit", lang)}${lang === "hi" ? "&" : "?"}mode=addText`}>
                <span>{tx("Open Edit PDF", "एडिट पीडीएफ खोलें")}</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="fill-form__layout">
            <div className="fill-form__side">
              <SelectedFileSummary
                name={file.name}
                meta={tx(`${pageCount} ${pageCount === 1 ? "page" : "pages"} · ${new Set(widgets.map((w) => w.field)).size} fields`, `${pageCount} पेज · ${new Set(widgets.map((w) => w.field)).size} खाने`)}
              />

              <label className="fill-form__check">
                <input type="checkbox" checked={romanTyping} onChange={(event) => setRomanTyping(event.target.checked)} />
                {tx("Type Hindi with English letters (namaste → नमस्ते)", "अंग्रेज़ी अक्षरों से हिंदी लिखें (namaste → नमस्ते)")}
              </label>

              <section className="utility-tool__setting-card" aria-labelledby="fill-fields-heading">
                <strong id="fill-fields-heading">{tx(`Fields on page ${current + 1}`, `पेज ${current + 1} के खाने`)}</strong>
                {listed.length === 0 ? (
                  <p className="utility-tool__note">{tx("This page has no fields.", "इस पेज पर कोई खाना नहीं है।")}</p>
                ) : (
                  <div className="fill-form__list">
                    {listed.map((widget) =>
                      widget.kind === "radio" ? (
                        <fieldset key={widget.field} className="fill-form__group" disabled={widget.readOnly}>
                          <legend>{widget.label}</legend>
                          {widgets
                            .filter((w) => w.field === widget.field)
                            .map((w, k) => (
                              <label key={w.id} className="fill-form__check">
                                <FieldControl widget={w} value={values[w.field]} romanTyping={false} label={optionName(w, k)} className="fill-form__list-radio" onChange={(v) => setValue(w.field, v)} />
                                {optionName(w, k)}
                              </label>
                            ))}
                        </fieldset>
                      ) : widget.kind === "checkbox" ? (
                        <label key={widget.field} className="fill-form__check">
                          <FieldControl widget={widget} value={values[widget.field]} romanTyping={false} label={widget.label} onChange={(v) => setValue(widget.field, v)} />
                          {widget.label}
                        </label>
                      ) : (
                        <label key={widget.field} className="utility-tool__field fill-form__field">
                          <span>{widget.label}</span>
                          <FieldControl widget={widget} value={values[widget.field]} romanTyping={romanTyping} label={widget.label} onChange={(v) => setValue(widget.field, v)} />
                        </label>
                      ),
                    )}
                  </div>
                )}
              </section>

              <label className="fill-form__check">
                <input type="checkbox" checked={flatten} onChange={(event) => { setFlatten(event.target.checked); setDone(null); }} />
                {tx("Lock the answers (flatten the form so they can't be changed)", "जवाब लॉक करें (फॉर्म को फ्लैट करें ताकि जवाब बदले न जा सकें)")}
              </label>
              {skipped.fields > 0 && (
                <p className="utility-tool__note">
                  {tx(
                    `${skipped.fields} ${skipped.fields === 1 ? "field" : "fields"} of a kind this tool can't fill ${skipped.fields === 1 ? "is" : "are"} left as ${skipped.fields === 1 ? "it is" : "they are"}.`,
                    `${skipped.fields} खाने ऐसे हैं जिन्हें यह टूल नहीं भर सकता; वे जैसे हैं वैसे रहेंगे।`,
                  )}
                </p>
              )}
              {skipped.signatures > 0 && (
                <p className="utility-tool__note">
                  {tx("This form has a signature box. Download the filled PDF, then sign it with ", "इस फॉर्म में हस्ताक्षर का खाना है। भरी हुई पीडीएफ डाउनलोड करें, फिर उस पर ")}
                  <a href={toolHref("sign", lang)}>{tx("Sign PDF", "पीडीएफ पर हस्ताक्षर")}</a>
                  {tx(".", " से हस्ताक्षर करें।")}
                </p>
              )}
              <p className="utility-tool__note">
                {tx(
                  "Hindi answers are drawn by your browser so the letters join correctly; the field still stores the text you typed.",
                  "हिंदी जवाब आपका ब्राउज़र बनाता है ताकि अक्षर सही जुड़ें; खाने में आपका लिखा टेक्स्ट भी सेव रहता है।",
                )}
              </p>

              <div className="utility-tool__actions">
                <AppButton title={tx("Choose another", "दूसरी फाइल चुनें")} variant="ghost" small disabled={busy} onClick={reset} />
                <AppButton
                  title={busy ? tx("Filling…", "भर रहे हैं…") : tx("Download filled PDF", "भरी हुई पीडीएफ डाउनलोड करें")}
                  disabled={busy || (changed === 0 && !flatten)}
                  onClick={() => void download()}
                />
              </div>
              {changed === 0 && !flatten && <p className="utility-tool__note">{tx("Fill in at least one field.", "कम से कम एक खाना भरें।")}</p>}
            </div>

            <div className="fill-form__preview">
              <div className="fill-form__pager">
                <button type="button" className="app-button app-button--secondary app-button--small" aria-label={tx("Previous page", "पिछला पेज")} disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <span>{tx(`Page ${current + 1} of ${pageCount}`, `पेज ${current + 1} / ${pageCount}`)}</span>
                <button type="button" className="app-button app-button--secondary app-button--small" aria-label={tx("Next page", "अगला पेज")} disabled={current >= pageCount - 1} onClick={() => setCurrent((c) => c + 1)}>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                {fieldPages.length > 1 && (
                  <span className="fill-form__pages">{tx(`Fields on pages ${fieldPages.map((p) => p + 1).join(", ")}`, `खाने इन पेजों पर: ${fieldPages.map((p) => p + 1).join(", ")}`)}</span>
                )}
              </div>
              <div ref={pageRef} className="fill-form__page" style={size ? { aspectRatio: `${size.widthPt} / ${size.heightPt}` } : undefined}>
                {preview ? <img className="fill-form__page-image" src={preview} alt={tx(`Page ${current + 1}`, `पेज ${current + 1}`)} /> : <div className="fill-form__page-loading" aria-busy="true" />}
                {scale > 0 &&
                  onPage.map((widget) => {
                    // A turned field shows its control turned the same way, in its own upright box.
                    const sideways = widget.textRotation === 90 || widget.textRotation === 270;
                    const boxW = (sideways ? widget.hPt : widget.wPt) * scale;
                    const boxH = (sideways ? widget.wPt : widget.hPt) * scale;
                    const fontPt = Math.min(widget.fontSizePt > 0 ? widget.fontSizePt : 12, widget.multiline || widget.kind === "list" ? 12 : boxH / scale * 0.6);
                    const k = widgets.filter((w) => w.field === widget.field).indexOf(widget);
                    return (
                      <FieldControl
                        key={widget.id}
                        widget={widget}
                        value={values[widget.field]}
                        romanTyping={romanTyping}
                        label={widget.kind === "radio" ? `${widget.label}: ${optionName(widget, k)}` : widget.label}
                        className={`fill-form__overlay fill-form__overlay--${widget.kind}`}
                        style={{
                          left: (widget.xPt + widget.wPt / 2) * scale - boxW / 2,
                          top: (widget.yPt + widget.hPt / 2) * scale - boxH / 2,
                          width: boxW,
                          height: boxH,
                          fontSize: Math.max(8, fontPt * scale),
                          transform: widget.textRotation ? `rotate(${widget.textRotation}deg)` : undefined,
                        }}
                        onChange={(v) => setValue(widget.field, v)}
                      />
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {error && (
          <AppStatus tone="error" title={tx("Something went wrong", "कुछ गड़बड़ हुई")}>
            {error}
          </AppStatus>
        )}
        {done && (
          <AppStatus tone="success" title={tx("Your filled PDF is ready", "भरी हुई पीडीएफ तैयार है")}>
            {tx(`Downloaded ${done.filename} with ${done.count} filled fields.`, `${done.filename} डाउनलोड हुई, ${done.count} भरे खानों के साथ।`)}
          </AppStatus>
        )}
      </div>
    </ToolShell>
  );
}
