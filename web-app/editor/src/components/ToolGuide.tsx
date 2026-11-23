import { ArrowRight, ShieldCheck } from "lucide-react";

import type { Language } from "../lib/i18n";
import { toolGuide, TOOL_GUIDES } from "../lib/toolGuides";
import { TOOL_HINDI_NAMES, TOOLS, toolHref, type ToolId } from "../lib/tools";
import "./ToolGuide.css";

type Props = { toolId: ToolId; language: Language };

const ARTICLE_TITLES: Record<string, string> = {
  "how-to-edit-hindi-pdf": "How to edit Hindi text in a PDF",
  "fix-broken-hindi-fonts-in-pdf": "Broken Hindi fonts in PDF: diagnose before editing",
  "kruti-dev-to-unicode-hindi-pdf-editor": "Kruti Dev PDF to Unicode: conversion limits and safe editing",
  "parimarjan-plus-affidavit-pdf-guide": "Parimarjan Plus affidavit PDF: official format and preparation",
  "name-correction-application-and-affidavit-guide": "Name correction application and affidavit",
  "swapramanit-ghoshna-patra-edistrict-hindi-pdf": "स्वप्रमाणित घोषणा पत्र PDF: सही प्रारूप में अपना आवेदन भरें",
  "translate-hindi-pdf-to-english": "Translate Hindi PDF to English: consent and review",
  "merge-multiple-hindi-pdf-files-online": "Merge Hindi PDF files online: order and output checks",
  "compress-scanned-hindi-pdf-without-blur": "Compress scanned Hindi PDF: check clarity and file size",
  "pdf-size-kam-kaise-kare-100kb-sarkari-form": "PDF साइज कम करें: 100KB लक्ष्य और साफ अक्षर की जाँच",
  "e-stamp-paper-par-hindi-matter-print-margin-guide": "e-Stamp पर हिंदी मसौदा: पहले प्रिंट लेआउट जाँचें",
};

/** Hindi-language article that covers the same task, shown to Hindi readers instead. */
const HINDI_EQUIVALENT: Record<string, string> = {
  "how-to-edit-hindi-pdf": "hindi-pdf-kaise-edit-kare",
  "fix-broken-hindi-fonts-in-pdf": "hindi-pdf-font-kaise-thik-kare",
  "kruti-dev-to-unicode-hindi-pdf-editor": "kruti-dev-pdf-unicode-converter-hindi",
  "parimarjan-plus-affidavit-pdf-guide": "bihar-bhumi-parimarjan-plus-shapath-patra-pdf",
  "name-correction-application-and-affidavit-guide": "sarkari-admit-card-name-correction-affidavit-hindi",
};

const HINDI_TITLES: Record<string, string> = {
  "hindi-pdf-kaise-edit-kare": "हिंदी PDF कैसे एडिट करें: टेक्स्ट जोड़ें और कॉपी जाँचें",
  "hindi-pdf-font-kaise-thik-kare": "PDF में हिंदी फॉन्ट टूट रहे हैं? पहले कारण पहचानें",
  "kruti-dev-pdf-unicode-converter-hindi": "Kruti Dev PDF और Unicode: कन्वर्जन की सीमाएँ",
  "bihar-bhumi-parimarjan-plus-shapath-patra-pdf": "परिमार्जन प्लस शपथ पत्र PDF: आधिकारिक प्रारूप और तैयारी",
  "sarkari-admit-card-name-correction-affidavit-hindi": "नाम सुधार आवेदन और शपथ पत्र: प्रवेश पत्र में त्रुटि हो तो क्या करें",
};

function guideLinks(toolId: ToolId, language: Language) {
  return TOOL_GUIDES[toolId].guides.map((slug) => {
    const hindi = language === "hi" ? HINDI_EQUIVALENT[slug] : undefined;
    const target = hindi ?? slug;
    return { href: `/articles/${target}/`, title: hindi ? HINDI_TITLES[hindi] : ARTICLE_TITLES[slug] };
  });
}

/**
 * Help shown under a tool's file picker: steps, limits, questions and related guides.
 * Pure markup so the build can prerender it into the static tool page.
 */
export function ToolGuide({ toolId, language }: Props) {
  const copy = toolGuide(toolId, language);
  const hi = language === "hi";
  const related = TOOLS.filter((t) => t.id !== toolId && t.category === TOOLS.find((x) => x.id === toolId)?.category);

  return (
    <section className="tool-guide" aria-labelledby="tool-guide-heading" lang={language}>
      <h2 id="tool-guide-heading" className="tool-guide__heading">{copy.heading}</h2>
      <ol className="tool-guide__steps">
        {copy.steps.map((step, index) => (
          <li key={step.title}>
            <span className="tool-guide__step-num" aria-hidden="true">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="tool-guide__grid">
        <div className="tool-guide__notes">
          <h2>{hi ? "जानने लायक बातें" : "Good to know"}</h2>
          <ul>
            {copy.notes.map((note) => (
              <li key={note}>
                <ShieldCheck size={18} aria-hidden="true" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="tool-guide__faq">
          <h2>{hi ? "सवाल-जवाब" : "Questions"}</h2>
          {copy.faqs.map((faq) => (
            <details key={faq.q}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      <nav className="tool-guide__more" aria-label={hi ? "और पढ़ें" : "Further reading"}>
        <div>
          <h2>{hi ? "गाइड" : "Guides"}</h2>
          <ul>
            {guideLinks(toolId, language).map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.title}</a>
              </li>
            ))}
          </ul>
        </div>
        {related.length > 0 && (
          <div>
            <h2>{hi ? "इससे जुड़े टूल" : "Related tools"}</h2>
            <ul>
              {related.map((t) => (
                <li key={t.id}>
                  <a href={toolHref(t.id, hi ? "hi" : undefined)}>
                    {hi ? TOOL_HINDI_NAMES[t.id] : t.title}
                    <ArrowRight size={15} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
    </section>
  );
}
