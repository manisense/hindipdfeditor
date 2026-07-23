import {
  AI_LIMITS,
  type TranslationDirection,
  type TranslationLine,
} from '@hindipdfeditor/translation-contract';

import { aiApiClient } from './aiApiClient';

const DEVANAGARI_RE = /[\u0900-\u097f]/u;
const LATIN_RE = /[A-Za-z]/u;

/** True when `text` contains at least one Devanagari code point. */
export function containsDevanagari(text: string): boolean {
  return DEVANAGARI_RE.test(text);
}

/** True when `text` contains at least one Latin letter. */
export function containsLatin(text: string): boolean {
  return LATIN_RE.test(text);
}

/** Translates OCR lines through the production API and preserves stable line IDs. */
export async function translateOcrLines(
  jobId: string,
  direction: TranslationDirection,
  lines: TranslationLine[],
): Promise<Map<string, string>> {
  if (lines.length === 0) return new Map();
  const translated = new Map<string, string>();
  for (let index = 0; index < lines.length; index += AI_LIMITS.maxLinesPerRequest) {
    const response = await aiApiClient.translate(
      jobId,
      direction,
      lines.slice(index, index + AI_LIMITS.maxLinesPerRequest),
    );
    for (const result of response.results) {
      if (result.status === 'translated' && result.translatedText) {
        translated.set(result.id, result.translatedText);
      }
    }
  }
  return translated;
}
