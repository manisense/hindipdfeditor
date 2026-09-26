import { useState } from 'react';

import { AppButton } from '../components/AppButton';
import { AppStatus } from '../components/AppStatus';
import { DropZone } from '../components/DropZone';
import { SelectedFileSummary } from '../components/SelectedFileSummary';
import { ToolShell } from '../components/ToolShell';
import { NextSteps } from '../components/NextSteps';
import { compressPdfFile, downloadPdfBytes, toPdfFile } from '../lib/pdfOps';
import { useTx } from '../lib/i18n';
import { getTool } from '../lib/tools';
import './UtilityTool.css';

const tool = getTool('compress')!;

type Result = {
  filename: string;
  originalBytes: number;
  compressedBytes: number;
  pageCount: number;
  /** False when re-encoding made the file bigger; nothing is downloaded then. */
  smaller: boolean;
  /** The compressed PDF, kept so it can go straight into another tool. */
  output: File | null;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function CompressPdfTool() {
  const tx = useTx();
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
      // Text-based PDFs can grow when every page becomes a JPEG; never hand back a bigger file.
      const smaller = bytes.byteLength < originalBytes;
      if (smaller) downloadPdfBytes(bytes, filename);
      setResult({
        filename,
        originalBytes,
        compressedBytes: bytes.byteLength,
        pageCount,
        smaller,
        output: smaller ? toPdfFile(bytes, filename) : null,
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
        { label: tx('Select PDF', 'पीडीएफ चुनें'), active: step === 1, done: step > 1 },
        { label: tx('Compress', 'कंप्रेस'), active: step === 2, done: step > 2 },
        { label: tx('Download', 'डाउनलोड'), active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {!file ? (
          <DropZone
            accent={tool.accent}
            title={tx('Compress a PDF', 'पीडीएफ का साइज कम करें')}
            subtitle={tx('Pages are re-encoded as JPEG in your browser. Text becomes image-based.', 'पेज आपके ब्राउज़र में JPEG इमेज के रूप में दोबारा बनते हैं। टेक्स्ट इमेज बन जाता है।')}
            buttonLabel={tx('Select PDF', 'पीडीएफ चुनें')}
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
                  <strong>{tx('Image quality', 'इमेज क्वालिटी')}</strong>
                  <span>{tx('Balance clarity and file size', 'साफ अक्षर और फाइल साइज में संतुलन')}</span>
                </div>
                <output>{Math.round(quality * 100)}%</output>
              </div>
              <label className="utility-tool__slider">
                <span className="utility-tool__sr-only">{tx('Compression quality', 'कंप्रेशन क्वालिटी')}</span>
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
                <span>{tx('Smaller file', 'छोटी फाइल')}</span>
                <span>{tx('Sharper pages', 'साफ पेज')}</span>
              </div>
              <p className="utility-tool__note">
                {tx('Compression rasterizes each page, so text will no longer be selectable in the output.', 'कंप्रेस करने पर हर पेज इमेज बनता है, इसलिए नई फाइल में टेक्स्ट सेलेक्ट नहीं होगा।')}
              </p>
            </div>
            <div className="utility-tool__actions">
              <AppButton
                title={tx('Choose another', 'दूसरी फाइल चुनें')}
                variant="ghost"
                small
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError(null);
                }}
              />
              <AppButton
                title={busy ? tx('Compressing…', 'कंप्रेस हो रहा है…') : tx('Compress & download', 'कंप्रेस करें और डाउनलोड करें')}
                onClick={() => void runCompress()}
                disabled={busy}
              />
            </div>
          </div>
        )}
        {error && <AppStatus tone="error" title={tx('Compression failed', 'कंप्रेस नहीं हो पाया')}>{error}</AppStatus>}
        {result && !result.smaller && (
          <AppStatus tone="warning" title={tx('This PDF is already compact', 'यह पीडीएफ पहले से छोटी है')}>
            {tx(
              `Compressing would make it bigger (${formatBytes(result.originalBytes)} → ${formatBytes(result.compressedBytes)}), so nothing was downloaded. Try a lower quality, or upload the original as it is.`,
              `कंप्रेस करने से फाइल बड़ी हो जाती (${formatBytes(result.originalBytes)} → ${formatBytes(result.compressedBytes)}), इसलिए कुछ डाउनलोड नहीं हुआ। क्वालिटी और घटाकर देखें, या मूल फाइल ही अपलोड करें।`,
            )}
          </AppStatus>
        )}
        {result?.smaller && (
          <AppStatus tone="success" title={tx('Your smaller PDF is ready', 'आपकी छोटी पीडीएफ तैयार है')}>
            {tx('Downloaded', 'डाउनलोड हुई:')} {result.filename} · {result.pageCount} {tx('pages', 'पेज')} ·{' '}
            {formatBytes(result.originalBytes)} → {formatBytes(result.compressedBytes)}
          </AppStatus>
        )}
        {result?.smaller && <NextSteps current="compress" output={result.output} />}
      </div>
    </ToolShell>
  );
}
