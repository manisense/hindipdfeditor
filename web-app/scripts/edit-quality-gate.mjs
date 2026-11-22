// Edit quality gate: replacing text with itself must leave the page as it was, a one-word edit
// must change only that word, a whiteout must delete the text it covers and a highlight must keep
// the text it marks readable. Runs the real editor in Chrome against a preview or production.
//   SMOKE_BASE_URL=http://127.0.0.1:8788 node web-app/scripts/edit-quality-gate.mjs
// Requires Playwright (resolvable through NODE_PATH) and system Chrome.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const editorModules = path.join(here, "../editor/node_modules");
const pdfjs = await import(path.join(editorModules, "pdfjs-dist/legacy/build/pdf.mjs"));
const { createCanvas } = require(path.join(editorModules, "@napi-rs/canvas"));

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:8788";
const fixtures = path.join(here, "../../mobile-app/fixtures");
const MAX_CHANGED_PIXELS = 0.001;

async function openPdf(page, file, pageIndex) {
  await page.goto(baseUrl + "/tools/edit-hindi-pdf/", { waitUntil: "networkidle" });
  await page.locator("input[type=file]").setInputFiles(file);
  await page.getByText("Edit text — click a highlighted line").waitFor({ timeout: 120000 });
  for (let i = 0; i < pageIndex; i++) await page.getByRole("button", { name: "Next page" }).click();
  await page.getByText("Edit text — click a highlighted line").waitFor({ timeout: 120000 });
}

async function tapLine(page, index) {
  const box = await page.locator(".ocr-highlight-layer__box").nth(index).boundingBox();
  assert.ok(box, "detected line " + index + " exists");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(700);
}

async function exportPdf(page) {
  const download = page.waitForEvent("download", { timeout: 120000 });
  await page.getByRole("button", { name: /Download|Export|Save/ }).first().click();
  const file = await (await download).path();
  return new Uint8Array(await import("node:fs").then((fs) => fs.readFileSync(file)));
}

async function pageText(bytes, pageIndex) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const content = await (await doc.getPage(pageIndex + 1)).getTextContent();
  await doc.destroy();
  return content.items.map((item) => item.str ?? "").join("");
}

/**
 * Height of the ink just right of `word` on its line in the rendered page, as a share of the
 * word's font size. The edited word follows it, so a much smaller share means the replacement was
 * drawn at the wrong size.
 */
async function inkHeightAfterWord(bytes, pageIndex, word) {
  const scale = 1.5;
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const pdfPage = await doc.getPage(pageIndex + 1);
  // Printed PDFs split words across text items: take the item where the word ends.
  let joined = "";
  const item = (await pdfPage.getTextContent()).items.find((i) => {
    joined += i.str ?? "";
    return i.str && joined.includes(word);
  });
  assert.ok(item, "kept word " + word + " is on the page");
  const viewport = pdfPage.getViewport({ scale });
  await doc.destroy();
  const pixels = await pagePixels(bytes, pageIndex);
  const width = Math.floor(viewport.width);
  const size = item.height * scale;
  const [x, y] = viewport.convertToViewportPoint(item.transform[4] + item.width, item.transform[5]);
  let top = Infinity;
  let bottom = -Infinity;
  for (let row = Math.floor(y - 1.6 * size); row < y + 0.6 * size; row++) {
    for (let col = Math.ceil(x + 1); col < Math.min(width, x + 12 * size); col++) {
      const i = (row * width + col) * 4;
      if (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2] < 140) {
        top = Math.min(top, row);
        bottom = Math.max(bottom, row);
      }
    }
  }
  return bottom >= top ? (bottom - top + 1) / size : 0;
}

async function pagePixels(bytes, pageIndex) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const pdfPage = await doc.getPage(pageIndex + 1);
  const viewport = pdfPage.getViewport({ scale: 1.5 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, viewport.width, viewport.height);
  await pdfPage.render({ canvasContext: context, viewport, canvas }).promise;
  await doc.destroy();
  return context.getImageData(0, 0, viewport.width, viewport.height).data;
}

