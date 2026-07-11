/**
 * Free Hindi→English translation that runs entirely in the browser via Transformers.js
 * and the Helsinki-NLP Opus-MT hi→en model (ONNX, quantized). No API key, no cloud LLM.
 *
 * First use downloads ~70–100MB of model weights from Hugging Face (then cached in
 * IndexedDB by the library). Subsequent runs reuse the cache.
 *
 * The `@huggingface/transformers` package is loaded via dynamic `import()` so Edit / Merge /
 * Split / Compress never pay for the ORT WASM + transformers chunk.
 */

const MODEL_ID = 'Xenova/opus-mt-hi-en';

const DEVANAGARI_RE = /[\u0900-\u097F]/;

/** True when `text` contains at least one Devanagari code point. */
export function containsDevanagari(text: string): boolean {
  return DEVANAGARI_RE.test(text);
}

type ProgressCallback = (detail: string) => void;

type TranslatorFn = (
  text: string,
  options?: { max_new_tokens?: number },
) => Promise<unknown>;

let translatorPromise: Promise<TranslatorFn> | null = null;
/** Latest UI progress callback — updated on every call so a shared load promise stays current. */
let activeProgress: ProgressCallback | undefined;

function report(detail: string): void {
  activeProgress?.(detail);
}

/**
 * Lazily loads (and caches) the Opus-MT Hindi→English pipeline.
 *
 * @param onProgress Optional human-readable load progress for the UI.
 */
export async function loadHindiEnglishTranslator(
  onProgress?: ProgressCallback,
): Promise<TranslatorFn> {
  activeProgress = onProgress;
  if (!translatorPromise) {
    translatorPromise = (async () => {
      report('Downloading Hindi→English model (one-time, free, cached)…');
      try {
        const { pipeline, env } = await import('@huggingface/transformers');
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        const translator = await pipeline('translation', MODEL_ID, {
          // q8 is the practical accuracy/size tradeoff for MarianMT in-browser.
          dtype: 'q8',
          progress_callback: (data) => {
            if (
              data &&
              typeof data === 'object' &&
              'status' in data &&
              data.status === 'progress' &&
              'file' in data &&
              'progress' in data &&
              typeof data.progress === 'number'
            ) {
              const file = String(data.file ?? 'model');
              const pct = Math.round(data.progress);
              report(`Loading model ${file}… ${pct}%`);
            }
          },
        });
        report('Translation model ready');
        return translator as unknown as TranslatorFn;
      } catch (error) {
        translatorPromise = null;
        throw error;
      }
    })();
  }
  return translatorPromise;
}

function readTranslationText(output: unknown): string {
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0] as { translation_text?: unknown };
    if (typeof first?.translation_text === 'string') return first.translation_text.trim();
  } else if (output && typeof output === 'object' && 'translation_text' in output) {
    const text = (output as { translation_text: unknown }).translation_text;
    if (typeof text === 'string') return text.trim();
  }
  return '';
}

/**
 * True when a model output is usable English (non-empty and no remaining Devanagari).
 * Failed / noop translations that still look like Hindi must not be painted as "English".
 */
export function isSuccessfulEnglishTranslation(source: string, translated: string): boolean {
  const t = translated.trim();
  if (t === '') return false;
  if (containsDevanagari(t)) return false;
  // Exact echo of the source (after trim) means the model did nothing useful.
  if (t === source.trim()) return false;
  return true;
}

/**
 * Translates Hindi (Devanagari) line strings to English in the browser.
 * Empty input returns []. Each result is English text, or `null` when translation failed
 * (caller must skip overlay for that line — never mask with the original Hindi).
 *
 * @param lines Source strings containing Devanagari.
 * @param onProgress Optional progress updates (model load + per-line status).
 */
export async function translateHindiLinesToEnglish(
  lines: string[],
  onProgress?: ProgressCallback,
): Promise<(string | null)[]> {
  if (lines.length === 0) return [];

  activeProgress = onProgress;
  const translator = await loadHindiEnglishTranslator(onProgress);
  const out: (string | null)[] = [];

  for (let i = 0; i < lines.length; i++) {
    report(`Translating line ${i + 1} of ${lines.length}…`);
    const source = lines[i].trim();
    if (source === '') {
      out.push(null);
      continue;
    }
    try {
      const result = await translator(source, { max_new_tokens: 256 });
      const english = readTranslationText(result);
      out.push(isSuccessfulEnglishTranslation(source, english) ? english : null);
    } catch (error) {
      console.warn(`Opus-MT failed on line ${i}; skipping overlay`, error);
      out.push(null);
    }
  }

  return out;
}
