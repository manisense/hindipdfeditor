# 0023: Patch pdf.js 5's zero-width-mark test at install time

Date: 27 November 2026. Status: accepted.

## Context

pdf.js 5.5 decides whether a glyph is a zero-width mark with `new RegExp("^(\\s)|(\\p{Mn})|(\\p{Cf})$", "u")`. The middle alternative is unanchored, so any glyph whose text merely contains a combining sign counts as a mark: every Devanagari conjunct or matra glyph whose ToUnicode (or our ADR 0022 repair) names it with a virama or sign (क्ष, त्र, प्र, हु). pdf.js then measures it as 0 wide and skips its line-break check. Effects seen on real files: line boxes short by up to 50 pt on Gazette of India pages (OCR crops cut the end of each line, so glyph repair could not confirm lines), words split inside conjuncts in PDF to Word (व्य क्ति, उम् मीदवारों, प्र माण: dozens per document), and a line-start conjunct joined to the line above (worked around in PR #96).

pdf.js 6 anchors the pattern (`^(?:(\s+)|(\p{Mn}+)|(\p{Cf}+))$`), but it also stops passing a font's real name to the page, which the editor needs (KrutiDev detection, font style matching, repaired-font lines).

## Decision

Stay on pdf.js 5 and replace that one pattern with pdf.js 6's in the four worker builds, from `editor/scripts/patch-pdfjs.mjs` run as `postinstall`. The script fails the install when a build has neither pattern, so a pdf.js update cannot silently drop the fix. The PR #96 workaround (moving line-start conjuncts between text items) is removed: with the fix it is unneeded and split उपलब्ध on CEN p70.

## Rejected

- Upgrading to pdf.js 6 now: needs a new source of font names first (a separate change).
- Correcting widths afterwards from the operator list: duplicates pdf.js's layout and still misses its line-break check.

## Evidence

`pdfjsMarkPatch.test.ts` (no zero-width Devanagari items in the mis-mapped fixture; red before). Gazette of India page 1: 81.0 % → 82.1 % of Hindi words; CEN p70 620/620, RRB p2 141/141, notices unchanged; whole files against production: RRB words in the word list 16 282 → 16 313, CEN 22 194 → 22 246.
