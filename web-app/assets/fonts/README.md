# Public UI fonts

These are existing design-system families, served locally to eliminate third-party font CSS from the public rendering path. They do not change the PDF editor's font catalog or export fonts.

`manifest.json` pins official Google Fonts asset URLs, exact byte sizes and SHA-256 digests. Binary files are committed; production never fetches mutable font URLs. `check-fonts.mjs` checks WOFF2 signatures, sizes and hashes. Keep the accompanying SIL Open Font License files.

Inter v20 Latin and Noto Sans Devanagari v30 Devanagari/Latin subsets have verified `wght` axes from 100 to 900. Public CSS advertises the used 400–800 range, with swap display and the official subset Unicode ranges. New text outside these subsets falls back through the design-system font stack.

If a future font update changes bytes, add a new versioned filename and reviewed manifest entry. Verify real Hindi headings and the shaping fixture before replacing a public family; do not overwrite the export pipeline's font files.
