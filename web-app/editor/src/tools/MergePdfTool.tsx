import { useState } from 'react';

import { AppButton } from '../components/AppButton';
import { AppStatus } from '../components/AppStatus';
import { DropZone } from '../components/DropZone';
import { SelectedFileSummary } from '../components/SelectedFileSummary';
import { ToolShell } from '../components/ToolShell';
import { downloadPdfBytes, mergePdfFiles } from '../lib/pdfOps';
import { useTx } from '../lib/i18n';
import { getTool } from '../lib/tools';
import './UtilityTool.css';

const tool = getTool('merge')!;

export function MergePdfTool() {
  const tx = useTx();
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
      compact={files.length > 0}
      steps={[
        { label: tx('Select PDFs', 'पीडीएफ चुनें'), active: step === 1, done: step > 1 },
        { label: tx('Merge', 'जोड़ें'), active: step === 2, done: step > 2 },
        { label: tx('Download', 'डाउनलोड'), active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {files.length === 0 ? (
          <DropZone
            multiple
            accent={tool.accent}
            title={tx('Merge PDF files', 'पीडीएफ फाइलें जोड़ें')}
            subtitle={tx('Choose two or more PDFs. They stay on your device.', 'दो या ज्यादा पीडीएफ चुनें। फाइलें आपके डिवाइस पर ही रहती हैं।')}
            buttonLabel={tx('Select PDF files', 'पीडीएफ फाइलें चुनें')}
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
              label={tx('Merge queue', 'जोड़ने की सूची')}
              name={tx(`${files.length} PDF${files.length === 1 ? '' : 's'} ready`, `${files.length} पीडीएफ तैयार`)}
              meta={tx('Files will be combined in the order shown below', 'फाइलें नीचे दिखाए क्रम में जुड़ेंगी')}
            />
            <ol className="utility-tool__list">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <span className="utility-tool__list-index">{index + 1}</span>
                  <span className="utility-tool__list-name">{file.name}</span>
                  <button
                    type="button"
                    className="utility-tool__remove"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  >
                    {tx('Remove', 'हटाएं')}
                  </button>
                </li>
              ))}
            </ol>
            <DropZone
              multiple
              compact
              accent={tool.accent}
              title={tx('Add more PDFs', 'और पीडीएफ जोड़ें')}
              subtitle={tx('Drop additional files to append.', 'और फाइलें यहाँ छोड़ें, वे आखिर में जुड़ेंगी।')}
              buttonLabel={tx('Add PDFs', 'पीडीएफ जोड़ें')}
              onFiles={(next) => setFiles((prev) => [...prev, ...next])}
            />
            <div className="utility-tool__actions">
              <AppButton
                title={tx('Clear', 'सब हटाएं')}
                variant="ghost"
                small
                onClick={() => {
                  setFiles([]);
                  setDoneName(null);
                  setError(null);
                }}
              />
              <AppButton
                title={busy ? tx('Merging…', 'जोड़ रहे हैं…') : tx('Merge & download', 'जोड़ें और डाउनलोड करें')}
                onClick={() => void runMerge()}
                disabled={busy || files.length < 2}
              />
            </div>
          </div>
        )}
        {error && <AppStatus tone="error" title={tx('Merge failed', 'जोड़ना नहीं हो पाया')}>{error}</AppStatus>}
        {doneName && (
          <AppStatus tone="success" title={tx('Merged PDF ready', 'जुड़ी हुई पीडीएफ तैयार')}>
            {tx('Downloaded', 'डाउनलोड हुई:')} {doneName}
          </AppStatus>
        )}
      </div>
    </ToolShell>
  );
}