function changedShare(a, b) {
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 96) changed++;
  }
  return changed / (a.length / 4);
}

async function noOpCase(browser, name, file, pageIndex, lineIndexes) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await openPdf(page, file, pageIndex);
  for (const index of lineIndexes) {
    await tapLine(page, index);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  const exported = await exportPdf(page);
  const original = new Uint8Array(await import("node:fs").then((fs) => fs.readFileSync(file)));
  assert.equal(await pageText(exported, pageIndex), await pageText(original, pageIndex), name + ": text unchanged");
  const share = changedShare(await pagePixels(original, pageIndex), await pagePixels(exported, pageIndex));
  assert.ok(share <= MAX_CHANGED_PIXELS, name + ": " + (share * 100).toFixed(3) + " % of pixels changed");
  console.log("NO_OP_OK", name, (share * 100).toFixed(3) + " % pixels changed");
  await page.close();
}

async function oneWordCase(browser) {
  const file = path.join(fixtures, "translation-bilingual-fixture.pdf");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await openPdf(page, file, 1);
  // Use the first detected line with at least four words, so "untouched words" means something.
  // A tapped line's highlight disappears, so positions are recorded before tapping.
  let before = "";
  const boxes = await page.locator(".ocr-highlight-layer__box").evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }),
  );
  for (const box of boxes) {
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(700);
    before = await page.evaluate(() => document.activeElement.value ?? "");
    if (before.trim().split(/\s+/).length >= 4) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  const words = before.trim().split(/\s+/);
  assert.ok(words.length >= 4, "found a line with at least four words");
  const last = words[words.length - 1];
  await page.evaluate(() => {
    const field = document.activeElement;
    field.setSelectionRange(field.value.length, field.value.length);
  });
  for (let i = 0; i < before.length - before.trimEnd().length + last.length; i++) await page.keyboard.press("Backspace");
  await page.keyboard.type("Updated");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const exported = await exportPdf(page);
  const text = await pageText(exported, 1);
  // Untouched words stay real PDF text; only the edited word becomes an image.
  for (const word of words.slice(0, -1).filter((w) => w.length > 3)) {
    assert.ok(text.includes(word), "one-word edit keeps original text for: " + word);
  }
  const inkShare = await inkHeightAfterWord(exported, 1, words[words.length - 2]);
  assert.ok(inkShare >= 0.5, "edited word drawn at the original size (ink " + inkShare.toFixed(2) + " of the font size)");
  console.log("ONE_WORD_OK", JSON.stringify(last), "→ Updated; kept", words.length - 1, "words as original text; new word ink", inkShare.toFixed(2), "of font size");
  await page.close();
}

/** A detected line's box on screen and as a share of the page size. */
async function lineBox(page, index) {
  await page.locator(".ocr-highlight-layer__box").nth(index).waitFor();
  return page.evaluate((i) => {
    const r = document.querySelectorAll(".ocr-highlight-layer__box")[i].getBoundingClientRect();
    const p = document.querySelector(".pdf-page-viewer__image").getBoundingClientRect();
    return {
      screen: { x: r.x, y: r.y, w: r.width, h: r.height },
      share: { x: (r.x - p.x) / p.width, y: (r.y - p.y) / p.height, w: r.width / p.width, h: r.height / p.height },
    };
  }, index);
}

/** Text of the PDF's text items whose centre lies inside a box given as page-size shares. */
async function textInBox(bytes, pageIndex, share) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const pdfPage = await doc.getPage(pageIndex + 1);
  const viewport = pdfPage.getViewport({ scale: 1 });
  const content = await pdfPage.getTextContent();
  await doc.destroy();
  return content.items
    .filter((item) => {
      const [x, baseline] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      const cx = (x + item.width / 2) / viewport.width;
      const cy = (baseline - item.height * 0.35) / viewport.height;
      return cx >= share.x && cx <= share.x + share.w && cy >= share.y && cy <= share.y + share.h;
    })
    .map((item) => item.str)
    .join(" ");
}

