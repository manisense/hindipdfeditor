// Scores a tool's text output against ground-truth.txt: the share of the sample's Hindi words that
// come out exactly right (counted as a multiset), the share of consecutive ground-truth line pairs
// whose reading order is kept, and (with --repeated "<line>") how many times running headers or
// footers leak into the output. Input: a .docx, .txt or .pdf (text read with Poppler's pdftotext).
//
//   node web-app/benchmark/score.mjs <output-file> [ground-truth.txt] [--repeated "<line>"]...
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../editor/package.json"));
const JSZip = require("jszip");

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/gu;
const TOKEN_SPLIT = /[\s।॥,.;:!?()[\]{}"'“”‘’/—–\-]+/u;
const DIGITS = /[0-9\u0966-\u096F]+/gu;

/** Hindi words: tokens with a Devanagari letter, split at spaces and punctuation, NFC. */
export function hindiWords(text) {
  return text
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .split(TOKEN_SPLIT)
    .filter((word) => /[अ-हक़-ॡ]/u.test(word));
}

/** All word tokens (Latin, Devanagari and numbers), lowercase NFC, split on whitespace/punctuation. */
function allWords(text) {
  return text
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .filter((word) => word.length > 0);
}

/** Word tokens with digit sequences normalised to '#', for matching running headers/footers. */
function normalizedTokens(text) {
  return text
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .toLowerCase()
    .replace(DIGITS, " # ")
    .split(TOKEN_SPLIT)
    .filter((word) => word.length > 0);
}

export async function readOutput(file) {
  if (file.endsWith(".docx")) {
    const zip = await JSZip.loadAsync(readFileSync(file));
    const xml = await zip.file("word/document.xml").async("string");
    return xml
      .replace(/<w:tab\/>/g, " ")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
  if (file.endsWith(".pdf")) return execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
  return readFileSync(file, "utf8");
}

/** Returns { correct, total, recall, extra } for an output text. */
export function score(outputText, truthText) {
  const remaining = new Map();
  const truth = hindiWords(truthText);
  for (const word of truth) remaining.set(word, (remaining.get(word) ?? 0) + 1);
  let correct = 0;
  let extra = 0;
  for (const word of hindiWords(outputText)) {
    const left = remaining.get(word) ?? 0;
    if (left > 0) {
      remaining.set(word, left - 1);
      correct += 1;
    } else {
      extra += 1;
    }
  }
  return { correct, total: truth.length, recall: truth.length > 0 ? correct / truth.length : 1, extra };
}

function findBestSpan(lineWords, outWords, positionsByWord, claimed, anchorPos) {
  const m = lineWords.length;
  const need = new Map();
  for (const word of lineWords) need.set(word, (need.get(word) ?? 0) + 1);

  const starts = new Set();
  for (const word of need.keys()) {
    const positions = positionsByWord.get(word);
    if (!positions) continue;
    for (const pos of positions) {
      if (!claimed[pos]) starts.add(pos);
    }
  }
  if (starts.size === 0) return null;

  const maxWindow = m <= 2 ? m + 1 : Math.ceil(m * 1.3);
  const minF1 = m === 1 ? 1 : m === 2 ? 0.8 : m === 3 ? 2 / 3 - 1e-9 : 0.7;
  let best = null;

  for (const start of [...starts].sort((a, b) => a - b)) {
    const remaining = new Map(need);
    let matched = 0;
    let lastMatched = start;
    const limit = Math.min(outWords.length, start + maxWindow);
    let localBest = null;

    for (let j = start; j < limit; j += 1) {
      if (claimed[j]) break;
      const left = remaining.get(outWords[j]) ?? 0;
      if (left > 0) {
        remaining.set(outWords[j], left - 1);
        matched += 1;
        lastMatched = j;
        const spanLen = lastMatched - start + 1;
        const f1 = (2 * matched) / (m + spanLen);
        if (!localBest || f1 > localBest.f1 + 1e-9) {
          localBest = { start, end: lastMatched + 1, matched, f1 };
        }
        if (matched === m) break;
      }
    }

    if (!localBest || localBest.f1 < minF1) continue;
    if (m <= 2 && localBest.matched < m) continue;
    if (m === 3 && localBest.matched < 2) continue;

    if (!best || localBest.f1 > best.f1 + 1e-9) {
      best = localBest;
    } else if (Math.abs(localBest.f1 - best.f1) <= 1e-9 && anchorPos !== null) {
      const bestAfter = best.start >= anchorPos;
      const candAfter = localBest.start >= anchorPos;
      if (!bestAfter && candAfter) {
        best = localBest;
      } else if (bestAfter && candAfter && localBest.start < best.start) {
        best = localBest;
      }
    }
  }
  return best;
}

/**
 * Measures reading order against a ground-truth text whose lines are in reading order:
 * returns the share of consecutive ground-truth line pairs whose order is kept in the output.
 * Lines are matched by word content over tight spans, tolerant to small word differences.
 */
export function readingOrder(outputText, truthText) {
  const truthLines = truthText
    .split(/\r?\n/u)
    .map((line) => allWords(line))
    .filter((words) => words.length > 0);
  const totalLines = truthLines.length;
  const totalPairs = Math.max(0, totalLines - 1);
  if (totalLines === 0) return { kept: 0, totalPairs: 0, order: 1, matched: 0, totalLines: 0 };

  const outWords = allWords(outputText);
  const positionsByWord = new Map();
  outWords.forEach((word, index) => {
    let list = positionsByWord.get(word);
    if (!list) {
      list = [];
      positionsByWord.set(word, list);
    }
    list.push(index);
  });

  const claimed = new Uint8Array(outWords.length);
  const matches = new Array(totalLines).fill(null);

  const matchPass = (predicate) => {
    for (let i = 0; i < totalLines; i += 1) {
      if (!predicate(truthLines[i].length)) continue;
      let anchorPos = null;
      for (let prev = i - 1; prev >= 0; prev -= 1) {
        if (matches[prev]) {
          anchorPos = matches[prev].end;
          break;
        }
      }
      const span = findBestSpan(truthLines[i], outWords, positionsByWord, claimed, anchorPos);
      if (span) {
        matches[i] = span;
        for (let k = span.start; k < span.end; k += 1) claimed[k] = 1;
      }
    }
  };

  // Match longer lines first so 1-2 word lines (headings, signatures) do not steal tokens inside paragraphs.
  matchPass((len) => len >= 3);
  matchPass((len) => len < 3);

  let matched = 0;
  for (const m of matches) if (m) matched += 1;
  let kept = 0;
  for (let i = 0; i + 1 < totalLines; i += 1) {
    if (matches[i] && matches[i + 1] && matches[i].start < matches[i + 1].start) kept += 1;
  }
  return { kept, totalPairs, order: totalPairs > 0 ? kept / totalPairs : 1, matched, totalLines };
}

/**
 * Counts how many times each repeated line (e.g. a running header or footer, digits normalised)
 * appears in the output text. Target: each repeated line appears at most once (or is dropped).
 */
export function headerFooterLeakage(outputText, repeatedLines) {
  const outTokens = normalizedTokens(outputText);
  const items = repeatedLines.map((line) => {
    const needle = normalizedTokens(line);
    if (needle.length === 0) return { line, count: 0 };
    let count = 0;
    for (let i = 0; i + needle.length <= outTokens.length; ) {
      let ok = true;
      for (let j = 0; j < needle.length; j += 1) {
        if (outTokens[i + j] !== needle[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        count += 1;
        i += needle.length;
      } else {
        i += 1;
      }
    }
    return { line, count };
  });
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const maxCount = items.reduce((max, item) => Math.max(max, item.count), 0);
  return { total, maxCount, items };
}

export function parseCliArgs(argv) {
  const positional = [];
  const repeated = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repeated") {
      if (i + 1 >= argv.length) throw new Error("--repeated requires a value");
      repeated.push(argv[++i]);
    } else if (arg.startsWith("--repeated=")) {
      repeated.push(arg.slice("--repeated=".length));
    } else {
      positional.push(arg);
    }
  }
  return {
    file: positional[0],
    truthFile: positional[1] ?? path.join(here, "ground-truth.txt"),
    repeated,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { file, truthFile, repeated } = parseCliArgs(process.argv.slice(2));
  const outputText = await readOutput(file);
  const truthText = readFileSync(truthFile, "utf8");
  const result = score(outputText, truthText);
  const order = readingOrder(outputText, truthText);
  const report = {
    file: path.basename(file),
    ...result,
    recall: Number((result.recall * 100).toFixed(1)),
    readingOrder: Number((order.order * 100).toFixed(1)),
    orderKept: order.kept,
    orderPairs: order.totalPairs,
  };
  if (repeated.length > 0) {
    report.leakage = headerFooterLeakage(outputText, repeated);
  }
  console.log(JSON.stringify(report));
}
