import { useState } from 'react';

import { AppButton } from '../components/AppButton';
import { AppStatus } from '../components/AppStatus';
import { DropZone } from '../components/DropZone';
import { SelectedFileSummary } from '../components/SelectedFileSummary';
import { ToolShell } from '../components/ToolShell';
import { NextSteps } from '../components/NextSteps';
import { downloadPdfBytes, getPdfPageCount, splitPdfFile, toPdfFile } from '../lib/pdfOps';
import { useTx } from '../lib/i18n';
import { getTool } from '../lib/tools';
import './UtilityTool.css';

const tool = getTool('split')!;

export function SplitPdfTool() {
  const tx = useTx();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneName, setDoneName] = useState<string | null>(null);
  const [output, setOutput] = useState<File | null>(null);

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
      setOutput(toPdfFile(bytes, filename));
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
      compact={Boolean(file)}
      steps={[
        { label: tx('Select PDF', 'पीडीएफ चुनें'), active: step === 1, done: step > 1 },
        { label: tx('Choose pages', 'पेज चुनें'), active: step === 2, done: step > 2 },
        { label: tx('Download', 'डाउनलोड'), active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {!file ? (
          <DropZone
            accent={tool.accent}
            title={tx('Split a PDF', 'पीडीएफ के पेज अलग करें')}
            subtitle={tx('Pick a PDF, then choose which pages to keep.', 'पीडीएफ चुनें, फिर तय करें कि कौन-से पेज रखने हैं।')}
            buttonLabel={tx('Select PDF', 'पीडीएफ चुनें')}
            onFiles={(files) => void openFile(files[0])}
          />
        ) : (
          <div className="utility-tool__panel">
            <SelectedFileSummary
              name={file.name}
              meta={tx(`${pageCount} page${pageCount === 1 ? '' : 's'}`, `${pageCount} पेज`)}
            />
            <div className="utility-tool__setting-card">
              <div className="utility-tool__setting-heading">
                <div>
                  <strong>{tx('Choose pages to keep', 'रखने वाले पेज चुनें')}</strong>
                  <span>{tx('Enter one continuous page range', 'एक लगातार पेज रेंज डालें')}</span>
                </div>
              </div>
              <div className="utility-tool__range">
                <label>
                  {tx('From page', 'पेज से')}
                  <input
                    type="number"
                    min={1}
                    max={pageCount}
                    value={fromPage}
                    onChange={(e) => setFromPage(Number(e.target.value))}
                  />
                </label>
                <span className="utility-tool__range-arrow" aria-hidden="true">→</span>
                <label>
                  {tx('To page', 'पेज तक')}
                  <input
                    type="number"
                    min={1}
                    max={pageCount}
                    value={toPage}
                    onChange={(e) => setToPage(Number(e.target.value))}
                  />
                </label>
              </div>
            </div>
            <div className="utility-tool__actions">
              <AppButton
                title={tx('Choose another', 'दूसरी फाइल चुनें')}
                variant="ghost"
                small
                onClick={() => {
                  setFile(null);
                  setDoneName(null);
                  setError(null);
                }}
              />
              <AppButton
                title={busy ? tx('Splitting…', 'अलग कर रहे हैं…') : tx('Split & download', 'अलग करें और डाउनलोड करें')}
                onClick={() => void runSplit()}
                disabled={busy}
              />
            </div>
          </div>
        )}
        {error && <AppStatus tone="error" title={tx('Couldn’t split this PDF', 'यह पीडीएफ अलग नहीं हो पाई')}>{error}</AppStatus>}
        {doneName && (
          <AppStatus tone="success" title={tx('Split PDF ready', 'नई पीडीएफ तैयार')}>
            {tx('Downloaded', 'डाउनलोड हुई:')} {doneName}
          </AppStatus>
        )}
        {doneName && <NextSteps current="split" output={output} />}
      </div>
    </ToolShell>
  );
}
