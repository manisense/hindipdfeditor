// Builds editor/public/dict/hi-words.txt, the Hindi spell-check word list, from FrequencyWords
// (https://github.com/hermitdave/FrequencyWords, content/2018/hi/hi_full.txt; MIT licence,
// built from OpenSubtitles). Keeps Devanagari words only, NFC, commonest first, one per line.
//   node web-app/scripts/build-hindi-dictionary.mjs /path/to/hi_full.txt
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = process.argv[2];
if (!source) throw new Error("usage: build-hindi-dictionary.mjs <hi_full.txt>");
const here = path.dirname(fileURLToPath(import.meta.url));
const seen = new Set();
const words = [];
for (const line of readFileSync(source, "utf8").split("\n")) {
  const word = line.split(" ")[0]?.normalize("NFC");
  if (!word || !/^[ऀ-ॣॱ-ॿ]+$/u.test(word) || seen.has(word)) continue;
  seen.add(word);
  words.push(word);
}
const out = path.join(here, "../editor/public/dict/hi-words.txt");
writeFileSync(out, words.join("\n") + "\n");
console.log(`wrote ${words.length} words to ${out}`);
