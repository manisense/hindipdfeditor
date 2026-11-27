// Compares OCR engines on scanned Hindi pages: Tesseract `hin` (the engine and model the editor
// ships today) against PaddleOCR PP-OCRv5 Devanagari (onnxruntime-web), with and without
// lexicon-weighted decoding, and a per-line vote between the two engines (rover.mjs). Scores each page with
// score.mjs (share of ground-truth Hindi words exactly right) and reports model load time and
// per-page time.
//
//   node web-app/benchmark/download-ocr-models.mjs   # once: pinned PP-OCRv5 models
//   node web-app/benchmark/ocr-bench.mjs [ocr-set.json] [--dpi 200] [--out dir]
//
// ocr-set.json lists pages: [{ "name", "file" (PDF or PNG), "page" (1-based, PDFs), "truth" }],
// paths relative to the JSON file.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPaddleOcr, readPpm } from "./paddleOcr.mjs";
import { voteLines } from "./rover.mjs";
import { score } from "./score.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../editor/package.json"));
const ort = require("onnxruntime-web");
ort.env.logLevel = "error";
const { createWorker } = require("tesseract.js");

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 ? args.splice(at, 2)[1] : fallback;
};
const dpi = Number(option("--dpi", "200"));
const outDir = option("--out", undefined);
const setFile = path.resolve(args[0] ?? path.join(here, "ocr-set.json"));
const set = JSON.parse(readFileSync(setFile, "utf8"));
const setDir = path.dirname(setFile);
const work = mkdtempSync(path.join(tmpdir(), "ocr-bench-"));

/** Renders a set entry to PNG and PPM (same pixels) at `dpi`; returns both paths. */
function rasterize(entry, index) {
  const file = path.resolve(setDir, entry.file);
  if (!file.endsWith(".pdf"))
    throw new Error(
      `${file}: only PDF pages are supported (wrap images with img2pdf)`,
    );
  const base = path.join(work, `page-${index}`);
  const page = String(entry.page ?? 1);
  const argv = ["-r", String(dpi), "-f", page, "-l", page, "-singlefile"];
  execFileSync("pdftoppm", [...argv, "-png", file, base]);
  execFileSync("pdftoppm", [...argv, file, base]);
  return { png: `${base}.png`, ppm: `${base}.ppm` };
}

async function timed(fn) {
  const start = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - start };
}

const pages = set.map((entry, index) => ({
  ...entry,
  ...rasterize(entry, index),
}));

const tesseractLoad = await timed(() =>
  createWorker("hin", 1, {
    langPath: path.join(
      path.dirname(require.resolve("@tesseract.js-data/hin/package.json")),
      "4.0.0_best_int",
    ),
    cachePath: work,
    gzip: true,
  }),
);
// The editor's Hindi word list (spell check), for Paddle's lexicon-weighted decoding.
const lexicon = new Set(
  readFileSync(
    path.join(here, "../editor/public/dict/hi-words.txt"),
    "utf8",
  ).split("\n"),
);
const paddleLexiconLoad = await timed(() =>
  createPaddleOcr(ort, {
    detModel: path.join(here, ".models/det.onnx"),
    recModel: path.join(here, ".models/rec.onnx"),
    recYml: path.join(here, ".models/rec.yml"),
    isKnown: (word) => lexicon.has(word),
  }),
);
const paddleLoad = await timed(() =>
  createPaddleOcr(ort, {
    detModel: path.join(here, ".models/det.onnx"),
    recModel: path.join(here, ".models/rec.onnx"),
    recYml: path.join(here, ".models/rec.yml"),
  }),
);

const rows = [];
for (const page of pages) {
  const truth = readFileSync(path.resolve(setDir, page.truth), "utf8");
  const tessResult = await timed(async () =>
    (await tesseractLoad.value.recognize(page.png, {}, { blocks: true })).data,
  );
  const tess = { value: tessResult.value.text, ms: tessResult.ms };
  const tessWords = (tessResult.value.blocks ?? []).flatMap((b) =>
    b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
  );
  const ppm = readPpm(page.ppm);
  const paddle = await timed(async () =>
    (await paddleLoad.value(ppm)).map((l) => l.text).join("\n"),
  );
  const lexicalLines = await timed(() => paddleLexiconLoad.value(ppm));
  const lexical = {
    value: lexicalLines.value.map((l) => l.text).join("\n"),
    ms: lexicalLines.ms,
  };
  const voted = voteLines(lexicalLines.value, tessWords, (w) => lexicon.has(w));
  const vote = {
    value: voted.map((l) => l.text).join("\n"),
    ms: tess.ms + lexical.ms,
  };
  const outputs = {
    Tesseract: tess,
    Paddle: paddle,
    "Paddle + lexicon": lexical,
    "Vote (per line)": vote,
  };
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    for (const [engine, out] of Object.entries(outputs)) {
      writeFileSync(
        path.join(
          outDir,
          `${page.name}.${engine.replace(/\W+/g, "-").toLowerCase()}.txt`,
        ),
        out.value,
      );
    }
  }
  rows.push({ name: page.name, truth, outputs });
}
await tesseractLoad.value.terminate();

const pct = (s) =>
  `${(100 * s.recall).toFixed(1)} % (${s.correct}/${s.total}, ${s.extra} extra)`;
const totals = {};
console.log(`OCR benchmark, ${pages.length} page(s) at ${dpi} dpi`);
console.log(
  `Model load: Tesseract ${tesseractLoad.ms.toFixed(0)} ms, Paddle ${paddleLoad.ms.toFixed(0)} ms, with lexicon ${paddleLexiconLoad.ms.toFixed(0)} ms`,
);
for (const row of rows) {
  console.log(row.name);
  for (const [engine, out] of Object.entries(row.outputs)) {
    const result = score(out.value, row.truth);
    totals[engine] ??= { correct: 0, total: 0 };
    totals[engine].correct += result.correct;
    totals[engine].total += result.total;
    console.log(
      `  ${engine.padEnd(17)} ${pct(result)}  ${out.ms.toFixed(0)} ms`,
    );
  }
}
console.log(
  `All pages: ${Object.entries(totals)
    .map(
      ([engine, t]) =>
        `${engine} ${((100 * t.correct) / t.total).toFixed(1)} %`,
    )
    .join(", ")}`,
);
