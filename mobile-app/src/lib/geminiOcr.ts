import type { RecognizedLine } from 'text-recognition';

/**
 * Opt-in cloud OCR via the Gemini API's free tier - the "Enhance with AI" path for scans
 * where the on-device ML Kit pass (`ocr.ts`/`mergeOcrLines.ts`) isn't accurate enough.
 *
 * Privacy boundary (the reason this is strictly opt-in and never automatic): unlike the
 * bundled ML Kit models, this sends the page's rasterized image to Google's servers. The
 * caller (App.tsx) is responsible for making that explicit to the user before the first call.
 *
 * Returns the same `RecognizedLine[]` px-space contract as the native `text-recognition`
 * module, so everything downstream (px-to-pt conversion, hit testing, tap-to-edit) is shared
 * with the on-device path and doesn't know which engine produced the lines.
 */

// gemini-3-flash-preview is the current strongest model WITH a Gemini API free tier
// (gemini-3.1-pro has no API free tier; 3.1-flash-lite is free but weaker at dense
// Devanagari OCR). Verified against ai.google.dev's model table, July 2026.
const GEMINI_MODEL = 'gemini-3-flash-preview';

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// box_2d follows the Gemini object-detection convention ([ymin, xmin, ymax, xmax], normalized
// to 0-1000) because the models are specifically trained to emit boxes in that format -
// asking for a custom format produces measurably worse localization.
const OCR_PROMPT =
  'Read ALL text in this scanned document image, line by line. ' +
  'Return a JSON array where each element is {"text": string, "box_2d": [ymin, xmin, ymax, xmax]} ' +
  'with box_2d normalized to 0-1000. One element per visual line of text. ' +
  'Include every visible line of Hindi (Devanagari) and English text. ' +
  'Transcribe the text exactly as written, preserving the original script. ' +
  'Return ONLY the JSON array, no other text.';

/**
 * Parses a Gemini `generateContent` response into px-space recognized lines. Exported
 * separately from the network call so it's unit-testable without mocking fetch.
 *
 * Fails closed (throws) on anything malformed rather than best-effort salvaging partial
 * output - same posture as `legacyFontDetector.ts` (AGENTS.md): a wrong-but-plausible OCR
 * box silently corrupts what the user sees, an error message doesn't.
 *
 * @param responseJson The decoded JSON body of the generateContent HTTP response.
 * @param imagePxWidth Width of the image that was sent, in px - used to descale box_2d.
 * @param imagePxHeight Height of the image that was sent, in px.
 */
export function parseGeminiOcrResponse(
  responseJson: unknown,
  imagePxWidth: number,
  imagePxHeight: number,
): RecognizedLine[] {
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

  // Belt-and-suspenders: responseMimeType application/json is requested, but models still
  // occasionally wrap output in a markdown code fence.
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  let entries: unknown;
  try {
    entries = JSON.parse(unfenced);
  } catch {
    throw new Error('Gemini response was not valid JSON');
  }
  if (!Array.isArray(entries)) {
    throw new Error('Gemini response JSON was not an array');
  }

  const lines: RecognizedLine[] = [];
  for (const entry of entries) {
    const e = entry as { text?: unknown; box_2d?: unknown };
    if (typeof e.text !== 'string' || e.text.trim() === '') continue;
    const box = e.box_2d;
    if (!Array.isArray(box) || box.length !== 4 || !box.every((n) => typeof n === 'number')) {
      throw new Error('Gemini response entry has a malformed box_2d');
    }
    const [yMin, xMin, yMax, xMax] = box as [number, number, number, number];
    if (yMax <= yMin || xMax <= xMin) continue;
    lines.push({
      text: e.text,
      x: Math.round((xMin / 1000) * imagePxWidth),
      y: Math.round((yMin / 1000) * imagePxHeight),
      width: Math.round(((xMax - xMin) / 1000) * imagePxWidth),
      height: Math.round(((yMax - yMin) / 1000) * imagePxHeight),
    });
  }
  return lines;
}

/**
 * Sends one page image to the Gemini API for OCR and returns recognized lines with boxes in
 * the image's own px space (same contract as the on-device `text-recognition` module).
 *
 * @param imageBase64 The page's rasterized background JPEG, base64-encoded (no data: prefix).
 * @param imagePxWidth Width of that image, in px.
 * @param imagePxHeight Height of that image, in px.
 * @param apiKey The user's own Gemini API key (free tier works; stored via `apiKeyStore.ts`).
 */
export async function recognizeTextWithGemini(
  imageBase64: string,
  imagePxWidth: number,
  imagePxHeight: number,
  apiKey: string,
): Promise<RecognizedLine[]> {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
            { text: OCR_PROMPT },
          ],
        },
      ],
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
  return parseGeminiOcrResponse(json, imagePxWidth, imagePxHeight);
}
