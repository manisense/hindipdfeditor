import { inspectFontsOrBlock } from "../lib/fontInspectionPolicy";
import { trackToolEvent } from "../lib/analytics";
import { useRef, useState } from "react";
import { useTx } from "../lib/i18n";
import type { Bilingual } from "../lib/userMessages";
import {
  AI_LIMITS,
  type TranslationDirection,
} from "@hindipdfeditor/translation-contract";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { DropZone } from "../components/DropZone";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { ToolShell } from "../components/ToolShell";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { aiApiClient } from "../lib/aiApiClient";
import { ptSizeToImagePx, ptToImagePx } from "../lib/coordinateMath";
import { downloadPdfBlob, exportPdf } from "../lib/exportPdf";
import { ensureFontsLoaded } from "../lib/fontAsset";
import {
  containsDevanagari,
  detectTranslationDirection,
  isTranslatableEnglishLine,
  isTranslatableHindiLine,
} from "../lib/translationSource";
import { buildTranslationLinesWithContext } from "../lib/translationContext";
import { detectLegacyFonts } from "../lib/legacyFontDetector";
import { detectTextLines, detectTextLinesWithGemini } from "../lib/ocr";
import { extractEmbeddedTextLines } from "../lib/pdfTextExtract";
import {
  getPageCount,
  getPdfBase64,
  getPdfBytes,
  renderPage,
  sampleAverageColor,
  samplePagePaperColor,
  sampleTextColor,
  setPdfBytes,
} from "../lib/pdfToImages";
import { getTool } from "../lib/tools";
import { geometryForTranslatedLine } from "../lib/translateEdits";
import type {
  DocumentState,
  Edit,
  OcrLine,
  PageState,
} from "../state/editStore";
import "./UtilityTool.css";

const tool = getTool("translate")!;
const RASTER_SCALE = 2;
const MASK_SAMPLE_MARGIN_PX = 16;

/** Soft caps so a phone/tab browser does not OOM on huge scans. */
const MAX_FILE_BYTES = AI_LIMITS.maxDocumentBytes;
const MAX_PAGES = AI_LIMITS.maxDocumentPages;
const DETECT_PAGES = 5;
const LATIN_RE = /[A-Za-z]/u;

type Progress = {
  phase: "loading" | "detecting" | "translating" | "exporting";
  detail: Bilingual;
};

/** An error whose message is written for the person using the tool, in both UI languages. */
class UserFacingError extends Error {
  constructor(readonly text: Bilingual) {
    super(text.en);
  }
}

/** Hindi or English screen text for whatever went wrong; library errors get a generic line. */
function failureText(err: unknown): Bilingual {
  if (err instanceof UserFacingError) return err.text;
  if (err instanceof DOMException && err.name === "AbortError") {
    return { en: "Translation cancelled.", hi: "अनुवाद रद्द किया गया।" };
  }
  const en = err instanceof Error ? err.message : String(err);
  return { en, hi: "अनुवाद पूरा नहीं हो पाया। थोड़ी देर बाद दोबारा कोशिश करें।" };
}

type Result = {
  filename: string;
  pageCount: number;
  translatedLines: number;
  skippedLines: number;
  usedOcrFallback: boolean;
};

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("Translation cancelled", "AbortError");
  }
}

async function detectDirectionFromPdf(
  bytes: Uint8Array,
): Promise<TranslationDirection | null> {
  setPdfBytes(bytes);
  const pageCount = Math.min(await getPageCount(), DETECT_PAGES);
  const texts: string[] = [];
  for (let page = 0; page < pageCount; page += 1) {
    try {
      const lines = await extractEmbeddedTextLines(bytes, page);
      for (const line of lines) texts.push(line.text);
    } catch {
      /* ignore page extract failures during language probe */
    }
  }
  return detectTranslationDirection(texts);
}

async function detectLegacyFontWarnings(): Promise<
  { page: number; fontName: string }[]
> {
  return inspectFontsOrBlock(async () =>
    detectLegacyFonts(await getPdfBase64()),
  );
}

