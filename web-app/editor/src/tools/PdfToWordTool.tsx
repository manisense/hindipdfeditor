import { useEffect, useRef, useState } from "react";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { DropZone } from "../components/DropZone";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { ToolShell } from "../components/ToolShell";
import { trackToolEvent } from "../lib/analytics";
import { downloadBlob } from "../lib/downloadBlob";
import { convertPdfToWord, sampleTextLayer, type OcrChoice, type TextLayerSample } from "../lib/convertPdfToWord";
import { useLanguage, useTx } from "../lib/i18n";
import { ocrPoolSize } from "../lib/ocr";
import { ocrPageLimit, ocrSecondsPerPage } from "../lib/ocrPoolSize";
import { parsePageList } from "../lib/pageList";
import { clearJob, conversionKey, savedPages, savePage, startJob } from "../lib/conversionProgress";
import { holdScreenAwake, minutesLeft } from "../lib/wakeLock";
import { getTool, toolHref } from "../lib/tools";
import "./UtilityTool.css";


/**
 * Largest PDF converted, in pages: each page is read (and OCR'd when needed) in the browser.
 * Digital pages keep only their text and pictures in memory, so long documents (2,000 pages) fit.
 */
const MAX_PAGES = 3000;

/** Page numbers as "3, 7, 9–40" (ranges joined), for messages. */
function pageList(pages: readonly number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    let end = i;
    while (end + 1 < pages.length && pages[end + 1] === pages[end] + 1) end++;
    parts.push(end > i ? `${pages[i]}–${pages[end]}` : String(pages[i]));
    i = end;
  }
  return parts.join(", ");
}

