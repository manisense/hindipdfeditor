import { useRef, useState } from "react";
import {
  AI_LIMITS,
  type TranslationDirection,
} from "@hindipdfeditor/translation-contract";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { NextSteps } from "../components/NextSteps";
import { DropZone } from "../components/DropZone";
import { SelectedFileSummary } from "../components/SelectedFileSummary";
import { ToolShell } from "../components/ToolShell";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { aiApiClient } from "../lib/aiApiClient";
import { ptSizeToImagePx, ptToImagePx } from "../lib/coordinateMath";
import { downloadPdfBlob, exportPdf } from "../lib/exportPdf";
import { toPdfFile } from "../lib/pdfOps";
import { ensureFontsLoaded, getFontBase64 } from "../lib/fontAsset";
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
  renderPage,
  sampleAverageColor,
  samplePagePaperColor,
  sampleTextColor,
  setPdfBytes,
} from "../lib/pdfToImages";
import { useTx } from "../lib/i18n";
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
const UNKNOWN_ENCODING_FONT_NAME = "unknown (font inspection failed)";

/** Soft caps so a phone/tab browser does not OOM on huge scans. */
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_PAGES = 40;
const DETECT_PAGES = 5;
const LATIN_RE = /[A-Za-z]/u;

type Progress = {
  phase: "loading" | "detecting" | "translating" | "exporting";
  detail: string;
};

type Result = {
  filename: string;
  /** The translated PDF, kept so it can go straight into another tool. */
  output: File;
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
  // Legacy fonts (Kruti Dev etc.) store Hindi as Latin letters, so their embedded text would
  // read as English. Every font on the legacy list is Devanagari, so those pages count as Hindi.
  // If fonts can't be inspected, don't guess a direction from possibly-garbled text.
  let legacyPages: Set<number>;
  try {
    legacyPages = new Set((await detectLegacyFonts(bytes)).map((warning) => warning.page));
  } catch {
    return null;
  }
  const texts: string[] = [];
  let sawLegacyHindi = false;
  for (let page = 0; page < pageCount; page += 1) {
    if (legacyPages.has(page)) {
      sawLegacyHindi = true;
      continue;
    }
    try {
      const lines = await extractEmbeddedTextLines(bytes, page);
      for (const line of lines) texts.push(line.text);
    } catch {
      /* ignore page extract failures during language probe */
    }
  }
  return detectTranslationDirection(texts) ?? (sawLegacyHindi ? "hi-en" : null);
}

async function detectLegacyFontWarnings(
  pageCount: number,
): Promise<{ page: number; fontName: string }[]> {
  try {
    const base64 = await getPdfBase64();
    return await detectLegacyFonts(base64);
  } catch (error) {
    console.warn(
      "legacyFontDetector failed during translate; forcing OCR (fail closed)",
      error,
    );
    return Array.from({ length: pageCount }, (_, page) => ({
      page,
      fontName: UNKNOWN_ENCODING_FONT_NAME,
    }));
  }
}