async function buildTranslatedDocument(
  file: File,
  direction: TranslationDirection,
  jobId: string,
  onProgress: (p: Progress) => void,
  signal: AbortSignal,
): Promise<{
  doc: DocumentState;
  translatedLines: number;
  skippedLines: number;
  usedOcrFallback: boolean;
}> {
  if (file.size > MAX_FILE_BYTES) {
    const mb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
    throw new UserFacingError({
      en: `This PDF is too large for in-browser translation (max ${mb} MB). Try Compress PDF first, or split into smaller files.`,
      hi: `यह पीडीएफ ब्राउज़र में अनुवाद के लिए बहुत बड़ी है (अधिकतम ${mb} MB)। पहले साइज कम करें या फाइल को छोटे हिस्सों में बाँटें।`,
    });
  }

  onProgress({ phase: "loading", detail: { en: "Reading PDF…", hi: "पीडीएफ पढ़ी जा रही है…" } });
  const bytes = new Uint8Array(await file.arrayBuffer());
  throwIfAborted(signal);
  setPdfBytes(bytes);
  const pageCount = await getPageCount();
  if (pageCount > MAX_PAGES) {
    throw new UserFacingError({
      en: `This PDF has ${pageCount} pages (max ${MAX_PAGES} for Translate). Split it into smaller ranges first.`,
      hi: `इस पीडीएफ में ${pageCount} पेज हैं (अनुवाद के लिए अधिकतम ${MAX_PAGES})। पहले इसे छोटे हिस्सों में बाँटें।`,
    });
  }

  onProgress({ phase: "loading", detail: { en: "Checking fonts…", hi: "फॉन्ट जाँचे जा रहे हैं…" } });
  const legacyFontWarnings = await detectLegacyFontWarnings();
  throwIfAborted(signal);
  const forceOcrPages = new Set(
    legacyFontWarnings.map((warning) => warning.page),
  );

  const pages: PageState[] = [];
  let translatedLines = 0;
  let skippedLines = 0;
  let usedOcrFallback = false;

  for (let i = 0; i < pageCount; i++) {
    const forceOcr = forceOcrPages.has(i);
    throwIfAborted(signal);
    onProgress({
      phase: "loading",
      detail: {
        en: `Rendering page ${i + 1} of ${pageCount}…`,
        hi: `पेज ${i + 1} / ${pageCount} बन रहा है…`,
      },
    });
    const image = await renderPage(i, RASTER_SCALE);
    const widthPt = image.pxWidth / RASTER_SCALE;
    const heightPt = image.pxHeight / RASTER_SCALE;
    const page: PageState = {
      pageIndex: i,
      widthPt,
      heightPt,
      backgroundImageUri: image.uri,
      imagePxWidth: image.pxWidth,
      imagePxHeight: image.pxHeight,
      edits: [],
      ocrLines: [],
    };

    onProgress({
      phase: "detecting",
      detail: forceOcr
        ? {
            en: `Reading page ${i + 1} of ${pageCount} from its image (old font)…`,
            hi: `पेज ${i + 1} / ${pageCount} इमेज से पढ़ा जा रहा है (पुराना फॉन्ट)…`,
          }
        : {
            en: `Detecting text on page ${i + 1} of ${pageCount}…`,
            hi: `पेज ${i + 1} / ${pageCount} का टेक्स्ट पहचाना जा रहा है…`,
          },
    });
    let lines: OcrLine[] = [];
    try {
      lines = await detectTextLines(page, { forceOcr });
    } catch (error) {
      console.warn(`Text detection failed on page ${i}`, error);
    }
    throwIfAborted(signal);

    if (
      forceOcr ||
      lines.length === 0 ||
      lines.some((line) => line.source === "embedded-degraded")
    ) {
      usedOcrFallback = true;
      onProgress({
        phase: "detecting",
        detail: {
          en: `Improving text detection on page ${i + 1} of ${pageCount}…`,
          hi: `पेज ${i + 1} / ${pageCount} पर टेक्स्ट पहचान बेहतर की जा रही है…`,
        },
      });
      lines = await detectTextLinesWithGemini(page, jobId, i);
      throwIfAborted(signal);
    }

    const sourceLines = lines.filter((line) =>
      direction === "hi-en"
        ? isTranslatableHindiLine(line.text)
        : isTranslatableEnglishLine(line.text),
    );
    if (sourceLines.length === 0) {
      // Count source-script lines that were filtered as OCR noise for the UX summary.
      skippedLines += lines.filter((line) =>
        direction === "hi-en"
          ? containsDevanagari(line.text)
          : LATIN_RE.test(line.text),
      ).length;
      pages.push({ ...page, ocrLines: lines });
      continue;
    }

    onProgress({
      phase: "translating",
      detail: {
        en: `Translating ${sourceLines.length} line(s) on page ${i + 1}…`,
        hi: `पेज ${i + 1} की ${sourceLines.length} लाइनों का अनुवाद हो रहा है…`,
      },
    });
    const translatedById = new Map<string, string>();
    const requestLines = buildTranslationLinesWithContext(
      i,
      lines,
      sourceLines,
    );
    for (
      let start = 0;
      start < requestLines.length;
      start += AI_LIMITS.maxLinesPerRequest
    ) {
      throwIfAborted(signal);
      const response = await aiApiClient.translate(
        jobId,
        direction,
        requestLines.slice(start, start + AI_LIMITS.maxLinesPerRequest),
      );
      for (const result of response.results) {
        if (result.status === "translated" && result.translatedText) {
          translatedById.set(result.id, result.translatedText);
        }
      }
    }

    let paperColor = "#ffffff";
    try {
      paperColor = await samplePagePaperColor(
        page.backgroundImageUri,
        page.imagePxWidth,
        page.imagePxHeight,
      );
    } catch {
      /* keep white */
    }

    const edits: Edit[] = [];
    const consumedIds = new Set<string>();
    for (const line of sourceLines) {
      const translated = translatedById.get(line.id);
      if (!translated) {
        skippedLines += 1;
        continue;
      }

      const geo = geometryForTranslatedLine(
        line,
        page.widthPt,
        page.heightPt,
        translated,
      );
      const { x: tx, y: ty } = ptToImagePx(
        line.xPt,
        line.yPt,
        page.imagePxWidth,
        page.widthPt,
      );
      const { wPx: tw, hPx: th } = ptSizeToImagePx(
        line.wPt,
        line.hPt,
        page.imagePxWidth,
        page.widthPt,
      );

      let textColor = "#111111";
      let maskColor = paperColor;
      try {
        textColor = await sampleTextColor(
          page.backgroundImageUri,
          Math.round(tx),
          Math.round(ty),
          Math.round(tw),
          Math.round(th),
        );
      } catch {
        /* keep black */
      }
      try {
        maskColor = await sampleAverageColor(
          page.backgroundImageUri,
          Math.round(tx),
          Math.round(ty),
          Math.round(tw),
          Math.round(th),
          MASK_SAMPLE_MARGIN_PX,
        );
      } catch {
        /* keep page-level fallback */
      }

      edits.push({
        type: "mask",
        id: crypto.randomUUID(),
        page: i,
        ...geo.mask,
        color: maskColor,
        kind: "replace",
      });
      edits.push({
        type: "text",
        id: crypto.randomUUID(),
        page: i,
        xPt: geo.text.xPt,
        yPt: geo.text.yPt,
        fontSizePt: geo.text.fontSizePt,
        text: translated,
        color: textColor,
        fontFamily: "NotoSansDevanagari",
        fontWeight: geo.text.fontWeight,
        widthPt: geo.text.widthPt,
      });
      consumedIds.add(line.id);
      translatedLines += 1;
    }

    pages.push({
      ...page,
      edits,
      ocrLines: lines.filter((l) => !consumedIds.has(l.id)),
    });
  }

  return {
    doc: {
      id: crypto.randomUUID(),
      sourceName: file.name,
      pageCount,
      pages,
      legacyFontWarnings,
    },
    translatedLines,
    skippedLines,
    usedOcrFallback,
  };
}

