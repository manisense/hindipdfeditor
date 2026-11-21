/**
 * Removes the original glyphs that fall inside given rectangles from a PDF page content stream,
 * leaving paths (table borders, underlines), images and all other text untouched.
 *
 * This replaces painting a flat rectangle over replaced text. It works at glyph level: a text
 * run that only partly overlaps a rectangle keeps its other glyphs at their exact positions,
 * because each removed glyph becomes a `TJ` spacing number equal to its advance.
 *
 * Operates on the decoded content as a latin1 string (one char per byte), so binary data such as
 * inline images passes through unchanged.
 */

/** 2-D affine matrix `[a, b, c, d, e, f]` as used by PDF. */
export type Matrix = [number, number, number, number, number, number];

/** Axis-aligned rectangle in PDF user space (pt, bottom-left origin). */
export type UserRect = { x0: number; y0: number; x1: number; y1: number };

/** What the remover needs to know about a font to walk its glyphs. */
export type FontMetrics = {
  /** Bytes per character code: 1 for simple fonts, 2 for Identity-H/V composite fonts. */
  codeBytes: 1 | 2;
  /** Advance width of a code in glyph space (1/1000 text space unit), or undefined if unknown. */
  width: (code: number) => number | undefined;
};

export type RemovalResult = {
  content: string;
  /** Glyphs removed per rectangle, same order as the input rectangles. */
  removedPerRect: number[];
  /** Rectangles that a text run touched but could not be resolved (unknown font or widths). */
  unresolvedRects: Set<number>;
};

type Token =
  | { kind: "num"; value: number; start: number; end: number }
  | { kind: "op"; value: string; start: number; end: number }
  | { kind: "str"; bytes: number[]; start: number; end: number }
  | { kind: "other"; start: number; end: number };

const WHITESPACE = " \t\r\n\f\0";
const DELIMITERS = "()<>[]{}/%";

function isRegular(ch: string | undefined): boolean {
  return ch !== undefined && !WHITESPACE.includes(ch) && !DELIMITERS.includes(ch);
}

function decodeLiteral(src: string, start: number): { bytes: number[]; end: number } {
  const bytes: number[] = [];
  let depth = 1;
  let i = start + 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "\\") {
      const next = src[i + 1];
      const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, "(": 40, ")": 41, "\\": 92 };
      if (next in escapes) {
        bytes.push(escapes[next]);
        i += 2;
      } else if (next >= "0" && next <= "7") {
        let octal = "";
        let j = i + 1;
        while (j < src.length && octal.length < 3 && src[j] >= "0" && src[j] <= "7") octal += src[j++];
        bytes.push(parseInt(octal, 8) & 0xff);
        i = j;
      } else if (next === "\r" || next === "\n") {
        i += next === "\r" && src[i + 2] === "\n" ? 3 : 2;
      } else {
        i += 1;
      }
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth > 0) bytes.push(ch.charCodeAt(0) & 0xff);
    i++;
  }
  return { bytes, end: i };
}

function decodeHex(src: string, start: number): { bytes: number[]; end: number } {
  const close = src.indexOf(">", start);
  const end = close < 0 ? src.length : close + 1;
  let hex = src.slice(start + 1, close < 0 ? src.length : close).replace(/[^0-9a-fA-F]/g, "");
  if (hex.length % 2 === 1) hex += "0";
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  return { bytes, end };
}

