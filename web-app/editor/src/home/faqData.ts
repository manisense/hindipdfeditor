/** Shared FAQ copy — used by the homepage accordion and FAQPage JSON-LD (AEO & GEO). */
export const SITE_FAQS = [
  {
    q: "Are my files uploaded to a server?",
    a: "No. Core editing, text replacement, merging, splitting, and compression run 100% locally in your browser via WebAssembly and Canvas. Your private documents, government forms, and IDs never leave your device.",
  },
  {
    q: "Why do Hindi letters and matras break in other PDF editors?",
    a: "Devanagari is an abugida script requiring OpenType substitution (GSUB) and positioning (GPOS) tables to combine consonants and vowel matras into conjunct glyphs. Standard tools like Canva or Adobe Acrobat often use naive 1:1 character mapping, detaching matras. Hindi PDF Editor renders via a Chromium HarfBuzz pipeline, guaranteeing 100% correct ligature shaping.",
  },
  {
    q: "How do I type Hindi in a PDF without broken fonts?",
    a: "Open your PDF in Hindi PDF Editor, tap on any text line or blank area, and type using standard Unicode Devanagari (via Google Input Tools, InScript keyboard, or mobile Hindi keyboard). The editor automatically shapes conjuncts like 'क्ष', 'त्र', 'ज्ञ' and complex matras in real time.",
  },
  {
    q: "Can I edit Government exam admit cards, land records, or legal affidavits?",
    a: "Yes. Hindi PDF Editor is designed for official Hindi documents including Sarkari admit cards (BPSC, UPPSC, SSC), land records (Khasra-Khatauni), legal affidavits, marks sheets, and office circulars without corrupting font layouts.",
  },
  {
    q: "How does Hindi ↔ English PDF translation work?",
    a: "Select the Translate tool to detect Hindi or English text. The lines are processed through our secure Gemini AI proxy only after your explicit confirmation. The translation is aligned back onto your PDF layout, and your original document is never overwritten.",
  },
  {
    q: "Can I edit scanned or image-based Hindi PDFs?",
    a: "Yes. Use our built-in OCR detection tool to recognize printed Hindi (Devanagari) and English text inside scanned PDF pages and images, allowing you to copy, edit, or translate the content directly.",
  },
  {
    q: "Does Hindi PDF Editor overwrite my original PDF file?",
    a: "Never. Every edit produces a brand-new, high-resolution exported PDF file. Your source document remains completely untouched and safe on your device.",
  },
  {
    q: "Can I use Hindi PDF Editor on mobile and tablet?",
    a: "Yes. You can use the web editor directly in any modern mobile browser (Chrome, Safari, Firefox) with no installation, or install the native Android app from the Google Play Store for a touch-optimized mobile experience.",
  },
  {
    q: "Is Hindi PDF Editor free?",
    a: "Yes, the full suite of PDF editing, translation, merging, splitting, and compression tools is 100% free with no account, subscription, or watermark required.",
  },
] as const;

