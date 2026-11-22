// Copies the OCR engine, worker and language data from pinned npm packages into public/ocr so
// the editor serves them itself instead of loading them from a third-party CDN, which some office
// networks block. Run before `vite` and `vite build`.
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const editor = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = path.join(editor, "node_modules");
const out = path.join(editor, "public", "ocr");

const files = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  // SIMD engine where supported, plain engine otherwise; LSTM-only matches the default OEM.
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "core/tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "core/tesseract-core-lstm.wasm.js"],
  ["@tesseract.js-data/hin/4.0.0_best_int/hin.traineddata.gz", "lang/hin.traineddata.gz"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "lang/eng.traineddata.gz"],
];

for (const [from, to] of files) {
  const target = path.join(out, to);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(path.join(modules, from), target);
}
console.log(`copy-ocr-assets: ${files.length} files → public/ocr`);
