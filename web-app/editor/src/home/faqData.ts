/** Shared visible FAQ copy and structured data; reviewed for actual product limits. */
export interface FaqItem {
  q: string;
  a: string;
}
export const SITE_FAQS: readonly FaqItem[] = [
  {
    q: "Are my files uploaded?",
    a: "Core editing, merging, splitting and compression stay on your device. Optional AI OCR and translation send approved text or page images through our secured API to Google Gemini. Read the consent screen before using them.",
  },
  {
    q: "How do I type Hindi?",
    a: "Use a Unicode Hindi keyboard such as InScript or your phone’s Hindi keyboard. Add a text box or replace detected text, then review the letters and placement before exporting.",
  },
  {
    q: "Can I edit scanned or legacy-font PDFs?",
    a: "Scans require text detection and its accuracy varies. Identified legacy fonts may use a confirmed raster-only Unicode replacement workflow. This does not decode the old font. Unknown encodings remain blocked.",
  },
  {
    q: "Does export overwrite the original?",
    a: "No. Export produces a new PDF. Browser exports are image-based; review readability because the exported text may not be selectable.",
  },
  {
    q: "Can editing a PDF correct an official record?",
    a: "No. Use the issuing authority’s correction process. The editor can help prepare blank forms, applications or clearly labelled drafts; editing a downloaded record does not change the official record.",
  },
  {
    q: "Is the editor free?",
    a: "Core browser tools are available without an account. AI features have usage limits and availability checks shown in the tool. Review the current limits before starting AI processing.",
  },
];
export const SITE_FAQS_HI: readonly FaqItem[] = [
  {
    q: "क्या मेरी फ़ाइल अपलोड होती है?",
    a: "सामान्य एडिटिंग, मर्ज, स्प्लिट और कंप्रेशन आपके डिवाइस पर होते हैं। वैकल्पिक AI OCR और अनुवाद आपकी सहमति से टेक्स्ट या पेज इमेज सुरक्षित API के जरिए Google Gemini को भेजते हैं। पहले सहमति स्क्रीन पढ़ें।",
  },
  {
    q: "हिंदी कैसे टाइप करें?",
    a: "InScript या अपने फोन का यूनिकोड हिंदी कीबोर्ड इस्तेमाल करें। टेक्स्ट बॉक्स जोड़ें या पहचाने गए टेक्स्ट की जगह नया टेक्स्ट रखें। एक्सपोर्ट से पहले अक्षर और स्थिति जांचें।",
  },
  {
    q: "क्या स्कैन या पुराने फ़ॉन्ट वाली PDF एडिट हो सकती है?",
    a: "स्कैन में टेक्स्ट पहचान जरूरी है और उसकी सटीकता बदल सकती है। पहचाने गए पुराने फ़ॉन्ट में चेतावनी के बाद यूनिकोड टेक्स्ट रखा जा सकता है; इससे पुराना फ़ॉन्ट डिकोड नहीं होता। अज्ञात एन्कोडिंग में एडिटिंग रोकी जाती है।",
  },
  {
    q: "क्या मूल PDF बदल जाती है?",
    a: "नहीं। एक्सपोर्ट से नई PDF बनती है। ब्राउज़र एक्सपोर्ट इमेज आधारित है; स्पष्टता जांचें क्योंकि टेक्स्ट चुनकर कॉपी करना संभव नहीं हो सकता।",
  },
  {
    q: "क्या PDF एडिट करने से सरकारी रिकॉर्ड सुधरता है?",
    a: "नहीं। संबंधित विभाग की आधिकारिक सुधार प्रक्रिया अपनाएं। एडिटर से खाली फॉर्म, आवेदन या स्पष्ट रूप से चिह्नित ड्राफ्ट तैयार कर सकते हैं; डाउनलोड किया हुआ रिकॉर्ड बदलने से विभाग का रिकॉर्ड नहीं बदलता।",
  },
  {
    q: "क्या एडिटर फ्री है?",
    a: "सामान्य ब्राउज़र टूल बिना खाता बनाए उपलब्ध हैं। AI सुविधाओं की उपयोग सीमा और उपलब्धता टूल में दिखाई जाती है। AI प्रोसेसिंग शुरू करने से पहले वर्तमान सीमा देखें।",
  },
];
export function getFaqs(lang: "en" | "hi"): readonly FaqItem[] {
  return lang === "hi" ? SITE_FAQS_HI : SITE_FAQS;
}
