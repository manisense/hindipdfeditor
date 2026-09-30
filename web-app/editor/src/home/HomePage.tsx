import {
  ArrowRight,
  BookOpen,
  Combine,
  FileArchive,
  Globe,
  Languages,
  Menu,
  Pencil,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "../lib/i18n";
import { TOOLS, toolHref, type ToolId } from "../lib/tools";
import { getFaqs } from "./faqData";
import { LOGO_BADGE, PLAY_STORE_URL } from "./links";
import "./HomePage.css";

const icons = {
  edit: Pencil,
  translate: Languages,
  merge: Combine,
  split: Scissors,
  compress: FileArchive,
};
const hindiTools: Record<ToolId, string> = {
  edit: "हिंदी PDF एडिट करें",
  translate: "हिंदी ↔ अंग्रेज़ी अनुवाद",
  merge: "PDF जोड़ें",
  split: "PDF अलग करें",
  compress: "PDF का आकार कम करें",
};
const hindiDescriptions: Record<ToolId, string> = {
  edit: "पहचाने गए टेक्स्ट की जगह नया टेक्स्ट रखें या टेक्स्ट बॉक्स जोड़ें। नई PDF एक्सपोर्ट करें।",
  translate:
    "सहमति के बाद सुरक्षित AI सेवा से अनुवाद करें। परिणाम देखकर नई PDF एक्सपोर्ट करें।",
  merge:
    "कई PDF को अपने चुने हुए क्रम में जोड़ें। प्रोसेसिंग आपके ब्राउज़र में होती है।",
  split: "चुने हुए पेजों से नई PDF बनाएं। आपकी मूल फ़ाइल सुरक्षित रहती है।",
  compress:
    "पेजों को इमेज में बदलकर आकार कम करें। डाउनलोड से पहले स्पष्टता जांचें।",
};

/** Crawlable landing content; heavy PDF processing stays in task routes. */
export function HomePage() {
  const { isHindi } = useLanguage();
  const text = (en: string, hi: string) => (isHindi ? hi : en);
  const navigation = (
    <>
      <a href="#features">{text("Tools", "टूल्स")}</a>
      <a href="#how-it-works">{text("How it works", "कैसे काम करता है")}</a>
      <a href="/articles/">{text("Guides", "गाइड्स")}</a>
    </>
  );
  const guides = [
    [
      "hindi-pdf-kaise-edit-kare",
      "How to edit a Hindi PDF",
      "हिंदी PDF कैसे एडिट करें",
    ],
    [
      "fix-broken-hindi-fonts-in-pdf",
      "Understand Hindi PDF font problems",
      "हिंदी PDF की फ़ॉन्ट समस्याएं समझें",
    ],
    [
      "translate-hindi-pdf-to-english",
      "Translate Hindi PDFs to English",
      "हिंदी PDF का अंग्रेज़ी में अनुवाद",
    ],
    [
      "bihar-bhumi-parimarjan-plus-shapath-patra-pdf",
      "Prepare a Parimarjan application PDF",
      "परिमार्जन आवेदन की PDF तैयार करें",
    ],
  ];
  const steps = [
    [
      "Open your PDF",
      "अपनी PDF खोलें",
      "Choose a file from your device.",
      "अपने डिवाइस से फ़ाइल चुनें।",
    ],
    [
      "Make your changes",
      "बदलाव करें",
      "Add text or mask and replace detected text.",
      "टेक्स्ट जोड़ें या पहचाने गए टेक्स्ट की जगह नया टेक्स्ट रखें।",
    ],
    [
      "Review each page",
      "हर पेज जांचें",
      "Check Hindi letters, spacing and placement.",
      "हिंदी अक्षर, दूरी और टेक्स्ट की स्थिति जांचें।",
    ],
    [
      "Export a new PDF",
      "नई PDF एक्सपोर्ट करें",
      "Download the result. Your source stays unchanged.",
      "नई फ़ाइल डाउनलोड करें। मूल फ़ाइल नहीं बदलती।",
    ],
  ];
  return (
    <div className="hpe-home">
      <a className="hpe-skip" href="#main-content">
        {text("Skip to content", "मुख्य सामग्री पर जाएं")}
      </a>
      <header className="hpe-header">
        <div className="hpe-container hpe-header-row">
          <a className="hpe-brand" href={isHindi ? "/hi/" : "/"}>
            <img src={LOGO_BADGE} width="32" height="32" alt="" />
            <span>
              Hindi PDF <strong>Editor</strong>
            </span>
          </a>
          <nav
            className="hpe-desktop-nav"
            aria-label={text("Main navigation", "मुख्य नेविगेशन")}
          >
            {navigation}
          </nav>
          <div className="hpe-header-actions">
            <a
              className="hpe-language"
              href={isHindi ? "/" : "/hi/"}
              lang={isHindi ? "en" : "hi"}
            >
              <Globe size={16} aria-hidden="true" />
              {isHindi ? "English" : "हिन्दी"}
            </a>
            <details className="hpe-mobile-nav">
              <summary aria-label={text("Navigation menu", "नेविगेशन मेन्यू")}>
                <Menu aria-hidden="true" size={20} />
              </summary>
              <nav aria-label={text("Mobile navigation", "मोबाइल नेविगेशन")}>
                {navigation}
              </nav>
            </details>
          </div>
        </div>
      </header>
      <main id="main-content">
        <section className="hpe-container hpe-hero">
          <div>
            <p className="hpe-eyebrow">
              {text("Made for Hindi documents", "हिंदी दस्तावेज़ों के लिए")}
            </p>
            <h1>
              <span lang="en">Hindi PDF Editor Online</span>
              <span lang="hi">हिंदी PDF ऑनलाइन संपादित करें</span>
            </h1>
            <p className="hpe-lead">
              {text(
                "Add and replace Hindi text, review your changes, and export a new PDF. Merge, split and translate documents from the same toolset.",
                "हिंदी टेक्स्ट जोड़ें या बदलें, परिणाम जांचें और नई PDF एक्सपोर्ट करें। इसी टूलसेट से PDF जोड़ें, अलग करें और अनुवाद करें।",
              )}
            </p>
            <div className="hpe-actions">
              <a className="hpe-button hpe-primary" href={toolHref("edit")}>
                {text("Open Hindi PDF Editor", "हिंदी PDF एडिटर खोलें")}
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a
                className="hpe-button hpe-secondary"
                href="/assets/samples/devanagari-fixture.pdf"
                download
              >
                {text("Download a sample PDF", "नमूना PDF डाउनलोड करें")}
              </a>
            </div>
            <p className="hpe-privacy">
              <ShieldCheck size={20} aria-hidden="true" />
              {text(
                "Core editing stays on your device. AI OCR and translation process only the content you approve.",
                "सामान्य एडिटिंग आपके डिवाइस पर होती है। AI OCR और अनुवाद केवल आपकी सहमति से सामग्री प्रोसेस करते हैं।",
              )}
            </p>
          </div>
          <figure className="hpe-preview">
            <img
              src="/assets/samples/devanagari-fixture.png"
              width="612"
              height="792"
              alt={text(
                "Hindi test PDF with conjuncts, vowel marks and reph",
                "संयुक्ताक्षर, मात्राओं और रेफ वाला हिंदी टेस्ट PDF",
              )}
              fetchPriority="high"
            />
            <figcaption>
              {text(
                "Original test PDF. Download it, open it in the editor and check your exported result.",
                "मूल टेस्ट PDF। इसे डाउनलोड करके एडिटर में खोलें और एक्सपोर्ट किया गया परिणाम जांचें।",
              )}
            </figcaption>
          </figure>
        </section>
        <section id="features" className="hpe-section hpe-cream">
          <div className="hpe-container">
            <h2>{text("Choose your PDF task", "अपना PDF काम चुनें")}</h2>
            <div className="hpe-tool-grid">
              {TOOLS.map((tool) => {
                const Icon = icons[tool.id];
                return (
                  <a
                    className="hpe-card"
                    href={toolHref(tool.id)}
                    key={tool.id}
                  >
                    <span className={`hpe-chip hpe-chip-${tool.id}`}>
                      <Icon size={24} aria-hidden="true" />
                    </span>
                    <h3>{isHindi ? hindiTools[tool.id] : tool.title}</h3>
                    <p>
                      {isHindi ? hindiDescriptions[tool.id] : tool.description}
                    </p>
                    <span className="hpe-link">
                      {text("Open tool", "टूल खोलें")}
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
        <section id="how-it-works" className="hpe-section">
          <div className="hpe-container">
            <h2>
              {text("From your file to a new PDF", "अपनी फ़ाइल से नई PDF तक")}
            </h2>
            <ol className="hpe-steps">
              {steps.map((step, i) => (
                <li key={step[0]}>
                  <span className="hpe-step-number">{i + 1}</span>
                  <h3>{text(step[0], step[1])}</h3>
                  <p>{text(step[2], step[3])}</p>
                </li>
              ))}
            </ol>
            <div className="hpe-limitations">
              <h3>{text("Know what changes", "बदलाव को समझें")}</h3>
              <p>
                {text(
                  "Text replacement uses overlays; it does not reflow surrounding paragraphs. Scanned pages need text detection. Legacy fonts may require a confirmed Unicode replacement workflow; unknown encodings remain blocked. Browser exports are image-based, so check readability before sharing.",
                  "टेक्स्ट बदलने के लिए ओवरले इस्तेमाल होते हैं; आसपास के पैराग्राफ अपने आप नहीं बदलते। स्कैन किए गए पेजों में टेक्स्ट पहचान जरूरी है। पुराने फ़ॉन्ट में चेतावनी के बाद यूनिकोड टेक्स्ट रखना पड़ सकता है; अज्ञात एन्कोडिंग में एडिटिंग रोकी जाती है। ब्राउज़र एक्सपोर्ट इमेज आधारित है, इसलिए साझा करने से पहले स्पष्टता जांचें।",
                )}
              </p>
              <p>
                {text(
                  "Editing a downloaded official document does not correct the issuing authority’s record. Use the official correction process.",
                  "डाउनलोड किए गए सरकारी दस्तावेज़ को एडिट करने से विभाग का रिकॉर्ड नहीं बदलता। आधिकारिक सुधार प्रक्रिया अपनाएं।",
                )}
              </p>
            </div>
          </div>
        </section>
        <section className="hpe-section hpe-cream">
          <div className="hpe-container">
            <h2>
              {text("Helpful Hindi PDF guides", "हिंदी PDF की उपयोगी गाइड्स")}
            </h2>
            <div className="hpe-guide-grid">
              {guides.map(([slug, en, hi]) => (
                <a key={slug} className="hpe-card" href={`/articles/${slug}/`}>
                  <BookOpen size={24} aria-hidden="true" />
                  <h3>{text(en, hi)}</h3>
                  <span className="hpe-link">
                    {text("Read guide", "गाइड पढ़ें")}
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
        <section id="faq" className="hpe-section">
          <div className="hpe-container hpe-reading">
            <h2>{text("Common questions", "आम सवाल")}</h2>
            {getFaqs(isHindi ? "hi" : "en").map((faq) => (
              <details className="hpe-faq" key={faq.q}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="hpe-section hpe-cream">
          <div className="hpe-container">
            <h2>
              {text(
                "Ready to work on your Hindi PDF?",
                "अपनी हिंदी PDF पर काम शुरू करें",
              )}
            </h2>
            <div className="hpe-actions">
              <a className="hpe-button hpe-primary" href={toolHref("edit")}>
                {text("Open the editor", "एडिटर खोलें")}
              </a>
              <a className="hpe-button hpe-secondary" href={PLAY_STORE_URL}>
                {text("Get the Android app", "एंड्रॉयड ऐप डाउनलोड करें")}
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="hpe-footer">
        <div className="hpe-container">
          <a className="hpe-brand" href={isHindi ? "/hi/" : "/"}>
            Hindi PDF <strong>Editor</strong>
          </a>
          <nav aria-label={text("Resources", "उपयोगी लिंक")}>
            <a href="/articles/">{text("Guides", "गाइड्स")}</a>
            <a href="/privacy/">{text("Privacy", "प्राइवेसी")}</a>
            <a href="/data-safety/">{text("Data safety", "डेटा सुरक्षा")}</a>
            <a href="/terms/">{text("Terms", "नियम")}</a>
            <a href="/support/">{text("Support", "सहायता")}</a>
          </nav>
          <p>
            {text(
              "Core editing stays local. Optional AI processing requires your consent.",
              "सामान्य एडिटिंग स्थानीय रहती है। वैकल्पिक AI प्रोसेसिंग के लिए आपकी सहमति जरूरी है।",
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
