import { useState } from "react";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { DropZone } from "../components/DropZone";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { ToolShell } from "../components/ToolShell";
import { trackToolEvent } from "../lib/analytics";
import { convertPdfToWord } from "../lib/convertPdfToWord";
import { useTx } from "../lib/i18n";
import { getTool } from "../lib/tools";
import "./UtilityTool.css";

const tool = getTool("pdf-to-word")!;

/** Largest PDF converted, in pages: each page is read (and OCR'd when needed) in the browser. */
const MAX_PAGES = 150;

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
export function PdfToWordTool() {
  const tx = useTx();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ filename: string; pages: number; emptyPages: number } | null>(null);
  const step = result ? 3 : file ? 2 : 1;

  const convert = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: 0 });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const converted = await convertPdfToWord(bytes, (done, total) => {
        if (total > MAX_PAGES) throw new Error("too-many-pages");
        setProgress({ done, total });
      });
      trackToolEvent("pdf_open_success", "pdf-to-word");
      const filename = `${file.name.replace(/\.pdf$/i, "") || "document"}.docx`;
      downloadBlob(converted.blob, filename);
      trackToolEvent("export_success", "pdf-to-word");
      setResult({ filename, pages: converted.pages, emptyPages: converted.emptyPages });
    } catch (err) {
      console.error("PDF to Word failed", err);
      trackToolEvent("export_failed", "pdf-to-word");
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
            accent={tool.accent}
            title={tx("PDF to Word", "पीडीएफ से वर्ड")}
            subtitle={tx(
              "Get an editable Word file from a Hindi or English PDF, including scans. Your file stays on this device.",
              "हिंदी या अंग्रेज़ी पीडीएफ (स्कैन भी) से बदलने लायक वर्ड फाइल पाएं। फाइल इसी डिवाइस पर रहती है।",
            )}
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
                  "A .docx file with each page's text as paragraphs, keeping sizes, bold headings and centred lines. Hindi uses Unicode (font: Nirmala UI). Tables drawn with lines become Word tables, on scans too. Scanned pages and text drawn as images are read with OCR, so check names and numbers. Pictures (logos, photos, stamps) are placed in reading order; exact positions are not kept.",
                  "हर पेज का टेक्स्ट अनुच्छेदों में, साइज, बोल्ड शीर्षक और बीच की लाइनों के साथ .docx फाइल में। हिंदी यूनिकोड में होगी (फॉन्ट: Nirmala UI)। लाइनों से बनी टेबल Word टेबल बनती हैं, स्कैन में भी। स्कैन पेज और इमेज के रूप में बना टेक्स्ट OCR से पढ़े जाते हैं, इसलिए नाम और नंबर जाँच लें। तस्वीरें (लोगो, फोटो, मुहर) पढ़ने के क्रम में आती हैं; सटीक जगह नहीं रहती।",
                )}
              </p>
            </div>
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
          </AppStatus>
        )}
      </div>
    </ToolShell>
  );
}
