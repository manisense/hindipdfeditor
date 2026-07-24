const DEVANAGARI_RE = /[\u0900-\u097f]/u;
const LATIN_RE = /[A-Za-z]/u;
const LATIN_GLOBAL_RE = /[A-Za-z]/gu;
const DEVANAGARI_GLOBAL_RE = /[\u0900-\u097f]/gu;

export function containsDevanagari(text: string): boolean {
  return DEVANAGARI_RE.test(text);
}

/** True when `text` contains at least one Latin letter. */
export function containsLatin(text: string): boolean {
  return LATIN_RE.test(text);
}

/** Rejects short/Latin-heavy OCR noise before Hindi-to-English translation. */
export function isTranslatableHindiLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2 || !containsDevanagari(trimmed)) return false;
  const latin = trimmed.match(LATIN_GLOBAL_RE)?.length ?? 0;
  const devanagari = trimmed.match(DEVANAGARI_GLOBAL_RE)?.length ?? 0;
  const letters = latin + devanagari;
  return devanagari >= 2 && (letters === 0 || devanagari / letters >= 0.5);
}

/** True when a line is predominantly Latin (English) and not Devanagari. */
export function isTranslatableEnglishLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2 || !containsLatin(trimmed)) return false;
  if (containsDevanagari(trimmed)) return false;
  return (trimmed.match(LATIN_GLOBAL_RE)?.length ?? 0) >= 2;
}

/**
 * Picks a single translation direction from detected page lines.
 * Returns null when neither Hindi nor English source text is present.
 */
export function detectTranslationDirection(
  texts: readonly string[],
): "hi-en" | "en-hi" | null {
  let hindiLines = 0;
  let englishLines = 0;
  for (const text of texts) {
    if (isTranslatableHindiLine(text)) hindiLines += 1;
    else if (isTranslatableEnglishLine(text)) englishLines += 1;
  }
  if (hindiLines === 0 && englishLines === 0) return null;
  return hindiLines >= englishLines ? "hi-en" : "en-hi";
}
