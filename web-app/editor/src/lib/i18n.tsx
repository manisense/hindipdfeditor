import React, { createContext, useContext, useEffect, useState } from 'react';

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
    'nav.switchLang': '🇮🇳 हिन्दी',

    // Hero
    'hero.badge': 'Free to use · runs locally · no account',
    'hero.titlePre': 'Every tool for',
    'hero.title1': 'Hindi PDFs.',
    'hero.title2': 'हिंदी दस्तावेज़।',
    'hero.title3': 'Bilingual edits.',
    'hero.title4': 'Sarkari forms.',
    'hero.titlePost': 'Devanagari-safe.',
    'hero.subtitle':
      'Edit Devanagari text with correct font shaping, translate Hindi ↔ English, merge, split, compress, and detect OCR. 100% private in your browser or Android app.',
    'hero.ctaPrimary': 'Open the editor →',
    'hero.ctaSecondary': 'Get the Android app',
    'hero.tryDemo': 'Try interactive demo',
    'hero.demoNotice': 'Runs 100% locally. Zero server uploads.',

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
    'feat.editHeading': 'Flawless Devanagari Font Shaping',
    'feat.editDesc':
      'Type Hindi directly with HarfBuzz OpenType layout. Conjuncts (क्ष, त्र, ज्ञ) and short-i matras (कि, पि) never detach or invert.',
    'feat.translateHeading': 'Bilingual Document Translation',
    'feat.translateDesc':
      'Translate English contracts, notices, and manuals to Hindi while preserving exact tables, fonts, and bounding boxes.',
    'feat.ocrHeading': 'Smart Hindi + English OCR',
    'feat.ocrDesc':
      'Detect printed Devanagari text inside scanned revenue records, admit cards, and certificates with local browser OCR.',
    'feat.privacyHeading': '100% Local-First Privacy',
    'feat.privacyDesc':
      'Your files never leave your device. All rendering, masking, merging, and compression run inside WebAssembly memory.',
    'feat.compressHeading': 'Sarkari Portal 100KB Compressor',
    'feat.compressDesc':
      'Reduce scanned PDF sizes under 100KB–200KB for government job portals (UP Police, BPSC, SSC) without blurry text.',

    // How It Works
    'how.eyebrow': 'Simple 4-Step Process',
    'how.title': 'How Hindi PDF Editor Works',
    'how.subtitle': 'No software installation, no account creation, and zero server uploads.',
    'how.step1Title': 'Open PDF Locally',
    'how.step1Desc': 'Drag and drop your PDF into your browser. It opens in high-resolution client-side canvas.',
    'how.step2Title': 'Select or Mask Text',
    'how.step2Desc': 'Click on existing text to mask it with matching background, or tap anywhere to create a new text box.',
    'how.step3Title': 'Type in Unicode Hindi',
    'how.step3Desc': 'Type using any standard Hindi keyboard (Gboard, InScript, Mangal). Fonts shape accurately in real time.',
    'how.step4Title': 'Export Vector PDF',
    'how.step4Desc': 'Download a brand-new, print-ready PDF readable on every smartphone and PC without font errors.',

    // Comparison
    'comp.eyebrow': 'Comparison & Benchmark',
    'comp.title': 'Why Hindi PDF Editor Beats Standard Tools',
    'comp.subtitle': 'See how our native Devanagari layout engine compares to general-purpose PDF software.',
    'comp.thFeature': 'Key Feature',
    'comp.thOur': 'Hindi PDF Editor',
    'comp.thAdobe': 'Adobe Acrobat',
    'comp.thCanva': 'Canva PDF',
    'comp.thSmallpdf': 'Smallpdf / iLovePDF',

    // Use Cases
    'use.eyebrow': 'Solutions by Document',
    'use.title': 'Built for Real-World Hindi Documents',
    'use.subtitle': 'From government job applications to legal notices and land records — edit with total confidence.',
    'use.admitCard': 'Sarkari & Govt Exam Admit Cards',
    'use.admitCardDesc': 'Update or correct personal details in government recruitment forms (BPSC, UP Police, SSC) without font misalignment.',
    'use.legal': 'Legal Affidavits & Stamp Papers',
    'use.legalDesc': 'Prepare bilingual court affidavits, Hindi rent agreements, power of attorney, and e-Stamp declarations.',
    'use.land': 'Land Records & Revenue Forms',
    'use.landDesc': 'Correct typos in UP Bhulekh, Bihar Parimarjan, MP B-1 Kistbandi, and Tehsil land certificate PDFs.',
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
    'art.subtitle': 'Step-by-step solutions for official state forms, admit cards, broken matras, and translations.',
    'art.viewAll': 'View all guides and articles →',

    // CTA & Footer
    'cta.title': 'Get your Hindi PDFs sorted.',
    'cta.subtitle': 'Open the editor in your browser, or grab the Android app. 100% free, private, and Devanagari-safe.',
    'cta.open': 'Open the editor →',
    'cta.play': 'Google Play App',
    'footer.desc': 'Every tool you need to work with Hindi PDFs, in one private, Devanagari-safe place.',
    'footer.editOcr': 'Edit & OCR',
    'footer.organize': 'Organize & optimize',
    'footer.resources': 'Resources & Guides',
    'footer.rights': '© 2026 Hindi PDF Editor. All rights reserved.',
    'footer.tagline': '100% Client-Side Processing · Zero Server Storage',

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
    'nav.switchLang': '🇬🇧 English',

    // Hero
    'hero.badge': '100% फ्री · सीधे ब्राउज़र में · कोई खाता नहीं',
    'hero.titlePre': 'हिंदी पीडीएफ के सभी टूल्स,',
    'hero.title1': 'सही देवनागरी में।',
    'hero.title2': 'बिना फॉन्ट टूटे।',
    'hero.title3': 'सरकारी फॉर्म हेतु।',
    'hero.title4': '100% प्राइवेट।',
    'hero.titlePost': 'सुरक्षित और आसान।',
    'hero.subtitle':
      'बिना किसी सॉफ्टवेयर डाउनलोड के देवनागरी के सही अक्षरों और मात्राओं के साथ पीडीएफ एडिट करें, अनुवाद करें, जोड़ें, अलग करें और कंप्रेस करें। आपकी फाइलें 100% प्राइवेट रहती हैं।',
    'hero.ctaPrimary': 'एडिटर खोलें →',
    'hero.ctaSecondary': 'एंड्रॉयड ऐप डाउनलोड करें',
    'hero.tryDemo': 'लाइव डेमो देखें',
    'hero.demoNotice': '100% लोकल प्रोसेसिंग। कोई सर्वर अपलोड नहीं।',

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
    'tool.compressSub': '100KB पोर्टल सुरक्षित',

    // Features Section
    'feat.eyebrow': 'सभी सुविधाएं एक ही स्थान पर',
    'feat.title': 'खास तौर पर हिंदी (देवनागरी) के लिए तैयार',
    'feat.subtitle':
      'साधारण पीडीएफ एडिटर हिंदी की मात्राओं, आधे अक्षरों और संयुक्ताक्षरों को तोड़ देते हैं। Hindi PDF Editor को विशेष रूप से भारतीय भाषाओं के लिए डिजाइन किया गया है।',
    'feat.editHeading': '100% सटीक देवनागरी फॉन्ट शेपिंग',
    'feat.editDesc':
      'HarfBuzz ओपन-टाइप इंजन के साथ सीधे हिंदी में टाइप करें। संयुक्ताक्षर (क्ष, त्र, ज्ञ, द्ध) और छोटी-इ की मात्राएं कभी अलग या उल्टी नहीं होतीं।',
    'feat.translateHeading': 'द्विभाषी दस्तावेज अनुवाद (AI)',
    'feat.translateDesc':
      'अंग्रेजी नोटिस, कॉन्ट्रैक्ट और मैनुअल को मूल लेआउट, टेबल और बॉर्डर्स को बनाए रखते हुए तुरंत हिंदी में ट्रांसलेट करें।',
    'feat.ocrHeading': 'स्मार्ट हिंदी + अंग्रेजी ओसीआर',
    'feat.ocrDesc':
      'स्कैन किए गए राजस्व रिकॉर्ड, एडमिट कार्ड और पुराने प्रमाण पत्रों में से देवनागरी प्रिंटेड टेक्स्ट को तुरंत पहचानें और कॉपी करें।',
    'feat.privacyHeading': '100% लोकल और गोपनीय',
    'feat.privacyDesc':
      'आपकी फाइलें कभी आपके डिवाइस से बाहर नहीं जातीं। सभी एडिटिंग, मास्किंग और कंप्रेशन आपके ब्राउज़र की मेमोरी में लोकली होती है।',
    'feat.compressHeading': 'सरकारी पोर्टल 100KB कंप्रेसर',
    'feat.compressDesc':
      'सरकारी भर्ती फॉर्म (UP Police, BPSC, SSC) में अपलोड करने के लिए पीडीएफ साइज को बिना लिखावट धुंधली किए 100KB–200KB में बदलें।',

    // How It Works
    'how.eyebrow': 'आसान 4-स्टेप प्रक्रिया',
    'how.title': 'Hindi PDF Editor कैसे काम करता है',
    'how.subtitle': 'बिना किसी सॉफ्टवेयर इंस्टालेशन, बिना अकाउंट बनाए और बिना किसी सर्वर अपलोड के।',
    'how.step1Title': 'पीडीएफ फाइल खोलें',
    'how.step1Desc': 'अपनी पीडीएफ फाइल एडिटर में ड्रैग-एंड-ड्रॉप करें। फाइल तुरंत हाई-रेजोल्यूशन में आपके डिवाइस पर खुल जाएगी।',
    'how.step2Title': 'टेक्स्ट सेलेक्ट या मास्क करें',
    'how.step2Desc': 'जिस टेक्स्ट को बदलना है उस पर क्लिक करें। एडिटर पुराने टेक्स्ट को बैकग्राउंड से मैच करके छिपा देता है।',
    'how.step3Title': 'यूनिकोड हिंदी में टाइप करें',
    'how.step3Desc': 'अपने मोबाइल या कंप्यूटर के किसी भी हिंदी कीबोर्ड (Google Indic, Mangal, InScript) से शुद्ध हिंदी टाइप करें।',
    'how.step4Title': 'वेक्टर पीडीएफ डाउनलोड करें',
    'how.step4Desc': 'Export PDF पर क्लिक करके तुरंत नया हाई-क्वालिटी पीडीएफ सेव करें जो हर स्मार्टफोन और पीसी पर साफ दिखता है।',

    // Comparison
    'comp.eyebrow': 'तुलना और बेंचमार्क',
    'comp.title': 'Hindi PDF Editor अन्य टूल्स से बेहतर क्यों है?',
    'comp.subtitle': 'जानिए हमारा देवनागरी इंजन साधारण अंग्रेजी एडिटर्स की तुलना में कैसे बेहतर परिणाम देता है।',
    'comp.thFeature': 'प्रमुख सुविधा',
    'comp.thOur': 'Hindi PDF Editor',
    'comp.thAdobe': 'Adobe Acrobat',
    'comp.thCanva': 'Canva PDF',
    'comp.thSmallpdf': 'Smallpdf / iLovePDF',

    // Use Cases
    'use.eyebrow': 'दस्तावेजों के अनुसार समाधान',
    'use.title': 'वास्तविक सरकारी और कानूनी दस्तावेजों के लिए निर्मित',
    'use.subtitle': 'उत्तर प्रदेश, बिहार, मध्य प्रदेश और राजस्थान के सरकारी फॉर्म से लेकर कोर्ट एफिडेविट तक — पूरे भरोसे के साथ एडिट करें।',
    'use.admitCard': 'सरकारी नौकरी व परीक्षा एडमिट कार्ड',
    'use.admitCardDesc': 'UP Police, BPSC, SSC और रेलवे भर्ती फॉर्म के एडमिट कार्ड में नाम, पिता का नाम या जन्मतिथि की गलती आसानी से सुधारें।',
    'use.legal': 'कानूनी शपथ पत्र और ई-स्टांप पेपर',
    'use.legalDesc': '₹10, ₹50, ₹100 के ई-स्टांप पेपर पर 4.5 इंच मार्जिन के साथ सही हिंदी एफिडेविट, किरायानामा और अनुबंध पत्र तैयार करें।',
    'use.land': 'भूलेख खसरा-खतौनी और परिमार्जन',
    'use.landDesc': 'यूपी भूलेख, बिहार भूमि परिमार्जन और एमपी खतौनी में काश्तकार का नाम, गाटा संख्या और रकबा सुधार का प्रपत्र तैयार करें।',
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
    'art.subtitle': 'सरकारी फॉर्म, एडमिट कार्ड, टूटी मात्राओं को ठीक करने और अनुवाद करने के स्टेप-बाय-स्टेप समाधान।',
    'art.viewAll': 'सभी गाइड्स और लेख देखें →',

    // CTA & Footer
    'cta.title': 'अपनी हिंदी पीडीएफ आसानी से तैयार करें।',
    'cta.subtitle': 'ब्राउज़र में एडिटर खोलें या एंड्रॉयड ऐप डाउनलोड करें। 100% फ्री, सुरक्षित और देवनागरी-फ्रेंडली।',
    'cta.open': 'एडिटर खोलें →',
    'cta.play': 'गूगल प्ले ऐप',
    'footer.desc': 'हिंदी पीडीएफ के साथ काम करने के लिए भारत का पहला सुरक्षित, लोकल-फर्स्ट देवनागरी एडिटर।',
    'footer.editOcr': 'एडिट और ओसीआर',
    'footer.organize': 'प्रबंधन और कंप्रेस',
    'footer.resources': 'संसाधन और गाइड्स',
    'footer.rights': '© 2026 Hindi PDF Editor. सर्वाधिकार सुरक्षित।',
    'footer.tagline': '100% क्लाइंट-साइड प्रोसेसिंग · शून्य सर्वर स्टोरेज',

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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    if (urlLang === 'hi' || urlLang === 'en') return urlLang;
    const saved = localStorage.getItem('preferred_language');
    if (saved === 'hi' || saved === 'en') return saved;
    if (navigator.language && navigator.language.startsWith('hi')) return 'hi';
    return 'en';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred_language', newLang);
      document.documentElement.lang = newLang;
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

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
