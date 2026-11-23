/**
 * Downloads OCR language data once per page load, before any worker asks for it.
 *
 * Each Tesseract worker fetches its own copy of the 1.4–3 MB model, so a pool of up to four
 * workers per language and mode downloaded the same file several times at once. On a slow
 * connection the copies competed and every worker hit its load timeout. Here one download runs
 * per language and fills the browser cache (`/edit/ocr/*` is cached for a week in `_headers`),
 * so the workers then read it locally. The download only fails when bytes stop arriving, not
 * when a slow download is long.
 *
 * Handing the bytes to `createWorker` as `{ code, data }` would avoid the cache, but
 * tesseract.js 6 initialises with `data` in place of the language code, so that form fails.
 */

/** A download that receives nothing for this long is treated as failed. */
export const OCR_STALL_TIMEOUT_MS = 30_000;

/**
 * Fetches `url` and fails only when no bytes arrive for `stallMs` (milliseconds), however long
 * the whole download takes.
 *
 * @param stallMs Longest gap between received chunks, in milliseconds.
 * @param fetchImpl Injected for tests.
 */
export async function downloadWithStallTimeout(
  url: string,
  stallMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stalled = false;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, stallMs);
  };
  arm();
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`OCR data ${url}: HTTP ${response.status}`);
    if (!response.body) return new Uint8Array(await response.arrayBuffer());
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      arm();
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch (error) {
    if (stalled) throw new Error(`OCR data ${url} stopped downloading`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const downloads = new Map<string, Promise<void>>();

/**
 * Settles once the gzipped `.traineddata` for `language` is in the browser cache. One download
 * per language is shared by every caller; a failed one is forgotten so the next call retries.
 *
 * @param langPath Absolute URL of the folder that holds `<language>.traineddata.gz`.
 */
export function warmLanguageData(language: string, langPath: string): Promise<void> {
  const url = `${langPath.replace(/\/$/, "")}/${language}.traineddata.gz`;
  let download = downloads.get(url);
  if (!download) {
    download = downloadWithStallTimeout(url, OCR_STALL_TIMEOUT_MS).then(() => undefined);
    downloads.set(url, download);
    download.catch(() => downloads.delete(url));
  }
  return download;
}
