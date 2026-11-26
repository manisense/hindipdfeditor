import { useEffect, useState } from "react";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { DropZone } from "../components/DropZone";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { ToolShell } from "../components/ToolShell";
import { trackToolEvent } from "../lib/analytics";
import { convertPdfToWord, sampleTextLayer, type OcrChoice, type TextLayerSample } from "../lib/convertPdfToWord";
import { useTx } from "../lib/i18n";
import { ocrPoolSize } from "../lib/ocr";
import { ocrPageLimit, ocrSecondsPerPage } from "../lib/ocrPoolSize";
import { getTool } from "../lib/tools";
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

/** Downloads a Blob under a file name. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** PDF to Word: reads each page's text (PDF text, repaired Hindi, or OCR) into a .docx file. */
/** PDF to Word, also served as the KrutiDev-to-Unicode page with its own heading. */
export function PdfToWordTool({ toolId = "pdf-to-word" }: { toolId?: "pdf-to-word" | "krutidev" }) {
  const tool = getTool(toolId)!;
  const tx = useTx();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ filename: string; pages: number; emptyPages: number; unreadPages: number[] } | null>(null);
  const [ocr, setOcr] = useState<OcrChoice>("auto");
  const [sample, setSample] = useState<TextLayerSample | null>(null);
  const step = result ? 3 : file ? 2 : 1;
  const pool = ocrPoolSize();
  const ocrLimit = ocrPageLimit(pool);
  // Pages the chosen setting will read with OCR, estimated from a sample of the PDF's pages.
  const ocrNeeded = !sample || ocr === "off" ? 0 : ocr === "all" ? sample.pages : Math.round((sample.pages * sample.withoutText) / sample.sampled);
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

  const convert = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: 0 });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const converted = await convertPdfToWord(bytes, { ocr, ocrPageLimit: ocrLimit }, (done, total) => {
        if (total > MAX_PAGES) throw new Error("too-many-pages");
        setProgress({ done, total });
      });
      trackToolEvent("pdf_open_success", toolId);
      const filename = `${file.name.replace(/\.pdf$/i, "") || "document"}.docx`;
      downloadBlob(converted.blob, filename);
      trackToolEvent("export_success", toolId);
      setResult({ filename, pages: converted.pages, emptyPages: converted.emptyPages, unreadPages: converted.unreadPages });
    } catch (err) {
      console.error("PDF to Word failed", err);
      trackToolEvent("export_failed", toolId);
      setError(
        err instanceof Error && err.message === "too-many-pages"
          ? tx(`Up to ${MAX_PAGES} pages can be converted at a time. Split the PDF first.`, `एक बार में ${MAX_PAGES} पेज तक बदले जा सकते हैं। पहले पीडीएफ को अलग करें।`)
          : tx("This PDF could not be converted. It may be damaged or password-protected.", "यह पीडीएफ नहीं बदली जा सकी। हो सकता है फाइल खराब हो या पासवर्ड से सुरक्षित हो।"),
      );
    } finally {
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
            <section className="utility-tool__setting-card" aria-labelledby="ocr-heading">
              <strong id="ocr-heading">{tx("Text recognition (OCR)", "टेक्स्ट पहचान (OCR)")}</strong>
              <div className="utility-tool__chips" role="radiogroup" aria-labelledby="ocr-heading">
                {(
                  [
                    ["auto", tx("Only where needed", "सिर्फ़ ज़रूरत पर")],
                    ["off", tx("Off", "बंद")],
                    ["all", tx("Every page", "हर पेज")],
                  ] as [OcrChoice, string][]
                ).map(([value, label]) => (
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
            {progress && (
              <AppStatus busy title={tx("Converting…", "बदल रहे हैं…")}>
                {progress.total > 0
                  ? tx(`${progress.done} of ${progress.total} pages read`, `${progress.total} में से ${progress.done} पेज पढ़े गए`)
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
                }}
              />
              <AppButton
                title={busy ? tx("Converting…", "बदल रहे हैं…") : tx("Convert & download Word", "बदलें और वर्ड डाउनलोड करें")}
                disabled={busy}
                onClick={() => void convert()}
              />
            </div>
          </div>
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
