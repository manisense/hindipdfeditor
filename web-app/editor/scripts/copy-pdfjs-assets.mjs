// Copies pdf.js runtime data from the installed pdfjs-dist into public/pdfjs, so the editor serves
// it itself: character maps (CJK and other predefined CMaps), standard font data (non-embedded
// fonts such as Helvetica or ZapfDingbats), WebAssembly image decoders (JPEG 2000, which many
// scanned PDFs use, and JBIG2) and ICC profiles. Without them pdf.js leaves such images blank and
// such text unreadable. Run before `vite` and `vite build`.
import { cpSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const editor = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(editor, "node_modules", "pdfjs-dist");
const out = path.join(editor, "public", "pdfjs");
const folders = ["cmaps", "standard_fonts", "wasm", "iccs"];

rmSync(out, { recursive: true, force: true });
for (const folder of folders) cpSync(path.join(source, folder), path.join(out, folder), { recursive: true });
console.log(`copy-pdfjs-assets: ${folders.join(", ")} → public/pdfjs`);
