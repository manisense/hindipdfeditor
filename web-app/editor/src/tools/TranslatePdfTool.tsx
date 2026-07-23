import { useRef, useState } from "react";
import {
  AI_LIMITS,
  type TranslationDirection,
  type TranslationLine,
} from "@hindipdfeditor/translation-contract";

import { AppButton } from "../components/AppButton";
import { DropZone } from "../components/DropZone";
import { ToolShell } from "../components/ToolShell";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { aiApiClient } from "../lib/aiApiClient";
import { ptSizeToImagePx, ptToImagePx } from "../lib/coordinateMath";
import { downloadPdfBlob, exportPdf } from "../lib/exportPdf";
import { getFontBase64 } from "../lib/fontAsset";
import {
  containsDevanagari,
  isTranslatableHindiLine,
} from "../lib/translationSource";
import { detectLegacyFonts } from "../lib/legacyFontDetector";
import { detectTextLines } from "../lib/ocr";
import {
  getPageCount,
  getPdfBase64,
  renderPage,
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
const UNKNOWN_ENCODING_FONT_NAME = "unknown (font inspection failed)";

/** Soft caps so a phone/tab browser does not OOM on huge scans. */
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_PAGES = 40;
const LATIN_RE = /[A-Za-z]/u;

type Progress = {
  phase: "loading" | "detecting" | "translating" | "exporting";
  detail: string;
};

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
): Promise<{
  doc: DocumentState;
  translatedLines: number;
  skippedLines: number;
  usedOcrFallback: boolean;
}> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `This PDF is too large for in-browser translation (max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB). Try Compress PDF first, or split into smaller files.`,
    );
  }

  onProgress({ phase: "loading", detail: "Reading PDF…" });
  const bytes = new Uint8Array(await file.arrayBuffer());
  throwIfAborted(signal);
  setPdfBytes(bytes);
  const pageCount = await getPageCount();
  if (pageCount > MAX_PAGES) {
    throw new Error(
      `This PDF has ${pageCount} pages (max ${MAX_PAGES} for Translate). Split it into smaller ranges first.`,
    );
  }

  onProgress({ phase: "loading", detail: "Checking fonts…" });
  const legacyFontWarnings = await detectLegacyFontWarnings(pageCount);
  throwIfAborted(signal);
  const forceOcr = legacyFontWarnings.length > 0;

  const pages: PageState[] = [];
  let translatedLines = 0;
  let skippedLines = 0;

  for (let i = 0; i < pageCount; i++) {
    throwIfAborted(signal);
    onProgress({
      phase: "loading",
      detail: `Rasterizing page ${i + 1} of ${pageCount}…`,
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
        ? `OCR on page ${i + 1} of ${pageCount} (legacy font — skipping embedded text)…`
        : `Detecting text on page ${i + 1} of ${pageCount}…`,
    });
    let lines: OcrLine[] = [];
    try {
      lines = await detectTextLines(page, { forceOcr });
    } catch (error) {
      console.warn(`Text detection failed on page ${i}`, error);
    }
    throwIfAborted(signal);

    const sourceLines = lines.filter((line) =>
      direction === "hi-en"
        ? isTranslatableHindiLine(line.text)
        : LATIN_RE.test(line.text),
    );
    if (sourceLines.length === 0) {
      // Count source-script lines that were filtered as OCR noise for the UX summary.
      skippedLines += lines.filter((line) =>
        direction === "hi-en" ? containsDevanagari(line.text) : LATIN_RE.test(line.text),
      ).length;
      pages.push({ ...page, ocrLines: lines });
      continue;
    }

    onProgress({
      phase: "translating",
      detail: `Translating ${sourceLines.length} line(s) on page ${i + 1}…`,
    });
    const translatedById = new Map<string, string>();
    const requestLines: TranslationLine[] = sourceLines.map((line) => ({
      id: line.id,
      page: i,
      text: line.text,
    }));
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

      const geo = geometryForTranslatedLine(line, page.widthPt, page.heightPt);
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

      edits.push({
        type: "mask",
        id: crypto.randomUUID(),
        page: i,
        ...geo.mask,
        color: paperColor,
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
    usedOcrFallback: forceOcr,
  };
}

export function TranslatePdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [direction, setDirection] = useState<TranslationDirection>("hi-en");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const step = result ? 3 : file ? 2 : 1;

  const cancelTranslate = () => {
    abortRef.current?.abort();
  };

  const runTranslate = async () => {
    if (!file || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (!turnstileToken)
        throw new Error("Complete the security check before translating.");
      aiApiClient.setTurnstileTokenProvider(() => turnstileToken);
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
        throw new Error(
          skippedLines > 0
            ? `Found ${sourceLabel} text but could not translate any lines (${skippedLines} skipped). Try a clearer scan.`
            : `No ${sourceLabel} text was found to translate. Try a clearer scan, or use AI OCR for difficult pages.`,
        );
      }
      throwIfAborted(controller.signal);
      const targetCode = direction === "hi-en" ? "en" : "hi";
      const targetLabel = direction === "hi-en" ? "English" : "Hindi";
      setProgress({
        phase: "exporting",
        detail: `Building ${targetLabel} PDF…`,
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
        pageCount: doc.pageCount,
        translatedLines,
        skippedLines,
        usedOcrFallback,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Translation cancelled.");
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
      steps={[
        { label: "Select PDF", active: step === 1, done: step > 1 },
        { label: "Translate", active: step === 2, done: step > 2 },
        { label: "Download", active: step === 3, done: step === 3 },
      ]}
    >
      <div className="utility-tool">
        {!file ? (
          <DropZone
            accent={tool.accent}
            title="Translate Hindi ↔ English PDF"
            subtitle="Secure AI translation in either direction. No API key entry; the original file is never overwritten."
            buttonLabel="Select PDF"
            onFiles={(files) => {
              setFile(files[0]);
              setResult(null);
              setError(null);
            }}
          />
        ) : (
          <div className="utility-tool__panel">
            <h2>{file.name}</h2>
            <p className="utility-tool__meta">
              {(file.size / 1024).toFixed(1)} KB · max {MAX_PAGES} pages /{" "}
              {Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB
            </p>
            <p className="utility-tool__note">
              Detected source lines are sent securely through our service to
              Google&apos;s Gemini API. Output is a new file; the source PDF is
              never modified.
            </p>
            <fieldset disabled={busy}>
              <legend>Translation direction</legend>
              <label>
                <input
                  type="radio"
                  name="translation-direction"
                  checked={direction === "hi-en"}
                  onChange={() => setDirection("hi-en")}
                />{" "}
                Hindi → English
              </label>{" "}
              <label>
                <input
                  type="radio"
                  name="translation-direction"
                  checked={direction === "en-hi"}
                  onChange={() => setDirection("en-hi")}
                />{" "}
                English → Hindi
              </label>
            </fieldset>
            <TurnstileWidget onToken={setTurnstileToken} />
            <div className="utility-tool__actions">
              <AppButton
                title="Choose another"
                variant="ghost"
                small
                disabled={busy}
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError(null);
                }}
              />
              {busy ? (
                <AppButton
                  title="Cancel"
                  variant="secondary"
                  onClick={cancelTranslate}
                />
              ) : (
                <AppButton
                  title="Translate & download"
                  onClick={() => void runTranslate()}
                  disabled={!turnstileToken}
                />
              )}
            </div>
          </div>
        )}
        {progress && (
          <div className="utility-tool__status">{progress.detail}</div>
        )}
        {error && (
          <div className="utility-tool__status utility-tool__status--error">
            {error}
          </div>
        )}
        {result && (
          <div className="utility-tool__status utility-tool__status--ok">
            Downloaded {result.filename} · {result.pageCount} pages ·{" "}
            {result.translatedLines} line
            {result.translatedLines === 1 ? "" : "s"} translated
            {result.skippedLines > 0 ? ` · ${result.skippedLines} skipped` : ""}
            {result.usedOcrFallback ? " · used OCR (legacy font)" : ""}
          </div>
        )}
      </div>
    </ToolShell>
  );
}
