import { useState } from 'react';

import { AppButton } from '../components/AppButton';
import { DropZone } from '../components/DropZone';
import { ToolShell } from '../components/ToolShell';
import { downloadPdfBytes, mergePdfFiles } from '../lib/pdfOps';
import { getTool } from '../lib/tools';
import './UtilityTool.css';

const tool = getTool('merge')!;

export function MergePdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneName, setDoneName] = useState<string | null>(null);

  const step = doneName ? 3 : files.length >= 2 ? 2 : 1;

  const runMerge = async () => {
    setBusy(true);
    setError(null);
    setDoneName(null);
    try {
      const bytes = await mergePdfFiles(files);
      const filename = 'merged.pdf';
      downloadPdfBytes(bytes, filename);
      setDoneName(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell
      tool={tool}
      steps={[
        { label: 'Select PDFs', active: step === 1, done: step > 1 },
        { label: 'Merge', active: step === 2, done: step > 2 },
        { label: 'Download', active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {files.length === 0 ? (
          <DropZone
            multiple
            accent={tool.accent}
            title="Merge PDF files"
            subtitle="Choose two or more PDFs. They stay on your device."
            buttonLabel="Select PDF files"
            onFiles={(next) => {
              setFiles(next);
              setDoneName(null);
              setError(null);
            }}
          />
        ) : (
          <div className="utility-tool__panel">
            <h2>Files to merge ({files.length})</h2>
            <ol className="utility-tool__list">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <span>{file.name}</span>
                  <button
                    type="button"
                    className="utility-tool__remove"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
            <DropZone
              multiple
              accent={tool.accent}
              title="Add more PDFs"
              subtitle="Drop additional files to append."
              buttonLabel="Add PDFs"
              onFiles={(next) => setFiles((prev) => [...prev, ...next])}
            />
            <div className="utility-tool__actions">
              <AppButton
                title="Clear"
                variant="ghost"
                small
                onClick={() => {
                  setFiles([]);
                  setDoneName(null);
                  setError(null);
                }}
              />
              <AppButton
                title={busy ? 'Merging…' : 'Merge & download'}
                onClick={() => void runMerge()}
                disabled={busy || files.length < 2}
              />
            </div>
          </div>
        )}
        {error && <div className="utility-tool__status utility-tool__status--error">{error}</div>}
        {doneName && (
          <div className="utility-tool__status utility-tool__status--ok">
            Downloaded {doneName}
          </div>
        )}
      </div>
    </ToolShell>
  );
}
