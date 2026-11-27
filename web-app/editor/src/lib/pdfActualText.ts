/**
 * Reads `/ActualText` from a page's marked content, the text a producer says its glyphs stand for.
 *
 * Chrome, Google Docs and other Skia-based producers draw Devanagari ligatures (conjuncts, reph,
 * pre-base ि) with glyphs that have no ToUnicode entry, and wrap each cluster in
 * `/Span <</ActualText (…)>> BDC … EMC` with its real text. pdf.js keeps where each marked-content
 * section starts and ends in the operator list but drops its properties, so the text is read from
 * the raw content stream here and matched to pdf.js's sections by order. Any mismatch (a section
 * inside a form XObject, a property list given by name, glyphs pdf.js left out of its text) leaves
 * the page as pdf.js read it.
 */

import { tokenize } from './contentStreamText';

/** One `BDC` in a content stream: its tag and its `/ActualText`, if any. */
export type MarkedContentStart = { tag: string; actualText: string | null };

/** pdf.js operator codes this module reads (from `OPS`), passed in so it stays testable. */
export type MarkedContentOps = {
  showText: number;
  beginMarkedContent: number;
  beginMarkedContentProps: number;
  endMarkedContent: number;
  /** Text positioning operators, read to tell where a new line starts (optional). */
  setFont?: number;
  setTextMatrix?: number;
  moveText?: number;
  setLeadingMoveText?: number;
  nextLine?: number;
};

/** One glyph drawn on the page, in drawing order. */
export type DrawnGlyph = {
  /** Its Unicode text from pdf.js (U+0000 when unmapped). */
  text: string;
  /** The `/ActualText` section it is drawn in (index into the page's `BDC`s), or null. */
  section: number | null;
  /** Set when it is the first glyph drawn after the text moved to another line. */
  lineStart?: true;
};

const NUL = String.fromCharCode(0);

function pdfStringText(bytes: number[]): string {
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let text = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) text += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return text;
  }
  return String.fromCharCode(...bytes);
}

/**
 * The `BDC` operators of a decoded content stream, in order.
 *
 * @param content Decoded page content stream, latin1 (one char per byte).
 */
