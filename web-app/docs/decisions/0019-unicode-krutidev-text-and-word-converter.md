# 0019 — Unicode ↔ KrutiDev converter for text and Word files

Date: 26 November 2026

## Decision

A new tool at `/tools/unicode-to-krutidev/` (`FontConverterTool`) converts Hindi between Unicode and KrutiDev 010 in both directions, for pasted text and for Word (.docx) files, in the browser.

- Unicode → KrutiDev is our own code (`unicodeToKrutiDev.ts`): ि moves before its consonant cluster (`f`), a reph moves after its syllable before ं/ँ (`Z`), then a longest-match table. Forms follow what KrutiDev typists type (प्र `iz`, ऑ `vkW`, केन्द्र `dsUnz`). Characters KrutiDev has no key for are kept and listed, never dropped. Every mapping is checked by converting back with `krutiDevToUnicode`, over hand-typed KrutiDev from a real notice and 328 sentences from the site's Hindi pages.
- A .docx is converted in place (`docxFontConversion.ts`, JSZip and the browser's XML parser): Unicode → KrutiDev converts Devanagari stretches and sets them in "Kruti Dev 010", splitting English words into their own runs so they keep their font. KrutiDev → Unicode converts only runs whose font resolves (run, character style, paragraph style, defaults) to the KrutiDev family and sets them in Mangal; other fonts are not touched, so English is never read as KrutiDev. Syllables Word split across runs are rejoined first. Size, bold and italic are copied between Word's Latin and complex-script slots, because KrutiDev text uses the first and Unicode Devanagari the second.
- The KrutiDev PDF page (ADR 0017) links to this tool for text and Word files.
- `krutiDevToUnicode` gets two fixes found by the round trip: the LTRC table read `pkS` as चै (it is चौ), and ि could stay before a virama in long clusters (स्टि्र for स्ट्रि).

## Reason

Search data (`reports/Hindi PDF editor market study.md`) puts legacy-font conversion at about 400,000 searches a month in India, held by small sites, and the two largest terms ("mangal to kruti", "unicode to krutidev") are the direction the site did not have. ADR 0017 rejected a plain-text box as new code when only the PDF case was known; that demand changes the call. Offices and typing tests still use KrutiDev while courts and ministries move to Unicode, so both directions are needed.

## Rejected

- Converting to a KrutiDev PDF: it needs the KrutiDev font embedded, whose licence is unclear. Output is text or .docx shown in the user's own font.
- Mangal vs Nirmala UI for Unicode output: PDF to Word uses Nirmala UI; this tool uses Mangal because "KrutiDev to Mangal" is how people search, and Mangal ships with every Windows version.
- Chanakya and other legacy fonts: still blocked (AGENTS.md); they need their own decision.
- A separate Hindi URL: ADR 0005 keeps language a UI toggle.
