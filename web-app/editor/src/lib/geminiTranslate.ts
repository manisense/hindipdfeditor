import {
  AI_LIMITS,
  type TranslationDirection,
  type TranslationLine,
} from "@hindipdfeditor/translation-contract";

import { aiApiClient } from "./aiApiClient";

/**
 * Translates OCR lines through the production AI API and preserves stable line IDs.
 */
export async function translateOcrLines(
  jobId: string,
  direction: TranslationDirection,
  lines: TranslationLine[],
): Promise<Map<string, string>> {
  if (lines.length === 0) return new Map();
  const translated = new Map<string, string>();
  for (
    let index = 0;
    index < lines.length;
    index += AI_LIMITS.maxLinesPerRequest
  ) {
    const response = await aiApiClient.translate(
      jobId,
      direction,
      lines.slice(index, index + AI_LIMITS.maxLinesPerRequest),
    );
    for (const result of response.results) {
      if (result.status === "translated" && result.translatedText) {
        translated.set(result.id, result.translatedText);
      }
    }
  }
  return translated;
}
