/** Shared FAQ copy — used by the homepage accordion and FAQPage JSON-LD (AEO & GEO). */
export interface FaqItem {
  q: string;
  a: string;
}

export const SITE_FAQS: readonly FaqItem[] = [
  {
    q: "Are my files uploaded to a server?",
    a: "Not for editing. Opening, editing, merging, splitting and compressing run in your browser, and the PDF stays on your device. Two optional AI features send data to our server, only after you confirm: translation sends the detected text, and AI text recognition sends page images of scanned pages.",
  },
  {
    q: "Why do Hindi letters and matras break in other PDF editors?",
    a: "Devanagari needs a text-shaping engine to join consonants and vowel signs into conjuncts and matras. When a PDF tool edits existing Hindi text without that shaping, matras land in the wrong place or split off. Hindi PDF Editor has the browser's own shaping engine draw every new line of Hindi text, the same one that renders Hindi web pages, so conjuncts and matras come out joined.",
  },
  {
    q: "How do I type Hindi in a PDF without broken fonts?",
    a: "Open your PDF in Hindi PDF Editor, tap a text line or a blank area, and type in Unicode Devanagari with Google Input Tools, an InScript keyboard or your phone's Hindi keyboard. Conjuncts such as 'क्ष', 'त्र', 'ज्ञ' and matras are shaped as you type.",
  },
  {
    q: "Can I use it for government forms and affidavits?",
    a: "Use it for documents you are entitled to change: filling in blank forms, preparing affidavits and applications, and fixing your own drafts. Do not alter documents issued by an authority, such as admit cards, mark sheets or land records. A correction to those has to come from the issuing office, and an edited copy can be treated as forgery.",
  },
  {
    q: "How does Hindi ↔ English PDF translation work?",
    a: "Open the Translate tool. It reads the Hindi or English text on each page, and after you confirm, sends those lines to our Gemini-based translation service. The translation is placed back onto the page, and your original file is never modified.",
  },
  {
    q: "Can I edit scanned or image-based Hindi PDFs?",
    a: "Yes. Scanned pages are read with text recognition in your browser. For hard-to-read pages you can choose AI text recognition, which sends the page image to our server after you confirm.",
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
    a: "Yes. Editing, translation, merging, splitting and compression are free, with no account, subscription or watermark.",
  },
] as const;

export const SITE_FAQS_HI: readonly FaqItem[] = [
  {
    q: "क्या मेरी फाइलें किसी सर्वर पर अपलोड होती हैं?",
    a: "एडिटिंग के लिए नहीं। फाइल खोलना, एडिट, मर्ज, स्प्लिट और कंप्रेस आपके ब्राउज़र में होते हैं और पीडीएफ आपके डिवाइस पर ही रहती है। दो वैकल्पिक AI फीचर आपकी पुष्टि के बाद ही हमारे सर्वर को डेटा भेजते हैं: अनुवाद पहचाना गया टेक्स्ट भेजता है, और AI टेक्स्ट पहचान स्कैन पेज की इमेज भेजती है।",
  },
  {
    q: "अन्य पीडीएफ एडिटर्स में हिंदी के अक्षर और मात्राएं क्यों टूट जाती हैं?",
    a: "देवनागरी में व्यंजनों और मात्राओं को जोड़कर संयुक्ताक्षर बनाने के लिए टेक्स्ट-शेपिंग इंजन चाहिए। जब कोई पीडीएफ टूल बिना इस शेपिंग के मौजूदा हिंदी टेक्स्ट एडिट करता है, तो मात्राएं गलत जगह चली जाती हैं या अलग हो जाती हैं। Hindi PDF Editor में हर नई हिंदी लाइन ब्राउज़र का वही शेपिंग इंजन बनाता है जो हिंदी वेब पेज दिखाता है, इसलिए 'क्ष', 'त्र', 'ज्ञ' और 'कि' जुड़े हुए बनते हैं।",
  },
  {
    q: "पीडीएफ में सही हिंदी टाइपिंग कैसे करें?",
    a: "Hindi PDF Editor में अपनी पीडीएफ खोलें, किसी टेक्स्ट लाइन या खाली जगह पर टैप करें और किसी भी यूनिकोड हिंदी कीबोर्ड (Google Input Tools, InScript या फोन का हिंदी कीबोर्ड) से टाइप करें। टाइप करते समय ही अक्षर सही आकार में जुड़ते हैं।",
  },
  {
    q: "क्या मैं इसे सरकारी फॉर्म और शपथ पत्र के लिए इस्तेमाल कर सकता हूं?",
    a: "इसे उन दस्तावेजों के लिए इस्तेमाल करें जिन्हें बदलने का आपको अधिकार है: खाली फॉर्म भरना, शपथ पत्र और आवेदन तैयार करना, और अपने ड्राफ्ट सुधारना। एडमिट कार्ड, अंक तालिका या भूलेख जैसे किसी विभाग द्वारा जारी दस्तावेज में बदलाव न करें। उनमें सुधार जारी करने वाले कार्यालय से ही होता है, और बदली हुई कॉपी जालसाजी मानी जा सकती है।",
  },
  {
    q: "हिंदी ↔ अंग्रेजी पीडीएफ अनुवाद कैसे काम करता है?",
    a: "ट्रांसलेट टूल खोलें। यह हर पेज का हिंदी या अंग्रेजी टेक्स्ट पढ़ता है और आपकी पुष्टि के बाद उन लाइनों को Gemini आधारित अनुवाद सर्विस को भेजता है। अनुवाद पेज पर वापस लगाया जाता है और मूल फाइल कभी नहीं बदलती।",
  },
  {
    q: "क्या मैं स्कैन किए गए हिंदी पीडीएफ एडिट कर सकता हूं?",
    a: "हाँ। स्कैन पेज का टेक्स्ट आपके ब्राउज़र में पहचाना जाता है। मुश्किल पेजों के लिए आप AI टेक्स्ट पहचान चुन सकते हैं, जो आपकी पुष्टि के बाद पेज की इमेज हमारे सर्वर को भेजती है।",
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
    a: "हाँ। एडिटिंग, अनुवाद, मर्ज, स्प्लिट और कंप्रेशन फ्री हैं। कोई वॉटरमार्क, खाता या शुल्क नहीं।",
  },
] as const;

export function getFaqs(lang: 'en' | 'hi'): readonly FaqItem[] {
  return lang === 'hi' ? SITE_FAQS_HI : SITE_FAQS;
}
