import { ChevronLeft, ChevronRight, ImagePlus, PenLine, Type } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { DropZone } from "../components/DropZone";
import { ImageEditOverlay } from "../components/ImageEditOverlay";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { SignaturePad } from "../components/SignaturePad";
import { ToolShell } from "../components/ToolShell";
import { trackToolEvent } from "../lib/analytics";
import { downloadPdfBlob } from "../lib/exportPdf";
import { useTx } from "../lib/i18n";
import { IMAGE_ACCEPT, readImageFile } from "../lib/imageImport";
import { getPageCount, getPageSize, renderPage, setPdfBytes } from "../lib/pdfToImages";
import { signPdf, type SignaturePlacement } from "../lib/signPdf";
import { parsePageList, presetRect, SIGN_POSITIONS, type SignPosition } from "../lib/signPlacement";
import { typedSignature, withClearBackground, type SignatureImage } from "../lib/signatureImage";
import { getTool } from "../lib/tools";
import type { ImageEdit } from "../state/editStore";
import "./UtilityTool.css";
import "./SignPdfTool.css";

const tool = getTool("sign")!;

type Mode = "manual" | "all" | "chosen";
type PageSize = { widthPt: number; heightPt: number };

/** Preview render scale, in px per PDF point. */
const PREVIEW_PX_PER_PT = 1.5;
/** Default signature width, in PDF points (about 5.3 cm), and its range. */
const DEFAULT_WIDTH_PT = 150;
const MIN_WIDTH_PT = 60;
const MAX_WIDTH_PT = 320;
/** Distance from the page edges for automatic placement, in PDF points (half an inch). */
const MARGIN_PT = 36;
/** Largest PDF accepted, in pages. */
const MAX_PAGES = 500;

const INKS = [
  { color: "#16181f", en: "Black", hi: "काला" },
  { color: "#1f3a93", en: "Blue", hi: "नीला" },
] as const;

const POSITION_LABELS: Record<SignPosition, [string, string]> = {
  "top-left": ["Top left", "ऊपर बाएं"],
  "top-center": ["Top centre", "ऊपर बीच में"],
  "top-right": ["Top right", "ऊपर दाएं"],
  "bottom-left": ["Bottom left", "नीचे बाएं"],
  "bottom-center": ["Bottom centre", "नीचे बीच में"],
  "bottom-right": ["Bottom right", "नीचे दाएं"],
};

/**
 * Sign PDF: make a signature (draw, type or upload), place it by hand, on every page or on chosen
 * pages, and download the signed copy. Everything runs in the browser.
 */
