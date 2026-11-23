// Edit quality gate: replacing text with itself must leave the page as it was, a one-word edit
// must change only that word, a whiteout must delete the text it covers and a highlight must keep
// the text it marks readable, inserted images and signatures must land where they were put, and
// unexported edits must survive a reload, new words in faux-bold (stroked) lines must be as
// heavy as the original, a line that grows must flow into the next line of its paragraph, and
// page changes must keep each page's edits with it, and Hindi text whose font lacks Unicode for
// some glyphs must read correctly; Hindi typed mid-line stays in order and is spell-checked. Runs the real editor in Chrome against a preview or production.
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
  // The hint also shows before a page has been read; wait for its detected lines.
  await page.locator(".ocr-highlight-layer__box").first().waitFor({ timeout: 120000 });
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

async function pagePixels(bytes, pageIndex, scale = 1.5) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const pdfPage = await doc.getPage(pageIndex + 1);
  const viewport = pdfPage.getViewport({ scale });
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
  // The same letters reversed: a word of the same length, so the line does not grow into the
  // next line of its paragraph (paragraphFlowCase covers that).
  const replacement = [...last].reverse().join("");
  await page.keyboard.type(replacement);
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
  console.log("ONE_WORD_OK", JSON.stringify(last), "→", JSON.stringify(replacement) + "; kept", words.length - 1, "words as original text; new word ink", inkShare.toFixed(2), "of font size");
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

/** An element's box as a share of the page image's size. */
async function shareOf(page, selector) {
  return page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    const p = document.querySelector(".pdf-page-viewer__image").getBoundingClientRect();
    return { x: (r.x - p.x) / p.width, y: (r.y - p.y) / p.height, w: r.width / p.width, h: r.height / p.height };
  }, selector);
}

/** Share of pixels inside a page-share box matching `test(r, g, b)`, with a small inset. */
function boxShare(rgba, width, height, share, test) {
  const inset = 0.15;
  const x0 = Math.round((share.x + share.w * inset) * width);
  const y0 = Math.round((share.y + share.h * inset) * height);
  const x1 = Math.round((share.x + share.w * (1 - inset)) * width);
  const y1 = Math.round((share.y + share.h * (1 - inset)) * height);
  let hits = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if (test(rgba[i], rgba[i + 1], rgba[i + 2])) hits++;
    }
  }
  return hits / Math.max(1, (x1 - x0) * (y1 - y0));
}

async function imagesCase(browser) {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const file = path.join(fixtures, "translation-bilingual-fixture.pdf");
  const red = createCanvas(200, 100);
  const redContext = red.getContext("2d");
  redContext.fillStyle = "#e01010";
  redContext.fillRect(0, 0, 200, 100);
  const redFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gate-")), "red.png");
  fs.writeFileSync(redFile, red.toBuffer("image/png"));

  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await openPdf(page, file, 1);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await (await chooser).setFiles(redFile);
  const image = page.getByRole("group", { name: "Image" });
  const placed = await image.boundingBox();
  await page.mouse.move(placed.x + placed.width / 2, placed.y + placed.height / 2);
  await page.mouse.down();
  await page.mouse.move(placed.x + placed.width / 2 - 120, placed.y + placed.height / 2 + 140, { steps: 10 });
  await page.mouse.up();
  const moved = await image.boundingBox();
  assert.ok(Math.abs(moved.x - (placed.x - 120)) < 3 && Math.abs(moved.y - (placed.y + 140)) < 3, "image moves with the pointer");
  const imageShare = await shareOf(page, '[role="group"][aria-label="Image"]');

  await page.getByRole("button", { name: "Signature", exact: true }).click();
  const pad = await page.getByLabel("Signature drawing area").boundingBox();
  await page.mouse.move(pad.x + 40, pad.y + 120);
  await page.mouse.down();
  for (let i = 0; i <= 30; i++) {
    await page.mouse.move(pad.x + 40 + i * 10, pad.y + 120 - Math.sin(i / 3) * 50);
  }
  await page.mouse.up();
  await page.getByRole("button", { name: "Add signature" }).click();
  await page.getByRole("group", { name: "Signature" }).waitFor();
  const signatureShare = await shareOf(page, '[role="group"][aria-label="Signature"]');

  const exported = await exportPdf(page);
  const original = new Uint8Array(fs.readFileSync(file));
  assert.equal(await pageText(exported, 1), await pageText(original, 1), "inserting images leaves the page text as it was");
  const doc = await pdfjs.getDocument({ data: exported.slice(), verbosity: 0 }).promise;
  const viewport = (await doc.getPage(2)).getViewport({ scale: 1.5 });
  await doc.destroy();
  const [w, h] = [Math.round(viewport.width), Math.round(viewport.height)];
  const rgba = await pagePixels(exported, 1);
  const redShare = boxShare(rgba, w, h, imageShare, (r, g, b) => r > 180 && g < 80 && b < 80);
  const inkShare = boxShare(rgba, w, h, signatureShare, (r, g, b) => r + g + b < 300);
  assert.ok(redShare > 0.95, "image is drawn where it was moved (" + (redShare * 100).toFixed(1) + " % red)");
  assert.ok(inkShare > 0.01, "signature ink is drawn where it was placed (" + (inkShare * 100).toFixed(2) + " % ink)");
  console.log("IMAGES_OK image", (redShare * 100).toFixed(1), "% red at its moved place; signature", (inkShare * 100).toFixed(2), "% ink; page text unchanged");
  await page.close();
}

