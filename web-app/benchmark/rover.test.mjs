// node --test web-app/benchmark/rover.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { knownShare, voteLines } from "./rover.mjs";

const known = new Set(["भारत", "सरकार", "रेलवे", "भर्ती"]);
const isKnown = (w) => known.has(w);
const box = (x, y, w, h) => ({ x, y, w, h });
const word = (text, x0, y0, x1, y1) => ({ text, bbox: { x0, y0, x1, y1 } });

test("knownShare counts Hindi words found in the lexicon, ignoring Latin and digits", () => {
  assert.deepEqual(knownShare("भारत सरकर 2024 RRB", isKnown), { known: 1, hindi: 2 });
});

test("each Paddle line keeps the reading with more known words, Tesseract's words taken from the same box", () => {
  const paddle = [
    { text: "भारत सरकर", box: box(0, 0, 200, 30) },
    { text: "रेलवे भर्ती", box: box(0, 40, 200, 30) },
  ];
  const tess = [
    word("भारत", 0, 0, 90, 30),
    word("सरकार", 100, 0, 190, 30),
    word("रेलव", 0, 40, 90, 70),
    word("भत", 100, 40, 190, 70),
  ];
  assert.deepEqual(
    voteLines(paddle, tess, isKnown).map((l) => [l.text, l.from]),
    [
      ["भारत सरकार", "tesseract"],
      ["रेलवे भर्ती", "paddle"],
    ],
  );
});

test("a tie keeps Paddle; Tesseract words outside every Paddle box are kept as their own lines", () => {
  const paddle = [{ text: "अबक", box: box(0, 0, 100, 30) }];
  const tess = [word("कखग", 0, 0, 100, 30), word("सरकार", 0, 100, 100, 130), word("भारत", 110, 100, 200, 130)];
  assert.deepEqual(
    voteLines(paddle, tess, isKnown).map((l) => [l.text, l.from]),
    [
      ["अबक", "paddle"],
      ["सरकार भारत", "tesseract"],
    ],
  );
});
