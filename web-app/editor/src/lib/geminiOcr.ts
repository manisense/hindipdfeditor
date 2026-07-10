import type { RecognizedLine } from './recognizedLine';

const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const OCR_PROMPT =
  'Read ALL text in this scanned document image, line by line. ' +
  'Return a JSON array where each element is {"text": string, "box_2d": [ymin, xmin, ymax, xmax]} ' +
  'with box_2d normalized to 0-1000. One element per visual line of text. ' +
  'Include every visible line of Hindi (Devanagari) and English text. ' +
  'Transcribe the text exactly as written, preserving the original script. ' +
  'Return ONLY the JSON array, no other text.';

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