async function autosaveCase(browser) {
  const file = path.join(fixtures, "translation-bilingual-fixture.pdf");
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  await openPdf(page, file, 1);
  const original = new Uint8Array(await import("node:fs").then((fs) => fs.readFileSync(file)));
  const squash = (text) => text.replace(/\s+/g, "");
  const line = await lineBox(page, 0);
  line.text = await textInBox(original, 1, line.share);
  await page.getByRole("button", { name: "Whiteout" }).click();
  await dragBox(page, line.screen);
  await page.getByText("Edits kept in this browser").waitFor({ timeout: 10000 });

  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Continue where you left off?").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Restore edits" }).click();
  await page.locator(".mask-overlay__mask--whiteout").waitFor({ timeout: 120000 });
  const exported = await exportPdf(page);
  // The restored editor opens on the edited (second) page, where the whiteout is.
  assert.ok(!squash(await pageText(exported, 1)).includes(squash(line.text)), "restored whiteout still deletes its text");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  assert.equal(await page.getByText("Continue where you left off?").count(), 0, "an exported draft is not offered again");
  console.log("AUTOSAVE_OK whiteout kept across a reload, restored and exported; draft dropped after export");
  await context.close();
}

/**
 * Median width of horizontal ink runs (stems) between two x positions in a band, in px; runs
 * wider than 30 px (bars, joined letters) are left out.
 */
function medianStemPx(rgba, width, x0, x1, y0, y1) {
  const runs = [];
  for (let y = y0; y < y1; y++) {
    let run = 0;
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * 4;
      const ink = x < x1 && rgba[i] + rgba[i + 1] + rgba[i + 2] < 384;
      if (ink) run++;
      else if (run) {
        if (run < 30) runs.push(run);
        run = 0;
      }
    }
  }
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length / 2)] ?? 0;
}

/** Ink width of the last word on a line band (right of the last word space), in px. */
async function lastWordInkWidth(rgba, width, x, y0, y1, size) {
  const inkAt = (col) => {
    for (let y = y0; y < y1; y++) {
      const i = (y * width + col) * 4;
      if (rgba[i] + rgba[i + 1] + rgba[i + 2] < 384) return true;
    }
    return false;
  };
  let right = width - 1;
  while (right > x && !inkAt(right)) right--;
  const wordSpace = Math.round(size * 0.2);
  let start = right;
  for (let blank = 0; start > x && blank < wordSpace; start--) blank = inkAt(start) ? 0 : blank + 1;
  return right + 1 - (start + wordSpace);
}

