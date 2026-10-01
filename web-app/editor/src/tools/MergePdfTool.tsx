import { useTx } from "../lib/i18n";
import { trackToolEvent } from "../lib/analytics";
import { useState } from "react";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { DropZone } from "../components/DropZone";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { ToolShell } from "../components/ToolShell";
import { downloadPdfBytes, mergePdfFiles } from "../lib/pdfOps";
import { getTool } from "../lib/tools";
import "./UtilityTool.css";

const tool = getTool("merge")!;

export function MergePdfTool() {
  const tx = useTx();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneName, setDoneName] = useState<string | null>(null);

  const step = doneName ? 3 : files.length >= 2 ? 2 : 1;

  const updateQueue = (next: File[]) => {
    setFiles(next);
    setDoneName(null);
    setError(null);
  };
  const runMerge = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setDoneName(null);
    try {
      const bytes = await mergePdfFiles(files);
      trackToolEvent("pdf_open_success", "merge");
      const filename = "merged.pdf";
      downloadPdfBytes(bytes, filename);
      trackToolEvent("export_success", "merge");
      setDoneName(filename);
    } catch (err) {
      trackToolEvent("export_failed", "merge");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell
      tool={tool}
      compact={files.length > 0}
      steps={[
        { label: "Select PDFs", active: step === 1, done: step > 1 },
        { label: "Merge", active: step === 2, done: step > 2 },
        { label: "Download", active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {files.length === 0 ? (
          <DropZone
            multiple
            accent={tool.accent}
            title={tx("Merge PDF files", "पीडीएफ फाइलें जोड़ें")}
            subtitle={tx(
              "Choose two or more PDFs. They stay on your device.",
              "दो या ज्यादा पीडीएफ चुनें। फाइलें आपके डिवाइस पर ही रहती हैं।",
            )}
            buttonLabel={tx("Select PDF files", "पीडीएफ फाइलें चुनें")}
            onFiles={(next) => {
              setFiles(next);
              setDoneName(null);
              setError(null);
            }}
          />
        ) : (
          <div className="utility-tool__panel">
            <SelectedFileSummary
              multiple
              label="Merge queue"
              name={`${files.length} PDF${files.length === 1 ? "" : "s"} ready`}
              meta="Files will be combined in the order shown below"
            />
            <ol className="utility-tool__list">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <span className="utility-tool__list-index">{index + 1}</span>
                  <span className="utility-tool__list-name">{file.name}</span>
                  <button
                    type="button"
                    className="utility-tool__remove"
                    disabled={busy}
                    onClick={() =>
                      updateQueue(files.filter((_, i) => i !== index))
                    }
                  >
                    {tx("Remove", "हटाएं")}
                  </button>
                </li>
              ))}
            </ol>
            <DropZone
              multiple
              compact
              accent={tool.accent}
              title={tx("Add more PDFs", "और पीडीएफ जोड़ें")}
              subtitle={tx(
                "Drop additional files to append.",
                "और फाइलें यहाँ छोड़ें, वे आखिर में जुड़ेंगी।",
              )}
              buttonLabel={tx("Add PDFs", "पीडीएफ जोड़ें")}
              disabled={busy}
              onFiles={(next) => updateQueue([...files, ...next])}
            />
            <div className="utility-tool__actions">
              <AppButton
                title={tx("Clear", "सब हटाएं")}
                disabled={busy}
                variant="ghost"
                small
                onClick={() => {
                  setFiles([]);
                  setDoneName(null);
                  setError(null);
                }}
              />
              <AppButton
                title={busy ? "Merging…" : "Merge & download"}
                onClick={() => void runMerge()}
                disabled={busy || files.length < 2}
              />
            </div>
          </div>
        )}
        {error && (
          <AppStatus tone="error" title="Merge failed">
            {error}
          </AppStatus>
        )}
        {doneName && (
          <AppStatus
            tone="success"
            title={tx("Merged PDF ready", "जुड़ी हुई पीडीएफ तैयार")}
          >
            {tx("Downloaded", "डाउनलोड हुई:")} {doneName}
          </AppStatus>
        )}
      </div>
    </ToolShell>
  );
}
