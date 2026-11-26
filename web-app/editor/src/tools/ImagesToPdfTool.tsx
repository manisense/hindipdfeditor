import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { ChoiceChips } from "../components/ChoiceChips";
import { DropZone } from "../components/DropZone";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { ToolShell } from "../components/ToolShell";
import { trackToolEvent } from "../lib/analytics";
import { useTx } from "../lib/i18n";
import { imagesToPdf, type ImagePageSize } from "../lib/imagesToPdf";
import { downloadPdfBytes } from "../lib/pdfOps";
import { moveItem } from "../lib/moveItem";
import { getTool } from "../lib/tools";
import "./UtilityTool.css";

const tool = getTool("jpg-to-pdf")!;

/** Most images in one PDF, so a phone does not run out of memory. */
const MAX_IMAGES = 200;


/** JPG to PDF: images in the chosen order, one per page, into a new PDF. */
export function ImagesToPdfTool() {
  const tx = useTx();
  const [files, setFiles] = useState<File[]>([]);
  const [size, setSize] = useState<ImagePageSize>("a4");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [doneName, setDoneName] = useState<string | null>(null);

  const step = doneName ? 3 : files.length > 0 ? 2 : 1;
  const tooMany = files.length > MAX_IMAGES;

  const update = (next: File[]) => {
    setFiles(next);
    setDoneName(null);
    setFailed(false);
  };

  const run = async () => {
    if (busy || files.length === 0 || tooMany) return;
    setBusy(true);
    setFailed(false);
    setDoneName(null);
    setProgress({ done: 0, total: files.length });
    try {
      const bytes = await imagesToPdf(files, size, (done, total) => setProgress({ done, total }));
      const base = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, "") || "images" : "images";
      const filename = `${base}.pdf`;
      downloadPdfBytes(bytes, filename);
      trackToolEvent("export_success", "jpg-to-pdf");
      setDoneName(filename);
    } catch (err) {
      console.error("JPG to PDF failed", err);
      trackToolEvent("export_failed", "jpg-to-pdf");
      setFailed(true);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <ToolShell
      tool={tool}
      compact={files.length > 0}
      steps={[
        { label: tx("Select images", "फोटो चुनें"), active: step === 1, done: step > 1 },
        { label: tx("Order pages", "पेज का क्रम"), active: step === 2, done: step > 2 },
        { label: tx("Download", "डाउनलोड"), active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {files.length === 0 ? (
          <DropZone
            kind="image"
            multiple
            accent={tool.accent}
            title={tx("JPG to PDF", "JPG से पीडीएफ")}
            subtitle={tx(
              "Put photos, scans or screenshots into one PDF, one per page, in the order you choose. Your images stay on this device.",
              "फोटो, स्कैन या स्क्रीनशॉट को एक पीडीएफ में रखें, हर पेज पर एक, अपने चुने क्रम में। आपकी फोटो इसी डिवाइस पर रहती हैं।",
            )}
            buttonLabel={tx("Select images", "फोटो चुनें")}
            onFiles={update}
          />
        ) : (
          <div className="utility-tool__panel">
            <SelectedFileSummary
              multiple
              label={tx("Pages", "पेज")}
              name={tx(`${files.length} image${files.length === 1 ? "" : "s"}`, `${files.length} फोटो`)}
              meta={tx("Each image becomes one page, in this order. Use the arrows to change it.", "हर फोटो एक पेज बनती है, इसी क्रम में। क्रम बदलने के लिए तीर इस्तेमाल करें।")}
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
                    onClick={() => update(moveItem(files, index, index - 1))}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="utility-tool__move"
                    disabled={busy || index === files.length - 1}
                    aria-label={tx(`Move ${file.name} down`, `${file.name} को नीचे करें`)}
                    onClick={() => update(moveItem(files, index, index + 1))}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="utility-tool__remove" disabled={busy} onClick={() => update(files.filter((_, i) => i !== index))}>
                    {tx("Remove", "हटाएं")}
                  </button>
                </li>
              ))}
            </ol>
            <DropZone
              kind="image"
              multiple
              compact
              accent={tool.accent}
              title={tx("Add more images", "और फोटो जोड़ें")}
              subtitle={tx("They are added at the end.", "वे आखिर में जुड़ेंगी।")}
              buttonLabel={tx("Add images", "फोटो जोड़ें")}
              disabled={busy}
              onFiles={(next) => update([...files, ...next])}
            />
            <section className="utility-tool__setting-card" aria-label={tx("Page settings", "पेज की सेटिंग")}>
              <ChoiceChips
                id="page-size"
                label={tx("Page size", "पेज का साइज")}
                value={size}
                disabled={busy}
                options={[
                  ["a4", tx("A4, with margin", "A4, किनारे के साथ")],
                  ["image", tx("Same as image", "फोटो के बराबर")],
                ]}
                onChange={(next) => {
                  setSize(next);
                  setDoneName(null);
                }}
              />
              <p className="utility-tool__note">
                {size === "a4"
                  ? tx("Each page turns to suit its image, and photos are scaled down to fit, never up.", "हर पेज अपनी फोटो के हिसाब से घूमता है, और फोटो पेज में आने तक छोटी होती है, कभी बड़ी नहीं।")
                  : tx("Each page is exactly the size of its image.", "हर पेज ठीक अपनी फोटो के साइज का होता है।")}
              </p>
              {tooMany && (
                <p className="utility-tool__field-error" role="alert">
                  {tx(`Up to ${MAX_IMAGES} images in one PDF. Remove some and make a second PDF.`, `एक पीडीएफ में ${MAX_IMAGES} फोटो तक। कुछ हटाकर दूसरी पीडीएफ बनाएं।`)}
                </p>
              )}
            </section>
            <div className="utility-tool__actions">
              <AppButton title={tx("Clear", "सब हटाएं")} disabled={busy} variant="ghost" small onClick={() => update([])} />
              <AppButton
                title={
                  busy && progress
                    ? tx(`Making PDF… ${progress.done}/${progress.total}`, `पीडीएफ बन रही है… ${progress.done}/${progress.total}`)
                    : tx("Make PDF & download", "पीडीएफ बनाएं और डाउनलोड करें")
                }
                onClick={() => void run()}
                disabled={busy || files.length === 0 || tooMany}
              />
            </div>
          </div>
        )}
        {failed && (
          <AppStatus tone="error" title={tx("Couldn’t make the PDF", "पीडीएफ नहीं बन पाई")}>
            {tx(
              "One of the images could not be read. Check that each file opens as a picture, remove it if not, and try again.",
              "कोई फोटो पढ़ी नहीं जा सकी। देखें कि हर फाइल फोटो की तरह खुलती है, न खुले तो उसे हटाकर फिर कोशिश करें।",
            )}
          </AppStatus>
        )}
        {doneName && (
          <AppStatus tone="success" title={tx("PDF ready", "पीडीएफ तैयार")}>
            {tx("Downloaded", "डाउनलोड हुई:")} {doneName}
          </AppStatus>
        )}
      </div>
    </ToolShell>
  );
}
