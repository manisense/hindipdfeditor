# Autonomous work log

Running log of work done while the owner is away (from 27 November 2026). Newest at the top. Each entry: what, evidence, where it lives, what is left. Branches stay local unless stated.

## 27 Nov 2026

- **PR #83 merged: web Plan B trial** (Gemini 4 Neon's work, reviewed and re-verified here). Off by default (`?planB=1`). Review caught a silent bug in Neon's first version: ToUnicode left contextual glyphs unmapped, so pdf.js and our own PDF to Word read edits as `सूयǺ … ȡकताब` while `pdftotext` looked right. Neon's fix maps every glyph; the gate now re-reads exports with pdf.js, in the editor and through PDF to Word. Merged branch: tests 487/487, gate 24/24 (on) and 23/23 (off), smoke clean, benchmark unchanged. Cost of Neon: about $15–20 build + $5 fix.
- **PR #82 merged and verified on production**: RRB p2 PDF to Word 100 % on hindipdfeditor.com (digital 100 %, scan 99.3 %).
- **Parked on `wip/drawing-order-repair`** (pushed, not merged): the second kind of broken Word map (CEN 08/2024: ToUnicode in drawing order, ligatures unmapped). Font repair makes letters exact and page 70 converts in 1.6 s instead of 17.2 s, but the producer leaves gaps inside words (आरक्ष ण, योग्य ता); the subtitles dictionary lacks formal words, so dictionary share is 0.830 vs 0.872 for today's OCR path. Next: handle those gaps geometrically (glyph advances from the font's hmtx vs pen moves), or build a formal-Hindi word list from government notices.

- **Font forensics shipped on `feat/ocr-benchmark-opus`** (web ADR 0022): mis-mapped ToUnicode rebuilt from the embedded font on a read-only copy, ि/reph reordered, dictionary check for repaired fonts, zero-width run joins. RRB p2 PDF to Word **64.5 % → 100 %** (141/141), 6.0 → 2.9 s; sample notice digital 100 %, scan 99.3 % (no regression). Tests 469/469, gate 23/23, smoke clean. Ground truth kept outside git in `pdfs-for-testing/truth/`.

- **Neon fix run started** (pid 9581) on `feat/plan-b-neon` for the ToUnicode bug found in review (Plan B export reads as garbage in pdf.js and in our own PDF to Word). Task: `neon-fix.md` in the session scratchpad. Review pending.
- **Font forensics (own-solutions idea 1) started** on `feat/ocr-benchmark-opus`: repair a mis-mapped ToUnicode from the embedded font's cmap + GSUB, on an in-memory copy used for reading only. Baseline (red): RRB notice p2, editor PDF to Word 64.5 % (91/141 words).
