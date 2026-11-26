import { useEffect, useState } from "react";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { ChoiceChips } from "../components/ChoiceChips";
import { DropZone } from "../components/DropZone";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { ToolShell } from "../components/ToolShell";
import { trackToolEvent } from "../lib/analytics";
import { downloadBlob } from "../lib/downloadBlob";
import { useTx } from "../lib/i18n";
import { cmToPx, resizeImage, type FitMode, type ResizeResult } from "../lib/resizeImage";
import { getTool } from "../lib/tools";
import "./UtilityTool.css";
import "./ResizeImageTool.css";

const tool = getTool("resize-image")!;

/** Bytes in a KB, as application portals count them. */
const KB = 1024;
const MIN_SIDE_PX = 10;
const MAX_SIDE_PX = 4000;

type Kind = "photo" | "signature";
type Unit = "px" | "cm";

/** Starting values only; the form a user fills in names its own limits. */
const START: Record<Kind, { width: string; height: string; minKb: string; maxKb: string }> = {
  photo: { width: "3.5", height: "4.5", minKb: "20", maxKb: "50" },
  signature: { width: "3.5", height: "1.5", minKb: "10", maxKb: "20" },
};

function number(text: string): number {
  return Number(text.replace(",", "."));
}

/** Photo and signature resizer: exact size in px or cm and a file size range in KB, as JPG. */
export function ResizeImageTool() {
  const tx = useTx();
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("photo");
  const [unit, setUnit] = useState<Unit>("cm");
  const [width, setWidth] = useState(START.photo.width);
  const [height, setHeight] = useState(START.photo.height);
  const [dpi, setDpi] = useState("200");
  const [mode, setMode] = useState<FitMode>("fill");
  const [position, setPosition] = useState(50);
  const [minKb, setMinKb] = useState(START.photo.minKb);
  const [maxKb, setMaxKb] = useState(START.photo.maxKb);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(ResizeResult & { url: string; widthPx: number; heightPx: number }) | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  const dpiValue = Math.round(number(dpi));
  const toPx = (text: string) => (unit === "cm" ? cmToPx(number(text), dpiValue) : Math.round(number(text)));
  const widthPx = toPx(width);
  const heightPx = toPx(height);
  const minBytes = Math.max(0, number(minKb || "0")) * KB;
  const maxBytes = number(maxKb) * KB;
  const sizeOk = [widthPx, heightPx].every((v) => Number.isFinite(v) && v >= MIN_SIDE_PX && v <= MAX_SIDE_PX);
  const dpiOk = Number.isFinite(dpiValue) && dpiValue >= 50 && dpiValue <= 1200;
  const kbOk = Number.isFinite(maxBytes) && maxBytes >= KB && Number.isFinite(minBytes) && minBytes <= maxBytes;
  const ready = Boolean(file) && sizeOk && dpiOk && kbOk;

  const changed = () => {
    setResult(null);
    setFailed(false);
  };

  const choose = (next: File) => {
    setFile(next);
    setSourceUrl(URL.createObjectURL(next));
    changed();
  };

  const pickKind = (next: Kind) => {
    setKind(next);
    setUnit("cm");
    setWidth(START[next].width);
    setHeight(START[next].height);
    setMinKb(START[next].minKb);
    setMaxKb(START[next].maxKb);
    changed();
  };

  const run = async () => {
    if (!file || !ready || busy) return;
    setBusy(true);
    changed();
    try {
      const resized = await resizeImage(file, {
        widthPx,
        heightPx,
        mode,
        position: position / 100,
        cleanSignature: kind === "signature",
        minBytes,
        maxBytes,
        dpi: dpiValue,
      });
      trackToolEvent("export_success", "resize-image");
      setResult({ ...resized, url: URL.createObjectURL(resized.blob), widthPx, heightPx });
    } catch (err) {
      console.error("Resize failed", err);
      trackToolEvent("export_failed", "resize-image");
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!file || !result) return;
    const base = file.name.replace(/\.[^.]+$/, "") || kind;
    downloadBlob(result.blob, `${base}-${result.widthPx}x${result.heightPx}.jpg`);
  };

  const field = (label: string, value: string, set: (v: string) => void, inputMode: "decimal" | "numeric" = "decimal") => (
    <label className="utility-tool__field">
      <span>{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        disabled={busy}
        onChange={(event) => {
          set(event.target.value);
          changed();
        }}
      />
    </label>
  );

  return (
    <ToolShell tool={tool} compact={Boolean(file)}>
      <div className="utility-tool">
        {!file ? (
          <DropZone
            kind="image"
            accent={tool.accent}
            title={tx("Resize photo and signature", "फोटो और हस्ताक्षर का साइज बदलें")}
            subtitle={tx(
              "Make a photo or signature the exact size and KB an application form asks for. Your image stays on this device.",
              "फोटो या हस्ताक्षर को ठीक उतने साइज और KB का बनाएं जितना आवेदन फॉर्म मांगता है। आपकी फोटो इसी डिवाइस पर रहती है।",
            )}
            buttonLabel={tx("Select image", "फोटो चुनें")}
            onFiles={(files) => choose(files[0])}
          />
        ) : (
          <div className="utility-tool__panel">
            <SelectedFileSummary label={tx("Selected image", "चुनी हुई फोटो")} name={file.name} meta={`${Math.round(file.size / KB)} KB`} />
            <section className="utility-tool__setting-card" aria-label={tx("Size settings", "साइज की सेटिंग")}>
              <ChoiceChips
                id="resize-kind"
                label={tx("This is a", "यह है")}
                value={kind}
                disabled={busy}
                options={[
                  ["photo", tx("Photo", "फोटो")],
                  ["signature", tx("Signature (paper turned white)", "हस्ताक्षर (कागज़ सफेद)")],
                ]}
                onChange={pickKind}
              />
              <ChoiceChips
                id="resize-unit"
                label={tx("Size in", "साइज")}
                value={unit}
                disabled={busy}
                options={[
                  ["cm", tx("cm", "सेमी")],
                  ["px", tx("pixels", "पिक्सेल")],
                ]}
                onChange={(next) => {
                  setUnit(next);
                  setWidth(next === "px" ? String(widthPx) : String(Math.round((widthPx / dpiValue) * 254) / 100));
                  setHeight(next === "px" ? String(heightPx) : String(Math.round((heightPx / dpiValue) * 254) / 100));
                  changed();
                }}
              />
              <div className="resize-tool__row">
                {field(unit === "cm" ? tx("Width (cm)", "चौड़ाई (सेमी)") : tx("Width (px)", "चौड़ाई (px)"), width, setWidth)}
                {field(unit === "cm" ? tx("Height (cm)", "ऊंचाई (सेमी)") : tx("Height (px)", "ऊंचाई (px)"), height, setHeight)}
                {field(tx("Resolution (dpi)", "रेज़ोल्यूशन (dpi)"), dpi, setDpi, "numeric")}
              </div>
              {!sizeOk && (
                <p className="utility-tool__field-error" role="alert">
                  {tx(`Width and height must come to ${MIN_SIDE_PX}–${MAX_SIDE_PX} px.`, `चौड़ाई और ऊंचाई ${MIN_SIDE_PX}–${MAX_SIDE_PX} px के बीच होनी चाहिए।`)}
                </p>
              )}
              {!dpiOk && (
                <p className="utility-tool__field-error" role="alert">
                  {tx("Use a resolution from 50 to 1200 dpi.", "50 से 1200 dpi के बीच रेज़ोल्यूशन लिखें।")}
                </p>
              )}
              {sizeOk && unit === "cm" && (
                <p className="utility-tool__note">{tx(`That is ${widthPx} × ${heightPx} px at ${dpiValue} dpi.`, `यह ${dpiValue} dpi पर ${widthPx} × ${heightPx} px है।`)}</p>
              )}
              <div className="resize-tool__row">
                {field(tx("Smallest size (KB)", "कम से कम साइज (KB)"), minKb, setMinKb, "numeric")}
                {field(tx("Largest size (KB)", "ज़्यादा से ज़्यादा साइज (KB)"), maxKb, setMaxKb, "numeric")}
              </div>
              {!kbOk && (
                <p className="utility-tool__field-error" role="alert">
                  {tx("Enter a largest size of at least 1 KB, and a smallest size no larger than it.", "ज़्यादा से ज़्यादा साइज कम से कम 1 KB लिखें, और कम से कम साइज उससे बड़ा न हो।")}
                </p>
              )}
              <ChoiceChips
                id="resize-fit"
                label={tx("If the shape differs", "अगर आकार अलग हो")}
                value={mode}
                disabled={busy}
                options={[
                  ["fill", tx("Crop the edges", "किनारे काटें")],
                  ["fit", tx("Keep all, add white border", "पूरी रखें, सफेद किनारा जोड़ें")],
                ]}
                onChange={(next) => {
                  setMode(next);
                  changed();
                }}
              />
              {mode === "fill" && (
                <label className="utility-tool__slider">
                  <span>{tx("Crop position", "कहाँ से काटें")}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={position}
                    disabled={busy}
                    onChange={(event) => {
                      setPosition(Number(event.target.value));
                      changed();
                    }}
                  />
                </label>
              )}
              <p className="utility-tool__note">
                {tx(
                  "Use the size and KB limits printed in your form's notice. The result is a JPG.",
                  "अपने फॉर्म की सूचना में लिखा साइज और KB इस्तेमाल करें। नतीजा JPG होगा।",
                )}
              </p>
            </section>
            {result && (
              <figure className="resize-tool__preview">
                <img src={result.url} width={result.widthPx} height={result.heightPx} alt={tx("Resized image", "बदली हुई फोटो")} />
                <figcaption>
                  {result.widthPx} × {result.heightPx} px · {(result.blob.size / KB).toFixed(1)} KB
                </figcaption>
              </figure>
            )}
            {result && !result.inRange && (
              <AppStatus tone="warning" title={tx("Could not reach that KB range", "यह KB सीमा नहीं बन पाई")}>
                {result.miss === "too-big"
                  ? tx(
                      `Even at the lowest quality this size of image is ${(result.blob.size / KB).toFixed(1)} KB. Use smaller width and height if the form allows it.`,
                      `सबसे कम क्वालिटी पर भी इस साइज की फोटो ${(result.blob.size / KB).toFixed(1)} KB है। फॉर्म अनुमति दे तो चौड़ाई और ऊंचाई कम करें।`,
                    )
                  : tx(
                      `At full quality this image is ${(result.blob.size / KB).toFixed(1)} KB, below your smallest size. Simple images compress well; check whether the form really needs a minimum, or use larger width and height if allowed.`,
                      `पूरी क्वालिटी पर यह फोटो ${(result.blob.size / KB).toFixed(1)} KB है, आपके कम से कम साइज से छोटी। सादी फोटो बहुत छोटी बनती है; देखें कि फॉर्म को सच में न्यूनतम साइज चाहिए, या अनुमति हो तो चौड़ाई और ऊंचाई बढ़ाएं।`,
                    )}
              </AppStatus>
            )}
            <div className="utility-tool__actions">
              <AppButton
                title={tx("Choose another", "दूसरी फोटो चुनें")}
                variant="ghost"
                small
                disabled={busy}
                onClick={() => {
                  setFile(null);
                  changed();
                }}
              />
              {result ? (
                <AppButton title={tx("Download JPG", "JPG डाउनलोड करें")} onClick={download} />
              ) : (
                <AppButton title={busy ? tx("Resizing…", "साइज बदल रहे हैं…") : tx("Resize", "साइज बदलें")} disabled={!ready || busy} onClick={() => void run()} />
              )}
            </div>
            {sourceUrl && !result && <img className="resize-tool__source" src={sourceUrl} alt={tx("Chosen image", "चुनी हुई फोटो")} />}
          </div>
        )}
        {failed && (
          <AppStatus tone="error" title={tx("Couldn’t resize this image", "फोटो का साइज नहीं बदल पाया")}>
            {tx("The image could not be read. Try another JPG, PNG or WebP file.", "फोटो पढ़ी नहीं जा सकी। कोई दूसरी JPG, PNG या WebP फाइल आज़माएं।")}
          </AppStatus>
        )}
      </div>
    </ToolShell>
  );
}
