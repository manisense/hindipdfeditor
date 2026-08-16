import { useState } from 'react';

import { AppButton } from '../components/AppButton';
import { AppStatus } from '../components/AppStatus';
import { DropZone } from '../components/DropZone';
import { SelectedFileSummary } from '../components/SelectedFileSummary';
import { ToolShell } from '../components/ToolShell';
import { compressPdfFile, downloadPdfBytes } from '../lib/pdfOps';
import { getTool } from '../lib/tools';
import './UtilityTool.css';

const tool = getTool('compress')!;

type Result = {
  filename: string;
  originalBytes: number;
  compressedBytes: number;
  pageCount: number;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function CompressPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.72);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const step = result ? 3 : file ? 2 : 1;

  const runCompress = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { bytes, pageCount, originalBytes } = await compressPdfFile(file, quality);
      const base = file.name.replace(/\.pdf$/i, '') || 'compressed';
      const filename = `${base}-compressed.pdf`;
      downloadPdfBytes(bytes, filename);
      setResult({
        filename,
        originalBytes,
        compressedBytes: bytes.byteLength,
        pageCount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell
      tool={tool}
      compact={Boolean(file)}
      steps={[
        { label: 'Select PDF', active: step === 1, done: step > 1 },
        { label: 'Compress', active: step === 2, done: step > 2 },
        { label: 'Download', active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {!file ? (
          <DropZone
            accent={tool.accent}
            title="Compress a PDF"
            subtitle="Pages are re-encoded as JPEG in your browser. Text becomes image-based."
            buttonLabel="Select PDF"
            onFiles={(files) => {
              setFile(files[0]);
              setResult(null);
              setError(null);
            }}
          />
        ) : (
          <div className="utility-tool__panel">
            <SelectedFileSummary name={file.name} meta={formatBytes(file.size)} />
            <div className="utility-tool__setting-card">
              <div className="utility-tool__setting-heading">
                <div>
                  <strong>Image quality</strong>
                  <span>Balance clarity and file size</span>
                </div>
                <output>{Math.round(quality * 100)}%</output>
              </div>
              <label className="utility-tool__slider">
                <span className="utility-tool__sr-only">Compression quality</span>
                <input
                  type="range"
                  min={0.4}
                  max={0.92}
                  step={0.02}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
              </label>
              <div className="utility-tool__range-labels" aria-hidden="true">
                <span>Smaller file</span>
                <span>Sharper pages</span>
              </div>
              <p className="utility-tool__note">
                Compression rasterizes each page, so text will no longer be selectable in the output.
              </p>
            </div>
            <div className="utility-tool__actions">
              <AppButton
                title="Choose another"
                variant="ghost"
                small
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError(null);
                }}
              />
              <AppButton
                title={busy ? 'Compressing…' : 'Compress & download'}
                onClick={() => void runCompress()}
                disabled={busy}
              />
            </div>
          </div>
        )}
        {error && <AppStatus tone="error" title="Compression failed">{error}</AppStatus>}
        {result && (
          <AppStatus tone="success" title="Your smaller PDF is ready">
            Downloaded {result.filename} · {result.pageCount} pages ·{' '}
            {formatBytes(result.originalBytes)} → {formatBytes(result.compressedBytes)}
          </AppStatus>
        )}
      </div>
    </ToolShell>
  );
}