/** Splits a content stream into tokens with source offsets. Exported for tests. */
export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (WHITESPACE.includes(ch)) {
      i++;
      continue;
    }
    const start = i;
    if (ch === "%") {
      while (i < src.length && src[i] !== "\n" && src[i] !== "\r") i++;
      continue;
    }
    if (ch === "(") {
      const { bytes, end } = decodeLiteral(src, i);
      tokens.push({ kind: "str", bytes, start, end });
      i = end;
      continue;
    }
    if (ch === "<" && src[i + 1] === "<") {
      tokens.push({ kind: "other", start, end: i + 2 });
      i += 2;
      continue;
    }
    if (ch === ">" && src[i + 1] === ">") {
      tokens.push({ kind: "other", start, end: i + 2 });
      i += 2;
      continue;
    }
    if (ch === "<") {
      const { bytes, end } = decodeHex(src, i);
      tokens.push({ kind: "str", bytes, start, end });
      i = end;
      continue;
    }
    if ("[]{}".includes(ch)) {
      tokens.push({ kind: "other", start, end: i + 1 });
      i++;
      continue;
    }
    if (ch === "/") {
      i++;
      while (isRegular(src[i])) i++;
      tokens.push({ kind: "other", start, end: i });
      continue;
    }
    while (isRegular(src[i])) i++;
    if (i === start) {
      i++; // stray delimiter such as ")"
      continue;
    }
    const word = src.slice(start, i);
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
      tokens.push({ kind: "num", value: Number(word), start, end: i });
      continue;
    }
    tokens.push({ kind: "op", value: word, start, end: i });
    if (word === "ID") {
      // Inline image data: binary until whitespace + "EI" + whitespace.
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "E" && src[j + 1] === "I" && WHITESPACE.includes(src[j - 1]) && (j + 2 >= src.length || WHITESPACE.includes(src[j + 2]))) break;
        j++;
      }
      tokens.push({ kind: "op", value: "EI", start: j, end: j + 2 });
      i = j + 2;
    }
  }
  return tokens;
}

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

type TextState = {
  font: string | null;
  size: number;
  charSpacing: number;
  wordSpacing: number;
  hScale: number;
  leading: number;
  rise: number;
};

type GraphicsState = { ctm: Matrix; text: TextState };

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function hexString(bytes: number[]): string {
  return `<${bytes.map((b) => b.toString(16).padStart(2, "0")).join("")}>`;
}

/**
 * Removes glyphs whose visual centre lies inside any rectangle.
 *
 * @param content Decoded page content stream, latin1.
 * @param fontFor Metrics for a font resource name (without the leading slash), or undefined.
 * @param rects Rectangles in PDF user space (pt).
 */
