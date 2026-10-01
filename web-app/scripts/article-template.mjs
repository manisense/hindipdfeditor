const origin = "https://hindipdfeditor.com";
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
function link(url, label) {
  if (!/^(https:\/\/|\/|#)/.test(url))
    throw new Error("Unsupported article link");
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}
export function renderArticle(item, articles) {
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) ||
    !["en", "hi"].includes(item.language)
  )
    throw new Error("Invalid article identity");
  if (!item.reviewedDate)
    throw new Error("Article requires recorded editorial review");
  const hi = item.language === "hi";
  const url = `${origin}/articles/${item.slug}/`;
  const e = escapeHtml;
  const alternate = articles.find(
    (a) =>
      a.slug === item.alternateSlug &&
      a.alternateSlug === item.slug &&
      a.language !== item.language,
  );
  const hreflang = alternate
    ? [item, alternate]
        .map(
          (a) =>
            `<link rel="alternate" hreflang="${a.language}" href="${origin}/articles/${a.slug}/" />`,
        )
        .join("") +
      `<link rel="alternate" hreflang="x-default" href="${origin}/articles/${[item, alternate].find((a) => a.language === "en").slug}/" />`
    : "";
  const faqs = item.faqs || [];
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": url + "#article",
        headline: item.title,
        description: item.metaDescription,
        inLanguage: item.language,
        datePublished: item.publishedDate,
        dateModified: item.reviewedDate || item.publishedDate,
        author: {
          "@type": "Person",
          "@id": origin + "/about/#manish",
          name: "Manish",
          url: origin + "/about/",
        },
        publisher: {
          "@type": "Organization",
          name: "Hindi PDF Editor",
          url: origin + "/",
        },
        mainEntityOfPage: url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Hindi PDF Editor",
            item: origin + "/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: hi ? "गाइड्स" : "Guides",
            item: origin + "/articles/",
          },
          { "@type": "ListItem", position: 3, name: item.title, item: url },
        ],
      },
      ...(faqs.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ]
        : []),
    ],
  };
  return `<!doctype html><html lang="${item.language}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${e(item.title)} — Hindi PDF Editor</title><meta name="description" content="${e(item.metaDescription)}"/><meta name="robots" content="index,follow,max-image-preview:large"/><link rel="canonical" href="${url}"/>${hreflang}<meta property="og:type" content="article"/><meta property="og:title" content="${e(item.title)}"/><meta property="og:description" content="${e(item.metaDescription)}"/><meta property="og:url" content="${url}"/><meta property="og:locale" content="${hi ? "hi_IN" : "en_IN"}"/><meta property="og:image" content="${origin}/assets/app-icon.png"/><meta name="twitter:card" content="summary"/><link rel="icon" href="/favicon.ico"/><link rel="stylesheet" href="/assets/article.css"/><script src="/assets/analytics.js" defer></script><script type="application/ld+json">${JSON.stringify(graph).replace(/</g, "\\u003c")}</script></head><body>
 <header class="guide-header"><a class="guide-brand" href="${hi ? "/hi/" : "/"}"><img src="/assets/app-icon.png" width="32" height="32" alt=""/>Hindi PDF Editor</a><nav aria-label="${hi ? "नेविगेशन" : "Navigation"}">${link("/articles/", hi ? "सभी गाइड्स" : "All guides")}${alternate ? link("/articles/" + alternate.slug + "/", hi ? "English" : "हिन्दी") : ""}${link("/tools/edit-hindi-pdf/", hi ? "एडिटर खोलें" : "Open editor")}</nav></header>
 <main class="guide-main"><nav class="guide-breadcrumb" aria-label="Breadcrumb">${link(hi ? "/hi/" : "/", hi ? "होम" : "Home")} / ${link("/articles/", hi ? "गाइड्स" : "Guides")}</nav><span class="guide-category">${e(item.category)}</span><h1>${e(item.title)}</h1><p class="guide-lede">${e(item.metaDescription)}</p><p class="guide-meta">${hi ? "लेखक" : "Written by"} ${link(hi ? "/hi/about/" : "/about/", "Manish")} · ${hi ? "समीक्षा" : "Reviewed"} ${e(item.reviewedDate || item.publishedDate)}</p>
 <aside class="guide-answer"><h2>${hi ? "सीधा उत्तर" : "Direct answer"}</h2><p>${e(item.directAnswer)}</p></aside>
 <nav class="guide-toc" aria-label="${hi ? "इस गाइड में" : "On this page"}"><ul>${(item.sections || []).map((s, i) => `<li>${link("#section-" + i, s.heading)}</li>`).join("")}</ul></nav>
 ${(item.sections || []).map((s, i) => `<section id="section-${i}"><h2>${e(s.heading)}</h2>${s.paragraphs.map((p) => `<p>${e(p)}</p>`).join("")}</section>`).join("")}
 ${(item.steps || []).length ? `<section><h2>${hi ? "काम करने का तरीका" : "Workflow"}</h2><ol class="guide-steps">${item.steps.map((s) => `<li><h3>${e(s.title)}</h3><p>${e(s.desc)}</p></li>`).join("")}</ol></section>` : ""}
 ${item.sample ? `<section><h2>${hi ? "पहले नमूने पर अभ्यास करें" : "Practice on a sample first"}</h2><figure><img src="/assets/samples/devanagari-fixture.png" width="612" height="792" loading="lazy" alt="${hi ? "संयुक्त अक्षर और मात्राओं वाली देवनागरी परीक्षण PDF" : "Devanagari test PDF containing conjuncts and vowel marks"}"/><figcaption>${hi ? "यह परीक्षण पेज है, सरकारी प्रपत्र नहीं।" : "This is a test page, not an official form."}</figcaption></figure>${link("/assets/samples/devanagari-fixture.pdf", hi ? "परीक्षण PDF डाउनलोड करें" : "Download the test PDF")}</section>` : ""}
 ${item.sources?.length ? `<section><h2>${hi ? "आधिकारिक स्रोत" : "Official sources"}</h2><ul>${item.sources.map((s) => `<li>${link(s.url, s.label)}</li>`).join("")}</ul><p>${hi ? "प्रपत्र और नियम बदल सकते हैं। जमा करने से पहले आधिकारिक पोर्टल पर वर्तमान निर्देश देखें।" : "Forms and instructions can change. Check the official portal before submitting."}</p></section>` : ""}
 ${faqs.length ? `<section><h2>${hi ? "अक्सर पूछे जाने वाले प्रश्न" : "Frequently asked questions"}</h2>${faqs.map((f) => `<details><summary>${e(f.q)}</summary><p>${e(f.a)}</p></details>`).join("")}</section>` : ""}
 <aside class="guide-cta"><h2>${hi ? "अपनी PDF पर काम करें" : "Work on your PDF"}</h2><p>${hi ? "मुख्य एडिटिंग आपके ब्राउज़र में होती है। AI OCR और अनुवाद के लिए आपकी सहमति से सामग्री भेजी जाती है। एक्सपोर्ट की जाँच करें; मूल PDF सुरक्षित रहती है।" : "Core editing runs in your browser. AI OCR and translation send approved content for processing. Review the exported copy; the original PDF remains unchanged."}</p>${link(item.toolPath || "/tools/edit-hindi-pdf/", hi ? "PDF टूल खोलें" : "Open PDF tool")}</aside>
 <section><h2>${hi ? "संबंधित गाइड्स" : "Related guides"}</h2><ul>${(
   item.relatedSlugs || []
 )
   .map((slug) => articles.find((a) => a.slug === slug))
   .filter(Boolean)
   .map((a) => `<li>${link("/articles/" + a.slug + "/", a.title)}</li>`)
   .join("")}</ul></section></main>
 <footer class="guide-footer">© 2026 Hindi PDF Editor <nav>${link("/privacy/", hi ? "प्राइवेसी" : "Privacy")}${link("/support/", hi ? "सहायता" : "Support")}${link("/terms/", hi ? "शर्तें" : "Terms")}</nav></footer></body></html>`.replace(
    /[ \t]+$/gm,
    "",
  );
}
export function renderArticlesHub(articles) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Hindi PDF editing guides — Hindi PDF Editor</title><meta name="description" content="Practical Hindi and English guides for PDF editing, Devanagari fonts, translation and preparing supporting applications."/><link rel="canonical" href="${origin}/articles/"/><link rel="stylesheet" href="/assets/article.css"/><script src="/assets/analytics.js" defer></script></head><body><header class="guide-header"><a class="guide-brand" href="/">Hindi PDF Editor</a><nav>${link("/tools/edit-hindi-pdf/", "Open editor")}${link("/hi/", "हिन्दी")}</nav></header><main class="guide-main guide-hub"><h1>Hindi PDF guides<br/><span lang="hi">हिंदी PDF गाइड्स</span></h1><p>Choose a task. Each guide explains what the tools can do, their limitations and how to review the result.</p><div class="guide-grid">${articles.map((a) => `<a class="guide-card" lang="${a.language}" href="/articles/${a.slug}/"><span class="guide-category">${escapeHtml(a.category)}</span><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(a.metaDescription)}</p><span>${a.language === "hi" ? "गाइड पढ़ें" : "Read guide"}</span></a>`).join("")}</div></main><footer class="guide-footer">${link("/privacy/", "Privacy")}${link("/support/", "Support")}</footer></body></html>`.replace(
    /[ \t]+$/gm,
    "",
  );
}