async function fauxBoldCase(browser) {
  const file = path.join(fixtures, "faux-bold-fixture.pdf");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await openPdf(page, file, 0);
  await page.locator(".ocr-highlight-layer__box").first().waitFor();
  const boxes = await page.locator(".ocr-highlight-layer__box").evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }),
  );
  // Lines 1 and 2 are faux bold (stroke 0.025 and 0.05 of the font size). Their last word is
  // replaced by itself reversed: same letters and length, so the line is not shrunk to fit and
  // stems compare like for like.
  for (const box of boxes.slice(1, 3)) {
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(800);
    const last = await page.evaluate(() => {
      const field = document.activeElement;
      const keep = field.value.trimEnd().replace(/\S+$/u, "");
      field.setSelectionRange(keep.length, field.value.length);
      return field.value.trimEnd().slice(keep.length);
    });
    await page.keyboard.type([...last].reverse().join(""));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  const exported = await exportPdf(page);
  if (process.env.GATE_SAVE_DIR) {
    const fs = await import("node:fs");
    fs.writeFileSync(path.join(process.env.GATE_SAVE_DIR, "faux-bold.pdf"), exported);
  }
  const scale = 4;
  const doc = await pdfjs.getDocument({ data: exported.slice(), verbosity: 0 }).promise;
  const pdfPage = await doc.getPage(1);
  const viewport = pdfPage.getViewport({ scale });
  const items = (await pdfPage.getTextContent()).items.filter((item) => item.str?.trim());
  await doc.destroy();
  const width = Math.round(viewport.width);
  const rgba = await pagePixels(exported, 0, scale);
  const sourceRgba = await pagePixels(new Uint8Array((await import("node:fs")).readFileSync(file)), 0, scale);
  const results = [];
  for (const prefix of ["Faux bold", "Heavy faux"]) {
    const item = items.find((it) => it.str.replace(/\s+/g, "").startsWith(prefix.replace(/\s+/g, "")));
    assert.ok(item, "kept words of the line are still PDF text: " + prefix);
    const [x, baseline] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    const size = item.height * scale;
    const y0 = Math.round(baseline - size * 0.7);
    const y1 = Math.round(baseline);
    // The new word is the last one on the line: the ink right of the last word space.
    const inkAt = (col) => {
      for (let y = y0; y < y1; y++) {
        const i = (y * width + col) * 4;
        if (rgba[i] + rgba[i + 1] + rgba[i + 2] < 384) return true;
      }
      return false;
    };
    let right = width - 1;
    while (right > x && !inkAt(right)) right--;
    const wordSpace = Math.round(size * 0.2);
    let start = right;
    for (let blank = 0; start > x && blank < wordSpace; start--) blank = inkAt(start) ? 0 : blank + 1;
    const newWordStart = start + wordSpace;
    const original = medianStemPx(rgba, width, Math.round(x), start, y0, y1);
    const replaced = medianStemPx(rgba, width, newWordStart, right + 1, y0, y1);
    const ratio = replaced / original;
    assert.ok(ratio > 0.85 && ratio < 1.2, prefix + ": new word stems " + replaced + " px vs original " + original + " px");
    // Faux bold keeps the regular letter shapes: the reversed word is as wide as the original
    // word, where a bold face would be wider.
    const originalWordPx = await lastWordInkWidth(sourceRgba, width, x, y0, y1, size);
    const newWordPx = right + 1 - newWordStart;
    const widthRatio = newWordPx / originalWordPx;
    assert.ok(Math.abs(widthRatio - 1) < 0.04, prefix + ": new word " + newWordPx + " px wide vs original " + originalWordPx + " px");
    results.push(prefix + " stems " + replaced + "/" + original + " px, width " + (widthRatio * 100).toFixed(1) + " %");
  }
  console.log("FAUX_BOLD_OK new word stems match the stroked original:", results.join("; "));
  await page.close();
}

/** Top and bottom of each row of ink in a box given as page-size shares, in px. */
function inkRows(rgba, width, height, share) {
  const x0 = Math.round(share.x * width);
  const x1 = Math.round((share.x + share.w) * width);
  const y0 = Math.round(share.y * height);
  const y1 = Math.round((share.y + share.h) * height);
  const rows = [];
  let start = null;
  for (let y = y0; y <= y1; y++) {
    let ink = false;
    for (let x = x0; x < x1 && !ink && y < y1; x++) {
      const i = (y * width + x) * 4;
      ink = rgba[i] + rgba[i + 1] + rgba[i + 2] < 450;
    }
    if (ink && start === null) start = y;
    if (!ink && start !== null) {
      rows.push([start, y - 1]);
      start = null;
    }
  }
  return rows;
}

async function paragraphFlowCase(browser) {
  const file = path.join(fixtures, "translation-bilingual-fixture.pdf");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await openPdf(page, file, 1);
  // "Please approve the application after verifying all supporting" / "documents."
  const first = await lineBox(page, 3);
  const second = await lineBox(page, 4);
  const region = {
    x: first.share.x - 0.01,
    y: first.share.y - first.share.h * 0.5,
    w: 0.85 - first.share.x,
    h: second.share.y + second.share.h * 1.5 - (first.share.y - first.share.h * 0.5),
  };
  await page.mouse.click(first.screen.x + first.screen.w / 2, first.screen.y + first.screen.h / 2);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const field = document.activeElement;
    const at = field.value.indexOf("application") + "application".length;
    field.setSelectionRange(at, at);
  });
  await page.keyboard.type(" and the attached forms", { delay: 10 });
  await page.waitForTimeout(300);
  const typed = await page.evaluate(() => document.activeElement.value);
  assert.ok(typed.endsWith("supporting documents."), "the next line of the paragraph is taken into the edit: " + typed);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  const exported = await exportPdf(page);
  const original = new Uint8Array((await import("node:fs")).readFileSync(file));
  const text = await pageText(exported, 1);
  assert.ok(!text.replace(/\s+/g, "").includes("documents."), "the taken line is redrawn with the paragraph, not left as text");
  assert.ok(text.replace(/\s+/g, "").includes("EmployeeName:SeemaSharma"), "lines outside the paragraph keep their text");
  const doc = await pdfjs.getDocument({ data: exported.slice(), verbosity: 0 }).promise;
  const viewport = (await doc.getPage(2)).getViewport({ scale: 1.5 });
  await doc.destroy();
  const [w, h] = [Math.round(viewport.width), Math.round(viewport.height)];
  const before = inkRows(await pagePixels(original, 1), w, h, region);
  const after = inkRows(await pagePixels(exported, 1), w, h, region);
  assert.equal(after.length, before.length, "the paragraph keeps its number of lines: " + JSON.stringify(after));
  for (const [k, [top]] of before.entries()) {
    assert.ok(Math.abs(after[k][0] - top) <= 3, "line " + (k + 1) + " stays on its row (" + after[k][0] + " vs " + top + " px)");
  }
  console.log("PARAGRAPH_FLOW_OK grown line took in the next line; rows", JSON.stringify(after), "vs original", JSON.stringify(before));
  await page.close();
}

