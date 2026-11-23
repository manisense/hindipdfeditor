import type { Language } from "./i18n";
import type { ToolId } from "./tools";

/**
 * Below-the-fold help for each tool page: steps, limits, questions and related guides.
 * Every claim here must match the tool's code (AGENTS.md "Public claims must match the code").
 * The English copy also feeds the tool page's FAQPage JSON-LD.
 */
export type ToolGuideCopy = {
  heading: string;
  steps: readonly { title: string; body: string }[];
  notes: readonly string[];
  faqs: readonly { q: string; a: string }[];
};

export type ToolGuide = {
  en: ToolGuideCopy;
  hi: ToolGuideCopy;
  /** Article slugs under /articles/ that answer follow-up questions. */
  guides: readonly string[];
};

const ORIGINAL_EN = "Your original file is never changed; every download is a new PDF.";
const ORIGINAL_HI = "आपकी मूल फाइल कभी नहीं बदलती; हर डाउनलोड एक नई पीडीएफ होती है।";
const LOCAL_EN = "Processing runs in your browser and the file stays on your device.";
const LOCAL_HI = "काम आपके ब्राउज़र में होता है और फाइल आपके डिवाइस पर ही रहती है।";

export const TOOL_GUIDES: Record<ToolId, ToolGuide> = {
  edit: {
    guides: ["how-to-edit-hindi-pdf", "fix-broken-hindi-fonts-in-pdf", "kruti-dev-to-unicode-hindi-pdf-editor"],
    en: {
      heading: "How to edit a Hindi PDF",
      steps: [
        { title: "Open your PDF", body: "Select or drop a PDF. Text lines are found from the file itself, and scanned pages are read with text recognition in your browser." },
        { title: "Tap text and type", body: "Tap a line to change it, or add new text anywhere. Type Hindi with any Unicode keyboard or in Roman letters; conjuncts and matras stay joined." },
        { title: "Download a new PDF", body: "Pages you did not touch are copied unchanged. Replaced words are removed from the page and your new words are placed in their spot." },
      ],
      notes: [
        LOCAL_EN,
        "New words are drawn as images, so they are not searchable or selectable.",
        "Any edit invalidates a digital signature on the document.",
        "KrutiDev pages are converted to Unicode and every line is shown for your review. Other legacy fonts stay blocked.",
      ],
      faqs: [
        { q: "Can I edit a scanned Hindi PDF?", a: "Yes. Scanned pages are read with text recognition in your browser. Replaced text is cleaned from the scan and your new words are placed on the page." },
        { q: "Why do my matras stay joined here?", a: "Every new line of Hindi is drawn by the browser's own text-shaping engine, the same one that shows Hindi web pages, so conjuncts like क्ष, त्र and ज्ञ come out correct." },
        { q: "Can I change an admit card or a mark sheet?", a: "No. Do not alter documents issued by an authority. Ask the issuing office for a correction, or use its correction window." },
      ],
    },
    hi: {
      heading: "हिंदी पीडीएफ कैसे एडिट करें",
      steps: [
        { title: "पीडीएफ खोलें", body: "पीडीएफ चुनें या यहाँ छोड़ें। टेक्स्ट लाइनें फाइल से पढ़ी जाती हैं, और स्कैन पेज आपके ब्राउज़र में टेक्स्ट पहचान से पढ़े जाते हैं।" },
        { title: "टेक्स्ट पर टैप करके लिखें", body: "किसी लाइन पर टैप करके उसे बदलें या कहीं भी नया टेक्स्ट जोड़ें। किसी भी यूनिकोड कीबोर्ड या रोमन अक्षरों में हिंदी लिखें; संयुक्ताक्षर और मात्राएं जुड़ी रहती हैं।" },
        { title: "नई पीडीएफ डाउनलोड करें", body: "जिन पेजों को आपने नहीं छुआ वे जैसे थे वैसे रहते हैं। बदले गए शब्द पेज से हटाए जाते हैं और नए शब्द उसी जगह लगते हैं।" },
      ],
      notes: [
        LOCAL_HI,
        "नए शब्द इमेज के रूप में बनते हैं, इसलिए उन्हें खोजा या चुना नहीं जा सकता।",
        "कोई भी बदलाव दस्तावेज़ के डिजिटल हस्ताक्षर को अमान्य कर देता है।",
        "कृतिदेव पेज यूनिकोड में बदले जाते हैं और हर लाइन आपकी जाँच के लिए दिखाई जाती है। बाकी पुराने फॉन्ट बंद रहते हैं।",
      ],
      faqs: [
        { q: "क्या स्कैन की गई हिंदी पीडीएफ एडिट हो सकती है?", a: "हाँ। स्कैन पेज आपके ब्राउज़र में टेक्स्ट पहचान से पढ़े जाते हैं। बदला गया टेक्स्ट स्कैन से साफ किया जाता है और नए शब्द पेज पर लगते हैं।" },
        { q: "यहाँ मात्राएं क्यों नहीं टूटतीं?", a: "हर नई हिंदी लाइन ब्राउज़र का वही शेपिंग इंजन बनाता है जो हिंदी वेब पेज दिखाता है, इसलिए क्ष, त्र और ज्ञ जैसे संयुक्ताक्षर सही बनते हैं।" },
        { q: "क्या मैं एडमिट कार्ड या अंक तालिका बदल सकता हूँ?", a: "नहीं। किसी विभाग द्वारा जारी दस्तावेज़ में बदलाव न करें। सुधार के लिए जारी करने वाले कार्यालय या उसकी सुधार विंडो का इस्तेमाल करें।" },
      ],
    },
  },
  sign: {
    guides: ["parimarjan-plus-affidavit-pdf-guide", "name-correction-application-and-affidavit-guide"],
    en: {
      heading: "How to sign a PDF",
      steps: [
        { title: "Open your PDF", body: "Select the document you need to sign." },
        { title: "Make your signature", body: "Draw it, type your name in Hindi or English, or upload a photo of your signature." },
        { title: "Place it and download", body: "Drag it into place on one page, or put it on every page or chosen pages at the same spot, then download the signed copy." },
      ],
      notes: [
        LOCAL_EN,
        "This adds an electronic signature image, not a certificate-based digital signature.",
        ORIGINAL_EN,
      ],
      faqs: [
        { q: "Is this a digital signature?", a: "No. It places an image of your signature on the page. Offices that require a certificate-based digital signature (DSC) need a different tool." },
        { q: "Can I sign every page at once?", a: "Yes. Choose every page or a set of pages and the signature goes to the same spot on each. You can still move it on any single page." },
      ],
    },
    hi: {
      heading: "पीडीएफ पर हस्ताक्षर कैसे करें",
      steps: [
        { title: "पीडीएफ खोलें", body: "वह दस्तावेज़ चुनें जिस पर हस्ताक्षर करना है।" },
        { title: "हस्ताक्षर बनाएं", body: "हाथ से बनाएं, हिंदी या अंग्रेज़ी में अपना नाम लिखें, या अपने हस्ताक्षर की फोटो लगाएं।" },
        { title: "लगाएं और डाउनलोड करें", body: "एक पेज पर खींचकर रखें, या हर पेज या चुने हुए पेजों पर एक ही जगह लगाएं, फिर हस्ताक्षर वाली कॉपी डाउनलोड करें।" },
      ],
      notes: [
        LOCAL_HI,
        "यह हस्ताक्षर की इमेज लगाता है, प्रमाणपत्र वाला डिजिटल हस्ताक्षर नहीं।",
        ORIGINAL_HI,
      ],
      faqs: [
        { q: "क्या यह डिजिटल हस्ताक्षर है?", a: "नहीं। यह पेज पर आपके हस्ताक्षर की इमेज लगाता है। जहाँ प्रमाणपत्र वाला डिजिटल हस्ताक्षर (DSC) चाहिए, वहाँ अलग टूल लगेगा।" },
        { q: "क्या एक साथ हर पेज पर हस्ताक्षर हो सकते हैं?", a: "हाँ। हर पेज या कुछ पेज चुनें, हस्ताक्षर हर पेज पर एक ही जगह लगेगा। किसी एक पेज पर आप उसे अलग से खिसका भी सकते हैं।" },
      ],
    },
  },
  "fill-form": {
    guides: ["swapramanit-ghoshna-patra-edistrict-hindi-pdf", "parimarjan-plus-affidavit-pdf-guide"],
    en: {
      heading: "How to fill a PDF form in Hindi",
      steps: [
        { title: "Open the form", body: "Select a PDF that has its own fillable fields." },
        { title: "Type your answers", body: "Fill each field in Hindi or English, tick boxes and pick options from lists." },
        { title: "Download the filled copy", body: "Hindi answers are drawn so they look right in any PDF reader." },
      ],
      notes: [
        LOCAL_EN,
        "Forms without fillable fields can be filled with Add text in the Edit tool.",
        ORIGINAL_EN,
      ],
      faqs: [
        { q: "My form says it has no fillable fields. What now?", a: "The PDF is a flat page. Open it in the Edit tool and use Add text to type your answers where they belong." },
        { q: "Will my Hindi answers break in other PDF readers?", a: "No. Each Hindi answer is drawn in the browser with correct shaping before it is saved into the form." },
      ],
    },
    hi: {
      heading: "पीडीएफ फॉर्म हिंदी में कैसे भरें",
      steps: [
        { title: "फॉर्म खोलें", body: "ऐसी पीडीएफ चुनें जिसमें भरने लायक खाने हों।" },
        { title: "जवाब लिखें", body: "हर खाने को हिंदी या अंग्रेज़ी में भरें, बॉक्स पर टिक करें और सूची से विकल्प चुनें।" },
        { title: "भरी हुई कॉपी डाउनलोड करें", body: "हिंदी जवाब इस तरह बनते हैं कि हर पीडीएफ रीडर में सही दिखें।" },
      ],
      notes: [
        LOCAL_HI,
        "जिस फॉर्म में भरने लायक खाने नहीं हैं, उसे एडिट टूल में टेक्स्ट जोड़ें से भरें।",
        ORIGINAL_HI,
      ],
      faqs: [
        { q: "फॉर्म में भरने लायक खाने नहीं हैं, अब क्या करें?", a: "यह सपाट पीडीएफ है। इसे एडिट टूल में खोलें और टेक्स्ट जोड़ें से सही जगह पर जवाब लिखें।" },
        { q: "क्या दूसरे पीडीएफ रीडर में मेरे हिंदी जवाब टूटेंगे?", a: "नहीं। हर हिंदी जवाब फॉर्म में सेव होने से पहले ब्राउज़र में सही शेपिंग के साथ बनाया जाता है।" },
      ],
    },
  },
  translate: {
    guides: ["translate-hindi-pdf-to-english"],
    en: {
      heading: "How to translate a Hindi PDF",
      steps: [
        { title: "Open your PDF", body: "The tool reads the Hindi or English text on each page." },
        { title: "Approve and translate", body: "After you confirm, the detected lines are sent to our translation service. Hard-to-read scanned pages may send page images for AI text recognition." },
        { title: "Download and review", body: "A new PDF with the translation in place downloads. Read it before you use it." },
      ],
      notes: [
        "Translation sends text, and for hard scans page images, to our server only after you approve it.",
        "Machine translation can be wrong. Review names, numbers and legal terms.",
        ORIGINAL_EN,
      ],
      faqs: [
        { q: "Is my PDF uploaded for translation?", a: "Only the detected text lines are sent, and only after you confirm. Opening and reading the PDF happen in your browser." },
        { q: "Can I correct the translation?", a: "Yes. Open the translated PDF in the Edit tool and tap any line to change it." },
      ],
    },
    hi: {
      heading: "हिंदी पीडीएफ का अनुवाद कैसे करें",
      steps: [
        { title: "पीडीएफ खोलें", body: "टूल हर पेज का हिंदी या अंग्रेज़ी टेक्स्ट पढ़ता है।" },
        { title: "मंज़ूरी दें और अनुवाद करें", body: "आपकी पुष्टि के बाद पहचानी गई लाइनें हमारी अनुवाद सेवा को भेजी जाती हैं। मुश्किल स्कैन पेजों की इमेज AI टेक्स्ट पहचान के लिए जा सकती है।" },
        { title: "डाउनलोड करें और जाँचें", body: "अनुवाद लगी हुई नई पीडीएफ डाउनलोड होती है। इस्तेमाल से पहले उसे पढ़ लें।" },
      ],
      notes: [
        "अनुवाद के लिए टेक्स्ट, और मुश्किल स्कैन के लिए पेज इमेज, आपकी मंज़ूरी के बाद ही हमारे सर्वर को जाते हैं।",
        "मशीन अनुवाद गलत हो सकता है। नाम, अंक और कानूनी शब्द ज़रूर जाँचें।",
        ORIGINAL_HI,
      ],
      faqs: [
        { q: "क्या अनुवाद के लिए मेरी पीडीएफ अपलोड होती है?", a: "सिर्फ पहचानी गई टेक्स्ट लाइनें भेजी जाती हैं, और वह भी आपकी पुष्टि के बाद। पीडीएफ खोलना और पढ़ना आपके ब्राउज़र में होता है।" },
        { q: "क्या मैं अनुवाद सुधार सकता हूँ?", a: "हाँ। अनुवादित पीडीएफ को एडिट टूल में खोलें और किसी भी लाइन पर टैप करके बदलें।" },
      ],
    },
  },
  merge: {
    guides: ["merge-multiple-hindi-pdf-files-online"],
    en: {
      heading: "How to merge PDF files",
      steps: [
        { title: "Add your PDFs", body: "Select or drop two or more PDF files." },
        { title: "Set the order", body: "Move files up or down until they are in the order you want." },
        { title: "Download one PDF", body: "The pages are joined into a new file in that order." },
      ],
      notes: [LOCAL_EN, "Hindi text keeps its original fonts because pages are copied, not redrawn.", ORIGINAL_EN],
      faqs: [
        { q: "Will merging break my Hindi text?", a: "No. Merging copies each page as it is, so the text, fonts and layout stay unchanged." },
        { q: "Are my files uploaded?", a: "No. Merging runs in your browser." },
      ],
    },
    hi: {
      heading: "पीडीएफ फाइलें कैसे जोड़ें",
      steps: [
        { title: "पीडीएफ जोड़ें", body: "दो या ज़्यादा पीडीएफ फाइलें चुनें या यहाँ छोड़ें।" },
        { title: "क्रम तय करें", body: "फाइलों को ऊपर या नीचे करके अपना क्रम बनाएं।" },
        { title: "एक पीडीएफ डाउनलोड करें", body: "पेज उसी क्रम में एक नई फाइल में जुड़ जाते हैं।" },
      ],
      notes: [LOCAL_HI, "पेज कॉपी होते हैं, दोबारा नहीं बनते, इसलिए हिंदी टेक्स्ट के फॉन्ट वैसे ही रहते हैं।", ORIGINAL_HI],
      faqs: [
        { q: "क्या जोड़ने से हिंदी टेक्स्ट टूटेगा?", a: "नहीं। हर पेज जैसा है वैसा कॉपी होता है, इसलिए टेक्स्ट, फॉन्ट और लेआउट नहीं बदलते।" },
        { q: "क्या मेरी फाइलें अपलोड होती हैं?", a: "नहीं। फाइलें आपके ब्राउज़र में ही जुड़ती हैं।" },
      ],
    },
  },
  split: {
    guides: ["merge-multiple-hindi-pdf-files-online"],
    en: {
      heading: "How to split a PDF",
      steps: [
        { title: "Open your PDF", body: "Select the file you want to take pages from." },
        { title: "Choose the pages", body: "Set the first and last page of the range you want to keep." },
        { title: "Download the new PDF", body: "Those pages are saved as a separate file." },
      ],
      notes: [LOCAL_EN, "Pages are copied as they are, so text stays searchable.", ORIGINAL_EN],
      faqs: [
        { q: "Can I take out just one page?", a: "Yes. Set the same page number as the first and last page." },
        { q: "Can I delete or rotate pages?", a: "Yes, in the Edit tool: open the Pages panel to turn, move, delete or add blank pages." },
      ],
    },
    hi: {
      heading: "पीडीएफ के पेज अलग कैसे करें",
      steps: [
        { title: "पीडीएफ खोलें", body: "वह फाइल चुनें जिससे पेज निकालने हैं।" },
        { title: "पेज चुनें", body: "रखने वाले पेजों का पहला और आखिरी पेज चुनें।" },
        { title: "नई पीडीएफ डाउनलोड करें", body: "वे पेज एक अलग फाइल में सेव हो जाते हैं।" },
      ],
      notes: [LOCAL_HI, "पेज जैसे हैं वैसे कॉपी होते हैं, इसलिए टेक्स्ट खोजा जा सकता है।", ORIGINAL_HI],
      faqs: [
        { q: "क्या सिर्फ एक पेज निकाल सकते हैं?", a: "हाँ। पहले और आखिरी पेज में एक ही पेज नंबर डालें।" },
        { q: "क्या पेज हटाए या घुमाए जा सकते हैं?", a: "हाँ, एडिट टूल में: पेज पैनल खोलकर पेज घुमाएं, खिसकाएं, हटाएं या खाली पेज जोड़ें।" },
      ],
    },
  },
  compress: {
    guides: ["compress-scanned-hindi-pdf-without-blur", "pdf-size-kam-kaise-kare-100kb-sarkari-form"],
    en: {
      heading: "How to compress a PDF",
      steps: [
        { title: "Open your PDF", body: "Select the file you need to make smaller." },
        { title: "Pick the quality", body: "Move the slider toward a smaller file or sharper pages." },
        { title: "Download and check", body: "Open the smaller file and make sure the text is still clear before you upload it." },
      ],
      notes: [
        LOCAL_EN,
        "Pages are re-encoded as images, so text in the compressed file is not searchable.",
        "Small Hindi text blurs first at low quality, so check it before uploading to a portal.",
      ],
      faqs: [
        { q: "Can it make my PDF exactly 100 KB?", a: "There is no fixed-size setting. Lower the quality slider until the size fits the portal's limit, then check that the text is still clear." },
        { q: "Why is the text no longer selectable?", a: "Compression turns each page into an image. Keep the original file if you need searchable text." },
      ],
    },
    hi: {
      heading: "पीडीएफ का साइज कैसे कम करें",
      steps: [
        { title: "पीडीएफ खोलें", body: "वह फाइल चुनें जिसे छोटा करना है।" },
        { title: "क्वालिटी चुनें", body: "स्लाइडर को छोटी फाइल या साफ पेज की ओर खिसकाएं।" },
        { title: "डाउनलोड करें और जाँचें", body: "छोटी फाइल खोलें और अपलोड से पहले देख लें कि टेक्स्ट साफ है।" },
      ],
      notes: [
        LOCAL_HI,
        "पेज इमेज के रूप में दोबारा बनते हैं, इसलिए छोटी फाइल का टेक्स्ट खोजा नहीं जा सकता।",
        "कम क्वालिटी पर छोटा हिंदी टेक्स्ट सबसे पहले धुंधला होता है, इसलिए पोर्टल पर अपलोड से पहले जाँचें।",
      ],
      faqs: [
        { q: "क्या पीडीएफ ठीक 100 KB की बन सकती है?", a: "तय साइज की सेटिंग नहीं है। स्लाइडर से क्वालिटी कम करें जब तक साइज पोर्टल की सीमा में न आ जाए, फिर देखें कि टेक्स्ट साफ है।" },
        { q: "टेक्स्ट अब चुना क्यों नहीं जाता?", a: "कंप्रेस करने पर हर पेज इमेज बन जाता है। खोजने लायक टेक्स्ट चाहिए तो मूल फाइल रखें।" },
      ],
    },
  },
  "pdf-to-word": {
    guides: ["kruti-dev-to-unicode-hindi-pdf-editor", "fix-broken-hindi-fonts-in-pdf"],
    en: {
      heading: "How to convert a Hindi PDF to Word",
      steps: [
        { title: "Open your PDF", body: "Select a Hindi or English PDF, typed or scanned." },
        { title: "Let it read the pages", body: "Text comes from the PDF, or from text recognition on your device for scanned pages." },
        { title: "Download the .docx", body: "Ruled tables become Word tables and pictures come along in reading order." },
      ],
      notes: [LOCAL_EN, "Check the Word file against the PDF: recognised text from scans can contain mistakes."],
      faqs: [
        { q: "Does it work on scanned Hindi PDFs?", a: "Yes. Scanned pages are read with text recognition in your browser, and ruled tables on scans become Word tables." },
        { q: "Will the Word file look exactly like the PDF?", a: "Close, not identical. Text, tables and pictures follow the reading order; complex layouts may need tidying in Word." },
      ],
    },
    hi: {
      heading: "हिंदी पीडीएफ को वर्ड में कैसे बदलें",
      steps: [
        { title: "पीडीएफ खोलें", body: "टाइप की हुई या स्कैन की गई हिंदी या अंग्रेज़ी पीडीएफ चुनें।" },
        { title: "पेज पढ़ने दें", body: "टेक्स्ट पीडीएफ से, या स्कैन पेज के लिए आपके डिवाइस पर टेक्स्ट पहचान से आता है।" },
        { title: ".docx डाउनलोड करें", body: "लाइनों वाली टेबल वर्ड टेबल बनती हैं और तस्वीरें पढ़ने के क्रम में आती हैं।" },
      ],
      notes: [LOCAL_HI, "वर्ड फाइल को पीडीएफ से मिलाकर देखें: स्कैन से पहचाने गए टेक्स्ट में गलतियाँ हो सकती हैं।"],
      faqs: [
        { q: "क्या यह स्कैन की गई हिंदी पीडीएफ पर काम करता है?", a: "हाँ। स्कैन पेज आपके ब्राउज़र में टेक्स्ट पहचान से पढ़े जाते हैं, और स्कैन पर लाइनों वाली टेबल वर्ड टेबल बनती हैं।" },
        { q: "क्या वर्ड फाइल बिल्कुल पीडीएफ जैसी दिखेगी?", a: "काफी मिलती-जुलती, पर हूबहू नहीं। टेक्स्ट, टेबल और तस्वीरें पढ़ने के क्रम में आती हैं; जटिल लेआउट को वर्ड में थोड़ा ठीक करना पड़ सकता है।" },
      ],
    },
  },
  "word-to-pdf": {
    guides: ["e-stamp-paper-par-hindi-matter-print-margin-guide", "fix-broken-hindi-fonts-in-pdf"],
    en: {
      heading: "How to convert Word to PDF with Hindi text",
      steps: [
        { title: "Open your .docx", body: "Select a Word file with Hindi or English text." },
        { title: "Preview the pages", body: "The document is laid out in your browser so Hindi stays joined." },
        { title: "Save the PDF", body: "Download an image PDF, or use Save as PDF for selectable text." },
      ],
      notes: [LOCAL_EN, "Image PDFs look the same everywhere but their text is not selectable."],
      faqs: [
        { q: "Which option should I pick?", a: "Choose the image PDF when it must look identical on every device. Choose Save as PDF when people need to select or search the text." },
        { q: "Does it support old .doc files?", a: "No. Save the document as .docx in Word first." },
      ],
    },
    hi: {
      heading: "हिंदी टेक्स्ट वाली वर्ड फाइल को पीडीएफ में कैसे बदलें",
      steps: [
        { title: ".docx खोलें", body: "हिंदी या अंग्रेज़ी टेक्स्ट वाली वर्ड फाइल चुनें।" },
        { title: "पेज देखें", body: "दस्तावेज़ आपके ब्राउज़र में बनता है ताकि हिंदी जुड़ी रहे।" },
        { title: "पीडीएफ सेव करें", body: "इमेज पीडीएफ डाउनलोड करें, या चुनने लायक टेक्स्ट के लिए पीडीएफ सेव करें चुनें।" },
      ],
      notes: [LOCAL_HI, "इमेज पीडीएफ हर जगह एक जैसी दिखती है, पर उसका टेक्स्ट चुना नहीं जा सकता।"],
      faqs: [
        { q: "कौन सा विकल्प चुनें?", a: "हर डिवाइस पर हूबहू दिखनी चाहिए तो इमेज पीडीएफ चुनें। टेक्स्ट चुनना या खोजना हो तो पीडीएफ सेव करें चुनें।" },
        { q: "क्या पुरानी .doc फाइलें चलती हैं?", a: "नहीं। पहले वर्ड में फाइल को .docx के रूप में सेव करें।" },
      ],
    },
  },
};

/** Guide copy for one tool in one UI language. */
export function toolGuide(id: ToolId, language: Language): ToolGuideCopy {
  return TOOL_GUIDES[id][language];
}
