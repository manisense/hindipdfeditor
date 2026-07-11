/**
 * Free Hindi→English translation that runs entirely in the browser via Transformers.js
 * and the Helsinki-NLP Opus-MT hi→en model (ONNX, quantized). No API key, no cloud LLM.
 *
 * First use downloads ~70–100MB of model weights from Hugging Face (then cached in
 * IndexedDB by the library). Subsequent runs reuse the cache.
 */

import { pipeline, env } from '@huggingface/transformers';

// Models are fetched from Hugging Face CDN and cached; don't try to bundle them into Vite.
env.allowLocalModels = false;
env.useBrowserCache = true;

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

/**
 * Lazily loads (and caches) the Opus-MT Hindi→English pipeline.
 *
 * @param onProgress Optional human-readable load progress for the UI.
 */
export async function loadHindiEnglishTranslator(
  onProgress?: ProgressCallback,
): Promise<TranslatorFn> {
  if (!translatorPromise) {
    translatorPromise = (async () => {
      onProgress?.('Downloading Hindi→English model (one-time, free, cached)…');
      try {
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
              onProgress?.(`Loading model ${file}… ${pct}%`);
            }
          },
        });
        onProgress?.('Translation model ready');
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
 * Translates Hindi (Devanagari) line strings to English in the browser.
 * Empty input returns []. Lines are translated sequentially to keep WASM memory stable.
 *
 * @param lines Source strings containing Devanagari.
 * @param onProgress Optional progress updates (model load + per-line status).
 */
export async function translateHindiLinesToEnglish(
  lines: string[],
  onProgress?: ProgressCallback,
): Promise<string[]> {
  if (lines.length === 0) return [];

  const translator = await loadHindiEnglishTranslator(onProgress);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    onProgress?.(`Translating line ${i + 1} of ${lines.length}…`);
    const source = lines[i].trim();
    if (source === '') {
      out.push('');
      continue;
    }
    try {
      const result = await translator(source, { max_new_tokens: 256 });
      const english = readTranslationText(result);
      out.push(english === '' ? source : english);
    } catch (error) {
      console.warn(`Opus-MT failed on line ${i}; leaving original text`, error);
      out.push(source);
    }
  }

  return out;
}
