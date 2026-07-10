const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Max source strings per Gemini request — keeps prompts small and responses reliable. */
const BATCH_SIZE = 40;

const DEVANAGARI_RE = /[\u0900-\u097F]/;

/** True when `text` contains at least one Devanagari code point. */
export function containsDevanagari(text: string): boolean {
  return DEVANAGARI_RE.test(text);
}

/**
 * Parses a Gemini translate response into an English string array of the expected length.
 *
 * @param responseJson Decoded generateContent JSON body.
 * @param expectedLength Number of input strings that must be mirrored in the output.
 */
export function parseGeminiTranslateResponse(
  responseJson: unknown,
  expectedLength: number,
): string[] {
  const root = responseJson as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (root?.error?.message) {
    throw new Error(`Gemini API error: ${root.error.message}`);
  }
  const text = root?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw new Error('Gemini returned no text content');
  }

  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let entries: unknown;
  try {
    entries = JSON.parse(unfenced);
  } catch {
    throw new Error('Gemini translate response was not valid JSON');
  }
  if (!Array.isArray(entries) || entries.length !== expectedLength) {
    throw new Error(
      `Gemini translate response length mismatch (got ${Array.isArray(entries) ? entries.length : 'non-array'}, expected ${expectedLength})`,
    );
  }
  return entries.map((entry, i) => {
    if (typeof entry !== 'string') {
      throw new Error(`Gemini translate entry ${i} was not a string`);
    }
    return entry.trim();
  });
}

async function translateBatch(lines: string[], apiKey: string): Promise<string[]> {
  const prompt =
    'Translate each string from Hindi (Devanagari) to natural English. ' +
    'Preserve meaning; leave already-English fragments as English. ' +
    'Return a JSON array of strings with the same length and order as the input. ' +
    'Return ONLY the JSON array.\n\n' +
    JSON.stringify(lines);

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });

  const json: unknown = await response.json().catch(() => {
    throw new Error(`Gemini API returned a non-JSON response (HTTP ${response.status})`);
  });
  if (!response.ok) {
    const message =
      (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`Gemini API request failed: ${message}`);
  }
  return parseGeminiTranslateResponse(json, lines.length);
}

/**
 * Translates Hindi (Devanagari) line strings to English via the user's Gemini API key.
 * Batches requests; empty input returns [].
 *
 * @param lines Source strings (typically OCR / embedded PDF lines containing Devanagari).
 * @param apiKey User's Gemini API key.
 */
export async function translateHindiLinesToEnglish(
  lines: string[],
  apiKey: string,
): Promise<string[]> {
  if (lines.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    const batch = lines.slice(i, i + BATCH_SIZE);
    out.push(...(await translateBatch(batch, apiKey)));
  }
  return out;
}