export function markedContentStarts(content: string): MarkedContentStart[] {
  const tokens = tokenize(content);
  const source = (i: number) => content.slice(tokens[i].start, tokens[i].end);
  const starts: MarkedContentStart[] = [];
  tokens.forEach((token, i) => {
    if (token.kind !== 'op' || token.value !== 'BDC') return;
    let tagAt = i - 2;
    let actualText: string | null = null;
    if (i > 0 && source(i - 1) === '>>') {
      let depth = 0;
      let open = i - 1;
      for (; open >= 0; open--) {
        const text = source(open);
        if (text === '>>') depth++;
        if (text === '<<') depth--;
        if (depth === 0) break;
      }
      for (let k = open + 1; k < i - 1; k++) {
        const value = tokens[k + 1];
        if (source(k) === '/ActualText' && value?.kind === 'str') actualText = pdfStringText(value.bytes);
      }
      tagAt = open - 1;
    }
    starts.push({ tag: tagAt >= 0 ? source(tagAt).replace(/^\//, '') : '', actualText });
  });
  return starts;
}

/**
 * Every glyph pdf.js drew, in order, with the `/ActualText` section around it.
 *
 * @param starts The page's `BDC`s (see {@link markedContentStarts}).
 * @returns The glyphs, or null when pdf.js's marked-content sections do not match `starts`.
 */
export function drawnGlyphs(
  fnArray: readonly number[],
  argsArray: readonly unknown[],
  starts: readonly MarkedContentStart[],
  ops: MarkedContentOps,
): DrawnGlyph[] | null {
  const glyphs: DrawnGlyph[] = [];
  const open: (number | null)[] = [];
  let next = 0;
  // Text line position (user space y of the line matrix), its vertical scale, and the font size.
  let lineY: number | null = null;
  let scaleY = 1;
  let fontSize = 0;
  let lastLineY: number | null = null;
  let moved = false;
  for (const [i, fn] of fnArray.entries()) {
    const args = argsArray[i] as unknown[] | null;
    if (fn === ops.setFont && typeof args?.[1] === 'number') fontSize = Math.abs(args[1]);
    if (fn === ops.setTextMatrix) {
      const m = (Array.isArray(args) && args.length === 6 ? args : (args?.[0] as ArrayLike<unknown> | undefined)) ?? [];
      if (typeof m[5] === 'number' && typeof m[3] === 'number') {
        lineY = m[5];
        scaleY = Math.hypot(Number(m[2]) || 0, m[3]) || 1;
        moved = true;
      }
    }
    if ((fn === ops.moveText || fn === ops.setLeadingMoveText) && typeof args?.[1] === 'number' && lineY !== null) {
      lineY += args[1] * scaleY;
      moved = true;
    }
    if (fn === ops.nextLine) lineY = null;
    if (fn === ops.beginMarkedContent) open.push(open.at(-1) ?? null);
    if (fn === ops.beginMarkedContentProps) {
      const start = starts[next];
      if (!start || start.tag !== String(args?.[0])) return null;
      open.push(open.at(-1) ?? (start.actualText === null ? null : next));
      next += 1;
    }
    if (fn === ops.endMarkedContent) open.pop();
    if (fn !== ops.showText) continue;
    const shown = (args?.[0] as ({ unicode?: string; width?: number } | number | null)[]) ?? [];
    for (const [k, glyph] of shown.entries()) {
      if (!glyph || typeof glyph !== 'object') continue;
      const text = glyph.unicode ?? '';
      const drawn: DrawnGlyph = { text: isCancelledSpace(text, glyph.width, shown[k + 1]) ? '' : text, section: open.at(-1) ?? null };
      // A move of more than half the font size up or down is a new line (superscripts move less).
      if (moved && lineY !== null && lastLineY !== null && Math.abs(lineY - lastLineY) > (fontSize * scaleY) / 2) drawn.lineStart = true;
      if (moved) lastLineY = lineY;
      moved = false;
      glyphs.push(drawn);
    }
  }
  return next === starts.length ? glyphs : null;
}

const isSpace = (char: string) => /^\s+$/u.test(char);

/**
 * A space glyph whose advance the next TJ shift takes straight back (Chrome draws a typed
 * zero-width joiner, as in उम्‍मीदवार, as a space and then moves left by its width): no word break.
 *
 * @param width The glyph's advance, in thousandths of an em (pdf.js glyph width).
 * @param shift The TJ number after it, in thousandths of an em (positive moves left).
 */
function isCancelledSpace(text: string, width: number | undefined, shift: unknown): boolean {
  return isSpace(text) && typeof shift === 'number' && width !== undefined && width > 0 && Math.abs(shift - width) <= width * 0.15;
}
const DEVANAGARI = /[\u0900-\u097F]/u;

/** Text items with `/ActualText` applied (see {@link applyActualText}). */
export type ActualTextResult = {
  items: string[];
  /** For each unmapped glyph, in drawing order: whether its section text replaced it. */
  replaced: boolean[];
  /** For each item whose glyphs all moved into another item's section text, that item. */
  into: (number | null)[];
  /** Whether the page draws its spaces as glyphs (then they are its only word breaks). */
  drawsSpaces: boolean;
  /** For each item, whether a drawn space follows it. */
  spaceAfter: boolean[];
};

/**
 * Replaces the glyphs of each `/ActualText` section that has text with the section's text, in
 * pdf.js's text items (even when every glyph already has a ToUnicode entry, so Devanagari drawn
 * in visual order extracts in exact logical reading order). Glyphs are lined up with the items'
 * characters in order (spaces pdf.js added between words are skipped); the section's text goes
 * where its first glyph was.
 *
 * Producers that write `/ActualText` draw every space as a glyph and draw Devanagari in visual
 * order (ि before its consonant), with jumps pdf.js reads as word gaps (शि क्षा). So when the
 * page draws spaces, a space pdf.js added between two Devanagari letters is removed.
 *
 * @param items pdf.js text item strings, in order.
 * @param glyphs Drawn glyphs (see {@link drawnGlyphs}).
 * @param actualTexts Text of each section by index (null where it has none).
 * @returns The new items and what was learned lining them up (see {@link ActualTextResult}), or
 *   null when the glyphs do not line up with the items.
 */
export function applyActualText(
  items: readonly string[],
  glyphs: readonly DrawnGlyph[],
  actualTexts: readonly (string | null)[],
): ActualTextResult | null {
  const fixable = new Set(
    glyphs
      .filter((glyph) => {
        if (glyph.section === null || glyph.text.length === 0) return false;
        const actual = actualTexts[glyph.section];
        return actual !== null && (!isSpace(actual) || !isSpace(glyph.text));
      })
      .map((glyph) => glyph.section),
  );
  const replaced = glyphs.filter((glyph) => glyph.text === NUL).map((glyph) => fixable.has(glyph.section));
  const chars: { char: string; item: number }[] = items.flatMap((text, item) => [...text].map((char) => ({ char, item })));
  const drop = new Set<number>();
  const insert = new Map<number, string>();
  const into: (number | null)[] = items.map(() => null);
  let target = -1;
  const matched = new Set<number>();
  let at = 0;
  let previous: number | null = null;
  // The section's text, until the first character of its glyphs is found.
  let pending: string | null = null;
  // Where line-start glyphs that hold a sign were found (see below).
  const lineStarts: number[] = [];
  for (const glyph of glyphs) {
    const section = glyph.section !== null && fixable.has(glyph.section) ? glyph.section : null;
    if (section !== previous) {
      if (pending !== null && !isSpace(pending)) return null;
      pending = section === null ? null : (actualTexts[section] ?? '');
      previous = section;
    }
    for (const char of glyph.text) {
      // pdf.js strips U+FEFF from getTextContent() while keeping it on showText glyphs.
      if (char === '\uFEFF' && chars[at]?.char !== '\uFEFF') continue;
      if (!isSpace(char)) {
        while (at < chars.length && isSpace(chars[at].char)) {
          if (section !== null && pending === null) drop.add(at);
          at++;
        }
      }
      if (glyph.lineStart && char === [...glyph.text][0] && /\p{Mn}/u.test(glyph.text)) lineStarts.push(at);
      // pdf.js writes compatibility characters (the ﬁ ligature) decomposed in its text.
      const expected = chars[at]?.char === char ? [char] : [...char.normalize('NFKC')];
      if (!expected.every((part, k) => chars[at + k]?.char === part)) {
        if (isSpace(char)) continue;
        return null;
      }
      for (let k = 0; k < expected.length; k++, at++) {
        matched.add(at);
        if (section === null) continue;
        if (pending !== null) {
          insert.set(at, pending);
          target = chars[at].item;
        }
        pending = null;
        drop.add(at);
        if (chars[at].item !== target) into[chars[at].item] = target;
      }
    }
  }
  if ((pending !== null && !isSpace(pending)) || chars.slice(at).some(({ char }) => !isSpace(char))) return null;
  // pdf.js takes any glyph whose text holds a combining sign (a ligature such as प्र) for a
  // zero-width mark and skips its line-break check, so a line that starts with one has it at the
  // end of the line above's item. Such a glyph, and what follows it in that item, opens the next.
  for (const start of lineStarts) {
    const item = chars[start].item;
    const first = chars.findIndex((c) => c.item === item && !isSpace(c.char));
    if (first === start || item + 1 >= items.length) continue;
    for (let i = start; i < chars.length && chars[i].item === item; i++) chars[i].item = item + 1;
  }
  if (glyphs.some((glyph) => isSpace(glyph.text))) {
    const nearestLetter = (from: number, step: number) => {
      for (let i = from; i >= 0 && i < chars.length; i += step) if (!isSpace(chars[i].char)) return chars[i].char;
      return '';
    };
    chars.forEach(({ char }, i) => {
      if (isSpace(char) && !matched.has(i) && DEVANAGARI.test(nearestLetter(i - 1, -1)) && DEVANAGARI.test(nearestLetter(i + 1, 1))) drop.add(i);
    });
  }
  const out = items.map(() => '');
  // Which items a drawn space follows (the page's own word breaks), read from the final text:
  // a space counts for the item before it only when the next letter is in another item.
  const spaceAfter = items.map(() => false);
  let last = -1;
  let spaced = false;
  const letter = (item: number) => {
    if (spaced && last >= 0 && item !== last) spaceAfter[last] = true;
    spaced = false;
    last = item;
  };
  chars.forEach(({ char, item }, i) => {
    const text = insert.get(i);
    if (text !== undefined) {
      out[item] += text;
      letter(item);
    }
    if (drop.has(i)) return;
    out[item] += char;
    if (!isSpace(char)) letter(item);
    else if (matched.has(i)) spaced = true;
  });
  out.forEach((text, item) => {
    if (text.length > 0) into[item] = null;
  });
  const drawsSpaces = glyphs.some((glyph) => isSpace(glyph.text));
  return { items: out, replaced, into, drawsSpaces, spaceAfter };
}
