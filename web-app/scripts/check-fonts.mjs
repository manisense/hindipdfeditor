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
console.log(
  "Pinned font checks passed: " +
    fonts.length +
    " official assets, sizes and hashes.",
);
