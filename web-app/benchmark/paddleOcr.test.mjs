// node --test web-app/benchmark/paddleOcr.test.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ctcDecode,
  dbBoxes,
  detInputSize,
  readCharacterDict,
} from "./paddleOcr.mjs";

test("ctcDecode merges repeats, drops blanks, keeps a letter repeated across a blank", () => {
  const characters = ["क", "ा"];
  // steps: क क blank क ा ा  → "कका"
  const best = [1, 1, 0, 1, 2, 2];
  const scores = best.flatMap((cls) =>
    [0, 1, 2].map((c) => (c === cls ? 1 : 0)),
  );
  assert.equal(ctcDecode(scores, best.length, 3, characters), "कका");
});

test("detInputSize keeps a page's size, rounded to multiples of 32, and caps the long side", () => {
  assert.deepEqual(detInputSize(1654, 2339), { w: 1664, h: 2336 });
  assert.deepEqual(detInputSize(8000, 4000), { w: 4000, h: 2016 });
  assert.deepEqual(detInputSize(20, 40), { w: 64, h: 128 });
});

test("dbBoxes keeps confident regions, drops weak ones, grows boxes by the unclip distance", () => {
  const w = 20;
  const h = 10;
  const prob = new Float32Array(w * h);
  for (let y = 2; y < 6; y++)
    for (let x = 2; x < 12; x++) prob[y * w + x] = 0.9; // 10 × 4 strong
  for (let y = 7; y < 10; y++)
    for (let x = 14; x < 19; x++) prob[y * w + x] = 0.4; // weak
  const boxes = dbBoxes(prob, w, h, { unclipRatio: 0.7 });
  assert.equal(boxes.length, 1);
  const grow = (10 * 4 * 0.7) / (2 * (10 + 4)); // 1 px
  assert.deepEqual(
    { x: boxes[0].x, y: boxes[0].y, w: boxes[0].w, h: boxes[0].h },
    { x: 2 - grow, y: 2 - grow, w: 10 + 2 * grow, h: 4 + 2 * grow },
  );
});

test("readCharacterDict reads the recognizer's YAML list and appends the space class", () => {
  const yml = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    ".models/rec.yml",
  );
  const characters = readCharacterDict(yml);
  assert.equal(characters.length, 569);
  assert.equal(characters[0], "!");
  assert.equal(characters[6], "'");
  assert.ok(characters.includes("क"));
  assert.equal(characters.at(-1), " ");
});
