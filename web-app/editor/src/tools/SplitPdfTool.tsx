import { useState } from 'react';

import { AppButton } from '../components/AppButton';
import { DropZone } from '../components/DropZone';
import { ToolShell } from '../components/ToolShell';
import { downloadPdfBytes, getPdfPageCount, splitPdfFile } from '../lib/pdfOps';
import { getTool } from '../lib/tools';
import './UtilityTool.css';

const tool = getTool('split')!;

export function SplitPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneName, setDoneName] = useState<string | null>(null);

  const step = doneName ? 3 : file ? 2 : 1;

  const openFile = async (next: File) => {
    setError(null);
    setDoneName(null);
    try {
      const count = await getPdfPageCount(next);
      setFile(next);
      setPageCount(count);
      setFromPage(1);
      setToPage(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const runSplit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDoneName(null);
    try {
      const bytes = await splitPdfFile(file, fromPage, toPage);
      const base = file.name.replace(/\.pdf$/i, '') || 'split';
      const filename = `${base}-p${fromPage}-${toPage}.pdf`;
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
        { label: 'Select PDF', active: step === 1, done: step > 1 },
        { label: 'Choose pages', active: step === 2, done: step > 2 },
        { label: 'Download', active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {!file ? (
          <DropZone
            accent={tool.accent}
            title="Split a PDF"
            subtitle="Pick a PDF, then choose which pages to keep."
            buttonLabel="Select PDF"
            onFiles={(files) => void openFile(files[0])}
          />
        ) : (
          <div className="utility-tool__panel">
            <h2>{file.name}</h2>
            <p className="utility-tool__meta">{pageCount} page{pageCount === 1 ? '' : 's'}</p>
            <div className="utility-tool__range">
              <label>
                From
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={fromPage}
                  onChange={(e) => setFromPage(Number(e.target.value))}
                />
              </label>
              <label>
                To
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={toPage}
                  onChange={(e) => setToPage(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="utility-tool__actions">
              <AppButton
                title="Choose another"
                variant="ghost"
                small
                onClick={() => {
                  setFile(null);
                  setDoneName(null);
                  setError(null);
                }}
              />
              <AppButton
                title={busy ? 'Splitting…' : 'Split & download'}
                onClick={() => void runSplit()}
                disabled={busy}
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
