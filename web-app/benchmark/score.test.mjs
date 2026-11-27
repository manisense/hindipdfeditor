// node --test web-app/benchmark/score.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  headerFooterLeakage,
  hindiWords,
  parseCliArgs,
  readingOrder,
  score,
} from "./score.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const NL = String.fromCharCode(10);

test("hindiWords and score keep existing multiset word-recall behaviour", () => {
  assert.deepEqual(
    hindiWords("धर्म और क्षेत्र में 2026 (test) ज्ञान दिया।"),
    ["धर्म", "और", "क्षेत्र", "में", "ज्ञान", "दिया"],
  );
  const res = score("धर्म और क्षेत्र में ज्ञान", "धर्म और क्षेत्र में ज्ञान दिया।");
  assert.equal(res.correct, 5);
  assert.equal(res.total, 6);
  assert.equal(res.extra, 0);
  assert.ok(Math.abs(res.recall - 5 / 6) < 1e-9);
});

test("readingOrder returns 1.0 when lines appear in order, including multi-cell table rows", () => {
  const truth = [
    "सूचना",
    "विद्यालय प्रबंधन समिति, आदर्श नगर",
    "स्वागत और दीप प्रज्वलन 10:00 मुख्य सभागार",
    "अधिक जानकारी के लिए प्रधानाचार्य से संपर्क करें।",
    "प्रधानाचार्य",
  ].join(NL);
  const output = [
    "सूचना",
    "विद्यालय प्रबंधन समिति, आदर्श नगर",
    "स्वागत और दीप प्रज्वलन",
    "10:00",
    "मुख्य सभागार",
    "अधिक जानकारी के लिए प्रधानाचार्य से संपर्क करें।",
    "प्रधानाचार्य",
  ].join(NL);
  const ro = readingOrder(output, truth);
  assert.equal(ro.kept, 4);
  assert.equal(ro.totalPairs, 4);
  assert.equal(ro.order, 1);
});

test("readingOrder tolerates small word differences within a line", () => {
  const truth = [
    "First paragraph with seven distinct words here",
    "Second paragraph about regional engineering operations today",
    "Third paragraph closing the quarterly operations review",
  ].join(NL);
  const output = [
    "First paragraph with seven different words here",
    "Second paragraph about regional engineering operations today",
    "Third paragraph closing the quarterly review",
  ].join(NL);
  const ro = readingOrder(output, truth);
  assert.equal(ro.kept, 2);
  assert.equal(ro.totalPairs, 2);
  assert.equal(ro.order, 1);
});

test("readingOrder penalises swapped sections and interleaved two-column paragraphs", () => {
  const truth = [
    "Section 1: Left Column Overview",
    "Archive teams prepare structured records carefully before regional distribution across northern offices",
    "Section 2: Left Column Hindi",
    "धर्म और क्षेत्र में गुरुजी ने ज्ञान दिया। विद्यालय में सूर्य की रोशनी आती है।",
    "Section 3: Right Column Details",
    "Review boards inspect typography margins alignment spacing and numbering during final verification",
  ].join(NL);
  // Simulates today's joinRows merging left and right columns line by line.
  const interleaved = [
    "Section 1: Left Column Overview Section 3: Right Column Details",
    "Archive teams prepare structured Review boards inspect typography",
    "records carefully before regional margins alignment spacing and",
    "distribution across northern offices numbering during final verification",
    "Section 2: Left Column Hindi",
    "धर्म और क्षेत्र में गुरुजी ने ज्ञान दिया। विद्यालय में सूर्य की रोशनी आती है।",
  ].join(NL);
  const ro = readingOrder(interleaved, truth);
  assert.ok(ro.order < 0.5, `expected interleaved reading order < 0.5, got ${ro.order}`);
});

test("headerFooterLeakage counts repeated headers and digit-normalised footers", () => {
  const output = [
    "Regional Engineering Bulletin — Issue 2026",
    "Body text on page one.",
    "Internal Copy — Page 1 of 3",
    "Regional Engineering Bulletin — Issue 2026",
    "Body text on page two.",
    "Internal Copy — Page 2 of 3",
    "Regional Engineering Bulletin — Issue 2026",
    "Body text on page three.",
    "Internal Copy — Page 3 of 3",
  ].join(NL);
  const leakage = headerFooterLeakage(output, [
    "Regional Engineering Bulletin — Issue 2026",
    "Internal Copy — Page 1 of 3",
  ]);
  assert.equal(leakage.total, 6);
  assert.equal(leakage.maxCount, 3);
  assert.deepEqual(
    leakage.items.map((item) => item.count),
    [3, 3],
  );

  const clean = headerFooterLeakage(
    ["Body text on page one.", "Body text on page two."].join(NL),
    [
      "Regional Engineering Bulletin — Issue 2026",
      "Internal Copy — Page 1 of 3",
    ],
  );
  assert.equal(clean.total, 0);
  assert.equal(clean.maxCount, 0);
});

test("headerFooterLeakage normalises Devanagari digits as well as ASCII digits", () => {
  const output = ["पृष्ठ १ / ३", "सामग्री", "पृष्ठ २ / ३", "सामग्री", "पृष्ठ ३ / ३"].join(NL);
  const leakage = headerFooterLeakage(output, ["पृष्ठ 1 / 3"]);
  assert.equal(leakage.items[0].count, 3);
});

test("CLI outputs word recall, readingOrder, and optional leakage with --repeated", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "score-test-"));
  try {
    const truthFile = path.join(dir, "truth.txt");
    const outFile = path.join(dir, "out.txt");
    writeFileSync(truthFile, ["धर्म और क्षेत्र", "विद्यालय में सूर्य", ""].join(NL));
    writeFileSync(
      outFile,
      ["Running Header", "धर्म और क्षेत्र", "Running Header", "विद्यालय में सूर्य", ""].join(NL),
    );

    const parsed = parseCliArgs([outFile, truthFile, "--repeated", "Running Header"]);
    assert.deepEqual(parsed.repeated, ["Running Header"]);

    const plainJson = JSON.parse(
      execFileSync("node", [path.join(here, "score.mjs"), outFile, truthFile], { encoding: "utf8" }),
    );
    assert.equal(plainJson.recall, 100);
    assert.equal(plainJson.readingOrder, 100);
    assert.equal("leakage" in plainJson, false);

    const leakJson = JSON.parse(
      execFileSync(
        "node",
        [path.join(here, "score.mjs"), outFile, truthFile, "--repeated", "Running Header"],
        { encoding: "utf8" },
      ),
    );
    assert.equal(leakJson.recall, 100);
    assert.equal(leakJson.readingOrder, 100);
    assert.equal(leakJson.leakage.maxCount, 2);
    assert.equal(leakJson.leakage.items[0].count, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
