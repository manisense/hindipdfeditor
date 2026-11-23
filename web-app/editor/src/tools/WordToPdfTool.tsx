import { useEffect, useRef, useState } from "react";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { DropZone } from "../components/DropZone";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { ToolShell } from "../components/ToolShell";
import { trackToolEvent } from "../lib/analytics";
import { printWordDocument, renderWordDocument, sectionsToPdf } from "../lib/convertWordToPdf";
import { useTx } from "../lib/i18n";
import { downloadPdfBytes } from "../lib/pdfOps";
import { getTool } from "../lib/tools";
import "./UtilityTool.css";
import "./WordToPdfTool.css";

const tool = getTool("word-to-pdf")!;

/** Largest Word file accepted, in bytes. */
const MAX_BYTES = 50 * 1024 * 1024;

/**
 * Word to PDF: lays the .docx out in the page with docx-preview, shows it, and makes a PDF of
 * page images, or prints it to "Save as PDF" for selectable text.
 */
export function WordToPdfTool() {
  const tx = useTx();
  const [file, setFile] = useState<File | null>(null);
  const [sections, setSections] = useState<HTMLElement[]>([]);
  const [rendering, setRendering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  // Read the current language without restarting the layout effect on every render.
  const txRef = useRef(tx);
  txRef.current = tx;
  const step = result ? 3 : file ? 2 : 1;

  useEffect(() => {
    const host = hostRef.current;
    if (!file || !host) return;
    let cancelled = false;
    setRendering(true);
    setError(null);
    renderWordDocument(file, host)
      .then((rendered) => {
        if (cancelled) return;
        setSections(rendered);
        trackToolEvent("pdf_open_success", "word-to-pdf");
      })
      .catch((err: unknown) => {
        console.error("Word file could not be read", err);
        if (!cancelled) setError(txRef.current("This Word file could not be read. Save it as .docx in Word and try again.", "यह वर्ड फाइल पढ़ी नहीं जा सकी। उसे वर्ड में .docx के रूप में सेव करके फिर कोशिश करें।"));
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const makePdf = async () => {
    if (!file || busy || sections.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const bytes = await sectionsToPdf(sections, (done, total) => setProgress({ done, total }));
      const filename = `${file.name.replace(/\.docx$/i, "") || "document"}.pdf`;
      downloadPdfBytes(bytes, filename);
      setResult(filename);
      trackToolEvent("export_success", "word-to-pdf");
    } catch (err) {
      console.error("Word to PDF failed", err);
      trackToolEvent("export_failed", "word-to-pdf");
      setError(tx("The PDF could not be made. Try “Print / Save as PDF” instead.", "पीडीएफ नहीं बन सकी। इसकी जगह “प्रिंट / पीडीएफ के रूप में सेव करें” आज़माएं।"));
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
        { label: tx("Select Word file", "वर्ड फाइल चुनें"), active: step === 1, done: step > 1 },
        { label: tx("Check", "जाँचें"), active: step === 2, done: step > 2 },
        { label: tx("Download", "डाउनलोड"), active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool word-to-pdf">
        {!file ? (
          <DropZone
            kind="docx"
            accent={tool.accent}
            title={tx("Word to PDF", "वर्ड से पीडीएफ")}
            subtitle={tx(
              "Turn a Word (.docx) file with Hindi or English text into a PDF. Your file stays on this device.",
              "हिंदी या अंग्रेज़ी टेक्स्ट वाली वर्ड (.docx) फाइल को पीडीएफ में बदलें। फाइल इसी डिवाइस पर रहती है।",
            )}
            buttonLabel={tx("Select Word file", "वर्ड फाइल चुनें")}
            onFiles={(files) => {
              if (files[0].size > MAX_BYTES) {
                setError(tx("Choose a Word file under 50 MB.", "50 MB से छोटी वर्ड फाइल चुनें।"));
                return;
              }
              setSections([]);
              setResult(null);
              setFile(files[0]);
            }}
          />
        ) : (
          <div className="utility-tool__panel">
            <SelectedFileSummary
              name={file.name}
              label={tx("Selected Word file", "चुनी गई वर्ड फाइल")}
              meta={sections.length ? tx(`${sections.length} pages laid out`, `${sections.length} पेज तैयार`) : undefined}
            />
            <div className="utility-tool__setting-card">
              <strong>{tx("Two ways to save", "सेव करने के दो तरीके")}</strong>
              <p className="utility-tool__note">
                {tx(
                  "“Download PDF” makes each page an image: it looks exactly like the preview, but its text cannot be selected or searched. “Print / Save as PDF” opens your browser's print window; choose “Save as PDF” there for selectable text.",
                  "“पीडीएफ डाउनलोड करें” हर पेज को इमेज बनाता है: वह प्रीव्यू जैसा ही दिखेगा, पर उसका टेक्स्ट सेलेक्ट या खोजा नहीं जा सकेगा। “प्रिंट / पीडीएफ के रूप में सेव करें” ब्राउज़र की प्रिंट विंडो खोलता है; सेलेक्ट होने वाले टेक्स्ट के लिए वहाँ “Save as PDF” चुनें।",
                )}
              </p>
            </div>
            {(rendering || progress) && (
              <AppStatus busy title={rendering ? tx("Reading the Word file…", "वर्ड फाइल पढ़ रहे हैं…") : tx("Making the PDF…", "पीडीएफ बन रही है…")}>
                {progress ? tx(`Page ${progress.done} of ${progress.total}`, `पेज ${progress.done} / ${progress.total}`) : tx("Laying out pages", "पेज तैयार हो रहे हैं")}
              </AppStatus>
            )}
            <div className="utility-tool__actions">
              <AppButton
                title={tx("Choose another", "दूसरी फाइल चुनें")}
                variant="ghost"
                small
                disabled={busy}
                onClick={() => {
                  setFile(null);
                  setSections([]);
                  setResult(null);
                  setError(null);
                }}
              />
              <AppButton
                title={tx("Print / Save as PDF", "प्रिंट / पीडीएफ के रूप में सेव करें")}
                variant="secondary"
                disabled={busy || rendering || sections.length === 0}
                onClick={() => void printWordDocument(file).catch(() => setError(tx("The print window could not open.", "प्रिंट विंडो नहीं खुल सकी।")))}
              />
              <AppButton
                title={busy ? tx("Making PDF…", "पीडीएफ बन रही है…") : tx("Download PDF", "पीडीएफ डाउनलोड करें")}
                disabled={busy || rendering || sections.length === 0}
                onClick={() => void makePdf()}
              />
            </div>
          </div>
        )}
        {error && (
          <AppStatus tone="error" title={tx("Something went wrong", "कुछ गड़बड़ हुई")}>
            {error}
          </AppStatus>
        )}
        {result && (
          <AppStatus tone="success" title={tx("Your PDF is ready", "आपकी पीडीएफ तैयार है")}>
            {tx(`Downloaded ${result}`, `${result} डाउनलोड हुई`)}
          </AppStatus>
        )}
        <div
          ref={hostRef}
          className="word-to-pdf__preview"
          hidden={!file}
          aria-label={tx("Preview of the Word file", "वर्ड फाइल का प्रीव्यू")}
        />
      </div>
    </ToolShell>
  );
}
