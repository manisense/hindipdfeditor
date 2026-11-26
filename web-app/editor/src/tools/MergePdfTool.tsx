import { useTx } from "../lib/i18n";
import { trackToolEvent } from "../lib/analytics";
import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { DropZone } from "../components/DropZone";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { ToolShell } from "../components/ToolShell";
import { downloadPdfBytes, mergePdfFiles } from "../lib/pdfOps";
import { moveItem } from "../lib/moveItem";
import { getTool } from "../lib/tools";
import { openFailureMessage, type Bilingual } from "../lib/userMessages";
import "./UtilityTool.css";

const tool = getTool("merge")!;


export function MergePdfTool() {
  const tx = useTx();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Bilingual | null>(null);
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
      setError(openFailureMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell
      tool={tool}
      compact={files.length > 0}
      steps={[
        { label: tx("Select PDFs", "पीडीएफ चुनें"), active: step === 1, done: step > 1 },
        { label: tx("Merge", "जोड़ें"), active: step === 2, done: step > 2 },
        { label: tx("Download", "डाउनलोड"), active: step === 3, done: step === 3 },
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
              label={tx("Merge queue", "जोड़ने की सूची")}
              name={tx(`${files.length} PDF${files.length === 1 ? "" : "s"} ready`, `${files.length} पीडीएफ तैयार`)}
              meta={tx("Files are joined in this order. Use the arrows to change it.", "फाइलें इसी क्रम में जुड़ेंगी। क्रम बदलने के लिए तीर इस्तेमाल करें।")}
            />
            <ol className="utility-tool__list">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <span className="utility-tool__list-index">{index + 1}</span>
                  <span className="utility-tool__list-name">{file.name}</span>
                  <button
                    type="button"
                    className="utility-tool__move"
                    disabled={busy || index === 0}
                    aria-label={tx(`Move ${file.name} up`, `${file.name} को ऊपर करें`)}
                    onClick={() => updateQueue(moveItem(files, index, index - 1))}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="utility-tool__move"
                    disabled={busy || index === files.length - 1}
                    aria-label={tx(`Move ${file.name} down`, `${file.name} को नीचे करें`)}
                    onClick={() => updateQueue(moveItem(files, index, index + 1))}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
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
                title={busy ? tx("Merging…", "जोड़ रहे हैं…") : tx("Merge & download", "जोड़ें और डाउनलोड करें")}
                onClick={() => void runMerge()}
                disabled={busy || files.length < 2}
              />
            </div>
          </div>
        )}
        {error && (
          <AppStatus tone="error" title={tx("Merge failed", "फाइलें नहीं जुड़ पाईं")}>
            {tx(error.en, error.hi)}
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