async function pageOpsCase(browser) {
  const file = path.join(fixtures, "multipage-fixture.pdf");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await openPdf(page, file, 0);
  // Whiteout the first line (the print date) of page 1, then move page 1 after page 2.
  const date = await lineBox(page, 0);
  await page.getByRole("button", { name: "Whiteout" }).click();
  await dragBox(page, date.screen);
  await page.locator(".mask-overlay__mask--whiteout").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Pages", exact: true }).click();
  await page.getByRole("button", { name: "Move page 1 later" }).click();
  await page.getByText("Page 1 is now page 2.").waitFor();
  await page.getByRole("button", { name: "Delete page 3" }).click();
  await page.getByText("Page 3 deleted.").waitFor();
  assert.equal(await page.locator(".pages-panel__card").count(), 2, "a deleted page leaves the list");
  await page.getByRole("button", { name: "Undo" }).first().click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator(".pages-panel__card").count(), 3, "Undo brings a deleted page back");
  await page.getByRole("button", { name: "Add a blank page after page 3" }).click();
  await page.getByText("Blank page added as page 4.").waitFor();

  const exported = await exportPdf(page);
  const doc = await pdfjs.getDocument({ data: exported.slice(), verbosity: 0 }).promise;
  const texts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    texts.push(content.items.map((item) => item.str).join("").replace(/\s+/g, ""));
  }
  await doc.destroy();
  assert.equal(texts.length, 4, "four pages after a move, a deleted-and-restored page and a blank page");
  assert.ok(texts[0].startsWith("Page2of3") && texts[1].startsWith("Page1of3") && texts[2].startsWith("Page3of3"), "pages in their new order: " + texts.map((t) => t.slice(0, 8)).join(", "));
  assert.equal(texts[3], "", "the added page is blank");
  const dateText = (t) => /\d{2}\/\d{2}\/\d{4}/.test(t);
  assert.ok(!dateText(texts[1]) && dateText(texts[0]) && dateText(texts[2]), "the whiteout moved with its page");
  console.log("PAGE_OPS_OK moved, deleted and restored, added a blank page; order", texts.map((t) => t.slice(0, 8)).join(", "), "; whiteout stayed on its page");
  await page.close();
}

async function glyphRepairCase(browser) {
  // Chrome printed this fixture with subset fonts that leave the reph, conjuncts, ें and ि without
  // Unicode. The label row reads "→" only from the PDF (OCR reads it as ">"), so reading it
  // exactly shows the PDF's own text was repaired.
  const file = path.join(fixtures, "devanagari-fixture.pdf");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await openPdf(page, file, 0);
  const expected = [
    "धर्म और क्षेत्र में गुरुजी ने ज्ञान दिया।",
    "धर्म → reph (र्) | क्षेत्र → क्ष",
    "विद्यालय में सूर्य की रोशनी आती है।",
  ];
  const read = [];
  const count = await page.locator(".ocr-highlight-layer__box").count();
  for (let i = 0; i < count; i++) {
    // Each tapped line is undone again, so every line stays in the list at its index.
    const box = page.locator(".ocr-highlight-layer__box").nth(i);
    await box.scrollIntoViewIfNeeded();
    const bb = await box.boundingBox();
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.waitForTimeout(400);
    read.push(await page.evaluate(() => document.activeElement.value ?? ""));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(250);
    if (expected.every((line) => read.includes(line))) break;
  }
  for (const line of expected) assert.ok(read.includes(line), "reads as written: " + line + " (read: " + JSON.stringify(read) + ")");
  console.log("GLYPH_REPAIR_OK", expected.length, "Hindi lines read exactly from the PDF's repaired text");
  await page.close();
}