async function buildTranslatedDocument(
  file: File,
  direction: TranslationDirection,
  jobId: string,
  onProgress: (p: Progress) => void,
  signal: AbortSignal,
  tr: (en: string, hi: string) => string,
): Promise<{
  doc: DocumentState;
  translatedLines: number;
  skippedLines: number;
  usedOcrFallback: boolean;
}> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      tr(
        `This PDF is too large for in-browser translation (max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB). Try Compress PDF first, or split into smaller files.`,
        `यह पीडीएफ ब्राउज़र में अनुवाद के लिए बहुत बड़ी है (अधिकतम ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB)। पहले कंप्रेस करें या छोटी फाइलों में बांटें।`,
      ),
    );
  }

  onProgress({ phase: "loading", detail: tr("Reading PDF…", "पीडीएफ पढ़ी जा रही है…") });
  const bytes = new Uint8Array(await file.arrayBuffer());
  throwIfAborted(signal);
  setPdfBytes(bytes);
  const pageCount = await getPageCount();
  if (pageCount > MAX_PAGES) {
    throw new Error(
      tr(
        `This PDF has ${pageCount} pages (max ${MAX_PAGES} for Translate). Split it into smaller ranges first.`,
        `इस पीडीएफ में ${pageCount} पेज हैं (अनुवाद के लिए अधिकतम ${MAX_PAGES})। पहले इसे छोटे हिस्सों में बांटें।`,
      ),
    );
  }

  onProgress({ phase: "loading", detail: tr("Checking fonts…", "फॉन्ट जांचे जा रहे हैं…") });
  const legacyFontWarnings = await detectLegacyFontWarnings(pageCount);
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
      detail: tr(`Rasterizing page ${i + 1} of ${pageCount}…`, `पेज ${i + 1} / ${pageCount} तैयार हो रहा है…`),
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
        ? tr(
            `OCR on page ${i + 1} of ${pageCount} (legacy font — skipping embedded text)…`,
            `पेज ${i + 1} / ${pageCount} पर OCR (पुराना फॉन्ट — अंदर का टेक्स्ट छोड़ा गया)…`,
          )
        : tr(`Detecting text on page ${i + 1} of ${pageCount}…`, `पेज ${i + 1} / ${pageCount} पर टेक्स्ट पहचाना जा रहा है…`),
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
        detail: tr(
          `Improving text detection on page ${i + 1} of ${pageCount}…`,
          `पेज ${i + 1} / ${pageCount} पर टेक्स्ट पहचान बेहतर की जा रही है…`,
        ),
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
      detail: tr(
        `Translating ${sourceLines.length} line(s) on page ${i + 1}…`,
        `पेज ${i + 1} की ${sourceLines.length} लाइनों का अनुवाद हो रहा है…`,
      ),
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
  const tr = useTx();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [detectingLanguage, setDetectingLanguage] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [direction, setDirection] = useState<TranslationDirection | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const step = result ? 3 : file ? 2 : 1;

  const cancelTranslate = () => {
    abortRef.current?.abort();
  };

  const selectFile = async (next: File) => {
    setFile(next);
    setResult(null);
    setError(null);
    setDirection(null);
    setDetectingLanguage(true);
    try {
      const bytes = new Uint8Array(await next.arrayBuffer());
      const detected = await detectDirectionFromPdf(bytes);
      setDirection(detected);
      if (!detected) {
        setError(
          tr(
            "Could not detect clear Hindi or English text in this PDF. Try a digital (text-layer) file, or use Edit PDF → Enhance with AI first.",
            "इस पीडीएफ में साफ हिंदी या अंग्रेजी टेक्स्ट नहीं मिला। डिजिटल (टेक्स्ट वाली) फाइल आज़माएं, या पहले एडिट टूल में \"AI से सुधारें\" इस्तेमाल करें।",
          ),
        );
      }
    } catch (err) {
      setDirection(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetectingLanguage(false);
    }
  };

  const runTranslate = async () => {
    if (!file || busy || !direction) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (!turnstileToken)
        throw new Error(tr("Complete the security check before translating.", "अनुवाद से पहले सुरक्षा चेक पूरा करें।"));
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
          tr,
        );
      if (translatedLines === 0) {
        const sourceLabel = direction === "hi-en"
          ? tr("Hindi (Devanagari)", "हिंदी")
          : tr("English", "अंग्रेजी");
        throw new Error(
          skippedLines > 0
            ? tr(
                `Found ${sourceLabel} text but could not translate any lines (${skippedLines} skipped). Try a clearer scan.`,
                `${sourceLabel} टेक्स्ट मिला, पर किसी लाइन का अनुवाद नहीं हो पाया (${skippedLines} छोड़ी गईं)। साफ स्कैन आज़माएं।`,
              )
            : tr(
                `No ${sourceLabel} text was found to translate. Try a clearer scan, or use AI OCR for difficult pages.`,
                `अनुवाद के लिए ${sourceLabel} टेक्स्ट नहीं मिला। साफ स्कैन आज़माएं, या मुश्किल पेजों के लिए AI OCR इस्तेमाल करें।`,
              ),
        );
      }
      throwIfAborted(controller.signal);
      const targetCode = direction === "hi-en" ? "en" : "hi";
      setProgress({
        phase: "exporting",
        detail: direction === "hi-en"
          ? tr("Building English PDF…", "अंग्रेजी पीडीएफ बन रही है…")
          : tr("Building Hindi PDF…", "हिंदी पीडीएफ बन रही है…"),
      });
      const [sans, serif] = await Promise.all([
        getFontBase64("NotoSansDevanagari"),
        getFontBase64("NotoSerifDevanagari"),
      ]);
      const blob = await exportPdf(doc, {
        NotoSansDevanagari: sans,
        NotoSerifDevanagari: serif,
      });
      throwIfAborted(controller.signal);
      const base = file.name.replace(/\.pdf$/i, "") || "translated";
      const filename = `${base}-${targetCode}.pdf`;
      downloadPdfBlob(blob, filename);
      setResult({
        filename,
        output: toPdfFile(blob, filename),
        pageCount: doc.pageCount,
        translatedLines,
        skippedLines,
        usedOcrFallback,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(tr("Translation cancelled.", "अनुवाद रद्द किया गया।"));
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
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
        { label: tr("Select PDF", "पीडीएफ चुनें"), active: step === 1, done: step > 1 },
        { label: tr("Translate", "अनुवाद"), active: step === 2, done: step > 2 },
        { label: tr("Download", "डाउनलोड"), active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {!file ? (
          <DropZone
            accent={tool.accent}
            title={tr("Translate Hindi ↔ English PDF", "हिंदी ↔ अंग्रेजी पीडीएफ अनुवाद")}
            subtitle={tr("Language is detected automatically. No API key entry; the original file is never overwritten.", "भाषा अपने-आप पहचानी जाती है। कोई API key नहीं चाहिए; मूल फाइल कभी नहीं बदलती।")}
            buttonLabel={tr("Select PDF", "पीडीएफ चुनें")}
            onFiles={(files) => {
              void selectFile(files[0]);
            }}
          />
        ) : (
          <div className="utility-tool__panel">
            <SelectedFileSummary
              name={file.name}
              meta={`${(file.size / 1024).toFixed(1)} KB · ${tr(`up to ${MAX_PAGES} pages`, `अधिकतम ${MAX_PAGES} पेज`)} / ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB`}
            />
            <div className="utility-tool__setting-card utility-tool__setting-card--translate">
              <fieldset disabled={busy || detectingLanguage}>
                <legend>{tr("Translation direction", "अनुवाद की दिशा")}</legend>
                {detectingLanguage ? (
                  <AppStatus busy>{tr("Detecting the source language…", "स्रोत भाषा पहचानी जा रही है…")}</AppStatus>
                ) : direction ? (
                  <div className="utility-tool__direction">
                    <span>{direction === "hi-en" ? "हिंदी" : "English"}</span>
                    <strong>→</strong>
                    <span>{direction === "hi-en" ? "English" : "हिंदी"}</span>
                    <small>{tr("Auto-detected", "अपने-आप पहचानी गई")}</small>
                  </div>
                ) : (
                  <AppStatus tone="warning">{tr("No clear Hindi or English source text detected.", "साफ हिंदी या अंग्रेजी टेक्स्ट नहीं मिला।")}</AppStatus>
                )}
              </fieldset>
              <p className="utility-tool__note">
                {tr(
                  "Detected lines are sent securely through our Gemini proxy. Difficult pages may use consented AI OCR; the source PDF is never modified.",
                  "पहचानी गई लाइनें सुरक्षित रूप से हमारे Gemini प्रॉक्सी से भेजी जाती हैं। मुश्किल पेजों पर आपकी सहमति से AI OCR इस्तेमाल हो सकता है; मूल पीडीएफ कभी नहीं बदलती।",
                )}
              </p>
              <div className="utility-tool__security-check">
                <span>{tr("One quick security check", "एक छोटा सुरक्षा चेक")}</span>
                <TurnstileWidget onToken={setTurnstileToken} />
              </div>
            </div>
            <div className="utility-tool__actions">
              <AppButton
                title={tr("Choose another", "दूसरी फाइल चुनें")}
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
                  title={tr("Cancel", "रद्द करें")}
                  variant="secondary"
                  onClick={cancelTranslate}
                />
              ) : (
                <AppButton
                  title={tr("Translate & download", "अनुवाद करें और डाउनलोड करें")}
                  onClick={() => void runTranslate()}
                  disabled={!turnstileToken || !direction || detectingLanguage}
                />
              )}
            </div>
          </div>
        )}
        {progress && (
          <AppStatus busy title={tr("Translation in progress", "अनुवाद हो रहा है")}>{progress.detail}</AppStatus>
        )}
        {error && (
          <AppStatus tone="error" title={tr("Translation couldn’t finish", "अनुवाद पूरा नहीं हो पाया")}>{error}</AppStatus>
        )}
        {result && (
          <AppStatus tone="success" title={tr("Translated PDF ready", "अनुवादित पीडीएफ तैयार")}>
            {tr("Downloaded", "डाउनलोड हुई:")} {result.filename} · {result.pageCount} {tr("pages", "पेज")} ·{" "}
            {tr(
              `${result.translatedLines} line${result.translatedLines === 1 ? "" : "s"} translated`,
              `${result.translatedLines} लाइनों का अनुवाद हुआ`,
            )}
            {result.skippedLines > 0 ? tr(` · ${result.skippedLines} skipped`, ` · ${result.skippedLines} छोड़ी गईं`) : ""}
            {result.usedOcrFallback ? tr(" · used OCR (legacy font)", " · OCR इस्तेमाल हुआ (पुराना फॉन्ट)") : ""}
          </AppStatus>
        )}
        {result && <NextSteps current="translate" output={result.output} />}
      </div>
    </ToolShell>
  );
}
