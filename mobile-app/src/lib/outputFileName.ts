const PDF_EXTENSION = /\.pdf$/i;
/** Path separators, characters Android storage rejects, and control characters. */
const UNSAFE_FILE_NAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

/**
 * Turns what the person typed into a safe file name ending in `.pdf`: drops a typed `.pdf`,
 * replaces path separators and other unsafe characters with `-`, drops leading dots and dashes
 * (no hidden files), and falls back to `fallback` (itself sanitised) when nothing usable is left.
 */
export function outputFileName(typed: string, fallback: string): string {
  const clean = (name: string) =>
    name
      .trim()
      .replace(PDF_EXTENSION, '')
      .replace(UNSAFE_FILE_NAME_CHARS, '-')
      .replace(/^[.\-\s]+/, '')
      .trim();
  const base = clean(typed) || clean(fallback) || 'document';
  return `${truncateUtf8(base, MAX_BASE_NAME_BYTES).replace(/[.\s]+$/, '')}.pdf`;
}

/**
 * Longest base name, in UTF-8 bytes. Android allows 255 bytes per file name; this leaves room
 * for a ` (n)` suffix and `.pdf`. Devanagari takes 3 bytes per code point, so this is about 66
 * Devanagari characters.
 */
export const MAX_BASE_NAME_BYTES = 200;

/** Combining marks (general and Devanagari: signs, nukta, matras, virama), ZWNJ/ZWJ, VS. */
const JOINING_CHAR =
  /[\u0300-\u036f\u0900-\u0903\u093a-\u094f\u0951-\u0957\u0962\u0963\u200c\u200d\ufe00-\ufe0f]/;
const VIRAMA = '\u094d';

function utf8Length(codePoint: number): number {
  return codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
}

/**
 * Cuts `text` to at most `maxBytes` UTF-8 bytes (a byte count) at a code point boundary, then
 * backs off so no Devanagari cluster is split: the cut never leaves a following mark, matra,
 * nukta or joiner behind, and never ends on a virama or joiner (half a conjunct).
 */
export function truncateUtf8(text: string, maxBytes: number): string {
  const chars = Array.from(text);
  let bytes = 0;
  let end = 0;
  while (end < chars.length) {
    const size = utf8Length(chars[end].codePointAt(0) ?? 0);
    if (bytes + size > maxBytes) break;
    bytes += size;
    end += 1;
  }
  if (end === chars.length) return text;
  const splitsCluster = (cut: number) => {
    const next = chars[cut];
    const last = chars[cut - 1];
    return (
      (next !== undefined && JOINING_CHAR.test(next)) ||
      last === VIRAMA ||
      last === '\u200d' ||
      last === '\u200c'
    );
  };
  while (end > 0 && splitsCluster(end)) end -= 1;
  return chars.slice(0, end).join('');
}
