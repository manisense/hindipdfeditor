/**
 * Repairs Devanagari text whose font has no Unicode for some glyphs. PDFs printed by Chrome,
 * Google Docs and other Skia-based producers subset the font and leave its ligature glyphs
 * (reph, pre-base ि, conjuncts such as क्ष and द्य, matra combinations) without a ToUnicode
 * entry, so their text comes out with gaps and, for reph and ि, in drawing order rather than
 * reading order. Each such glyph is stood in for by one placeholder character; what it stands for
 * is learned by lining the PDF's words up with OCR of the same lines, and its place in reading
 * order as a shift in syllables (a reph is drawn after the syllable it precedes, ि before the
 * consonant it follows). The PDF's own, correctly mapped characters are kept as they are.
 */

/** What one unmapped glyph stands for, and how far it moves (in syllables) from where it is drawn. */
export type GlyphReading = { text: string; shift: number };

/** One line of PDF text (with placeholders) and OCR of the same line. */
export type LinePair = { embedded: string; ocr: string };

const CONSONANT = /[क-हक़-य़ॸ-ॿ]/u;
const VIRAMA = '्';
/** Votes a reading needs, and the share of votes it must have, to be trusted. */
const MIN_VOTES = 1;
const MIN_SHARE = 0.75;

const isDevanagari = (char: string) => /[\u0900-\u097f]/u.test(char);
const isDevanagariSign = (char: string) => /[ऀ-ःऺ-ॏ॑-ॗॢॣ]/u.test(char);

/**
 * Where each syllable of `text` starts (code-unit offsets). A syllable starts at a consonant that
 * does not follow a virama, at an independent vowel, or at any non-Devanagari-sign character;
 * signs and virama-joined consonants belong to the syllable before them.
 */
export function clusterStarts(text: string): number[] {
  const starts: number[] = [];
  let previous = '';
  let offset = 0;
  for (const char of text) {
    const joined = CONSONANT.test(char) && previous === VIRAMA;
    if (!joined && !isDevanagariSign(char) && char !== VIRAMA) starts.push(offset);
    if (starts.length === 0) starts.push(0);
    previous = char;
    offset += char.length;
  }
  return starts;
}

/** Number of syllables that start before `offset`. */
function syllablesBefore(text: string, offset: number): number {
  return clusterStarts(text).filter((start) => start < offset).length;
}

/** Offset where syllable `index` starts, or the end of the text. */
function syllableStart(text: string, index: number): number {
  const starts = clusterStarts(text);
  return index <= 0 ? 0 : (starts[index] ?? text.length);
}

/**
 * Rebuilds reading-order text from drawn text with placeholders. Glyphs that stay in place are
 * put back first, at their exact position; then each moved glyph (reph, ि) is moved by its
 * learned shift, counted in syllables of the rebuilt word. Unlearned placeholders are left as
 * they are.
 *
 * @param isPlaceholder Whether a character is a glyph placeholder.
 */
export function repairText(
  text: string,
  readings: ReadonlyMap<string, GlyphReading>,
  isPlaceholder: (char: string) => boolean,
): string {
  return text
    .split(/(\s+)/u)
    .map((word) => (/\s/u.test(word) ? word : repairWord(word, readings, isPlaceholder)))
    .join('');
}

function repairWord(
  word: string,
  readings: ReadonlyMap<string, GlyphReading>,
  isPlaceholder: (char: string) => boolean,
): string {
  // In-place glyphs first, so moved ones count syllables in the most complete word.
  let rebuilt = '';
  const moved: { offset: number; reading: GlyphReading }[] = [];
  for (const char of word) {
    const reading = isPlaceholder(char) ? readings.get(char) : undefined;
    if (!reading) rebuilt += char;
    else if (reading.shift === 0) rebuilt += reading.text;
    else moved.push({ offset: rebuilt.length, reading });
  }
  // Apply from the end, so earlier offsets stay valid.
  for (const { offset, reading } of moved.reverse()) {
    const target = syllableStart(rebuilt, syllablesBefore(rebuilt, offset) + reading.shift);
    let at = reading.shift > 0 ? Math.max(target, offset) : Math.min(target, offset);
    // A vowel sign moved forward goes after the consonants, before ं ँ ः that end the syllable.
    if (reading.shift > 0) while (at > offset && /[ँंः]/u.test(rebuilt[at - 1])) at -= 1;
    rebuilt = rebuilt.slice(0, at) + reading.text + rebuilt.slice(at);
  }
  return rebuilt;
}