async function findReplaceFlowCase(browser) {
  const file = path.join(fixtures, "translation-bilingual-fixture.pdf");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await openPdf(page, file, 1);
  await page.getByRole("button", { name: "Find & replace" }).click();
  await page.getByLabel("Find", { exact: true }).fill("the application");
  await page.getByLabel("Replace with").fill("the application and the attached forms");
  await page.getByRole("button", { name: /^Replace all/ }).click();
  await page.getByText(/Replaced in \d+ place/).waitFor();
  const exported = await exportPdf(page);
  const text = (await pageText(exported, 1)).replace(/\s+/g, "");
  // The grown line takes in "documents." from the next line: neither stays as PDF text.
  assert.ok(!text.includes("documents."), "a longer replacement flows into the next line of its paragraph");
  assert.ok(text.includes("EmployeeName:SeemaSharma"), "other lines keep their text");
  console.log("FIND_REPLACE_FLOW_OK longer replacement took in the next line of its paragraph");
  await page.close();
}

async function spellCheckCase(browser) {
  const file = path.join(fixtures, "devanagari-fixture.pdf");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await openPdf(page, file, 0);
  const count = await page.locator(".ocr-highlight-layer__box").count();
  for (let i = 0; i < count; i++) {
    const box = await page.locator(".ocr-highlight-layer__box").nth(i).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
    if ((await page.evaluate(() => document.activeElement.value ?? "")).startsWith("धर्म और")) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(200);
  }
  // Typed before the next word with no space yet: the virama must not pull the caret into it.
  await page.evaluate(() => {
    const field = document.activeElement;
    const at = field.value.indexOf("दिया");
    field.setSelectionRange(at, at);
  });
  await page.keyboard.type("कार्यलय ");
  assert.equal(
    await page.evaluate(() => document.activeElement.value),
    "धर्म और क्षेत्र में गुरुजी ने ज्ञान कार्यलय दिया।",
    "typing before a word keeps the letters in order",
  );
  const fix = page.getByRole("button", { name: "Replace कार्यलय with कार्यालय" });
  await fix.waitFor({ timeout: 20000 });
  assert.equal(await page.locator(".spelling-panel__word").count(), 1, "only the added misspelling is flagged, not the line's own words");
  await fix.click();
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(() => document.activeElement.value),
    "धर्म और क्षेत्र में गुरुजी ने ज्ञान कार्यालय दिया।",
    "the suggestion replaces the word",
  );
  console.log("SPELL_CHECK_OK typed word kept in order, misspelling flagged and fixed from a suggestion");
  await page.close();
}

async function signCase(browser) {
  const file = path.join(fixtures, "multipage-fixture.pdf");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(baseUrl + "/tools/sign-pdf/", { waitUntil: "networkidle" });
  await page.locator("input[type=file]").first().setInputFiles(file);
  await page.getByRole("button", { name: "Type", exact: true }).click();
  await page.getByLabel("Your name (Hindi or English)").fill("मनीष शर्मा");
  await page.getByRole("button", { name: "Use this signature" }).click();
  await page.getByRole("radio", { name: "Every page" }).click();
  await page.getByRole("radio", { name: "Bottom right" }).click();
  const download = page.waitForEvent("download", { timeout: 120000 });
  await page.getByRole("button", { name: /Download signed PDF/ }).click();
  const signed = new Uint8Array((await import("node:fs")).readFileSync(await (await download).path()));
  const original = new Uint8Array((await import("node:fs")).readFileSync(file));
  const doc = await pdfjs.getDocument({ data: signed.slice(), verbosity: 0 }).promise;
  assert.equal(doc.numPages, 3, "every page is kept");
  const viewport = (await doc.getPage(1)).getViewport({ scale: 1.5 });
  await doc.destroy();
  const [w, h] = [Math.round(viewport.width), Math.round(viewport.height)];
  for (let i = 0; i < 3; i++) {
    assert.equal(await pageText(signed, i), await pageText(original, i), "page text is unchanged");
    const a = await pagePixels(original, i);
    const b = await pagePixels(signed, i);
    let inCorner = 0;
    let elsewhere = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4;
        if (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]) <= 96) continue;
        if (x > w / 2 && y > h * 0.75) inCorner++;
        else elsewhere++;
      }
    }
    assert.ok(inCorner > 200 && elsewhere === 0, "page " + (i + 1) + ": signature only at the bottom right (" + inCorner + " / " + elsewhere + " px)");
  }
  console.log("SIGN_OK typed Hindi signature on all 3 pages at the bottom right; page text unchanged");
  await page.close();
}

