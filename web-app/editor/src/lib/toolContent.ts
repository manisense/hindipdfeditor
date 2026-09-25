import type { Language } from './i18n';
import type { ToolId } from './tools';

/**
 * Crawlable copy for each tool page, per language. Everything here must describe what the
 * code actually does today — answer engines quote this text verbatim.
 */
export type ToolCopy = {
  /** Visible page heading (H1). */
  heading: string;
  /** `<title>` text, without the site-name suffix. */
  metaTitle: string;
  metaDescription: string;
  intro: string;
  steps: readonly string[];
  faqs: readonly { q: string; a: string }[];
};

export const TOOL_COPY: Record<ToolId, Record<Language, ToolCopy>> = {
  edit: {
    en: {
      heading: 'Edit Hindi text in PDF online',
      metaTitle: 'Edit Hindi PDF Online Free — Change Hindi Text Without Font Problems',
      metaDescription:
        'Edit Hindi text in a PDF online: replace or add Devanagari text in a Hindi font, with matras and conjuncts intact. Free, no sign-up, and the PDF stays on your device.',
      intro:
        'Open a PDF, tap detected Hindi or English text to replace it, add new text boxes, or erase text baked into the page. New Hindi text is typed in Unicode and shaped by the browser, so matras like ि and conjuncts like क्ष stay joined.',
      steps: [
        'Open a PDF from your device. It is read in the browser and not uploaded.',
        'Tap a detected line to replace it, or choose Add text or Erase box.',
        'Type in Unicode Hindi with any Hindi keyboard, then export. You get a new PDF; the original file is not changed.',
      ],
      faqs: [
        {
          q: 'Is the exported PDF searchable text?',
          a: 'Not in the web editor. Each page is exported as a high-resolution image so Devanagari always looks exactly as it did on screen. If you need selectable text, keep the original alongside the edited copy.',
        },
        {
          q: 'Which Hindi font does it use?',
          a: 'New text is written in Noto Sans Devanagari or Noto Serif Devanagari, Unicode Hindi fonts that work on every device. You can pick sans or serif, bold, size and colour to match the text around it. The exact font of the original PDF is not reused.',
        },
        {
          q: 'Can it edit PDFs made with Kruti Dev or other legacy fonts?',
          a: 'The editor detects common legacy Hindi fonts such as Kruti Dev, DevLys and Chanakya and warns you first. It does not convert them to Unicode; new text you add is typed in a Unicode Devanagari font.',
        },
      ],
    },
    hi: {
      heading: 'पीडीएफ में हिंदी टेक्स्ट ऑनलाइन एडिट करें',
      metaTitle: 'हिंदी पीडीएफ एडिट करें ऑनलाइन फ्री — बिना फॉन्ट टूटे हिंदी टेक्स्ट बदलें',
      metaDescription:
        'ब्राउज़र में पीडीएफ का हिंदी टेक्स्ट बदलें या नया जोड़ें। मात्राएं और संयुक्ताक्षर सही जुड़े रहते हैं। फ्री, बिना अकाउंट, फाइल आपके डिवाइस पर ही रहती है।',
      intro:
        'पीडीएफ खोलें, पहचानी गई हिंदी या अंग्रेजी लाइन पर टैप करके उसे बदलें, नया टेक्स्ट जोड़ें या पेज पर छपा टेक्स्ट मिटाएं। नया हिंदी टेक्स्ट यूनिकोड में टाइप होता है और ब्राउज़र उसे सही आकार देता है, इसलिए ि जैसी मात्राएं और क्ष जैसे संयुक्ताक्षर जुड़े रहते हैं।',
      steps: [
        'अपने डिवाइस से पीडीएफ खोलें। फाइल ब्राउज़र में ही पढ़ी जाती है, अपलोड नहीं होती।',
        'किसी लाइन पर टैप करके उसे बदलें, या "टेक्स्ट जोड़ें" / "मिटाएं" चुनें।',
        'किसी भी हिंदी कीबोर्ड से यूनिकोड हिंदी टाइप करें और एक्सपोर्ट करें। नई पीडीएफ बनती है, मूल फाइल नहीं बदलती।',
      ],
      faqs: [
        {
          q: 'क्या एक्सपोर्ट की गई पीडीएफ में टेक्स्ट सर्च हो सकता है?',
          a: 'वेब एडिटर में नहीं। हर पेज हाई-रेजोल्यूशन इमेज के रूप में सेव होता है ताकि देवनागरी बिल्कुल वैसी ही दिखे जैसी स्क्रीन पर थी। सर्च होने वाला टेक्स्ट चाहिए तो मूल फाइल भी संभालकर रखें।',
        },
        {
          q: 'इसमें कौन सा हिंदी फॉन्ट इस्तेमाल होता है?',
          a: 'नया टेक्स्ट Noto Sans Devanagari या Noto Serif Devanagari में लिखा जाता है — ये यूनिकोड हिंदी फॉन्ट हर डिवाइस पर चलते हैं। आसपास के टेक्स्ट से मिलाने के लिए आप सैंस या सेरिफ, बोल्ड, साइज और रंग चुन सकते हैं। मूल पीडीएफ का फॉन्ट दोबारा इस्तेमाल नहीं होता।',
        },
        {
          q: 'क्या यह कृति देव (Kruti Dev) जैसे पुराने फॉन्ट वाली पीडीएफ एडिट कर सकता है?',
          a: 'एडिटर कृति देव, DevLys और चाणक्य जैसे पुराने हिंदी फॉन्ट पहचानकर पहले चेतावनी देता है। यह उन्हें यूनिकोड में कन्वर्ट नहीं करता; आप जो नया टेक्स्ट जोड़ते हैं वह यूनिकोड देवनागरी फॉन्ट में होता है।',
        },
      ],
    },
  },
  translate: {
    en: {
      heading: 'Translate Hindi PDF to English (and back)',
      metaTitle: 'Translate Hindi PDF to English Online — Keep the Page Layout',
      metaDescription:
        'Translate the text of a Hindi or English PDF in either direction and place it back on the page. You confirm before any text is sent for translation. Free, no account.',
      intro:
        'The tool detects Hindi or English lines in your PDF, translates them in either direction, and writes the translation back in place of the original lines. Nothing is sent to our translation service until you confirm.',
      steps: [
        'Open a PDF. Text lines are read from the file in your browser.',
        'The direction (Hindi → English or English → Hindi) is detected automatically. Pass the quick security check and confirm sending the text for translation.',
        'Review the translated lines on the page and download a new PDF.',
      ],
      faqs: [
        {
          q: 'Is my PDF uploaded for translation?',
          a: 'The PDF file itself is not uploaded. After you confirm, the detected text lines are sent to our Gemini-based translation service. For scanned or hard-to-read pages, the page image is also sent for AI text recognition. The original PDF is never modified.',
        },
        {
          q: 'Does it work on scanned Hindi PDFs?',
          a: 'Yes. Scanned pages go through text recognition first — in your browser, or with AI text recognition after you confirm. Clear, straight scans give the best results.',
        },
      ],
    },
    hi: {
      heading: 'हिंदी पीडीएफ का अंग्रेजी में अनुवाद करें (और उल्टा भी)',
      metaTitle: 'हिंदी पीडीएफ का अंग्रेजी अनुवाद ऑनलाइन — पेज लेआउट वैसा ही',
      metaDescription:
        'हिंदी या अंग्रेजी पीडीएफ के टेक्स्ट का किसी भी दिशा में अनुवाद करें और उसे पेज पर वापस लगाएं। टेक्स्ट भेजने से पहले आपकी अनुमति ली जाती है। फ्री, बिना अकाउंट।',
      intro:
        'यह टूल आपकी पीडीएफ की हिंदी या अंग्रेजी लाइनें पहचानता है, उनका अनुवाद करता है और अनुवाद को मूल लाइन की जगह लगा देता है। आपकी पुष्टि से पहले अनुवाद सर्विस को कुछ नहीं भेजा जाता।',
      steps: [
        'पीडीएफ खोलें। टेक्स्ट लाइनें आपके ब्राउज़र में ही पहचानी जाती हैं।',
        'दिशा (हिंदी → अंग्रेजी या अंग्रेजी → हिंदी) अपने-आप पहचानी जाती है। छोटा सुरक्षा चेक पूरा करें और टेक्स्ट भेजने की पुष्टि करें।',
        'पेज पर अनुवाद जांचें और नई पीडीएफ डाउनलोड करें।',
      ],
      faqs: [
        {
          q: 'क्या अनुवाद के लिए मेरी पीडीएफ अपलोड होती है?',
          a: 'पीडीएफ फाइल अपलोड नहीं होती। आपकी पुष्टि के बाद पहचानी गई टेक्स्ट लाइनें Gemini आधारित अनुवाद सर्विस को भेजी जाती हैं। स्कैन या अस्पष्ट पेज के लिए पेज की इमेज भी AI टेक्स्ट पहचान के लिए भेजी जाती है। मूल पीडीएफ कभी नहीं बदलती।',
        },
        {
          q: 'क्या स्कैन की हुई हिंदी पीडीएफ पर यह काम करता है?',
          a: 'हां। स्कैन पेज का टेक्स्ट पहले पहचाना जाता है — आपके ब्राउज़र में, या आपकी पुष्टि के बाद AI टेक्स्ट पहचान से। साफ और सीधे स्कैन पर सबसे अच्छे नतीजे मिलते हैं।',
        },
      ],
    },
  },
  merge: {
    en: {
      heading: 'Merge PDF files',
      metaTitle: 'Merge PDF Files Online Free — Combine Hindi PDFs in Your Browser',
      metaDescription:
        'Combine two or more PDFs into one file in your browser. Hindi text is copied as-is, the files are not uploaded, and there is no account or watermark.',
      intro:
        'Pick two or more PDFs and they are joined into a single file in the order you choose. Pages are copied without re-typing, so Hindi text and fonts stay exactly as they were.',
      steps: [
        'Select two or more PDF files from your device.',
        'Check the order of the files.',
        'Merge and download one combined PDF.',
      ],
      faqs: [
        {
          q: 'Will merging change the Hindi text?',
          a: 'No. Pages are copied as they are, so the original fonts and text are kept.',
        },
        {
          q: 'Are my PDFs uploaded?',
          a: 'No. Merging runs in your browser and the files stay on your device.',
        },
      ],
    },
    hi: {
      heading: 'पीडीएफ फाइलें जोड़ें (Merge PDF)',
      metaTitle: 'पीडीएफ फाइलें जोड़ें — हिंदी पीडीएफ ब्राउज़र में फ्री मर्ज करें',
      metaDescription:
        'दो या ज्यादा पीडीएफ को ब्राउज़र में एक फाइल में जोड़ें। हिंदी टेक्स्ट जैसा था वैसा रहता है, फाइलें अपलोड नहीं होतीं, कोई अकाउंट या वॉटरमार्क नहीं।',
      intro:
        'दो या ज्यादा पीडीएफ चुनें और वे आपके चुने क्रम में एक फाइल में जुड़ जाती हैं। पेज बिना दोबारा टाइप किए कॉपी होते हैं, इसलिए हिंदी टेक्स्ट और फॉन्ट बिल्कुल वैसे ही रहते हैं।',
      steps: [
        'अपने डिवाइस से दो या ज्यादा पीडीएफ चुनें।',
        'फाइलों का क्रम जांचें।',
        'मर्ज करें और एक जुड़ी हुई पीडीएफ डाउनलोड करें।',
      ],
      faqs: [
        {
          q: 'क्या मर्ज करने से हिंदी टेक्स्ट बदल जाएगा?',
          a: 'नहीं। पेज जैसे हैं वैसे ही कॉपी होते हैं, इसलिए मूल फॉन्ट और टेक्स्ट बने रहते हैं।',
        },
        {
          q: 'क्या मेरी पीडीएफ अपलोड होती है?',
          a: 'नहीं। मर्जिंग आपके ब्राउज़र में होती है और फाइलें आपके डिवाइस पर ही रहती हैं।',
        },
      ],
    },
  },
  split: {
    en: {
      heading: 'Split PDF pages',
      metaTitle: 'Split PDF Online Free — Extract Pages From a Hindi PDF',
      metaDescription:
        'Extract a page range from a PDF into a new file in your browser. The original stays unchanged and nothing is uploaded. Free, no account.',
      intro:
        'Choose a page range and it is saved as a new PDF. Pages are copied as they are, so Hindi text keeps its original fonts. Your original file is not modified.',
      steps: [
        'Open a PDF from your device.',
        'Enter the first and last page you want.',
        'Download the extracted pages as a new PDF.',
      ],
      faqs: [
        {
          q: 'Does splitting change the original PDF?',
          a: 'No. The selected pages are written to a new file; the original is left as it is.',
        },
        {
          q: 'Are my PDFs uploaded?',
          a: 'No. Splitting runs in your browser and the file stays on your device.',
        },
      ],
    },
    hi: {
      heading: 'पीडीएफ के पेज अलग करें (Split PDF)',
      metaTitle: 'पीडीएफ स्प्लिट करें — हिंदी पीडीएफ से पेज अलग करें, फ्री',
      metaDescription:
        'पीडीएफ के चुने हुए पेज ब्राउज़र में नई फाइल में निकालें। मूल फाइल नहीं बदलती और कुछ भी अपलोड नहीं होता। फ्री, बिना अकाउंट।',
      intro:
        'पेज रेंज चुनें और वह नई पीडीएफ के रूप में सेव हो जाती है। पेज जैसे हैं वैसे कॉपी होते हैं, इसलिए हिंदी टेक्स्ट के मूल फॉन्ट बने रहते हैं। आपकी मूल फाइल नहीं बदलती।',
      steps: [
        'अपने डिवाइस से पीडीएफ खोलें।',
        'पहला और आखिरी पेज नंबर डालें।',
        'निकाले गए पेज नई पीडीएफ के रूप में डाउनलोड करें।',
      ],
      faqs: [
        {
          q: 'क्या स्प्लिट करने से मूल पीडीएफ बदलती है?',
          a: 'नहीं। चुने गए पेज नई फाइल में लिखे जाते हैं; मूल फाइल वैसी ही रहती है।',
        },
        {
          q: 'क्या मेरी पीडीएफ अपलोड होती है?',
          a: 'नहीं। स्प्लिटिंग आपके ब्राउज़र में होती है और फाइल आपके डिवाइस पर ही रहती है।',
        },
      ],
    },
  },
  compress: {
    en: {
      heading: 'Compress PDF size',
      metaTitle: 'Compress PDF Online Free — Reduce PDF Size for Sarkari Form Uploads',
      metaDescription:
        'Reduce the size of a scanned PDF in your browser by re-encoding pages as JPEG with a quality slider. Useful for government portal upload limits. Nothing is uploaded.',
      intro:
        'Pages are re-drawn as JPEG images at the quality you choose, which shrinks scanned PDFs a lot. Lower quality gives a smaller file. Because pages become images, text in the result is no longer selectable.',
      steps: [
        'Open the PDF you need to shrink.',
        'Move the quality slider — lower means a smaller file.',
        'Compress, download, and check the new size against the portal limit.',
      ],
      faqs: [
        {
          q: 'Can I reach an exact size like 100 KB?',
          a: 'There is no exact-size target yet. Lower the quality step by step and check the downloaded size until it is under the portal limit.',
        },
        {
          q: 'Will the text stay selectable?',
          a: 'No. Compressed pages are images, so text cannot be selected or searched. Keep the original if you need that.',
        },
      ],
    },
    hi: {
      heading: 'पीडीएफ का साइज कम करें (Compress PDF)',
      metaTitle: 'पीडीएफ साइज कम करें — सरकारी फॉर्म अपलोड के लिए फ्री कंप्रेस',
      metaDescription:
        'स्कैन की हुई पीडीएफ का साइज ब्राउज़र में कम करें — पेज क्वालिटी स्लाइडर के साथ JPEG में बदले जाते हैं। सरकारी पोर्टल की साइज लिमिट के लिए उपयोगी। कुछ भी अपलोड नहीं होता।',
      intro:
        'पेज आपकी चुनी क्वालिटी पर JPEG इमेज के रूप में दोबारा बनते हैं, जिससे स्कैन की हुई पीडीएफ काफी छोटी हो जाती है। कम क्वालिटी से फाइल और छोटी होती है। पेज इमेज बन जाते हैं, इसलिए नतीजे में टेक्स्ट सेलेक्ट नहीं होता।',
      steps: [
        'जिस पीडीएफ को छोटा करना है उसे खोलें।',
        'क्वालिटी स्लाइडर घटाएं — कम क्वालिटी यानी छोटी फाइल।',
        'कंप्रेस करके डाउनलोड करें और पोर्टल की लिमिट से साइज मिलाएं।',
      ],
      faqs: [
        {
          q: 'क्या मैं ठीक 100 KB जैसा साइज पा सकता हूं?',
          a: 'अभी तय साइज का विकल्प नहीं है। क्वालिटी धीरे-धीरे घटाएं और डाउनलोड हुई फाइल का साइज पोर्टल लिमिट से कम होने तक जांचें।',
        },
        {
          q: 'क्या टेक्स्ट सेलेक्ट हो पाएगा?',
          a: 'नहीं। कंप्रेस किए गए पेज इमेज होते हैं, इसलिए टेक्स्ट सेलेक्ट या सर्च नहीं होता। ज़रूरत हो तो मूल फाइल रखें।',
        },
      ],
    },
  },
};