/**
 * Whether OCR of a line confirms every repaired word of its PDF text: each word that held an
 * unmapped glyph must appear, once repaired, in the OCR text. Spaces and zero-width joiners are
 * ignored on the OCR side (Tesseract writes दिल्‍ली with a joiner the PDF does not have).
 *
 * @param drawn The line's PDF text with glyph placeholders.
 * @param ocr OCR of the same line.
 */
export function ocrConfirmsRepair(
  drawn: string,
  ocr: string,
  readings: ReadonlyMap<string, GlyphReading>,
  isPlaceholder: (char: string) => boolean,
): boolean {
  const compact = ocr.normalize('NFC').replace(/[\s\u200B-\u200D\uFEFF]+/gu, '');
  return drawn
    .split(/\s+/u)
    .filter((word) => [...word].some(isPlaceholder))
    .every((word) => compact.includes(repairText(word, readings, isPlaceholder).normalize('NFC')));
}

const NUMBER = /[0-9०-९]+/gu;

/**
 * OCR text with its numbers replaced, in order, by the PDF's own: a broken text map garbles
 * Devanagari letters, not digits, while OCR misreads them (161 as 6, 1947 as 947). Only when both
 * hold the same count of numbers, so each is matched to its own.
 */
function withPdfNumbers(ocr: string, pdf: string): string {
  const own = pdf.match(NUMBER) ?? [];
  if ((ocr.match(NUMBER) ?? []).length !== own.length) return ocr;
  let i = 0;
  return ocr.replace(NUMBER, () => own[i++]);
}

/**
 * The text kept for a line whose row OCR could not confirm: OCR of the line's own area when it was
 * read (page OCR merges or misses rows of dense text, which would lose the line), else the line's
 * repaired PDF text without the glyphs left unknown. Null only when nothing is left.
 *
 * @param repaired The line's PDF text with learned glyphs put back (placeholders may remain).
 * @param ownOcr OCR of the line's own area, when it was read.
 */
export function unresolvedLineText(
  repaired: string,
  ownOcr: string | undefined,
  isPlaceholder: (char: string) => boolean,
): { text: string; fromOcr: boolean } | null {
  if (ownOcr?.trim()) return { text: withPdfNumbers(ownOcr.trim(), repaired), fromOcr: true };
  const text = [...repaired].filter((char) => !isPlaceholder(char)).join('').replace(/\s+/gu, ' ').trim();
  return text ? { text, fromOcr: false } : null;
}

/** Known syllables taken on each side of a glyph to find it in the OCR line. */
const CONTEXT_SYLLABLES = 2;
/** Fewest known characters around a glyph for its context to be trusted. */
const MIN_CONTEXT_CHARS = 2;

/** Longest text one glyph can stand for (a conjunct with signs). */
const MAX_GLYPH_CHARS = 6;

/**
 * Finds `known` in `ocr` as an ordered subsequence with exactly one contiguous run of extra
 * characters, starting and ending on known characters, and returns that run and where it sits
 * (code-unit offset in the matched stretch), with the stretch itself. Null when no start works or
 * more than one does differently.
 */
function findWithOneGap(known: string, ocr: string): { gap: string; offset: number; stretch: string } | null {
  const k = [...known];
  const o = [...ocr];
  let found: { gap: string; offset: number; stretch: string } | null = null;
  for (let start = 0; start < o.length; start++) {
    if (o[start] !== k[0]) continue;
    let ki = 0;
    const extra: number[] = [];
    let end = start;
    for (let i = start; i < o.length && ki < k.length; i++) {
      if (o[i] === k[ki]) {
        ki += 1;
        end = i;
      } else {
        extra.push(i);
        if (extra.length > MAX_GLYPH_CHARS) break;
      }
    }
    if (ki < k.length || extra.length === 0 || extra.length > MAX_GLYPH_CHARS) continue;
    if (extra[extra.length - 1] - extra[0] !== extra.length - 1) continue;
    const stretch = o.slice(start, end + 1).join('');
    const gap = o.slice(extra[0], extra[extra.length - 1] + 1).join('');
    const offset = o.slice(start, extra[0]).join('').length;
    if (found && (found.gap !== gap || found.offset !== offset)) return null;
    found = { gap, offset, stretch };
  }
  return found;
}

