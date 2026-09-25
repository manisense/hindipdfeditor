/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';

export type Language = 'en' | 'hi';

export interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, defaultText?: string) => string;
  isHindi: boolean;
}

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav
    'nav.features': 'Features',
    'nav.howItWorks': 'How it works',
    'nav.compare': 'Compare',
    'nav.useCases': 'Use cases',
    'nav.guides': 'Guides',
    'nav.openEditor': 'Open editor',
    'nav.googlePlay': 'Google Play',
    'nav.switchLang': 'हिन्दी',

    // Hero
    'hero.badge': 'Free to use · runs locally · no account',
    'hero.titlePre': 'Every tool for',
    'hero.title1': 'Hindi PDFs.',
    'hero.title2': 'हिंदी दस्तावेज़।',
    'hero.title3': 'Bilingual edits.',
    'hero.title4': 'Sarkari forms.',
    'hero.titlePost': 'Devanagari-safe.',
    'hero.subtitle':
      'Edit Devanagari text without broken matras, translate Hindi ↔ English, merge, split and compress. Editing runs in your browser or the Android app; AI features ask before sending anything.',
    'hero.ctaPrimary': 'Open the editor →',
    'hero.ctaSecondary': 'Get the Android app',
    'hero.tryDemo': 'Try interactive demo',
    'hero.demoNotice': 'Runs in your browser. Nothing is uploaded unless you choose an AI feature.',

    // Tool Items in Hero
    'tool.edit': 'Edit Hindi PDF',
    'tool.editSub': 'Live Devanagari shaping',
    'tool.translate': 'Hindi ↔ English',
    'tool.translateSub': 'Free in your browser',
    'tool.ocr': 'OCR detection',
    'tool.ocrSub': 'Hindi + English text',
    'tool.merge': 'Merge & split',
    'tool.mergeSub': 'Any order, any range',
    'tool.compress': 'Compress PDF',
    'tool.compressSub': 'Shrink scanned files',

    // Features Section
    'feat.eyebrow': 'Everything in one place',
    'feat.title': 'Built for Hindi PDFs, not English afterthoughts',
    'feat.subtitle':
      'General-purpose PDF editors break Devanagari matras, conjuncts, and vowel placements. Hindi PDF Editor is engineered from scratch for Indic typography.',
    'feat.editHeading': 'Devanagari That Stays Joined',
    'feat.editDesc':
      'New Hindi text is typed in Unicode and shaped by the browser text engine, so conjuncts (क्ष, त्र, ज्ञ) and the short-i matra (कि, पि) render joined, as they do on web pages.',
    'feat.translateHeading': 'Bilingual Document Translation',
    'feat.translateDesc':
      'Translate English contracts, notices, and manuals to Hindi while preserving exact tables, fonts, and bounding boxes.',
    'feat.ocrHeading': 'Smart Hindi + English OCR',
    'feat.ocrDesc':
      'Detect printed Devanagari text inside scanned revenue records, admit cards, and certificates with local browser OCR.',
    'feat.privacyHeading': 'Local-First Privacy',
    'feat.privacyDesc':
      'Opening, editing, merging, splitting and compressing happen in your browser. AI text recognition and translation send data to our server only after you confirm.',
    'feat.compressHeading': 'Shrink PDFs for Sarkari Portals',
    'feat.compressDesc':
      'Re-encode scanned pages with a quality slider to get under government portal upload limits (SSC, UP Police, BPSC). Lower quality means a smaller file.',

    // How It Works
    'how.eyebrow': 'Simple 4-Step Process',
    'how.title': 'How Hindi PDF Editor Works',
    'how.subtitle': 'No installation and no account. Your file opens in the browser.',
    'how.step1Title': 'Open PDF Locally',
    'how.step1Desc': 'Drag and drop your PDF into your browser. It opens in high-resolution client-side canvas.',
    'how.step2Title': 'Select or Mask Text',
    'how.step2Desc': 'Click on existing text to mask it with matching background, or tap anywhere to create a new text box.',
    'how.step3Title': 'Type in Unicode Hindi',
    'how.step3Desc': 'Type using any Unicode Hindi keyboard (Gboard, Google Input Tools, InScript). The browser shapes the text as you type.',
    'how.step4Title': 'Export a New PDF',
    'how.step4Desc': 'Download a new PDF with your edits. Pages are saved as high-resolution images, so the Hindi looks the same on every phone and PC. Your original file is not changed.',

    // Comparison
    'comp.eyebrow': 'Comparison',
    'comp.title': 'How It Differs From General PDF Editors',
    'comp.subtitle': 'What Hindi PDF Editor does, next to what users often run into with general-purpose PDF tools.',
    'comp.thFeature': 'Key Feature',
    'comp.thOur': 'Hindi PDF Editor',
    'comp.thTypical': 'General PDF editors',

    // Use Cases
    'use.eyebrow': 'Solutions by Document',
    'use.title': 'Built for Real-World Hindi Documents',
    'use.subtitle': 'From government job applications to affidavits and correction requests — fill in Hindi without broken matras.',
    'use.admitCard': 'Sarkari Application Forms',
    'use.admitCardDesc': 'Fill in blank recruitment and certificate forms (BPSC, UP Police, SSC) in Unicode Hindi before you print or upload them.',
    'use.legal': 'Legal Affidavits & Stamp Papers',
    'use.legalDesc': 'Prepare bilingual court affidavits, Hindi rent agreements, power of attorney, and e-Stamp declarations.',
    'use.land': 'Land Record Correction Requests',
    'use.landDesc': 'Fill the correction application or self-declaration for UP Bhulekh or Bihar Parimarjan. The record itself is corrected by the revenue office.',
    'use.academic': 'Academic Papers & Worksheets',
    'use.academicDesc': 'Build, edit, or translate CBSE and State Board Hindi question papers, assignments, and study materials.',
    'use.openForDoc': 'Open Editor for this document →',

    // Work Your Way
    'work.eyebrow': 'Work your way',
    'work.title': 'On the web, or in your pocket.',
    'work.subtitle': 'Start in the browser with nothing to install, or take the same toolkit anywhere with the Android app.',
    'work.f1Title': 'No install on web',
    'work.f1Desc': 'Open a tab and get straight to editing — nothing to download.',
    'work.f2Title': 'Native Android app',
    'work.f2Desc': 'The full toolkit on your phone, tuned for touch.',
    'work.f3Title': 'Same result, everywhere',
    'work.f3Desc': 'Devanagari shaping stays identical across web and mobile.',

    // FAQ
    'faq.eyebrow': 'Frequently asked questions',
    'faq.title': 'Everything you need to know',
    'faq.subtitle': 'Common questions about Hindi PDF editing, Devanagari font shaping, privacy, and tools.',

    // Articles Section
    'art.eyebrow': 'Guides & Technical Insights',
    'art.title': 'Master Hindi PDF Editing & Typography',
    'art.subtitle': 'Step-by-step solutions for official state forms, affidavits, broken matras, and translations.',
    'art.viewAll': 'View all guides and articles →',

    // CTA & Footer
    'cta.title': 'Get your Hindi PDFs sorted.',
    'cta.subtitle': 'Open the editor in your browser, or grab the Android app. Free, private by default, and built for Devanagari.',
    'cta.open': 'Open the editor →',
    'cta.play': 'Google Play App',
    'footer.desc': 'Every tool you need to work with Hindi PDFs, in one private, Devanagari-safe place.',
    'footer.editOcr': 'Edit & OCR',
    'footer.organize': 'Organize & optimize',
    'footer.resources': 'Resources & Guides',
    'footer.rights': '© 2026 Hindi PDF Editor. All rights reserved.',
    'footer.tagline': 'Editing runs in your browser · No account needed',

    // Tool Interfaces
    'tool.save': 'Export PDF',
    'tool.downloading': 'Generating PDF…',
    'tool.addText': 'Add Text',
    'tool.mask': 'Mask Text',
    'tool.fontSize': 'Font Size',
    'tool.color': 'Color',
    'tool.zoomIn': 'Zoom In',
    'tool.zoomOut': 'Zoom Out',
    'tool.prevPage': 'Previous',
    'tool.nextPage': 'Next',
    'tool.backHome': '← Back to Home',
  },
  hi: {
    // Nav
    'nav.features': 'विशेषताएं',
    'nav.howItWorks': 'कैसे काम करता है',
    'nav.compare': 'तुलना',
    'nav.useCases': 'उपयोग के मामले',
    'nav.guides': 'गाइड्स और लेख',
    'nav.openEditor': 'एडिटर खोलें',
    'nav.googlePlay': 'गूगल प्ले',
    'nav.switchLang': 'English',

    // Hero
    'hero.badge': 'फ्री · सीधे ब्राउज़र में · कोई खाता नहीं',
    'hero.titlePre': 'हिंदी पीडीएफ के सभी टूल्स,',
    'hero.title1': 'सही देवनागरी में।',
    'hero.title2': 'बिना फॉन्ट टूटे।',
    'hero.title3': 'सरकारी फॉर्म हेतु।',
    'hero.title4': 'प्राइवेट, ब्राउज़र में।',
    'hero.titlePost': 'सुरक्षित और आसान।',
    'hero.subtitle':
      'बिना किसी सॉफ्टवेयर डाउनलोड के देवनागरी के सही अक्षरों और मात्राओं के साथ पीडीएफ एडिट करें, अनुवाद करें, जोड़ें, अलग करें और कंप्रेस करें। एडिटिंग आपके ब्राउज़र में होती है; AI फीचर कुछ भेजने से पहले पूछते हैं।',
    'hero.ctaPrimary': 'एडिटर खोलें →',
    'hero.ctaSecondary': 'एंड्रॉयड ऐप डाउनलोड करें',
    'hero.tryDemo': 'लाइव डेमो देखें',
    'hero.demoNotice': 'ब्राउज़र में चलता है। AI फीचर चुने बिना कुछ भी अपलोड नहीं होता।',

    // Tool Items in Hero
    'tool.edit': 'हिंदी पीडीएफ एडिट करें',
    'tool.editSub': 'सही देवनागरी फॉन्ट और मात्राएं',
    'tool.translate': 'हिंदी ↔ अंग्रेजी अनुवाद',
    'tool.translateSub': 'ब्राउज़र में फ्री अनुवाद',
    'tool.ocr': 'स्मार्ट ओसीआर डिटेक्शन',
    'tool.ocrSub': 'हिंदी + अंग्रेजी टेक्स्ट',
    'tool.merge': 'पीडीएफ जोड़ें व अलग करें',
    'tool.mergeSub': 'क्रम और पेज रेंज चुनें',
    'tool.compress': 'पीडीएफ साइज कम करें',
    'tool.compressSub': 'सरकारी पोर्टल के लिए छोटी फाइल',

    // Features Section
    'feat.eyebrow': 'सभी सुविधाएं एक ही स्थान पर',
    'feat.title': 'खास तौर पर हिंदी (देवनागरी) के लिए तैयार',
    'feat.subtitle':
      'साधारण पीडीएफ एडिटर हिंदी की मात्राओं, आधे अक्षरों और संयुक्ताक्षरों को तोड़ देते हैं। Hindi PDF Editor को विशेष रूप से भारतीय भाषाओं के लिए डिजाइन किया गया है।',
    'feat.editHeading': 'जुड़ी हुई, सही देवनागरी',
    'feat.editDesc':
      'नया हिंदी टेक्स्ट यूनिकोड में टाइप होता है और ब्राउज़र का टेक्स्ट इंजन उसे आकार देता है, इसलिए संयुक्ताक्षर (क्ष, त्र, ज्ञ, द्ध) और छोटी-इ की मात्रा (कि, पि) वेब पेज की तरह जुड़ी हुई दिखती हैं।',
    'feat.translateHeading': 'द्विभाषी दस्तावेज अनुवाद (AI)',
    'feat.translateDesc':
      'अंग्रेजी नोटिस, कॉन्ट्रैक्ट और मैनुअल को मूल लेआउट, टेबल और बॉर्डर्स को बनाए रखते हुए तुरंत हिंदी में ट्रांसलेट करें।',
    'feat.ocrHeading': 'स्मार्ट हिंदी + अंग्रेजी ओसीआर',
    'feat.ocrDesc':
      'स्कैन किए गए राजस्व रिकॉर्ड, एडमिट कार्ड और पुराने प्रमाण पत्रों में से देवनागरी प्रिंटेड टेक्स्ट को तुरंत पहचानें और कॉपी करें।',
    'feat.privacyHeading': 'लोकल और गोपनीय',
    'feat.privacyDesc':
      'फाइल खोलना, एडिट, मर्ज, स्प्लिट और कंप्रेस आपके ब्राउज़र में होते हैं। AI टेक्स्ट पहचान और अनुवाद आपकी पुष्टि के बाद ही हमारे सर्वर को डेटा भेजते हैं।',
    'feat.compressHeading': 'सरकारी पोर्टल के लिए पीडीएफ छोटी करें',
    'feat.compressDesc':
      'स्कैन पेज क्वालिटी स्लाइडर से दोबारा बनाएं ताकि फाइल सरकारी पोर्टल की अपलोड लिमिट (SSC, UP Police, BPSC) में आ जाए। कम क्वालिटी यानी छोटी फाइल।',

    // How It Works
    'how.eyebrow': 'आसान 4-स्टेप प्रक्रिया',
    'how.title': 'Hindi PDF Editor कैसे काम करता है',
    'how.subtitle': 'कोई इंस्टालेशन नहीं, कोई अकाउंट नहीं। फाइल ब्राउज़र में ही खुलती है।',
    'how.step1Title': 'पीडीएफ फाइल खोलें',
    'how.step1Desc': 'अपनी पीडीएफ फाइल एडिटर में ड्रैग-एंड-ड्रॉप करें। फाइल तुरंत हाई-रेजोल्यूशन में आपके डिवाइस पर खुल जाएगी।',
    'how.step2Title': 'टेक्स्ट सेलेक्ट या मास्क करें',
    'how.step2Desc': 'जिस टेक्स्ट को बदलना है उस पर क्लिक करें। एडिटर पुराने टेक्स्ट को बैकग्राउंड से मैच करके छिपा देता है।',
    'how.step3Title': 'यूनिकोड हिंदी में टाइप करें',
    'how.step3Desc': 'किसी भी यूनिकोड हिंदी कीबोर्ड (Gboard, Google Input Tools, InScript) से टाइप करें। ब्राउज़र टाइप करते समय ही अक्षरों को सही आकार देता है।',
    'how.step4Title': 'नई पीडीएफ डाउनलोड करें',
    'how.step4Desc': 'अपने बदलावों के साथ नई पीडीएफ डाउनलोड करें। पेज हाई-रेजोल्यूशन इमेज के रूप में सेव होते हैं, इसलिए हिंदी हर फोन और पीसी पर एक जैसी दिखती है। मूल फाइल नहीं बदलती।',

    // Comparison
    'comp.eyebrow': 'तुलना',
    'comp.title': 'साधारण पीडीएफ एडिटर्स से यह कैसे अलग है',
    'comp.subtitle': 'Hindi PDF Editor क्या करता है, और साधारण पीडीएफ टूल्स में लोगों को अक्सर क्या दिक्कतें आती हैं।',
    'comp.thFeature': 'प्रमुख सुविधा',
    'comp.thOur': 'Hindi PDF Editor',
    'comp.thTypical': 'साधारण पीडीएफ एडिटर',

    // Use Cases
    'use.eyebrow': 'दस्तावेजों के अनुसार समाधान',
    'use.title': 'वास्तविक सरकारी और कानूनी दस्तावेजों के लिए निर्मित',
    'use.subtitle': 'उत्तर प्रदेश, बिहार, मध्य प्रदेश और राजस्थान के सरकारी फॉर्म से लेकर कोर्ट एफिडेविट तक — पूरे भरोसे के साथ एडिट करें।',
    'use.admitCard': 'सरकारी आवेदन फॉर्म',
    'use.admitCardDesc': 'UP Police, BPSC, SSC और रेलवे भर्ती या प्रमाण पत्र के खाली फॉर्म प्रिंट या अपलोड करने से पहले यूनिकोड हिंदी में भरें।',
    'use.legal': 'कानूनी शपथ पत्र और ई-स्टांप पेपर',
    'use.legalDesc': '₹10, ₹50, ₹100 के ई-स्टांप पेपर पर 4.5 इंच मार्जिन के साथ सही हिंदी एफिडेविट, किरायानामा और अनुबंध पत्र तैयार करें।',
    'use.land': 'भूलेख सुधार आवेदन',
    'use.landDesc': 'यूपी भूलेख या बिहार परिमार्जन के सुधार आवेदन या स्वघोषणा पत्र भरें। रिकॉर्ड में सुधार राजस्व कार्यालय ही करता है।',
    'use.academic': 'शैक्षणिक प्रश्न पत्र और अध्ययन सामग्री',
    'use.academicDesc': 'शिक्षक और छात्र सीबीएसई या स्टेट बोर्ड के हिंदी प्रश्न पत्र, असाइनमेंट और नोट्स को आसानी से एडिट और ट्रांसलेट कर सकते हैं।',
    'use.openForDoc': 'इस दस्तावेज के लिए एडिटर खोलें →',

    // Work Your Way
    'work.eyebrow': 'अपनी पसंद के अनुसार काम करें',
    'work.title': 'वेब ब्राउज़र में, या अपने मोबाइल में।',
    'work.subtitle': 'कंप्यूटर ब्राउज़र में बिना कुछ इंस्टॉल किए शुरू करें, या एंड्रॉयड ऐप के साथ कहीं भी इस्तेमाल करें।',
    'work.f1Title': 'वेब पर कोई इंस्टालेशन नहीं',
    'work.f1Desc': 'सीधे ब्राउज़र में नया टैब खोलें और तुरंत काम शुरू करें।',
    'work.f2Title': 'नेटिव एंड्रॉयड ऐप',
    'work.f2Desc': 'टच स्क्रीन के लिए विशेष रूप से ऑप्टिमाइज्ड पूरा टूलकिट आपके फोन पर।',
    'work.f3Title': 'हर जगह एक जैसा परिणाम',
    'work.f3Desc': 'वेब और मोबाइल दोनों पर देवनागरी फॉन्ट और मात्राएं बिल्कुल एक समान रेंडर होती हैं।',

    // FAQ
    'faq.eyebrow': 'अक्सर पूछे जाने वाले सवाल',
    'faq.title': 'जरूरी सवालों के आसान जवाब',
    'faq.subtitle': 'हिंदी पीडीएफ एडिटिंग, फॉन्ट शेपिंग, प्राइवेसी और टूल्स के बारे में सामान्य प्रश्न।',

    // Articles Section
    'art.eyebrow': 'गाइड्स और तकनीकी लेख',
    'art.title': 'हिंदी पीडीएफ और देवनागरी टाइपोग्राफी सीखें',
    'art.subtitle': 'सरकारी फॉर्म, शपथ पत्र, टूटी मात्राओं को ठीक करने और अनुवाद करने के स्टेप-बाय-स्टेप तरीके।',
    'art.viewAll': 'सभी गाइड्स और लेख देखें →',

    // CTA & Footer
    'cta.title': 'अपनी हिंदी पीडीएफ आसानी से तैयार करें।',
    'cta.subtitle': 'ब्राउज़र में एडिटर खोलें या एंड्रॉयड ऐप डाउनलोड करें। फ्री, डिफ़ॉल्ट रूप से प्राइवेट और देवनागरी के लिए बना।',
    'cta.open': 'एडिटर खोलें →',
    'cta.play': 'गूगल प्ले ऐप',
    'footer.desc': 'हिंदी पीडीएफ के साथ काम करने के लिए भारत का पहला सुरक्षित, लोकल-फर्स्ट देवनागरी एडिटर।',
    'footer.editOcr': 'एडिट और ओसीआर',
    'footer.organize': 'प्रबंधन और कंप्रेस',
    'footer.resources': 'संसाधन और गाइड्स',
    'footer.rights': '© 2026 Hindi PDF Editor. सर्वाधिकार सुरक्षित।',
    'footer.tagline': 'एडिटिंग आपके ब्राउज़र में · कोई अकाउंट नहीं',

    // Tool Interfaces
    'tool.save': 'एक्सपोर्ट पीडीएफ',
    'tool.downloading': 'पीडीएफ तैयार हो रहा है…',
    'tool.addText': 'टेक्स्ट जोड़ें',
    'tool.mask': 'मास्क लगाएं',
    'tool.fontSize': 'फॉन्ट साइज',
    'tool.color': 'रंग',
    'tool.zoomIn': 'बड़ा करें (+)',
    'tool.zoomOut': 'छोटा करें (-)',
    'tool.prevPage': 'पिछला पेज',
    'tool.nextPage': 'अगला पेज',
    'tool.backHome': '← होम पेज पर जाएं',
  },
};

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key: string, defaultText?: string) => defaultText || key,
  isHindi: false,
});

