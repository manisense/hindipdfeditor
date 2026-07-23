/** Shared FAQ copy — used by the homepage accordion and FAQPage JSON-LD (AEO). */
export const SITE_FAQS = [
  {
    q: "Are my files uploaded to a server?",
    a: "No. The core tools run locally in your browser or on your Android device. Your PDFs stay on your device — nothing is uploaded, and you do not need an account.",
  },
  {
    q: "Will Hindi text stay correct after editing?",
    a: "Yes. Shaping goes through a real browser engine, so Devanagari conjuncts, matras and reph render exactly as they should — no broken glyphs or mis-joined characters.",
  },
  {
    q: "Does it change my original PDF?",
    a: "Never. Every edit exports a fresh copy and your original file is left untouched, so you can always go back.",
  },
  {
    q: "What can I actually do with a PDF here?",
    a: "Edit and replace Hindi text, add new text, translate to English, run OCR, and merge, split or compress documents — all in one place.",
  },
  {
    q: "How does translation work?",
    a: "Translation and optional AI OCR use our secured Gemini proxy after an explicit action; no API key is entered or stored in your browser. The original PDF is never overwritten.",
  },
  {
    q: "Is Hindi PDF Editor free?",
    a: "Yes, the tools are free to use on the web, and the same toolkit is available as an Android app on Google Play.",
  },
] as const;
