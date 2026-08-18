/** Shared FAQ copy — used by the homepage accordion and FAQPage JSON-LD (AEO & GEO). */
export interface FaqItem {
  q: string;
  a: string;
}

export const SITE_FAQS: readonly FaqItem[] = [
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

export const SITE_FAQS_HI: readonly FaqItem[] = [
  {
    q: "क्या मेरी फाइलें किसी सर्वर पर अपलोड होती हैं?",
    a: "नहीं। पीडीएफ एडिट करना, टेक्स्ट बदलना, फाइलों को जोड़ना (Merge), अलग करना (Split) और कंप्रेस करना 100% आपके अपने ब्राउज़र में WebAssembly और Canvas के माध्यम से लोकली होता है। आपके निजी दस्तावेज, सरकारी फॉर्म और पहचान पत्र कभी आपके डिवाइस से बाहर नहीं जाते।",
  },
  {
    q: "अन्य पीडीएफ एडिटर्स में हिंदी के अक्षर और मात्राएं क्यों टूट जाती हैं?",
    a: "देवनागरी लिपि में व्यंजनों और स्वर मात्राओं को जोड़ने के लिए OpenType GSUB और GPOS टेबल्स की आवश्यकता होती है। Canva या Adobe जैसे सामान्य टूल्स 1:1 कैरेक्टर मैपिंग करते हैं, जिससे मात्राएं अलग हो जाती हैं या उल्टी दिखने लगती हैं। Hindi PDF Editor सीधे Chromium HarfBuzz रेंडरिंग का उपयोग करता है, जिससे 'क्ष', 'त्र', 'ज्ञ' और 'कि' जैसी मात्राएं 100% सही बनती हैं।",
  },
  {
    q: "पीडीएफ में सही हिंदी टाइपिंग कैसे करें?",
    a: "Hindi PDF Editor में अपनी पीडीएफ खोलें, किसी भी टेक्स्ट लाइन पर क्लिक करें या खाली जगह पर टैप करें। इसके बाद अपने फोन या कंप्यूटर के किसी भी मानक हिंदी कीबोर्ड (Google Input Tools, Mangal, InScript) से टाइप करें। एडिटर रीयल-टाइम में सही देवनागरी फोंट रेंडर करता है।",
  },
  {
    q: "क्या मैं सरकारी एडमिट कार्ड, खसरा-खतौनी या कोर्ट एफिडेविट एडिट कर सकता हूं?",
    a: "हाँ। यह एडिटर विशेष रूप से भारतीय सरकारी और कानूनी दस्तावेजों जैसे BPSC, UP Police, SSC के एडमिट कार्ड, भूलेख खसरा-खतौनी, शपथ पत्र और अंक तालिकाओं में बिना फॉन्ट खराब किए सुधार करने के लिए बनाया गया है।",
  },
  {
    q: "हिंदी ↔ अंग्रेजी पीडीएफ अनुवाद कैसे काम करता है?",
    a: "ट्रांसलेट टूल चुनें। एडिटर पेज के टेक्स्ट की पहचान करता है और आपकी सहमति के बाद सुरक्षित AI प्रॉक्सी के जरिए अनुवाद करता है। अनुवाद मूल पीडीएफ के लेआउट में बिल्कुल सटीक जगह पर सेट होता है।",
  },
  {
    q: "क्या मैं स्कैन किए गए हिंदी पीडीएफ एडिट कर सकता हूं?",
    a: "हाँ। इन-बिल्ट स्मार्ट OCR टूल के जरिए स्कैन किए गए पेजों और फोटो में से हिंदी और अंग्रेजी टेक्स्ट को आसानी से पहचानें और एडिट करें।",
  },
  {
    q: "क्या यह मेरी मूल (ओरिजिनल) पीडीएफ फाइल को ओवरराइट करता है?",
    a: "बिल्कुल नहीं। प्रत्येक संपादन पर एक नया, हाई-क्वालिटी एक्सपोर्ट पीडीएफ तैयार होता है। आपकी मूल फाइल आपके डिवाइस पर पूरी तरह सुरक्षित और अपरिवर्तित रहती है।",
  },
  {
    q: "क्या मैं इसे मोबाइल और टैबलेट पर चला सकता हूं?",
    a: "हाँ। आप मोबाइल ब्राउज़र (Chrome, Safari) में बिना कुछ इंस्टॉल किए इस्तेमाल कर सकते हैं, या गूगल प्ले स्टोर से हमारा एंड्रॉयड ऐप डाउनलोड कर सकते हैं।",
  },
  {
    q: "क्या Hindi PDF Editor पूरी तरह फ्री है?",
    a: "हाँ, पीडीएफ एडिटिंग, ट्रांसलेशन, मर्ज, स्प्लिट और कंप्रेशन के सभी टूल्स 100% फ्री हैं। कोई वाटरमार्क, कोई खाता और कोई शुल्क नहीं है।",
  },
] as const;

export function getFaqs(lang: 'en' | 'hi'): readonly FaqItem[] {
  return lang === 'hi' ? SITE_FAQS_HI : SITE_FAQS;
}
