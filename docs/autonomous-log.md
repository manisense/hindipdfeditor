# Autonomous work log

Running log of work done while the owner is away (from 27 November 2026). Newest at the top. Each entry: what, evidence, where it lives, what is left. Branches stay local unless stated.

## 27 Nov 2026

- **Font forensics shipped on `feat/ocr-benchmark-opus`** (web ADR 0022): mis-mapped ToUnicode rebuilt from the embedded font on a read-only copy, ि/reph reordered, dictionary check for repaired fonts, zero-width run joins. RRB p2 PDF to Word **64.5 % → 100 %** (141/141), 6.0 → 2.9 s; sample notice digital 100 %, scan 99.3 % (no regression). Tests 469/469, gate 23/23, smoke clean. Ground truth kept outside git in `pdfs-for-testing/truth/`.

- **Neon fix run started** (pid 9581) on `feat/plan-b-neon` for the ToUnicode bug found in review (Plan B export reads as garbage in pdf.js and in our own PDF to Word). Task: `neon-fix.md` in the session scratchpad. Review pending.
- **Font forensics (own-solutions idea 1) started** on `feat/ocr-benchmark-opus`: repair a mis-mapped ToUnicode from the embedded font's cmap + GSUB, on an in-memory copy used for reading only. Baseline (red): RRB notice p2, editor PDF to Word 64.5 % (91/141 words).
