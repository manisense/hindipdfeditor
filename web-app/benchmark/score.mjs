// Scores a tool's text output against ground-truth.txt: the share of the sample's Hindi words that
// come out exactly right, counted as a multiset (order is ignored, so table reading order does not
// matter). Input: a .docx, .txt or .pdf (text read with Poppler's pdftotext).
//
//   node web-app/benchmark/score.mjs <output-file> [ground-truth.txt]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../editor/package.json"));
const JSZip = require("jszip");

/** Hindi words: tokens with a Devanagari letter, split at spaces and punctuation, NFC. */
export function hindiWords(text) {
  return text
    .normalize("NFC")
    .replace(/[​-‍﻿]/gu, "")
    .split(/[\s।॥,.;:!?()[\]{}"'“”‘’/—–\-]+/u)
    .filter((word) => /[अ-हक़-ॡ]/u.test(word));
}

async function readOutput(file) {
  if (file.endsWith(".docx")) {
    const zip = await JSZip.loadAsync(readFileSync(file));
    const xml = await zip.file("word/document.xml").async("string");
    return xml
      .replace(/<w:tab\/>/g, " ")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
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
  return { correct, total: truth.length, recall: correct / truth.length, extra };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, truthFile = path.join(here, "ground-truth.txt")] = process.argv.slice(2);
  const result = score(await readOutput(file), readFileSync(truthFile, "utf8"));
  console.log(JSON.stringify({ file: path.basename(file), ...result, recall: Number((result.recall * 100).toFixed(1)) }));
}