async function dragBox(page, { x, y, w, h }) {
  await page.mouse.move(x - 2, y - 2);
  await page.mouse.down();
  await page.mouse.move(x + w + 2, y + h + 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
}

/** Shares of yellow and of dark pixels inside a box given as page-size shares. */
function boxInk(rgba, width, height, share) {
  const x0 = Math.round(share.x * width);
  const y0 = Math.round(share.y * height);
  const x1 = Math.round((share.x + share.w) * width);
  const y1 = Math.round((share.y + share.h) * height);
  let yellow = 0;
  let dark = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
      if (r > 200 && g > 180 && b < 160) yellow++;
      if (0.299 * r + 0.587 * g + 0.114 * b < 110) dark++;
    }
  }
  const total = Math.max(1, (x1 - x0) * (y1 - y0));
  return { yellow: yellow / total, dark: dark / total };
}

async function boxMarksCase(browser) {
  const file = path.join(fixtures, "translation-bilingual-fixture.pdf");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await openPdf(page, file, 1);
  const original = new Uint8Array(await import("node:fs").then((fs) => fs.readFileSync(file)));
  // Whiteout one line and highlight another, each with text to check. This PDF splits words into
  // fragments, so text is compared with whitespace removed.
  const squash = (text) => text.replace(/\s+/g, "");
  await page.locator(".ocr-highlight-layer__box").first().waitFor();
  const count = await page.locator(".ocr-highlight-layer__box").count();
  const lines = [];
  for (let i = 0; i < count && lines.length < 2; i++) {
    const line = await lineBox(page, i);
    line.text = await textInBox(original, 1, line.share);
    if (squash(line.text).length >= 12) lines.push(line);
  }
  assert.equal(lines.length, 2, "found two lines with words to check");
  const [hidden, marked] = lines;
  await page.getByRole("button", { name: "Whiteout" }).click();
  await dragBox(page, hidden.screen);
  await page.getByRole("button", { name: "Highlight" }).click();
  await dragBox(page, marked.screen);
  const exported = await exportPdf(page);
  const text = await pageText(exported, 1);
  assert.ok(squash(text).includes(squash(marked.text)), "highlight keeps the marked text: " + marked.text);
  assert.ok(!squash(text).includes(squash(hidden.text)), "whiteout deletes the covered text: " + hidden.text);
  const doc = await pdfjs.getDocument({ data: exported.slice(), verbosity: 0 }).promise;
  const viewport = (await doc.getPage(2)).getViewport({ scale: 1.5 });
  await doc.destroy();
  const rgba = await pagePixels(exported, 1);
  if (process.env.GATE_SAVE_DIR) {
    const fs = await import("node:fs");
    fs.writeFileSync(path.join(process.env.GATE_SAVE_DIR, "box-marks.pdf"), exported);
  }
  const whiteout = boxInk(rgba, Math.round(viewport.width), Math.round(viewport.height), hidden.share);
  const highlight = boxInk(rgba, Math.round(viewport.width), Math.round(viewport.height), marked.share);
  assert.ok(whiteout.dark < 0.005, "whiteout hides the ink (" + (whiteout.dark * 100).toFixed(2) + " % dark)");
  assert.ok(highlight.yellow > 0.3, "highlight is visible (" + (highlight.yellow * 100).toFixed(1) + " % yellow)");
  assert.ok(highlight.dark > 0.02, "text under the highlight stays dark (" + (highlight.dark * 100).toFixed(2) + " % dark)");
  console.log(
    "BOX_MARKS_OK whiteout removed", JSON.stringify(squash(hidden.text)), (whiteout.dark * 100).toFixed(2),
    "% dark; highlight kept", JSON.stringify(squash(marked.text)),
    (highlight.yellow * 100).toFixed(1), "% yellow,", (highlight.dark * 100).toFixed(2), "% dark",
  );
  await page.close();
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  await noOpCase(browser, "English digital page", path.join(fixtures, "translation-bilingual-fixture.pdf"), 1, [1, 3]);
  await noOpCase(browser, "Hindi fixture page", path.join(fixtures, "devanagari-fixture.pdf"), 0, [1]);
  await oneWordCase(browser);
  await boxMarksCase(browser);
} finally {
  await browser.close();
}