/** PDF to Word: reads each page's text (PDF text, repaired Hindi, or OCR) into a .docx file. */
/** PDF to Word, also served as the KrutiDev-to-Unicode page with its own heading. */
export function PdfToWordTool({ toolId = "pdf-to-word" }: { toolId?: "pdf-to-word" | "krutidev" }) {
  const tool = getTool(toolId)!;
  const tx = useTx();
  const { lang } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; left: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ filename: string; pages: number; emptyPages: number; unreadPages: number[] } | null>(null);
  const [ocr, setOcr] = useState<OcrChoice>("auto");
  const [sample, setSample] = useState<TextLayerSample | null>(null);
  const [pageMode, setPageMode] = useState<"all" | "chosen">("all");
  const [pageText, setPageText] = useState("1-500");
  const [stopped, setStopped] = useState(false);
  // Pages kept from an earlier run of this file with these settings (see conversionProgress.ts).
  const [resumable, setResumable] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const step = result ? 3 : file ? 2 : 1;
  const pool = ocrPoolSize();
  const ocrLimit = ocrPageLimit(pool);
  const chosen = pageMode === "chosen" && sample ? parsePageList(pageText, sample.pages) : null;
  const chosenPages = chosen && "pages" in chosen ? chosen.pages : null;
  const selectedCount = chosenPages?.length ?? sample?.pages ?? 0;
  const tooMany = selectedCount > MAX_PAGES;
  // Pages the chosen setting will read with OCR, estimated from a sample of the PDF's pages.
  const ocrNeeded = !sample || ocr === "off" ? 0 : ocr === "all" ? selectedCount : Math.round((selectedCount * sample.withoutText) / sample.sampled);
  const jobKey = file ? conversionKey(file, JSON.stringify([ocr, pageMode === "chosen" ? pageText : "all"])) : null;
  const ocrMinutes = Math.ceil((Math.min(ocrNeeded, ocrLimit) * ocrSecondsPerPage(pool)) / 60);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setSample(null);
    file
      .arrayBuffer()
      .then((buffer) => sampleTextLayer(new Uint8Array(buffer)))
      .then((found) => {
        if (!cancelled) setSample(found);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (!jobKey) return;
    let cancelled = false;
    savedPages(jobKey)
      .then((saved) => {
        if (!cancelled) setResumable(saved.size);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [jobKey, busy]);

  const convert = async () => {
    if (!file || busy || tooMany || (pageMode === "chosen" && !chosenPages)) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setResult(null);
    setStopped(false);
    setProgress({ done: 0, total: 0, left: null });
    const release = await holdScreenAwake();
    const started = Date.now();
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const key = jobKey ?? "";
      const total = chosenPages?.length ?? sample?.pages ?? 0;
      const saved = await savedPages(key);
      await startJob(key, total);
      const options = {
        ocr,
        ocrPageLimit: ocrLimit,
        pages: chosenPages ?? undefined,
        signal: controller.signal,
        resume: { saved, save: savePage },
      };
      const converted = await convertPdfToWord(bytes, options, (done, total) => {
        // Workers still finishing their page after Stop must not bring the progress back.
        if (controller.signal.aborted) return;
        if (total > MAX_PAGES) throw new Error("too-many-pages");
        setProgress({ done, total, left: minutesLeft(Date.now() - started, done, total) });
      });
      trackToolEvent("pdf_open_success", toolId);
      const filename = `${file.name.replace(/\.pdf$/i, "") || "document"}.docx`;
      downloadBlob(converted.blob, filename);
      await clearJob();
      trackToolEvent("export_success", toolId);
      setResult({ filename, pages: converted.pages, emptyPages: converted.emptyPages, unreadPages: converted.unreadPages });
    } catch (err) {
      if (controller.signal.aborted) {
        setStopped(true);
        return;
      }
      console.error("PDF to Word failed", err);
      trackToolEvent("export_failed", toolId);
      setError(
        err instanceof Error && err.message === "too-many-pages"
          ? tx(`Up to ${MAX_PAGES} pages can be converted at a time. Choose pages below.`, `एक बार में ${MAX_PAGES} पेज तक बदले जा सकते हैं। नीचे पेज चुनें।`)
          : tx("This PDF could not be converted. It may be damaged or password-protected.", "यह पीडीएफ नहीं बदली जा सकी। हो सकता है फाइल खराब हो या पासवर्ड से सुरक्षित हो।"),
      );
    } finally {
      abortRef.current = null;
      release();
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <ToolShell
      tool={tool}
      compact={Boolean(file)}
      steps={[
        { label: tx("Select PDF", "पीडीएफ चुनें"), active: step === 1, done: step > 1 },
        { label: tx("Convert", "बदलें"), active: step === 2, done: step > 2 },
        { label: tx("Download", "डाउनलोड"), active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {!file ? (
          <>
            <DropZone
              sample={toolId === "pdf-to-word"}
              accent={tool.accent}
              title={
                toolId === "krutidev"
                  ? tx("KrutiDev PDF to Unicode", "कृतिदेव पीडीएफ से यूनिकोड")
                  : tx("PDF to Word", "पीडीएफ से वर्ड")
              }
              subtitle={
                toolId === "krutidev"
                  ? tx(
                      "Open a PDF typed in KrutiDev or DevLys and get a Word file with Unicode Hindi you can copy, search and edit. Your file stays on this device.",
                      "कृतिदेव या देवलिस में टाइप की गई पीडीएफ खोलें और यूनिकोड हिंदी वाली वर्ड फाइल पाएं, जिसे कॉपी, खोज और एडिट कर सकें। फाइल इसी डिवाइस पर रहती है।",
                    )
                  : tx(
                      "Get an editable Word file from a Hindi or English PDF, including scans. Your file stays on this device.",
                      "हिंदी या अंग्रेज़ी पीडीएफ (स्कैन भी) से बदलने लायक वर्ड फाइल पाएं। फाइल इसी डिवाइस पर रहती है।",
                    )
              }
              buttonLabel={tx("Select PDF", "पीडीएफ चुनें")}
              onFiles={(files) => {
                setFile(files[0]);
                setResult(null);
                setError(null);
              }}
            />
            {toolId === "krutidev" && (
              <p className="utility-tool__note">
                {tx("Have KrutiDev text or a Word file, not a PDF?", "पीडीएफ नहीं, कृतिदेव टेक्स्ट या वर्ड फाइल है?")}{" "}
                <a href={`${toolHref("unicode-to-krutidev", lang)}${lang === "hi" ? "&" : "?"}direction=krutidev-to-unicode`}>
                  {tx("Use the text and Word converter", "टेक्स्ट और वर्ड कन्वर्टर इस्तेमाल करें")}
                </a>
              </p>
            )}
          </>
        ) : (
          <div className="utility-tool__panel">
            <SelectedFileSummary name={file.name} meta={`${(file.size / 1024 / 1024).toFixed(2)} MB`} />
            <div className="utility-tool__setting-card">
              <strong>{tx("What you get", "आपको क्या मिलेगा")}</strong>
              <p className="utility-tool__note">
                {tx(
                  "A .docx file with each page's text as paragraphs, keeping sizes, bold headings and centred lines. Hindi uses Unicode (font: Nirmala UI). Tables drawn with lines become Word tables, on scans too. Pictures (logos, photos, stamps) are placed in reading order; exact positions are not kept.",
                  "हर पेज का टेक्स्ट अनुच्छेदों में, साइज, बोल्ड शीर्षक और बीच की लाइनों के साथ .docx फाइल में। हिंदी यूनिकोड में होगी (फॉन्ट: Nirmala UI)। लाइनों से बनी टेबल Word टेबल बनती हैं, स्कैन में भी। तस्वीरें (लोगो, फोटो, मुहर) पढ़ने के क्रम में आती हैं; सटीक जगह नहीं रहती।",
                )}
              </p>
            </div>
            <section className="utility-tool__setting-card" aria-labelledby="pages-heading">
              <strong id="pages-heading">{tx("Pages", "पेज")}</strong>
              <div className="utility-tool__chips" role="radiogroup" aria-labelledby="pages-heading">
                {(
                  [
                    ["all", sample ? tx(`All ${sample.pages} pages`, `सभी ${sample.pages} पेज`) : tx("All pages", "सभी पेज")],
                    ["chosen", tx("Choose pages", "पेज चुनें")],
                  ] as ["all" | "chosen", string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={pageMode === value}
                    className="utility-tool__chip"
                    disabled={busy}
                    onClick={() => {
                      setPageMode(value);
                      setResult(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {pageMode === "chosen" && (
                <label className="utility-tool__field">
                  <span>{tx("Pages, e.g. 1-500 or 1, 3-5", "पेज, जैसे 1-500 या 1, 3-5")}</span>
                  <input
                    id="pdf-to-word-pages"
                    value={pageText}
                    inputMode="numeric"
                    disabled={busy}
                    onChange={(event) => {
                      setPageText(event.target.value);
                      setResult(null);
                    }}
                  />
                  {chosen && "error" in chosen && (
                    <small className="utility-tool__field-error" role="alert">
                      {chosen.error === "range"
                        ? tx(`Use pages 1 to ${sample?.pages ?? 1}.`, `1 से ${sample?.pages ?? 1} तक के पेज लिखें।`)
                        : chosen.error === "empty"
                          ? tx("Enter the pages to convert.", "बदलने वाले पेज लिखें।")
                          : tx("Write pages like 1-500 or 1, 3-5.", "पेज ऐसे लिखें: 1-500 या 1, 3-5")}
                    </small>
                  )}
                </label>
              )}
              {tooMany ? (
                <AppStatus tone="warning" title={tx("Too many pages for one file", "एक फाइल के लिए बहुत पेज")}>
                  {tx(
                    `Up to ${MAX_PAGES} pages are converted at a time. Choose pages, for example 1-${MAX_PAGES}, then the rest.`,
                    `एक बार में ${MAX_PAGES} पेज तक बदले जाते हैं। पेज चुनें, जैसे 1-${MAX_PAGES}, फिर बाकी।`,
                  )}
                </AppStatus>
              ) : (
                <p className="utility-tool__note">
                  {tx(
                    "Long files can be converted in parts, such as 1‑500, then 501‑1000.",
                    "लंबी फाइल हिस्सों में बदली जा सकती है, जैसे 1‑500, फिर 501‑1000।",
                  )}
                </p>
              )}
            </section>
            <section className="utility-tool__setting-card" aria-labelledby="ocr-heading">
              <strong id="ocr-heading">{tx("Text recognition (OCR)", "टेक्स्ट पहचान (OCR)")}</strong>
              <div className="utility-tool__chips" role="radiogroup" aria-labelledby="ocr-heading">
                {(
                  [
                    ["auto", tx("Only where needed", "सिर्फ़ ज़रूरत पर")],
                    ["off", tx("Off", "बंद")],
                    ["all", tx("Every page", "हर पेज")],
                  ] as [OcrChoice, string][]
                )
                  // KrutiDev conversions are always checked against the page image.
                  .filter(([value]) => toolId !== "krutidev" || value !== "off")
                  .map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={ocr === value}
                    className="utility-tool__chip"
                    disabled={busy}
                    onClick={() => {
                      setOcr(value);
                      setResult(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="utility-tool__note">
                {ocr === "auto"
                  ? tx(
                      `Uses the PDF's own text. Only scanned pages, and text the PDF does not store as Unicode, are read from the page image. This device reads up to ${ocrLimit} such pages per file. Check names and numbers on those pages.`,
                      `पीडीएफ का अपना टेक्स्ट लेता है। सिर्फ़ स्कैन पेज, और जो टेक्स्ट पीडीएफ में यूनिकोड में नहीं है, पेज की इमेज से पढ़े जाते हैं। यह डिवाइस एक फाइल में ऐसे ${ocrLimit} पेज तक पढ़ता है। उन पेजों पर नाम और नंबर जाँच लें।`,
                    )
                  : ocr === "off"
                    ? tx(
                        "Fastest. Uses only the PDF's own text. Scanned pages come out empty, and Hindi text is not checked against the page image.",
                        "सबसे तेज़। सिर्फ़ पीडीएफ का अपना टेक्स्ट लेता है। स्कैन पेज खाली आएंगे, और हिंदी टेक्स्ट को पेज की इमेज से नहीं जाँचा जाएगा।",
                      )
                    : tx(
                        `Slowest. Reads every page from its image. Use it when text copied from this PDF comes out garbled. This device reads up to ${ocrLimit} pages; check names and numbers.`,
                        `सबसे धीमा। हर पेज उसकी इमेज से पढ़ता है। तब चुनें जब इस पीडीएफ से कॉपी किया टेक्स्ट गड़बड़ आता हो। यह डिवाइस ${ocrLimit} पेज तक पढ़ता है; नाम और नंबर जाँच लें।`,
                      )}
              </p>
              {sample && ocr !== "all" && (
                <p className="utility-tool__note">
                  {sample.withoutText === 0
                    ? tx(
                        `The pages we sampled all have selectable text, so this PDF should need no OCR.`,
                        `जाँचे गए सभी पेजों में सेलेक्ट होने वाला टेक्स्ट है, इसलिए इस पीडीएफ को OCR की ज़रूरत नहीं होनी चाहिए।`,
                      )
                    : tx(
                        `About ${Math.max(1, Math.round((sample.pages * sample.withoutText) / sample.sampled))} of ${sample.pages} pages look scanned.`,
                        `${sample.pages} में से लगभग ${Math.max(1, Math.round((sample.pages * sample.withoutText) / sample.sampled))} पेज स्कैन लगते हैं।`,
                      )}
                </p>
              )}
              {ocrNeeded > ocrLimit ? (
                <AppStatus tone="warning" title={tx("Not every page can be read", "हर पेज नहीं पढ़ा जा सकेगा")}>
                  {pool >= 3
                    ? tx(
                        `This device reads ${ocrLimit} pages with OCR per file (about ${ocrMinutes} min). Pages after that are listed as not read; split the PDF to convert them.`,
                        `यह डिवाइस एक फाइल में ${ocrLimit} पेज OCR से पढ़ता है (लगभग ${ocrMinutes} मिनट)। उसके बाद के पेज "नहीं पढ़े गए" में दिखेंगे; उन्हें बदलने के लिए पीडीएफ को अलग करें।`,
                      )
                    : tx(
                        `This phone reads ${ocrLimit} pages with OCR per file (about ${ocrMinutes} min). Pages after that are listed as not read. A computer reads up to ${ocrPageLimit(4)}.`,
                        `यह फोन एक फाइल में ${ocrLimit} पेज OCR से पढ़ता है (लगभग ${ocrMinutes} मिनट)। उसके बाद के पेज "नहीं पढ़े गए" में दिखेंगे। कंप्यूटर ${ocrPageLimit(4)} पेज तक पढ़ता है।`,
                      )}
                </AppStatus>
              ) : (
                ocrMinutes >= 2 && (
                  <p className="utility-tool__note">
                    {tx(`Text recognition will take about ${ocrMinutes} min on this device.`, `इस डिवाइस पर टेक्स्ट पहचान में लगभग ${ocrMinutes} मिनट लगेंगे।`)}
                  </p>
                )
              )}
            </section>
            {!busy && resumable > 0 && (
              <AppStatus tone="info" title={tx("Continues where it stopped", "जहाँ रुका था वहीं से आगे")}>
                {tx(
                  `${resumable} pages of this file were already converted with these settings in this browser. Converting continues from there.`,
                  `इस फाइल के ${resumable} पेज इन्हीं सेटिंग के साथ इस ब्राउज़र में पहले ही बदले जा चुके हैं। बदलना वहीं से आगे चलेगा।`,
                )}{" "}
                <button
                  type="button"
                  className="utility-tool__link"
                  onClick={() => {
                    void clearJob().then(() => setResumable(0));
                  }}
                >
                  {tx("Start over", "शुरू से करें")}
                </button>
              </AppStatus>
            )}
            {progress && (
              <AppStatus busy title={tx("Converting…", "बदल रहे हैं…")}>
                {progress.total > 0
                  ? tx(
                      `${progress.done} of ${progress.total} pages read${progress.left ? ` · about ${progress.left} min left` : ""}. Keep this tab open.`,
                      `${progress.total} में से ${progress.done} पेज पढ़े गए${progress.left ? ` · लगभग ${progress.left} मिनट बाकी` : ""}। यह टैब खुला रखें।`,
                    )
                  : tx("Opening the PDF…", "पीडीएफ खुल रही है…")}
              </AppStatus>
            )}
            <div className="utility-tool__actions">
              <AppButton
                title={tx("Choose another", "दूसरी फाइल चुनें")}
                disabled={busy}
                variant="ghost"
                small
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError(null);
                  setStopped(false);
                  setPageMode("all");
                }}
              />
              {busy ? (
                <AppButton title={tx("Stop", "रोकें")} variant="secondary" onClick={() => abortRef.current?.abort()} />
              ) : (
                <AppButton
                  title={tx("Convert & download Word", "बदलें और वर्ड डाउनलोड करें")}
                  disabled={tooMany || (pageMode === "chosen" && !chosenPages)}
                  onClick={() => void convert()}
                />
              )}
            </div>
          </div>
        )}
        {stopped && (
          <AppStatus tone="info" title={tx("Conversion stopped", "बदलना रोका गया")}>
            {tx(
              "Nothing was downloaded. Convert again with the same settings to continue where it stopped.",
              "कुछ डाउनलोड नहीं हुआ। इन्हीं सेटिंग के साथ फिर से बदलें, तो वहीं से आगे चलेगा।",
            )}
          </AppStatus>
        )}
        {error && (
          <AppStatus tone="error" title={tx("Conversion failed", "बदलना नहीं हो सका")}>
            {error}
          </AppStatus>
        )}
        {result && (
          <AppStatus tone="success" title={tx("Your Word file is ready", "आपकी वर्ड फाइल तैयार है")}>
            {tx(
              `Downloaded ${result.filename} · ${result.pages} pages${result.emptyPages ? ` · ${result.emptyPages} without readable text` : ""}`,
              `${result.filename} डाउनलोड हुई · ${result.pages} पेज${result.emptyPages ? ` · ${result.emptyPages} पेज पर पढ़ने लायक टेक्स्ट नहीं मिला` : ""}`,
            )}
            {result.unreadPages.length > 0 &&
              ` ${tx(
                `Not read (they need OCR): pages ${pageList(result.unreadPages)}.`,
                `नहीं पढ़े गए (इन्हें OCR चाहिए): पेज ${pageList(result.unreadPages)}।`,
              )}`}
          </AppStatus>
        )}
      </div>
    </ToolShell>
  );
}