export function TranslatePdfTool() {
  const tx = useTx();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [detectingLanguage, setDetectingLanguage] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<Bilingual | null>(null);
  const [consented, setConsented] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [direction, setDirection] = useState<TranslationDirection | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const step = result ? 3 : file ? 2 : 1;

  const cancelTranslate = () => {
    abortRef.current?.abort();
  };

  const selectFile = async (next: File) => {
    setConsented(false);
    setFile(next);
    setResult(null);
    setError(null);
    setDirection(null);
    setDetectingLanguage(true);
    try {
      const bytes = new Uint8Array(await next.arrayBuffer());
      const detected = await detectDirectionFromPdf(bytes);
      trackToolEvent("pdf_open_success", "translate");
      setDirection(detected);
      if (!detected) {
        setError({
          en: "Could not detect clear Hindi or English text in this PDF. Try a digital (text-layer) file, or use Edit PDF → Enhance with AI first.",
          hi: "इस पीडीएफ में साफ हिंदी या अंग्रेज़ी टेक्स्ट नहीं मिला। टेक्स्ट वाली डिजिटल फाइल आज़माएं, या पहले एडिट टूल में AI से सुधारें।",
        });
      }
    } catch (err) {
      setDirection(null);
      setError(failureText(err));
    } finally {
      setDetectingLanguage(false);
    }
  };

  const runTranslate = async () => {
    if (!file || busy || !direction || !consented) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (!turnstileToken)
        throw new UserFacingError({
          en: "Complete the security check before translating.",
          hi: "अनुवाद से पहले सुरक्षा जाँच पूरी करें।",
        });
      aiApiClient.setTurnstileTokenProvider(() => turnstileToken);
      ensureFontsLoaded();
      await document.fonts.load("12px NotoSansDevanagari");
      const { doc, translatedLines, skippedLines, usedOcrFallback } =
        await buildTranslatedDocument(
          file,
          direction,
          `document-${crypto.randomUUID()}`,
          setProgress,
          controller.signal,
        );
      if (translatedLines === 0) {
        const sourceLabel =
          direction === "hi-en" ? "Hindi (Devanagari)" : "English";
        const sourceHi = direction === "hi-en" ? "हिंदी" : "अंग्रेज़ी";
        throw new UserFacingError(
          skippedLines > 0
            ? {
                en: `Found ${sourceLabel} text but could not translate any lines (${skippedLines} skipped). Try a clearer scan.`,
                hi: `${sourceHi} टेक्स्ट मिला, पर कोई लाइन अनुवाद नहीं हो पाई (${skippedLines} छोड़ी गईं)। साफ स्कैन आज़माएं।`,
              }
            : {
                en: `No ${sourceLabel} text was found to translate. Try a clearer scan, or use AI OCR for difficult pages.`,
                hi: `अनुवाद के लिए ${sourceHi} टेक्स्ट नहीं मिला। साफ स्कैन आज़माएं, या मुश्किल पेजों के लिए AI टेक्स्ट पहचान इस्तेमाल करें।`,
              },
        );
      }
      throwIfAborted(controller.signal);
      const targetCode = direction === "hi-en" ? "en" : "hi";
      const targetLabel = direction === "hi-en" ? "English" : "Hindi";
      setProgress({
        phase: "exporting",
        detail: {
          en: `Building ${targetLabel} PDF…`,
          hi: `${direction === "hi-en" ? "अंग्रेज़ी" : "हिंदी"} पीडीएफ बन रही है…`,
        },
      });
      const sourceBytes = getPdfBytes();
      if (!sourceBytes) throw new Error("No PDF loaded");
      const blob = await exportPdf(doc, sourceBytes);
      throwIfAborted(controller.signal);
      const base = file.name.replace(/\.pdf$/i, "") || "translated";
      const filename = `${base}-${targetCode}.pdf`;
      downloadPdfBlob(blob, filename);
      trackToolEvent("export_success", "translate");
      setResult({
        filename,
        pageCount: doc.pageCount,
        translatedLines,
        skippedLines,
        usedOcrFallback,
      });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        trackToolEvent("export_failed", "translate");
      }
      setError(failureText(err));
    } finally {
      abortRef.current = null;
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <ToolShell
      tool={tool}
      compact={Boolean(file)}
      steps={[
        { label: tx("Select PDF", "पीडीएफ चुनें"), active: step === 1, done: step > 1 },
        { label: tx("Translate", "अनुवाद"), active: step === 2, done: step > 2 },
        { label: tx("Download", "डाउनलोड"), active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {!file ? (
          <DropZone
            sample
            accent={tool.accent}
            title={tx("Translate Hindi ↔ English PDF", "हिंदी ↔ अंग्रेज़ी पीडीएफ अनुवाद")}
            subtitle={tx(
              "The language is detected for you. Your original file is never changed.",
              "भाषा अपने आप पहचानी जाती है। आपकी मूल फाइल कभी नहीं बदलती।",
            )}
            buttonLabel={tx("Select PDF", "पीडीएफ चुनें")}
            onFiles={(files) => {
              void selectFile(files[0]);
            }}
          />
        ) : (
          <div className="utility-tool__panel">
            <SelectedFileSummary
              name={file.name}
              meta={tx(
                `${(file.size / 1024).toFixed(1)} KB · up to ${MAX_PAGES} pages / ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB`,
                `${(file.size / 1024).toFixed(1)} KB · अधिकतम ${MAX_PAGES} पेज / ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB`,
              )}
            />
            <div className="utility-tool__setting-card utility-tool__setting-card--translate">
              <fieldset disabled={busy || detectingLanguage}>
                <legend>{tx("Translation direction", "अनुवाद की दिशा")}</legend>
                {detectingLanguage ? (
                  <AppStatus busy>{tx("Detecting the source language…", "मूल भाषा पहचानी जा रही है…")}</AppStatus>
                ) : direction ? (
                  <div className="utility-tool__direction">
                    <span>{direction === "hi-en" ? tx("Hindi", "हिंदी") : tx("English", "अंग्रेज़ी")}</span>
                    <strong>→</strong>
                    <span>{direction === "hi-en" ? tx("English", "अंग्रेज़ी") : tx("Hindi", "हिंदी")}</span>
                    <small>{tx("Auto-detected", "अपने आप पहचानी गई")}</small>
                  </div>
                ) : (
                  <AppStatus tone="warning">
                    {tx("No clear Hindi or English source text detected.", "साफ हिंदी या अंग्रेज़ी टेक्स्ट नहीं मिला।")}
                  </AppStatus>
                )}
              </fieldset>
              <p className="utility-tool__note">
                {tx(
                  "Detected lines are sent securely to our AI translation service. Hard-to-read pages may use AI text recognition. Your original PDF is never changed.",
                  "पहचानी गई लाइनें सुरक्षित तरीके से हमारी AI अनुवाद सेवा को भेजी जाती हैं। मुश्किल पेजों के लिए AI टेक्स्ट पहचान इस्तेमाल हो सकती है। आपकी मूल पीडीएफ नहीं बदलती।",
                )}
              </p>
              <p className="utility-tool__note">
                {tx(
                  `AI allowance: up to ${AI_LIMITS.anonymousDocumentsPerDay} documents and ${AI_LIMITS.anonymousPagesPerDay} pages per day.`,
                  `AI सीमा: हर दिन अधिकतम ${AI_LIMITS.anonymousDocumentsPerDay} दस्तावेज़ और ${AI_LIMITS.anonymousPagesPerDay} पेज।`,
                )}
              </p>
              <label className="utility-tool__consent">
                <input
                  type="checkbox"
                  checked={consented}
                  disabled={busy}
                  onChange={(event) => setConsented(event.target.checked)}
                />
                <span>
                  {tx(
                    "I agree to send detected text to the AI service for translation and, where needed, page images for AI text recognition. I will review the translated PDF before using it.",
                    "मैं अनुवाद के लिए पहचाना गया टेक्स्ट, और ज़रूरत हो तो AI टेक्स्ट पहचान के लिए पेज इमेज, AI सेवा को भेजने के लिए सहमत हूँ। इस्तेमाल से पहले मैं अनुवादित पीडीएफ जाँच लूँगा/लूँगी।",
                  )}{" "}
                  <a href="/privacy/" target="_blank" rel="noopener noreferrer">
                    {tx("Privacy details", "प्राइवेसी की जानकारी")}
                  </a>
                </span>
              </label>
              <div className="utility-tool__security-check">
                <span>{tx("One quick security check", "एक छोटी सुरक्षा जाँच")}</span>
                <TurnstileWidget onToken={setTurnstileToken} />
              </div>
            </div>
            <div className="utility-tool__actions">
              <AppButton
                title={tx("Choose another", "दूसरी फाइल चुनें")}
                variant="ghost"
                small
                disabled={busy || detectingLanguage}
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError(null);
                  setDirection(null);
                }}
              />
              {busy ? (
                <AppButton
                  title={tx("Cancel", "रद्द करें")}
                  variant="secondary"
                  onClick={cancelTranslate}
                />
              ) : (
                <AppButton
                  title={tx("Translate & download", "अनुवाद करें और डाउनलोड करें")}
                  onClick={() => void runTranslate()}
                  disabled={
                    !consented ||
                    !turnstileToken ||
                    !direction ||
                    detectingLanguage
                  }
                />
              )}
            </div>
          </div>
        )}
        {progress && (
          <AppStatus busy title={tx("Translation in progress", "अनुवाद हो रहा है")}>
            {tx(progress.detail.en, progress.detail.hi)}
          </AppStatus>
        )}
        {error && (
          <AppStatus tone="error" title={tx("Translation couldn’t finish", "अनुवाद पूरा नहीं हो पाया")}>
            {tx(error.en, error.hi)}
          </AppStatus>
        )}
        {result && (
          <AppStatus tone="success" title={tx("Translated PDF ready", "अनुवादित पीडीएफ तैयार")}>
            {tx(
              `Downloaded ${result.filename} · ${result.pageCount} pages · ${result.translatedLines} line${result.translatedLines === 1 ? "" : "s"} translated${result.skippedLines > 0 ? ` · ${result.skippedLines} skipped` : ""}${result.usedOcrFallback ? " · some pages read by text recognition" : ""}`,
              `डाउनलोड हुई: ${result.filename} · ${result.pageCount} पेज · ${result.translatedLines} लाइनों का अनुवाद${result.skippedLines > 0 ? ` · ${result.skippedLines} छोड़ी गईं` : ""}${result.usedOcrFallback ? " · कुछ पेज टेक्स्ट पहचान से पढ़े गए" : ""}`,
            )}
          </AppStatus>
        )}
      </div>
    </ToolShell>
  );
}
