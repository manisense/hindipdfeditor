/** One OCR word with its confidence (0–100). */
export type CellWord = { text: string; confidence: number };

/** Below this confidence (0–100) a short word at a cell's edge is speckle, not text. */
const EDGE_JUNK_CONFIDENCE = 60;
/** Longest edge word, in characters, that can be dropped as speckle. */
const EDGE_JUNK_LENGTH = 2;

function isEdgeJunk(word: CellWord): boolean {
  if (!/[\p{L}\p{N}]/u.test(word.text)) return true;
  return [...word.text.normalize("NFC")].length <= EDGE_JUNK_LENGTH && word.confidence < EDGE_JUNK_CONFIDENCE;
}

/**
 * The reading of one scanned table cell without the speckle OCR finds in its empty part: short,
 * unsure words (० . का) and marks with no letter or digit are dropped from the start and the end.
 * Words in the middle are kept. The confidence is the mean of the words kept.
 *
 * @param words The cell's words in reading order.
 * @returns The text and its confidence, or null when nothing is left.
 */
export function cleanCellReading(words: readonly CellWord[]): { text: string; confidence: number } | null {
  let start = 0;
  let end = words.length;
  while (start < end && isEdgeJunk(words[start])) start++;
  while (end > start && isEdgeJunk(words[end - 1])) end--;
  const kept = words.slice(start, end);
  if (kept.length === 0) return null;
  return {
    text: kept.map((word) => word.text).join(" "),
    confidence: kept.reduce((sum, word) => sum + word.confidence, 0) / kept.length,
  };
}
