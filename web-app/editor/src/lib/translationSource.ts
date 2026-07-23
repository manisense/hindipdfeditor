const DEVANAGARI_RE = /[\u0900-\u097f]/u;
const LATIN_GLOBAL_RE = /[A-Za-z]/gu;
const DEVANAGARI_GLOBAL_RE = /[\u0900-\u097f]/gu;

export function containsDevanagari(text: string): boolean {
  return DEVANAGARI_RE.test(text);
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
