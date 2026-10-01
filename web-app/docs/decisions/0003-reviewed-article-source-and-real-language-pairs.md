# Reviewed source content and genuine language pairs

Decision: `scripts/seo-keyword-queue.json` owns guide content and review dates; `scripts/article-template.mjs` renders static pages using `assets/article.css` and shared design tokens. `refresh:content` generates articles, the hub and machine-readable summaries. `test:content` rejects source/output drift, unsafe identities and broken reciprocal pairs.

Hreflang is emitted only for distinct, genuinely translated pages with reciprocal `alternateSlug` values. Each locale has its own canonical. Unpaired guides receive no invented English/Hindi alternates. Publication dates are retained; review dates change only when editorial review occurs.

Why: the previous generator repeated one URL as both languages, drifted from hand-edited pages and reused unsupported privacy/export claims. Government guides must separate filling one's application from changing an issued record, link official sources and label examples as fictional.

Rejected: synonym landing pages, automatic low-value translations, fabricated author credentials, guaranteed export/shaping claims and blanket official-document correction instructions.