export function SignPdfTool() {
  const tx = useTx();
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [opening, setOpening] = useState(false);
  const [signature, setSignature] = useState<SignatureImage | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [typedInk, setTypedInk] = useState<string>(INKS[0].color);
  const [typedSerif, setTypedSerif] = useState(false);
  const [upload, setUpload] = useState<SignatureImage | null>(null);
  const [clearPaper, setClearPaper] = useState(true);
  const [mode, setMode] = useState<Mode>("manual");
  const [position, setPosition] = useState<SignPosition>("bottom-right");
  const [widthPt, setWidthPt] = useState(DEFAULT_WIDTH_PT);
  const [pageText, setPageText] = useState("1");
  const [manual, setManual] = useState<(SignaturePlacement & { id: string })[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ filename: string; count: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [viewWidthPx, setViewWidthPx] = useState(0);

  const aspect = signature ? signature.pxHeight / signature.pxWidth : 0.4;
  const pageCount = pageSizes.length;
  const chosen = mode === "chosen" ? parsePageList(pageText, Math.max(1, pageCount)) : null;
  const step = done ? 3 : file ? 2 : 1;

  const openFile = async (next: File) => {
    setOpening(true);
    setError(null);
    setDone(null);
    try {
      const data = new Uint8Array(await next.arrayBuffer());
      setPdfBytes(data);
      const count = await getPageCount();
      if (count > MAX_PAGES) throw new Error(tx(`This PDF has ${count} pages; up to ${MAX_PAGES} can be signed.`, `इस पीडीएफ में ${count} पेज हैं; ${MAX_PAGES} तक पेज पर हस्ताक्षर हो सकते हैं।`));
      const sizes: PageSize[] = [];
      for (let i = 0; i < count; i++) {
        const size = await getPageSize(i, 1);
        sizes.push({ widthPt: size.pxWidth, heightPt: size.pxHeight });
      }
      setFile(next);
      setBytes(data);
      setPageSizes(sizes);
      setManual([]);
      setCurrent(0);
      trackToolEvent("pdf_open_success", "sign");
    } catch (err) {
      console.error("Opening the PDF failed", err);
      setError(err instanceof Error && err.message ? err.message : tx("This PDF could not be opened.", "यह पीडीएफ नहीं खुल सकी।"));
    } finally {
      setOpening(false);
    }
  };

  // Render the page on show.
  useEffect(() => {
    if (!bytes || pageCount === 0) return;
    let cancelled = false;
    setPreview(null);
    void renderPage(current, PREVIEW_PX_PER_PT)
      .then((image) => {
        if (!cancelled) setPreview(image.uri);
      })
      .catch((err: unknown) => console.warn("Page preview failed", err));
    return () => {
      cancelled = true;
    };
  }, [bytes, current, pageCount]);

  useLayoutEffect(() => {
    const element = pageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewWidthPx(element.clientWidth));
    observer.observe(element);
    setViewWidthPx(element.clientWidth);
    return () => observer.disconnect();
  }, [file]);

  // Every signature placement the download will make.
  const placements = (): SignaturePlacement[] => {
    if (!signature) return [];
    if (mode === "manual") return manual;
    const pages = mode === "all" ? pageSizes.map((_, i) => i) : chosen && "pages" in chosen ? chosen.pages : [];
    return pages.map((page) => ({ page, ...presetRect(pageSizes[page], aspect, position, widthPt, MARGIN_PT) }));
  };

  const addToPage = () => {
    if (!signature || !pageSizes[current]) return;
    const size = pageSizes[current];
    const wPt = Math.min(widthPt, size.widthPt - 2 * MARGIN_PT);
    const hPt = wPt * aspect;
    const id = `${current}-${Date.now()}`;
    setManual((list) => [...list, { id, page: current, xPt: (size.widthPt - wPt) / 2, yPt: size.heightPt * 0.7 - hPt / 2, wPt, hPt }]);
    setSelected(id);
    setDone(null);
  };

  const applyTyped = async () => {
    if (!typedName.trim()) return;
    setSignature(await typedSignature(typedName.trim(), typedSerif ? "NotoSerifDevanagari" : "NotoSansDevanagari", typedInk));
    setTyping(false);
    setDone(null);
  };

  const applyUpload = async (image: SignatureImage, clear: boolean) => {
    setSignature(clear ? await withClearBackground(image.uri) : image);
    setDone(null);
  };

  const download = async () => {
    if (!file || !bytes || !signature || busy) return;
    const list = placements();
    if (list.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await signPdf(bytes, file.name, pageSizes, list, signature.uri);
      const filename = `${file.name.replace(/\.pdf$/i, "") || "document"}-signed.pdf`;
      downloadPdfBlob(blob, filename);
      setDone({ filename, count: list.length });
      trackToolEvent("export_success", "sign");
    } catch (err) {
      console.error("Signing failed", err);
      trackToolEvent("export_failed", "sign");
      setError(tx("The signed PDF could not be made. Try again, or try another copy of the PDF.", "हस्ताक्षर वाली पीडीएफ नहीं बन सकी। फिर कोशिश करें या पीडीएफ की दूसरी कॉपी आज़माएं।"));
    } finally {
      setBusy(false);
    }
  };

  const size = pageSizes[current];
  const shown = placements().filter((placement) => placement.page === current);
  const canDownload = Boolean(signature) && placements().length > 0 && !busy;

  return (
    <ToolShell
      tool={tool}
      compact={Boolean(file)}
      steps={[
        { label: tx("Select PDF", "पीडीएफ चुनें"), active: step === 1, done: step > 1 },
        { label: tx("Sign", "हस्ताक्षर करें"), active: step === 2, done: step > 2 },
        { label: tx("Download", "डाउनलोड"), active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool sign-tool">
        {!file ? (
          <DropZone
            accent={tool.accent}
            title={tx("Sign a PDF", "पीडीएफ पर हस्ताक्षर करें")}
            subtitle={tx(
              "Draw, type or upload your signature and place it on the pages you choose. Your file stays on this device.",
              "अपना हस्ताक्षर बनाएं, टाइप करें या उसकी फोटो चुनें और उसे अपने चुने पेजों पर लगाएं। फाइल इसी डिवाइस पर रहती है।",
            )}
            buttonLabel={opening ? tx("Opening…", "खुल रही है…") : tx("Select PDF", "पीडीएफ चुनें")}
            disabled={opening}
            onFiles={(files) => void openFile(files[0])}
          />
        ) : (
          <div className="sign-tool__layout">
            <div className="sign-tool__side">
              <SelectedFileSummary
                name={file.name}
                meta={tx(`${pageCount} pages`, `${pageCount} पेज`)}
              />

              <section className="utility-tool__setting-card" aria-labelledby="sign-signature-heading">
                <strong id="sign-signature-heading">{tx("1. Your signature", "1. आपका हस्ताक्षर")}</strong>
                {signature && !typing && (
                  <div className="sign-tool__signature">
                    <img src={signature.uri} alt={tx("Your signature", "आपका हस्ताक्षर")} />
                  </div>
                )}
                {typing ? (
                  <div className="sign-tool__typed">
                    <label className="utility-tool__field">
                      <span>{tx("Your name (Hindi or English)", "आपका नाम (हिंदी या अंग्रेज़ी)")}</span>
                      <input value={typedName} onChange={(event) => setTypedName(event.target.value)} lang="hi" autoFocus />
                    </label>
                    <div className="sign-tool__chips" role="radiogroup" aria-label={tx("Style", "स्टाइल")}>
                      {[false, true].map((serif) => (
                        <button key={String(serif)} type="button" role="radio" aria-checked={typedSerif === serif} className="sign-tool__chip" onClick={() => setTypedSerif(serif)}>
                          {serif ? tx("Serif", "सेरिफ") : tx("Sans", "सैंस")}
                        </button>
                      ))}
                      {INKS.map((ink) => (
                        <button key={ink.color} type="button" role="radio" aria-checked={typedInk === ink.color} className="sign-tool__chip" onClick={() => setTypedInk(ink.color)}>
                          <span className="sign-tool__swatch" style={{ background: ink.color }} aria-hidden="true" />
                          {tx(ink.en, ink.hi)}
                        </button>
                      ))}
                    </div>
                    <div className="sign-tool__row">
                      <AppButton title={tx("Cancel", "रद्द करें")} variant="ghost" small onClick={() => setTyping(false)} />
                      <AppButton title={tx("Use this signature", "यह हस्ताक्षर लगाएं")} small disabled={!typedName.trim()} onClick={() => void applyTyped()} />
                    </div>
                  </div>
                ) : (
                  <div className="sign-tool__row">
                    <AppButton title={tx("Draw", "बनाएं")} icon={<PenLine size={15} aria-hidden="true" />} variant="secondary" small onClick={() => setPadOpen(true)} />
                    <AppButton title={tx("Type", "टाइप करें")} icon={<Type size={15} aria-hidden="true" />} variant="secondary" small onClick={() => setTyping(true)} />
                    <AppButton title={tx("Upload image", "इमेज चुनें")} icon={<ImagePlus size={15} aria-hidden="true" />} variant="secondary" small onClick={() => imageInputRef.current?.click()} />
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept={IMAGE_ACCEPT}
                      hidden
                      onChange={(event) => {
                        const picked = event.target.files?.[0];
                        event.target.value = "";
                        if (!picked) return;
                        void readImageFile(picked)
                          .then((image) => {
                            setUpload(image);
                            return applyUpload(image, clearPaper);
                          })
                          .catch(() => setError(tx("Choose a PNG, JPEG or WebP image under 20 MB.", "20 MB से छोटी PNG, JPEG या WebP इमेज चुनें।")));
                      }}
                    />
                  </div>
                )}
                {upload && signature && !typing && (
                  <label className="sign-tool__check">
                    <input
                      type="checkbox"
                      checked={clearPaper}
                      onChange={(event) => {
                        setClearPaper(event.target.checked);
                        void applyUpload(upload, event.target.checked);
                      }}
                    />
                    {tx("Remove the white paper behind the signature", "हस्ताक्षर के पीछे का सफ़ेद कागज़ हटाएं")}
                  </label>
                )}
              </section>

              <section className="utility-tool__setting-card" aria-labelledby="sign-place-heading">
                <strong id="sign-place-heading">{tx("2. Where to sign", "2. कहाँ हस्ताक्षर करें")}</strong>
                <div className="sign-tool__modes" role="radiogroup" aria-label={tx("Where to sign", "कहाँ हस्ताक्षर करें")}>
                  {(
                    [
                      ["manual", tx("Place by hand", "खुद जगह चुनें")],
                      ["all", tx("Every page", "हर पेज पर")],
                      ["chosen", tx("Chosen pages", "चुने पेजों पर")],
                    ] as [Mode, string][]
                  ).map(([value, label]) => (
                    <button key={value} type="button" role="radio" aria-checked={mode === value} className="sign-tool__chip" onClick={() => { setMode(value); setDone(null); }}>
                      {label}
                    </button>
                  ))}
                </div>
                {mode === "manual" ? (
                  <p className="utility-tool__note">
                    {tx(
                      "Open a page, press “Sign this page”, then drag the signature into place and resize it from its corner. Add it to as many pages as you need.",
                      "पेज खोलें, “इस पेज पर हस्ताक्षर करें” दबाएं, फिर हस्ताक्षर को खींचकर सही जगह रखें और कोने से छोटा-बड़ा करें। जितने पेज चाहें, उन पर लगाएं।",
                    )}
                  </p>
                ) : (
                  <>
                    {mode === "chosen" && (
                      <label className="utility-tool__field">
                        <span>{tx("Pages, e.g. 1, 3-5", "पेज, जैसे 1, 3-5")}</span>
                        <input value={pageText} inputMode="numeric" onChange={(event) => { setPageText(event.target.value); setDone(null); }} />
                        {chosen && "error" in chosen && (
                          <small className="sign-tool__error" role="alert">
                            {chosen.error === "range"
                              ? tx(`Use pages 1 to ${pageCount}.`, `1 से ${pageCount} तक के पेज लिखें।`)
                              : chosen.error === "empty"
                                ? tx("Enter the pages to sign.", "हस्ताक्षर वाले पेज लिखें।")
                                : tx("Write pages like 1, 3-5.", "पेज ऐसे लिखें: 1, 3-5")}
                          </small>
                        )}
                      </label>
                    )}
                    <div className="sign-tool__positions" role="radiogroup" aria-label={tx("Position on the page", "पेज पर जगह")}>
                      {SIGN_POSITIONS.map((value) => (
                        <button key={value} type="button" role="radio" aria-checked={position === value} className="sign-tool__chip" onClick={() => { setPosition(value); setDone(null); }}>
                          {tx(...POSITION_LABELS[value])}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <label className="utility-tool__field">
                  <span>{tx(`Signature width: ${(widthPt / 72 * 2.54).toFixed(1)} cm`, `हस्ताक्षर की चौड़ाई: ${(widthPt / 72 * 2.54).toFixed(1)} सेमी`)}</span>
                  <input type="range" min={MIN_WIDTH_PT} max={MAX_WIDTH_PT} step={5} value={widthPt} onChange={(event) => { setWidthPt(Number(event.target.value)); setDone(null); }} />
                </label>
              </section>

              <p className="utility-tool__note">
                {tx(
                  "This adds your signature as an image (an electronic signature). It is not a certificate-based digital signature (DSC); documents that require a DSC must be signed with one.",
                  "यह आपके हस्ताक्षर को इमेज के रूप में जोड़ता है (इलेक्ट्रॉनिक हस्ताक्षर)। यह सर्टिफिकेट वाला डिजिटल हस्ताक्षर (DSC) नहीं है; जिन दस्तावेज़ों पर DSC ज़रूरी है, उन पर DSC से ही हस्ताक्षर करें।",
                )}
              </p>

              <div className="utility-tool__actions">
                <AppButton
                  title={tx("Choose another", "दूसरी फाइल चुनें")}
                  variant="ghost"
                  small
                  disabled={busy}
                  onClick={() => {
                    setFile(null);
                    setBytes(null);
                    setPageSizes([]);
                    setManual([]);
                    setDone(null);
                    setError(null);
                  }}
                />
                <AppButton
                  title={busy ? tx("Signing…", "हस्ताक्षर हो रहे हैं…") : tx("Download signed PDF", "हस्ताक्षर वाली पीडीएफ डाउनलोड करें")}
                  disabled={!canDownload}
                  onClick={() => void download()}
                />
              </div>
              {!signature && <p className="utility-tool__note">{tx("Make your signature first.", "पहले अपना हस्ताक्षर बनाएं।")}</p>}
              {signature && placements().length === 0 && mode === "manual" && (
                <p className="utility-tool__note">{tx("Add the signature to at least one page.", "कम से कम एक पेज पर हस्ताक्षर लगाएं।")}</p>
              )}
            </div>

            <div className="sign-tool__preview">
              <div className="sign-tool__pager">
                <button type="button" className="app-button app-button--secondary app-button--small" aria-label={tx("Previous page", "पिछला पेज")} disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <span>{tx(`Page ${current + 1} of ${pageCount}`, `पेज ${current + 1} / ${pageCount}`)}</span>
                <button type="button" className="app-button app-button--secondary app-button--small" aria-label={tx("Next page", "अगला पेज")} disabled={current >= pageCount - 1} onClick={() => setCurrent((c) => c + 1)}>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                {mode === "manual" && (
                  <AppButton title={tx("Sign this page", "इस पेज पर हस्ताक्षर करें")} small disabled={!signature} onClick={addToPage} />
                )}
              </div>
              <div
                ref={pageRef}
                className="sign-tool__page"
                style={size ? { aspectRatio: `${size.widthPt} / ${size.heightPt}` } : undefined}
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget || (event.target as HTMLElement).tagName === "IMG") setSelected(null);
                }}
              >
                {preview ? <img className="sign-tool__page-image" src={preview} alt={tx(`Page ${current + 1}`, `पेज ${current + 1}`)} /> : <div className="sign-tool__page-loading" aria-busy="true" />}
                {signature && size && viewWidthPx > 0 &&
                  (mode === "manual"
                    ? manual
                        .filter((placement) => placement.page === current)
                        .map((placement) => {
                          const edit: ImageEdit = { type: "image", id: placement.id, page: current, xPt: placement.xPt, yPt: placement.yPt, wPt: placement.wPt, hPt: placement.hPt, uri: signature.uri, signature: true };
                          return (
                            <ImageEditOverlay
                              key={placement.id}
                              edit={edit}
                              viewWidthPx={viewWidthPx}
                              pageWidthPt={size.widthPt}
                              pageHeightPt={size.heightPt}
                              selected={selected === placement.id}
                              interactive
                              label={tx("Signature", "हस्ताक्षर")}
                              deleteLabel={tx("Remove signature", "हस्ताक्षर हटाएं")}
                              resizeLabel={tx("Drag to resize", "आकार बदलने के लिए खींचें")}
                              onSelect={() => setSelected(placement.id)}
                              onChange={(rect) => {
                                setManual((list) => list.map((p) => (p.id === placement.id ? { ...p, ...rect } : p)));
                                setDone(null);
                              }}
                              onDelete={() => {
                                setManual((list) => list.filter((p) => p.id !== placement.id));
                                setSelected(null);
                              }}
                            />
                          );
                        })
                    : shown.map((placement, k) => {
                        const scale = viewWidthPx / size.widthPt;
                        return (
                          <img
                            key={k}
                            className="sign-tool__placed"
                            src={signature.uri}
                            alt=""
                            style={{ left: placement.xPt * scale, top: placement.yPt * scale, width: placement.wPt * scale, height: placement.hPt * scale }}
                          />
                        );
                      }))}
              </div>
              <p className="sign-tool__count" role="status">
                {signature
                  ? tx(`${placements().length} signatures will be added.`, `${placements().length} हस्ताक्षर जोड़े जाएंगे।`)
                  : ""}
              </p>
            </div>
          </div>
        )}

        {error && (
          <AppStatus tone="error" title={tx("Something went wrong", "कुछ गड़बड़ हुई")}>
            {error}
          </AppStatus>
        )}
        {done && (
          <AppStatus tone="success" title={tx("Your signed PDF is ready", "हस्ताक्षर वाली पीडीएफ तैयार है")}>
            {tx(`Downloaded ${done.filename} with ${done.count} signatures.`, `${done.filename} डाउनलोड हुई, ${done.count} हस्ताक्षर के साथ।`)}
          </AppStatus>
        )}
      </div>

      <SignaturePad
        open={padOpen}
        onCancel={() => setPadOpen(false)}
        onAdd={(drawn) => {
          setPadOpen(false);
          setUpload(null);
          setSignature(drawn);
          setDone(null);
        }}
      />
    </ToolShell>
  );
}