// Every page at a custom spot dragged on page 1, page 2 moved on its own, page 3 left unsigned.
async function signPositionsCase(browser) {
  const file = path.join(fixtures, "multipage-fixture.pdf");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
  await page.goto(baseUrl + "/tools/sign-pdf/", { waitUntil: "networkidle" });
  await page.locator("input[type=file]").first().setInputFiles(file);
  await page.getByRole("button", { name: "Type", exact: true }).click();
  await page.getByLabel("Your name (Hindi or English)").fill("मनीष शर्मा");
  await page.getByRole("button", { name: "Use this signature" }).click();
  await page.getByRole("radio", { name: "Every page" }).click();
  await page.getByRole("radio", { name: /Custom/ }).click();
  const dragTo = async (fx, fy) => {
    const box = await page.locator(".image-edit-overlay").boundingBox();
    const sheet = await page.locator(".sign-tool__page").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(sheet.x + sheet.width * fx, sheet.y + sheet.height * fy, { steps: 10 });
    await page.mouse.up();
  };
  await dragTo(0.25, 0.2);
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("radio", { name: "This page only" }).click();
  await dragTo(0.5, 0.5);
  assert.ok(await page.getByText("Own position on this page").isVisible(), "page 2 is marked as adjusted");
  await page.getByRole("button", { name: "Next page" }).click();
  await page.locator(".image-edit-overlay").click();
  await page.getByRole("button", { name: "Remove from this page" }).click();
  assert.ok(await page.getByText("Not signed on this page").isVisible(), "page 3 is marked as unsigned");
  assert.ok(await page.getByText("2 signatures will be added.").isVisible(), "two signatures counted");
  const download = page.waitForEvent("download", { timeout: 120000 });
  await page.getByRole("button", { name: /Download signed PDF/ }).click();
  const signed = new Uint8Array((await import("node:fs")).readFileSync(await (await download).path()));
  const original = new Uint8Array((await import("node:fs")).readFileSync(file));
  const doc = await pdfjs.getDocument({ data: signed.slice(), verbosity: 0 }).promise;
  const viewport = (await doc.getPage(1)).getViewport({ scale: 1.5 });
  await doc.destroy();
  const [w, h] = [Math.round(viewport.width), Math.round(viewport.height)];
  const centres = [];
  for (let i = 0; i < 3; i++) {
    const a = await pagePixels(original, i);
    const b = await pagePixels(signed, i);
    let n = 0, sx = 0, sy = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      if (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]) <= 96) continue;
      n++; sx += x; sy += y;
    }
    centres.push(n ? [sx / n / w, sy / n / h, n] : [0, 0, 0]);
  }
  const near = ([cx, cy, n], fx, fy) => n > 200 && Math.abs(cx - fx) < 0.06 && Math.abs(cy - fy) < 0.06;
  const fmt = centres.map(([cx, cy, n]) => `(${cx.toFixed(2)}, ${cy.toFixed(2)}; ${n} px)`).join(" ");
  assert.ok(near(centres[0], 0.25, 0.2), "page 1 signature at the custom spot " + fmt);
  assert.ok(near(centres[1], 0.5, 0.5), "page 2 signature at its own spot " + fmt);
  assert.equal(centres[2][2], 0, "page 3 unsigned " + fmt);
  console.log("SIGN_POSITIONS_OK custom spot on page 1, own spot on page 2, page 3 unsigned: " + fmt);
  await page.close();
}

