// Per-line voting between two OCR engines (a small ROVER): for every line PaddleOCR finds, the
// Tesseract words whose centres fall inside the same box form a second reading of that line, and
// the reading with more lexicon words wins (a tie keeps Paddle, the stronger engine on scans).
// Neither engine wins everywhere (Tesseract is best on clean renders, Paddle on photographed and
// table pages), and the lexicon is the only judge available without ground truth.
// Benchmark only: nothing here ships in the editor.
import { hindiWords } from "./score.mjs";

/** Counts the Hindi words of `text` and how many of them `isKnown` accepts. */
export function knownShare(text, isKnown) {
  const words = hindiWords(text);
  return { known: words.filter((w) => isKnown(w)).length, hindi: words.length };
}

const centre = (b) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });
const inside = (p, box) => p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;

/** Groups words (tesseract.js shape, bbox in image px) into lines, top to bottom, left to right. */
function asLines(words) {
  const sorted = [...words].sort((a, b) => centre(a.bbox).y - centre(b.bbox).y);
  const lines = [];
  for (const w of sorted) {
    const last = lines.at(-1);
    const h = w.bbox.y1 - w.bbox.y0;
    if (last && Math.abs(centre(w.bbox).y - last.y) < h / 2) last.words.push(w);
    else lines.push({ y: centre(w.bbox).y, words: [w] });
  }
  return lines.map((l) => l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0).map((w) => w.text).join(" "));
}

/**
 * Picks one reading per line.
 *
 * @param paddleLines Paddle lines `{ text, box: { x, y, w, h } }`, box in image px.
 * @param tesseractWords tesseract.js words `{ text, bbox: { x0, y0, x1, y1 } }`, same image px.
 * @param isKnown Lexicon test for one NFC Hindi word.
 * @returns Lines `{ text, from: "paddle" | "tesseract" }` in Paddle's order, then Tesseract lines
 *   no Paddle box covered.
 */
export function voteLines(paddleLines, tesseractWords, isKnown) {
  const unused = new Set(tesseractWords);
  const voted = paddleLines.map((line) => {
    const mine = tesseractWords.filter((w) => unused.has(w) && inside(centre(w.bbox), line.box));
    for (const w of mine) unused.delete(w);
    const other = mine.sort((a, b) => a.bbox.x0 - b.bbox.x0).map((w) => w.text).join(" ");
    return knownShare(other, isKnown).known > knownShare(line.text, isKnown).known
      ? { text: other, from: "tesseract" }
      : { text: line.text, from: "paddle" };
  });
  return [...voted, ...asLines([...unused]).map((text) => ({ text, from: "tesseract" }))];
}
