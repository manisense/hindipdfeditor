import { useState } from "react";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { ChoiceChips } from "../components/ChoiceChips";
import { DropZone } from "../components/DropZone";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { ToolShell } from "../components/ToolShell";
import { trackToolEvent } from "../lib/analytics";
import { downloadBlob } from "../lib/downloadBlob";
import { useTx } from "../lib/i18n";
import { parsePageList } from "../lib/pageList";
import { fileToBytes, getPdfPageCount } from "../lib/pdfOps";
import { pdfPagesToImages, type ImageFormat } from "../lib/pdfPagesToImages";
import { getTool } from "../lib/tools";
import { openFailureMessage, type Bilingual } from "../lib/userMessages";
import "./UtilityTool.css";

const tool = getTool("pdf-to-jpg")!;

/** Most pages made into images in one go, so a phone does not run out of memory. */
const MAX_PAGES = 300;

/** PDF to JPG: each chosen page as a JPG or PNG image, in a ZIP when there are several. */
export function PdfToImagesTool() {
  const tx = useTx();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<ImageFormat>("jpeg");
  const [dpi, setDpi] = useState<"150" | "300">("150");
  const [pageMode, setPageMode] = useState<"all" | "chosen">("all");
  const [pageText, setPageText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<Bilingual | null>(null);
  const [doneName, setDoneName] = useState<string | null>(null);

  const chosen = pageMode === "chosen" ? parsePageList(pageText, pageCount) : null;
  const pages = chosen ? ("pages" in chosen ? chosen.pages : null) : Array.from({ length: pageCount }, (_, i) => i);
  const tooMany = (pages?.length ?? 0) > MAX_PAGES;
  const step = doneName ? 3 : file ? 2 : 1;

  const reset = () => {
    setDoneName(null);
    setError(null);
  };

  const openFile = async (next: File) => {
    reset();
    try {
      const count = await getPdfPageCount(next);
      trackToolEvent("pdf_open_success", "pdf-to-jpg");
      setFile(next);
      setPageCount(count);
      setPageMode(count > MAX_PAGES ? "chosen" : "all");
      setPageText(count > MAX_PAGES ? `1-${MAX_PAGES}` : "");
    } catch (err) {
      setError(openFailureMessage(err));
    }
  };

  const run = async () => {
    if (!file || !pages || pages.length === 0 || tooMany || busy) return;
    setBusy(true);
    reset();
    setProgress({ done: 0, total: pages.length });
    try {
      const baseName = file.name.replace(/\.pdf$/i, "") || "document";
      const result = await pdfPagesToImages(await fileToBytes(file), pages, { format, dpi: Number(dpi), baseName }, (done, total) =>
        setProgress({ done, total }),
      );
      downloadBlob(result.blob, result.filename);
      trackToolEvent("export_success", "pdf-to-jpg");
      setDoneName(result.filename);
    } catch (err) {
      trackToolEvent("export_failed", "pdf-to-jpg");
      setError(openFailureMessage(err));
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
        { label: tx("Choose settings", "सेटिंग चुनें"), active: step === 2, done: step > 2 },
        { label: tx("Download", "डाउनलोड"), active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {!file ? (
          <DropZone
            sample
            accent={tool.accent}
            title={tx("PDF to JPG", "पीडीएफ से JPG")}
            subtitle={tx(
              "Turn each page of a PDF into a JPG or PNG image. Hindi stays exactly as it looks in the PDF, and your file stays on this device.",
              "पीडीएफ के हर पेज को JPG या PNG फोटो में बदलें। हिंदी वैसी ही रहती है जैसी पीडीएफ में दिखती है, और फाइल इसी डिवाइस पर रहती है।",
            )}
            buttonLabel={tx("Select PDF", "पीडीएफ चुनें")}
            onFiles={(files) => void openFile(files[0])}
          />
        ) : (
          <div className="utility-tool__panel">
            <SelectedFileSummary name={file.name} meta={tx(`${pageCount} page${pageCount === 1 ? "" : "s"}`, `${pageCount} पेज`)} />
            <section className="utility-tool__setting-card" aria-label={tx("Image settings", "फोटो की सेटिंग")}>
              <ChoiceChips
                id="image-format"
                label={tx("Format", "फॉर्मेट")}
                value={format}
                disabled={busy}
                options={[
                  ["jpeg", tx("JPG (smaller)", "JPG (छोटी फाइल)")],
                  ["png", tx("PNG (sharpest)", "PNG (सबसे साफ)")],
                ]}
                onChange={(next) => {
                  setFormat(next);
                  reset();
                }}
              />
              <ChoiceChips
                id="image-quality"
                label={tx("Quality", "क्वालिटी")}
                value={dpi}
                disabled={busy}
                options={[
                  ["150", tx("Standard (150 dpi)", "सामान्य (150 dpi)")],
                  ["300", tx("High (300 dpi, for print)", "हाई (300 dpi, प्रिंट के लिए)")],
                ]}
                onChange={(next) => {
                  setDpi(next);
                  reset();
                }}
              />
              <ChoiceChips
                id="image-pages"
                label={tx("Pages", "पेज")}
                value={pageMode}
                disabled={busy}
                options={[
                  ["all", tx(`All ${pageCount} pages`, `सभी ${pageCount} पेज`)],
                  ["chosen", tx("Choose pages", "पेज चुनें")],
                ]}
                onChange={(next) => {
                  setPageMode(next);
                  reset();
                }}
              />
              {pageMode === "chosen" && (
                <label className="utility-tool__field">
                  <span>{tx("Pages, e.g. 1-5 or 1, 3-5", "पेज, जैसे 1-5 या 1, 3-5")}</span>
                  <input
                    value={pageText}
                    inputMode="numeric"
                    disabled={busy}
                    onChange={(event) => {
                      setPageText(event.target.value);
                      reset();
                    }}
                  />
                  {chosen && "error" in chosen && (
                    <small className="utility-tool__field-error" role="alert">
                      {chosen.error === "range"
                        ? tx(`Use pages 1 to ${pageCount}.`, `1 से ${pageCount} तक के पेज लिखें।`)
                        : chosen.error === "empty"
                          ? tx("Enter the pages to convert.", "बदलने वाले पेज लिखें।")
                          : tx("Write pages like 1-5 or 1, 3-5.", "पेज ऐसे लिखें: 1-5 या 1, 3-5")}
                    </small>
                  )}
                </label>
              )}
              {tooMany && (
                <p className="utility-tool__field-error" role="alert">
                  {tx(`Up to ${MAX_PAGES} pages at a time. Choose fewer pages and convert the rest next.`, `एक बार में ${MAX_PAGES} पेज तक। कम पेज चुनें और बाकी अगली बार बदलें।`)}
                </p>
              )}
              <p className="utility-tool__note">
                {(pages?.length ?? 0) > 1
                  ? tx("Several pages download as one ZIP file with an image per page.", "कई पेज एक ZIP फाइल में आते हैं, हर पेज की एक फोटो।")
                  : tx("One page downloads as a single image.", "एक पेज एक फोटो के रूप में डाउनलोड होता है।")}
              </p>
            </section>
            <div className="utility-tool__actions">
              <AppButton
                title={tx("Choose another", "दूसरी फाइल चुनें")}
                disabled={busy}
                variant="ghost"
                small
                onClick={() => {
                  setFile(null);
                  reset();
                }}
              />
              <AppButton
                title={
                  busy && progress
                    ? tx(`Making images… ${progress.done}/${progress.total}`, `फोटो बन रही हैं… ${progress.done}/${progress.total}`)
                    : tx("Convert & download", "बदलें और डाउनलोड करें")
                }
                onClick={() => void run()}
                disabled={busy || !pages || pages.length === 0 || tooMany}
              />
            </div>
          </div>
        )}
        {error && (
          <AppStatus tone="error" title={tx("Couldn’t make images", "फोटो नहीं बन पाईं")}>
            {tx(error.en, error.hi)}
          </AppStatus>
        )}
        {doneName && (
          <AppStatus tone="success" title={tx("Images ready", "फोटो तैयार")}>
            {tx("Downloaded", "डाउनलोड हुई:")} {doneName}
          </AppStatus>
        )}
      </div>
    </ToolShell>
  );
}