export function removeGlyphsInRects(
  content: string,
  fontFor: (name: string) => FontMetrics | undefined,
  rects: readonly UserRect[],
): RemovalResult {
  const tokens = tokenize(content);
  const removedPerRect = rects.map(() => 0);
  const unresolvedRects = new Set<number>();
  const replacements: { start: number; end: number; text: string }[] = [];

  let state: GraphicsState = {
    ctm: IDENTITY,
    text: { font: null, size: 0, charSpacing: 0, wordSpacing: 0, hScale: 1, leading: 0, rise: 0 },
  };
  const stack: GraphicsState[] = [];
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;
  let operands: Token[] = [];
  let operandStart: number | null = null;

  const nextLine = (dx: number, dy: number) => {
    tlm = multiply([1, 0, 0, 1, dx, dy], tlm);
    tm = tlm;
  };

  const rectAt = (x: number, y: number) =>
    rects.findIndex((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);

  /** Walks one show operation; returns new TJ elements if any glyph was removed. */
  const show = (elements: (number[] | number)[]): string | null => {
    const ts = state.text;
    const metrics = ts.font ? fontFor(ts.font) : undefined;
    const rendering = multiply(tm, state.ctm);
    const out: string[] = [];
    let removedAny = false;
    let kept: number[] = [];
    let pendingShift = 0;
    let tx = 0;
    const flushKept = () => {
      if (kept.length > 0) out.push(hexString(kept));
      kept = [];
    };
    const flushShift = () => {
      if (pendingShift !== 0) out.push(formatNumber(pendingShift));
      pendingShift = 0;
    };

    for (const element of elements) {
      if (typeof element === "number") {
        flushKept();
        pendingShift += element;
        tx -= (element / 1000) * ts.size * ts.hScale;
        continue;
      }
      const bytes = element;
      const step = metrics?.codeBytes ?? 1;
      for (let i = 0; i + step <= bytes.length; i += step) {
        const code = step === 2 ? (bytes[i] << 8) | bytes[i + 1] : bytes[i];
        const widthGlyph = metrics?.width(code);
        const glyphWidth = widthGlyph === undefined ? undefined : (widthGlyph / 1000) * ts.size;
        const spacing = ts.charSpacing + (step === 1 && code === 32 ? ts.wordSpacing : 0);
        const advance = glyphWidth === undefined ? undefined : (glyphWidth + spacing) * ts.hScale;
        const centreX = tx + (advance ?? 0) / 2;
        const [ux, uy] = apply(rendering, centreX, ts.rise + ts.size * 0.35);
        const hit = rectAt(ux, uy);
        if (hit >= 0 && advance === undefined) {
          unresolvedRects.add(hit);
        }
        if (hit >= 0 && advance !== undefined) {
          flushKept();
          pendingShift -= (advance / (ts.size * ts.hScale || 1)) * 1000;
          removedPerRect[hit] += 1;
          removedAny = true;
        } else {
          flushShift();
          kept.push(...bytes.slice(i, i + step));
        }
        tx += advance ?? 0;
      }
    }
    flushKept();
    flushShift();
    tm = multiply([1, 0, 0, 1, tx, 0], tm);
    return removedAny ? `[${out.join(" ")}] TJ` : null;
  };

  for (const token of tokens) {
    if (token.kind !== "op") {
      if (operandStart === null) operandStart = token.start;
      operands.push(token);
      continue;
    }
    const nums = operands.filter((o): o is Extract<Token, { kind: "num" }> => o.kind === "num").map((o) => o.value);
    const start = operandStart ?? token.start;
    const ts = state.text;
    switch (token.value) {
      case "q":
        stack.push({ ctm: state.ctm, text: { ...state.text } });
        break;
      case "Q":
        state = stack.pop() ?? state;
        break;
      case "cm":
        if (nums.length === 6) state = { ...state, ctm: multiply(nums as Matrix, state.ctm) };
        break;
      case "BT":
        tm = IDENTITY;
        tlm = IDENTITY;
        break;
      case "Tf": {
        const nameToken = operands.find((o) => o.kind === "other");
        ts.font = nameToken ? content.slice(nameToken.start + 1, nameToken.end) : null;
        ts.size = nums[0] ?? ts.size;
        break;
      }
      case "Tc":
        ts.charSpacing = nums[0] ?? 0;
        break;
      case "Tw":
        ts.wordSpacing = nums[0] ?? 0;
        break;
      case "Tz":
        ts.hScale = (nums[0] ?? 100) / 100;
        break;
      case "TL":
        ts.leading = nums[0] ?? 0;
        break;
      case "Ts":
        ts.rise = nums[0] ?? 0;
        break;
      case "Td":
        nextLine(nums[0] ?? 0, nums[1] ?? 0);
        break;
      case "TD":
        ts.leading = -(nums[1] ?? 0);
        nextLine(nums[0] ?? 0, nums[1] ?? 0);
        break;
      case "Tm":
        if (nums.length === 6) {
          tm = nums as Matrix;
          tlm = tm;
        }
        break;
      case "T*":
        nextLine(0, -ts.leading);
        break;
      case "Tj":
      case "'":
      case '"':
      case "TJ": {
        let prefix = "";
        if (token.value === '"') {
          ts.wordSpacing = nums[0] ?? ts.wordSpacing;
          ts.charSpacing = nums[1] ?? ts.charSpacing;
          prefix = `${formatNumber(ts.wordSpacing)} Tw ${formatNumber(ts.charSpacing)} Tc T* `;
        } else if (token.value === "'") {
          prefix = "T* ";
        }
        if (token.value === "'" || token.value === '"') nextLine(0, -ts.leading);
        const elements: (number[] | number)[] = operands
          .filter((o) => o.kind === "str" || o.kind === "num")
          .filter((o) => token.value === "TJ" || o.kind === "str")
          .map((o) => (o.kind === "str" ? o.bytes : (o as { value: number }).value));
        const rewritten = show(elements);
        if (rewritten) replacements.push({ start, end: token.end, text: prefix + rewritten });
        break;
      }
    }
    operands = [];
    operandStart = null;
  }

  let output = "";
  let last = 0;
  for (const { start, end, text } of replacements) {
    output += content.slice(last, start) + text;
    last = end;
  }
  output += content.slice(last);
  return { content: output, removedPerRect, unresolvedRects };
}