// A KrutiDev page with English in its own font (as real files have): PDF to Word converts only the
// KrutiDev runs and keeps the English, numbers and email exactly.
async function krutiDevMixedCase(browser) {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const { unzipSync, strFromU8 } = require(path.join(editorModules, "fflate"));
  const { PDFDict, PDFDocument, PDFName, StandardFonts } = await import(path.join(editorModules, "@cantoo/pdf-lib/es/index.js"));
  const doc = await PDFDocument.create();
  const sheet = doc.addPage([595, 842]);
  const kruti = await doc.embedFont(StandardFonts.Helvetica);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  sheet.drawText("rFkk dsUnz ljdkj ds deZpkfj;ksa dks le; le; ij ns; lkekU; HkÙkksa lfgr", { x: 50, y: 760, size: 12, font: kruti });
  sheet.drawText("Application No. CISF/2026/0457, Email: office@example.org", { x: 50, y: 720, size: 12, font: times });
  // pdf-lib writes font dicts at save time: rename the first font on a reloaded copy.
  const named = await PDFDocument.load(await doc.save({ useObjectStreams: false }));
  for (const [, ref] of named.getPage(0).node.Resources().lookup(PDFName.of("Font"), PDFDict).entries()) {
    const font = named.context.lookup(ref, PDFDict);
    if (String(font.get(PDFName.of("BaseFont"))) === "/Helvetica") font.set(PDFName.of("BaseFont"), PDFName.of("KrutiDev010"));
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-"));
  const pdfPath = path.join(dir, "krutidev-mixed.pdf");
  fs.writeFileSync(pdfPath, await named.save({ useObjectStreams: false }));
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(baseUrl + "/tools/pdf-to-word/", { waitUntil: "networkidle" });
  await page.locator("input[type=file]").first().setInputFiles(pdfPath);
  const download = page.waitForEvent("download", { timeout: 120000 });
  await page.getByRole("button", { name: /Convert & download Word/ }).click();
  const docx = path.join(dir, "out.docx");
  fs.copyFileSync(await (await download).path(), docx);
  const xml = strFromU8(unzipSync(new Uint8Array(fs.readFileSync(docx)))["word/document.xml"]);
  const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("\n");
  assert.ok(text.includes("तथा केन्द्र सरकार के कर्मचारियों को समय समय पर देय सामान्य भत्तों सहित"), "KrutiDev converted: " + text);
  assert.ok(text.includes("Application No. CISF/2026/0457, Email: office@example.org"), "English kept: " + text);
  console.log("KRUTIDEV_MIXED_OK KrutiDev line converted to Unicode; English line in its own font kept exactly");
  await page.close();
}

async function convertersCase(browser) {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const { unzipSync, strFromU8 } = require(path.join(editorModules, "fflate"));
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(baseUrl + "/tools/pdf-to-word/", { waitUntil: "networkidle" });
  await page.locator("input[type=file]").first().setInputFiles(path.join(fixtures, "devanagari-fixture.pdf"));
  let download = page.waitForEvent("download", { timeout: 240000 });
  await page.getByRole("button", { name: /Convert & download Word/ }).click();
  const docxPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gate-")), "fixture.docx");
  fs.copyFileSync(await (await download).path(), docxPath);
  const xml = strFromU8(unzipSync(new Uint8Array(fs.readFileSync(docxPath)))["word/document.xml"]);
  const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("\n");
  for (const line of ["धर्म और क्षेत्र में गुरुजी ने ज्ञान दिया।", "विद्यालय में सूर्य की रोशनी आती है।", "धर्म → reph (र्) | क्षेत्र → क्ष"]) {
    assert.ok(text.includes(line), "the Word file has the PDF's text: " + line);
  }
  await page.goto(baseUrl + "/tools/word-to-pdf/", { waitUntil: "networkidle" });
  await page.locator("input[type=file]").first().setInputFiles(docxPath);
  await page.locator(".word-to-pdf__preview section.docx").first().waitFor({ timeout: 60000 });
  download = page.waitForEvent("download", { timeout: 240000 });
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const pdf = new Uint8Array(fs.readFileSync(await (await download).path()));
  const doc = await pdfjs.getDocument({ data: pdf.slice(), verbosity: 0 }).promise;
  const pages = doc.numPages;
  await doc.destroy();
  const rgba = await pagePixels(pdf, 0);
  let ink = 0;
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i] + rgba[i + 1] + rgba[i + 2] < 300) ink++;
  assert.ok(pages >= 1 && ink > 5000, "the PDF from the Word file has its text drawn (" + ink + " dark px)");
  console.log("CONVERTERS_OK PDF to Word kept the Hindi text exactly; Word to PDF made", pages, "pages");
  await page.close();
}

