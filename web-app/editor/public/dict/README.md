# Hindi spell-check word list

`hi-words.txt` holds about 19,700 Devanagari words, commonest first, used by the editor's Hindi spell
check (`src/lib/hindiSpell.ts`). It is loaded only when the spell check runs and never leaves the
browser.

Source: [FrequencyWords](https://github.com/hermitdave/FrequencyWords) by Hermit Dave,
`content/2018/hi/hi_full.txt`, built from OpenSubtitles. The repository is under the MIT
licence (Copyright (c) 2016 Hermit Dave); its README describes the word lists as CC BY-SA 4.0.
This file is a filtered derivative (Devanagari words only, NFC) and is shared under the same
terms. Regenerate with `node web-app/scripts/build-hindi-dictionary.mjs <hi_full.txt>`.
