// Downloads the pinned PP-OCRv5 models the OCR benchmark compares against Tesseract into
// web-app/benchmark/.models (git-ignored), and checks each file's SHA-256.
//
//   node web-app/benchmark/download-ocr-models.mjs
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), ".models");

/** Official PaddlePaddle ONNX exports on Hugging Face (Apache-2.0), pinned to a commit. */
const MODELS = [
  {
    file: "det.onnx",
    repo: "PaddlePaddle/PP-OCRv5_mobile_det_onnx",
    commit: "e6f4fa85f00e168c862bc462aebca69eef9b3d3d",
    path: "inference.onnx",
    sha256: "a431985659dc921974177a95adcfbb90fd9e51989a5e04d70d0b75f597b6e61d",
  },
  {
    file: "rec.onnx",
    repo: "PaddlePaddle/devanagari_PP-OCRv5_mobile_rec_onnx",
    commit: "251aec19e36739540d35e2cc943f6aa7503b98e5",
    path: "inference.onnx",
    sha256: "cb789212ce96c69d3e74728ae4309d179281d68cb3945d0616b67cafab41c986",
  },
  {
    file: "rec.yml",
    repo: "PaddlePaddle/devanagari_PP-OCRv5_mobile_rec_onnx",
    commit: "251aec19e36739540d35e2cc943f6aa7503b98e5",
    path: "inference.yml",
    sha256: "9bd172dd26440c8ce94d1cde5d5baea6aefdc7cf3c5c8492e0beedef656d4e54",
  },
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

mkdirSync(dir, { recursive: true });
for (const model of MODELS) {
  const target = path.join(dir, model.file);
  if (existsSync(target) && sha256(readFileSync(target)) === model.sha256) {
    console.log(`${model.file}: present`);
    continue;
  }
  const url = `https://huggingface.co/${model.repo}/resolve/${model.commit}/${model.path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = sha256(bytes);
  if (actual !== model.sha256)
    throw new Error(
      `${model.file}: SHA-256 ${actual}, expected ${model.sha256}`,
    );
  writeFileSync(target, bytes);
  console.log(`${model.file}: ${bytes.byteLength} bytes`);
}
