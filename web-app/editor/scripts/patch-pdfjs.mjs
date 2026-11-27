// Anchors pdf.js 5's zero-width-mark test, as pdf.js 6 does upstream. pdf.js 5 builds
//   new RegExp("^(\\s)|(\\p{Mn})|(\\p{Cf})$", "u")
// whose middle alternative is unanchored, so any glyph whose text merely contains a combining
// sign (a Devanagari conjunct read from its font: क्ष, त्र, प्र) counts as a zero-width mark. pdf.js
// then measures it as 0 wide and skips its line-break check: text boxes come out short and a
// line-start conjunct joins the line above. pdf.js 6 fixes the pattern but no longer passes font
// names to the page, which the editor needs, so it stays on 5 with this one-line change.
//
// Runs after `npm install` / `npm ci` (postinstall). Fails when a worker build has neither the old
// nor the patched pattern, so a pdf.js update cannot silently drop the fix.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "../node_modules/pdfjs-dist");
const OLD = String.raw`"^(\\s)|(\\p{Mn})|(\\p{Cf})$"`;
const NEW = String.raw`"^(?:(\\s+)|(\\p{Mn}+)|(\\p{Cf}+))$"`;
const files = ["legacy/build/pdf.worker.mjs", "legacy/build/pdf.worker.min.mjs", "build/pdf.worker.mjs", "build/pdf.worker.min.mjs"];

let failed = false;
for (const file of files) {
  const full = path.join(root, file);
  const source = readFileSync(full, "utf8");
  if (source.includes(NEW)) {
    console.log(`patch-pdfjs: ${file} already patched`);
  } else if (source.split(OLD).length === 2) {
    writeFileSync(full, source.replace(OLD, NEW));
    console.log(`patch-pdfjs: ${file} patched`);
  } else {
    console.error(`patch-pdfjs: ${file}: zero-width-mark pattern not found exactly once; check the pdf.js version`);
    failed = true;
  }
}
if (failed) process.exit(1);
