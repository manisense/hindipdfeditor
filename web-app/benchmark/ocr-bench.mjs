// Compares OCR engines on scanned Hindi pages: Tesseract `hin` (the engine and model the editor
// ships today) against PaddleOCR PP-OCRv5 Devanagari (onnxruntime-web). Scores each page with
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
  const tess = await timed(
    async () => (await tesseractLoad.value.recognize(page.png)).data.text,
  );
  const paddle = await timed(async () =>
    (await paddleLoad.value(readPpm(page.ppm))).map((l) => l.text).join("\n"),
  );
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, `${page.name}.tesseract.txt`), tess.value);
    writeFileSync(path.join(outDir, `${page.name}.paddle.txt`), paddle.value);
  }
  rows.push({ name: page.name, truth, tess, paddle });
}
await tesseractLoad.value.terminate();

const pct = (s) =>
  `${(100 * s.recall).toFixed(1)} % (${s.correct}/${s.total}, ${s.extra} extra)`;
const totals = {
  tesseract: { correct: 0, total: 0 },
  paddle: { correct: 0, total: 0 },
};
console.log(`OCR benchmark, ${pages.length} page(s) at ${dpi} dpi`);
console.log(
  `Model load: Tesseract ${tesseractLoad.ms.toFixed(0)} ms, Paddle ${paddleLoad.ms.toFixed(0)} ms`,
);
for (const row of rows) {
  const t = score(row.tess.value, row.truth);
  const p = score(row.paddle.value, row.truth);
  totals.tesseract.correct += t.correct;
  totals.tesseract.total += t.total;
  totals.paddle.correct += p.correct;
  totals.paddle.total += p.total;
  console.log(`${row.name}`);
  console.log(`  Tesseract ${pct(t)}  ${row.tess.ms.toFixed(0)} ms`);
  console.log(`  Paddle    ${pct(p)}  ${row.paddle.ms.toFixed(0)} ms`);
}
const share = (s) => ((100 * s.correct) / s.total).toFixed(1);
console.log(
  `All pages: Tesseract ${share(totals.tesseract)} %, Paddle ${share(totals.paddle)} %`,
);