/**
 * The known characters around the glyph at `index` of `text` (spaces removed): up to two
 * syllables before and after it, with the glyph's place in it. `blocked` when another unknown
 * glyph sits within those syllables: OCR of that stretch then holds that glyph's text too (a ि
 * drawn before the consonant ends up after it), so nothing can be learned from it yet.
 */
function contextAround(
  text: string,
  index: number,
  isPlaceholder: (char: string) => boolean,
): { known: string; at: number; blocked: boolean } {
  const chars = [...text];
  let blocked = false;
  // Only Devanagari letters: OCR misreads symbols (→ as >) and Latin in Hindi lines.
  let before = '';
  for (let i = index - 1; i >= 0; i--) {
    const next = chars[i] + before;
    if (clusterStarts(next).length > CONTEXT_SYLLABLES) break;
    if (isPlaceholder(chars[i])) {
      blocked = true;
      break;
    }
    if (!isDevanagari(chars[i])) break;
    before = next;
  }
  let after = '';
  for (let i = index + 1; i < chars.length; i++) {
    const next = after + chars[i];
    if (clusterStarts(next).length > CONTEXT_SYLLABLES) break;
    if (isPlaceholder(chars[i])) {
      blocked = true;
      break;
    }
    if (!isDevanagari(chars[i])) break;
    after = next;
  }
  return { known: before + after, at: before.length, blocked };
}

/**
 * Learns what unmapped glyphs stand for from lines of PDF text paired with OCR of the same line.
 * Spaces are ignored on both sides (text layers often drop or add them). For each glyph, the
 * known characters around it are looked for in the OCR line; the one extra run of characters
 * between them is what the glyph stands for, and where that run sits gives its place in reading
 * order. Passes repeat, putting learned glyphs back, so glyphs next to each other are learned in
 * turn. A reading is kept when its votes agree.
 *
 * @param isPlaceholder Whether a character is a glyph placeholder.
 * @param known Readings already known (kept as they are).
 * @returns Readings by placeholder character.
 */
export function learnGlyphs(
  pairs: readonly LinePair[],
  isPlaceholder: (char: string) => boolean,
  known: ReadonlyMap<string, GlyphReading> = new Map(),
): Map<string, GlyphReading> {
  const readings = new Map<string, GlyphReading>(known);
  const lines = pairs.map(({ embedded, ocr }) => ({ embedded, ocr: ocr.normalize('NFC').replace(/\s+/gu, '') }));
  for (let pass = 0; pass < 6; pass++) {
    const votes = new Map<string, Map<string, number>>();
    for (const { embedded, ocr } of lines) {
      const text = repairText(embedded, readings, isPlaceholder).replace(/\s+/gu, '');
      [...text].forEach((glyph, index) => {
        if (!isPlaceholder(glyph) || readings.has(glyph)) return;
        const { known, at, blocked } = contextAround(text, index, isPlaceholder);
        if (blocked || [...known].length < MIN_CONTEXT_CHARS) return;
        const match = findWithOneGap(known, ocr);
        if (!match) return;
        const shift = syllablesBefore(match.stretch, match.offset) - syllablesBefore(known, at);
        const key = JSON.stringify({ text: match.gap, shift });
        const forGlyph = votes.get(glyph) ?? new Map<string, number>();
        forGlyph.set(key, (forGlyph.get(key) ?? 0) + 1);
        votes.set(glyph, forGlyph);
      });
    }
    let learned = 0;
    for (const [glyph, forGlyph] of votes) {
      const total = [...forGlyph.values()].reduce((a, b) => a + b, 0);
      const [best, count] = [...forGlyph].sort((a, b) => b[1] - a[1])[0];
      if (count >= MIN_VOTES && count / total >= MIN_SHARE) {
        readings.set(glyph, JSON.parse(best) as GlyphReading);
        learned += 1;
      }
    }
    if (learned === 0) break;
  }
  return readings;
}

/**
 * Re-spaces `text` (a repaired PDF line) like `ocr` (OCR of the same line). PDF text layers often
 * drop or add spaces where a line switches between font subsets; OCR spaces words as they look.
 * The two are aligned character by character with spaces removed, and between two neighbouring
 * characters that both line up with neighbouring OCR characters, OCR decides whether there is a
 * space. Everywhere else the PDF's text and spaces are kept.
 */