async function fillFormCase(browser) {
  const fs = await import("node:fs");
  const { PDFDocument, PDFName } = await import(path.join(editorModules, "@cantoo/pdf-lib/es/index.js"));
  const file = path.join(fixtures, "form-fixture.pdf");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(baseUrl + "/tools/fill-pdf-form/", { waitUntil: "networkidle" });
  await page.locator("input[type=file]").first().setInputFiles(file);
  const side = page.locator(".fill-form__list");
  await side.getByLabel("Full name").fill("मनीष शर्मा");
  await side.getByLabel("applicant.address").fill("12, गांधी मार्ग\nलखनऊ");
  await side.getByLabel("applicant.city").fill("Lucknow");
  await side.getByLabel("applicant.agree").check();
  await side.getByLabel("Other").check();
  await side.getByLabel("applicant.state").selectOption("Bihar");
  await side.getByLabel("applicant.languages").selectOption(["Hindi", "Urdu"]);
  assert.equal(await page.locator(".fill-form__overlay").first().inputValue(), "मनीष शर्मा", "the on-page box shows the answer");
  // Page 2 is turned 90 degrees with its field: the on-page box must read upright.
  await page.getByRole("button", { name: "Next page" }).click();
  await side.getByLabel("Remarks").fill("सब ठीक है");
  const remarksBox = page.locator(".fill-form__overlay").first();
  assert.equal(await remarksBox.inputValue(), "सब ठीक है");
  assert.equal(await remarksBox.evaluate((el) => getComputedStyle(el).transform), "none", "the turned field's box is upright on screen");
  const download = page.waitForEvent("download", { timeout: 120000 });
  await page.getByRole("button", { name: /Download filled PDF/ }).click();
  const filled = new Uint8Array(fs.readFileSync(await (await download).path()));
  const form = (await PDFDocument.load(filled)).getForm();
  assert.equal(form.getTextField("applicant.name").getText(), "मनीष शर्मा", "the Hindi answer is stored as Unicode");
  assert.equal(form.getTextField("applicant.address").getText(), "12, गांधी मार्ग\nलखनऊ");
  assert.equal(form.getTextField("applicant.city").getText(), "Lucknow");
  assert.ok(form.getCheckBox("applicant.agree").isChecked(), "the box is ticked");
  assert.equal(form.getRadioGroup("applicant.category").getSelected(), "Other");
  assert.deepEqual(form.getDropdown("applicant.state").getSelected(), ["Bihar"]);
  assert.deepEqual(form.getOptionList("applicant.languages").getSelected(), ["Hindi", "Urdu"], "both list choices are selected");
  assert.equal(form.getTextField("applicant.remarks").getText(), "सब ठीक है");
  assert.equal(String(form.acroForm.dict.get(PDFName.of("NeedAppearances"))), "false", "viewers keep the drawn Hindi");
  // The Hindi answer is drawn in its box: ink inside the name field, none outside the fields.
  const original = new Uint8Array(fs.readFileSync(file));
  const a = await pagePixels(original, 0, 2);
  const b = await pagePixels(filled, 0, 2);
  const doc = await pdfjs.getDocument({ data: filled.slice(), verbosity: 0 }).promise;
  const w = Math.round((await doc.getPage(1)).getViewport({ scale: 2 }).width);
  await doc.destroy();
  const inBox = (x0, y0, x1, y1) => {
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = (y * w + x) * 4;
      if (b[k] + b[k + 1] + b[k + 2] < 300 && a[k] + a[k + 1] + a[k + 2] > 600) n++;
    }
    return n;
  };
  // Name field: x 200–520 pt, top 842-724 = 118 pt, height 24 pt; at 2 px/pt.
  const nameInk = inBox(400, 236, 1040, 284);
  assert.ok(nameInk > 300, "the Hindi name is drawn in its field (" + nameInk + " px)");
  // The turned field: user space x 76–100, y 160–480 pt shows at x 160–480, y 76–100 pt on screen.
  const a2 = await pagePixels(original, 1, 2);
  const b2 = await pagePixels(filled, 1, 2);
  const w2 = 842 * 2;
  const band = (x0, y0, x1, y1) => {
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = (y * w2 + x) * 4;
      if (b2[k] + b2[k + 1] + b2[k + 2] < 300 && a2[k] + a2[k + 1] + a2[k + 2] > 600) n++;
    }
    return n;
  };
  const remarksInk = band(324, 156, 956, 196);
  // Upright Devanagari has its headline (shirorekha) as one long dark row; turned text has none.
  let headline = 0;
  for (let y = 156; y < 196; y++) {
    let run = 0;
    for (let x = 324; x < 956; x++) {
      const k = (y * w2 + x) * 4;
      run = b2[k] + b2[k + 1] + b2[k + 2] < 300 ? run + 1 : 0;
      headline = Math.max(headline, run);
    }
  }
  assert.ok(remarksInk > 300 && headline > 20, "the turned field's Hindi answer reads upright (" + remarksInk + " px, headline " + headline + " px)");
  console.log("FILL_FORM_OK Hindi and English answers stored, Hindi drawn in its box (" + nameInk + " px), box, radio, dropdown and list set; turned field upright (headline " + headline + " px)");
  await page.close();
}

// GATE_ONLY=fillFormCase,signCase runs only the named cases.
const only = process.env.GATE_ONLY?.split(",");
const wanted = (name) => !only || only.includes(name);
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  if (wanted("noOpCase")) await noOpCase(browser, "English digital page", path.join(fixtures, "translation-bilingual-fixture.pdf"), 1, [1, 3]);
  if (wanted("noOpCase")) await noOpCase(browser, "Hindi fixture page", path.join(fixtures, "devanagari-fixture.pdf"), 0, [1]);
  if (wanted("oneWordCase")) await oneWordCase(browser);
  if (wanted("boxMarksCase")) await boxMarksCase(browser);
  if (wanted("imagesCase")) await imagesCase(browser);
  if (wanted("autosaveCase")) await autosaveCase(browser);
  if (wanted("fauxBoldCase")) await fauxBoldCase(browser);
  if (wanted("paragraphFlowCase")) await paragraphFlowCase(browser);
  if (wanted("pageOpsCase")) await pageOpsCase(browser);
  if (wanted("glyphRepairCase")) await glyphRepairCase(browser);
  if (wanted("findReplaceFlowCase")) await findReplaceFlowCase(browser);
  if (wanted("spellCheckCase")) await spellCheckCase(browser);
  if (wanted("signCase")) await signCase(browser);
  if (wanted("signPositionsCase")) await signPositionsCase(browser);
  if (wanted("convertersCase")) await convertersCase(browser);
  if (wanted("krutiDevMixedCase")) await krutiDevMixedCase(browser);
  if (wanted("fillFormCase")) await fillFormCase(browser);
} finally {
  await browser.close();
}
