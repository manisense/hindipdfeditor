/**
 * Free Hindi→English translation that runs entirely in the browser via Transformers.js
 * and the Helsinki-NLP Opus-MT hi→en model (ONNX, quantized). No API key, no cloud LLM.
 *
 * First use downloads ~70–100MB of model weights from Hugging Face (then cached in
 * IndexedDB by the library). Subsequent runs reuse the cache. PDF bytes never leave
 * the browser for translation — only the model weights are fetched.
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

export type TranslateOptions = {
  onProgress?: ProgressCallback;
  /** When aborted, throws `DOMException` with name `AbortError`. */
  signal?: AbortSignal;
};

let translatorPromise: Promise<TranslatorFn> | null = null;
/** Latest UI progress callback — updated on every call so a shared load promise stays current. */
let activeProgress: ProgressCallback | undefined;

function report(detail: string): void {
  activeProgress?.(detail);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Translation cancelled', 'AbortError');
  }
}

function friendlyModelLoadError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch|network|Failed to fetch|Load failed|offline/i.test(message)) {
    return new Error(
      'Could not download the translation model. Check your internet connection and try again. The model is cached after the first successful download.',
    );
  }
  if (/WebAssembly|out of memory|OOM|memory/i.test(message)) {
    return new Error(
      'This browser ran out of memory loading the translation model. Try a smaller PDF, close other tabs, or use a desktop browser.',
    );
  }
  return new Error(`Translation model failed to load: ${message}`);
}

/**
 * Lazily loads (and caches) the Opus-MT Hindi→English pipeline.
 *
 * @param options Progress + optional abort signal.
 */
export async function loadHindiEnglishTranslator(
  options: TranslateOptions = {},
): Promise<TranslatorFn> {
  const { onProgress, signal } = options;
  activeProgress = onProgress;
  throwIfAborted(signal);

  if (!translatorPromise) {
    translatorPromise = (async () => {
      report('Downloading Hindi→English model (one-time, free, cached)…');
      try {
        const { pipeline, env } = await import('@huggingface/transformers');
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        throwIfAborted(signal);
        const translator = await pipeline('translation', MODEL_ID, {
          // q8 is the practical accuracy/size tradeoff for MarianMT in-browser.
          dtype: 'q8',
          progress_callback: (data) => {
            if (signal?.aborted) return;
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
        throwIfAborted(signal);
        report('Translation model ready');
        return translator as unknown as TranslatorFn;
      } catch (error) {
        translatorPromise = null;
        throw friendlyModelLoadError(error);
      }
    })();
  }

  try {
    return await translatorPromise;
  } catch (error) {
    throw friendlyModelLoadError(error);
  }
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
 * True when a line is predominantly Devanagari and worth sending to Opus-MT.
 * Skips bilingual / English-heavy OCR noise that produces garbage translations.
 */
export function isTranslatableHindiLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  let dev = 0;
  let latin = 0;
  for (const ch of trimmed) {
    if (/[\u0900-\u097F]/.test(ch)) dev += 1;
    else if (/[A-Za-z]/.test(ch)) latin += 1;
  }
  if (dev < 3) return false;
  const letterTotal = dev + latin;
  if (letterTotal > 0 && dev / letterTotal < 0.6) return false;
  return true;
}

/**
 * True when a model output is usable English (non-empty and no remaining Devanagari).
 * Failed / noop / OCR-garbage translations must not be painted as "English".
 */
export function isSuccessfulEnglishTranslation(source: string, translated: string): boolean {
  const t = translated.trim();
  if (t === '') return false;
  if (containsDevanagari(t)) return false;
  if (t === source.trim()) return false;

  const letters = (t.match(/[A-Za-z]/g) ?? []).length;
  if (letters < 3) return false;

  const vowels = (t.match(/[aeiouAEIOU]/g) ?? []).length;
  if (letters > 8 && vowels / letters < 0.12) return false;

  const words = t.split(/\s+/).filter(Boolean);
  const shouty = words.filter((w) => /^[A-Z]{5,}$/.test(w.replace(/[^A-Za-z]/g, '')));
  if (words.length >= 2 && shouty.length >= Math.ceil(words.length * 0.5)) return false;

  // Obvious OCR→MT failure patterns seen on bilingual government forms.
  if (/\bWindows\s*2000\b/i.test(t)) return false;
  if (/\bnan of the\b/i.test(t)) return false;

  return true;
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

/**
 * Translates Hindi (Devanagari) line strings to English in the browser.
 * Empty input returns []. Each result is English text, or `null` when translation failed
 * (caller must skip overlay for that line — never mask with the original Hindi).
 *
 * @param lines Source strings containing Devanagari.
 * @param options Progress + optional abort signal.
 */
export async function translateHindiLinesToEnglish(
  lines: string[],
  options: TranslateOptions = {},
): Promise<(string | null)[]> {
  if (lines.length === 0) return [];

  const { onProgress, signal } = options;
  activeProgress = onProgress;
  throwIfAborted(signal);

  const translator = await loadHindiEnglishTranslator(options);
  const out: (string | null)[] = [];

  for (let i = 0; i < lines.length; i++) {
    throwIfAborted(signal);
    report(`Translating line ${i + 1} of ${lines.length}…`);
    // Yield so the UI stays responsive and Chrome is less likely to freeze the tab
    // when the user switches away mid-run.
    await yieldToUi();
    const source = lines[i].trim();
    if (source === '' || !isTranslatableHindiLine(source)) {
      out.push(null);
      continue;
    }
    try {
      const result = await translator(source, { max_new_tokens: 256 });
      throwIfAborted(signal);
      const english = readTranslationText(result);
      out.push(isSuccessfulEnglishTranslation(source, english) ? english : null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      console.warn(`Opus-MT failed on line ${i}; skipping overlay`, error);
      out.push(null);
    }
  }

  return out;
}
