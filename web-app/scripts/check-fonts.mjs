import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const fonts = JSON.parse(
  readFileSync(
    new URL("../assets/fonts/manifest.json", import.meta.url),
    "utf8",
  ),
);
for (const font of fonts) {
  const bytes = readFileSync(
    new URL("../assets/fonts/" + font.file, import.meta.url),
  );
  assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
  assert.equal(bytes.length, font.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sha256);
  assert.ok(font.source.startsWith("https://fonts.gstatic.com/"));
}
// Replacement fonts the editor uses to match the original document's typeface.
const replacement = JSON.parse(
  readFileSync(
    new URL("../editor/public/fonts/replacement/manifest.json", import.meta.url),
    "utf8",
  ),
);
for (const font of replacement) {
  const bytes = readFileSync(
    new URL("../editor/public/fonts/replacement/" + font.file, import.meta.url),
  );
  assert.equal(bytes.subarray(0, 4).toString(), "wOF2", font.file);
  assert.equal(bytes.length, font.bytes, font.file);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sha256, font.file);
  assert.ok(font.source.startsWith("https://fonts.gstatic.com/s/"), font.file);
}
console.log(
  "Pinned font checks passed: " +
    (fonts.length + replacement.length) +
    " official assets, sizes and hashes.",
);