export const LANGUAGE_PREFERENCE_KEY = 'preferred_language';

/** Reads the visitor's explicit language choice; storage can be unavailable in private modes. */
export function readLanguagePreference(): Language | null {
  try {
    const saved = localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
    return saved === 'hi' || saved === 'en' ? saved : null;
  } catch {
    return null;
  }
}

function saveLanguagePreference(lang: Language): void {
  try {
    localStorage.setItem(LANGUAGE_PREFERENCE_KEY, lang);
  } catch {
    // Storage blocked: the URL still carries the language, so nothing is lost.
  }
}

type LanguageProviderProps = {
  /** Language of the current URL (`/hi/...` is Hindi); each language has its own page. */
  lang: Language;
  /** Returns the path of the current page in another language. */
  pathFor: (lang: Language) => string;
  children: ReactNode;
};

export function LanguageProvider({ lang, pathFor, children }: LanguageProviderProps) {
  const setLang = (newLang: Language) => {
    saveLanguagePreference(newLang);
    if (newLang !== lang) {
      window.location.assign(`${pathFor(newLang)}${window.location.search}${window.location.hash}`);
    }
  };

  const t = (key: string, defaultText?: string): string => {
    const langDict = translations[lang] || translations.en;
    if (langDict[key]) return langDict[key];
    if (translations.en[key]) return translations.en[key];
    return defaultText || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isHindi: lang === 'hi' }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLanguage() {
  return useContext(I18nContext);
}