export function spacedLike(text: string, ocr: string): string {
  const split = (line: string) => {
    const chars: string[] = [];
    const spaceBefore: boolean[] = [];
    let pending = false;
    for (const char of line.trim()) {
      if (/\s/u.test(char)) {
        pending = true;
        continue;
      }
      chars.push(char);
      spaceBefore.push(pending);
      pending = false;
    }
    return { chars, spaceBefore };
  };
  const { chars: a, spaceBefore: spaceBeforeA } = split(text);
  const { chars: b, spaceBefore: spaceBeforeB } = split(ocr.normalize('NFC'));
  // Longest common subsequence, then walk it to pair characters.
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const partner: number[] = new Array(n).fill(-1);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) {
      partner[i] = j;
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1;
    else j += 1;
  }
  let out = '';
  a.forEach((char, i) => {
    if (i > 0) {
      const agreed = partner[i] >= 0 && partner[i - 1] >= 0 && partner[i] === partner[i - 1] + 1;
      const space = agreed ? spaceBeforeB[partner[i]] : spaceBeforeA[i];
      if (space) out += ' ';
    }
    out += char;
  });
  return out;
}

/** First placeholder: Supplementary Private Use Area-A, which no PDF text map here produces. */
const PLACEHOLDER_BASE = 0xf0000;

/** Whether a character stands in for an unmapped glyph. */
export function isGlyphPlaceholder(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code >= PLACEHOLDER_BASE && code <= 0xffffd;
}

/** Whether text still holds a glyph placeholder. */
export function hasGlyphPlaceholder(text: string): boolean {
  return [...text].some(isGlyphPlaceholder);
}

type Registry = { byKey: Map<string, string>; signatureOf: Map<string, string> };
const placeholdersByDocument = new WeakMap<Uint8Array, Registry>();

/**
 * The placeholder character for an unmapped glyph, the same on every page of one opened file.
 *
 * @param pdfBytes Bytes of the opened PDF (identifies the document).
 * @param glyphKey The PDF font (pdf.js's loaded name, unique per font) and the glyph's code.
 * @param signature What the glyph looks like as far as the PDF tells: the font's name and the
 *   glyph's advance width. Producers split one font into several subsets with the same name, so
 *   one glyph can appear under several keys with the same signature.
 */
export function glyphPlaceholder(pdfBytes: Uint8Array, glyphKey: string, signature: string): string {
  let registry = placeholdersByDocument.get(pdfBytes);
  if (!registry) {
    registry = { byKey: new Map(), signatureOf: new Map() };
    placeholdersByDocument.set(pdfBytes, registry);
  }
  let char = registry.byKey.get(glyphKey);
  if (!char) {
    char = String.fromCodePoint(PLACEHOLDER_BASE + registry.byKey.size);
    registry.byKey.set(glyphKey, char);
    registry.signatureOf.set(char, signature);
  }
  return char;
}

/** Where a glyph is drawn in its words: always before a consonant, always after a letter, or both. */
export type GlyphPlace = 'pre' | 'post' | 'mixed';

/** Where each placeholder is drawn across lines of PDF text (see {@link GlyphPlace}). */
export function glyphPlaces(texts: readonly string[], isPlaceholder: (char: string) => boolean): Map<string, GlyphPlace> {
  const places = new Map<string, GlyphPlace>();
  for (const text of texts) {
    const chars = [...text];
    chars.forEach((char, i) => {
      if (!isPlaceholder(char)) return;
      const previous = chars[i - 1] ?? ' ';
      const next = chars[i + 1] ?? ' ';
      const place: GlyphPlace = !isDevanagari(previous) && CONSONANT.test(next) ? 'pre' : isDevanagari(previous) ? 'post' : 'mixed';
      const seen = places.get(char);
      places.set(char, seen && seen !== place ? 'mixed' : place);
    });
  }
  return places;
}

/**
 * Readings for unlearned glyphs taken from learned glyphs with the same signature (font name and
 * a non-zero advance width), when every learned glyph with that signature reads the same.
 * Zero-width glyphs (marks) are never shared: too many different marks have no width. Where
 * the glyph is drawn picks between readings that share a width (ि and ी can).
 *
 * @param signatureOf Signature by placeholder character.
 * @param placeOf Where each placeholder is drawn (see {@link glyphPlaces}).
 */
export function borrowReadings(
  readings: ReadonlyMap<string, GlyphReading>,
  signatureOf: ReadonlyMap<string, string>,
  placeOf: ReadonlyMap<string, GlyphPlace> = new Map(),
): Map<string, GlyphReading> {
  const bySignature = new Map<string, Set<string>>();
  for (const [char, reading] of readings) {
    const signature = signatureOf.get(char);
    if (!signature || signature.endsWith('|0')) continue;
    const set = bySignature.get(signature) ?? new Set<string>();
    set.add(JSON.stringify(reading));
    bySignature.set(signature, set);
  }
  const borrowed = new Map(readings);
  for (const [char, signature] of signatureOf) {
    if (borrowed.has(char)) continue;
    const place = placeOf.get(char);
    // Where the glyph is drawn narrows the candidates: before a consonant it is a pre-base sign
    // (moves forward); after a letter it is not.
    const fitting = [...(bySignature.get(signature) ?? [])].filter((candidate) => {
      const { shift } = JSON.parse(candidate) as GlyphReading;
      return place === 'pre' ? shift > 0 : place === 'post' ? shift <= 0 : true;
    });
    if (fitting.length === 1) borrowed.set(char, JSON.parse(fitting[0]) as GlyphReading);
  }
  return borrowed;
}

type Box = { xPt: number; yPt: number; wPt: number; hPt: number };

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/**
 * Pairs each PDF line holding placeholders with the OCR line covering most of it (at least half
 * its height and half its width).
 *
 * @param embedded PDF lines; boxes in PDF points.
 * @param ocr OCR lines of the same page; boxes in PDF points.
 */
export function pairLinesWithOcr(
  embedded: readonly (Box & { text: string })[],
  ocr: readonly (Box & { text: string })[],
): LinePair[] {
  const pairs: LinePair[] = [];
  for (const line of embedded) {
    if (!hasGlyphPlaceholder(line.text)) continue;
    const match = ocrLineFor(line, ocr);
    if (match) pairs.push({ embedded: line.text, ocr: match.text });
  }
  return pairs;
}

/**
 * The OCR line covering most of a PDF line (at least half its height and half its width), or
 * null. Boxes in PDF points.
 */
export function ocrLineFor<T extends Box>(line: Box, ocr: readonly T[]): T | null {
  let best: { line: T; score: number } | null = null;
  for (const candidate of ocr) {
    const v = overlap(line.yPt, line.yPt + line.hPt, candidate.yPt, candidate.yPt + candidate.hPt) / Math.min(line.hPt, candidate.hPt);
    const h = overlap(line.xPt, line.xPt + line.wPt, candidate.xPt, candidate.xPt + candidate.wPt) / line.wPt;
    if (v < 0.5 || h < 0.5) continue;
    const score = v * h;
    if (!best || score > best.score) best = { line: candidate, score };
  }
  return best?.line ?? null;
}

const pairsByDocument = new WeakMap<Uint8Array, LinePair[]>();

/**
 * Adds a page's line pairs to what is known about the opened file and learns from all of them, so
 * glyphs seen on earlier pages are read on later ones too. Readings are shared between subsets of
 * one font (see {@link borrowReadings}).
 *
 * @param pdfBytes Bytes of the opened PDF (identifies the document).
 */
export function learnDocumentGlyphs(pdfBytes: Uint8Array, pagePairs: readonly LinePair[]): Map<string, GlyphReading> {
  const pairs = [...(pairsByDocument.get(pdfBytes) ?? []), ...pagePairs];
  pairsByDocument.set(pdfBytes, pairs);
  const signatureOf = placeholdersByDocument.get(pdfBytes)?.signatureOf ?? new Map<string, string>();
  // Learning and borrowing feed each other: a borrowed ि lets the conjunct after it be learned.
  const placeOf = glyphPlaces(pairs.map((pair) => pair.embedded), isGlyphPlaceholder);
  let readings = learnGlyphs(pairs, isGlyphPlaceholder);
  for (let round = 0; round < 3; round++) {
    const borrowed = borrowReadings(readings, signatureOf, placeOf);
    if (borrowed.size === readings.size) break;
    readings = learnGlyphs(pairs, isGlyphPlaceholder, borrowed);
  }
  return readings;
}
