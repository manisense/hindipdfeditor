# Fix the plumbing, then own broken matras

hindipdfeditor.com can rank on Google and get cited by AI answer engines in 2026, but not with the tactics it has used so far. The problem is not missing "GEO tricks". The site already has an AI-bot allow-list, llms.txt and FAQ schema. What is broken is the basics underneath them. **The homepage 302-redirects to a client-rendered React shell whose `<body>` is an empty `<div id="root">`**, so AI crawlers that don't run JavaScript see no headline, copy or links. Hreflang is broken on nearly every page, and no Hindi homepage or Hindi tool URL exists. Sixteen thin articles were auto-published by a daily bot. Several published claims ("vector PDF", "convert Kruti Dev to Unicode", "100% correct shaping") contradict the code, and answer engines will repeat them word for word. The winnable ground is also clear. **Hindi-specific problem queries (broken matras, garbled copy-paste, editing an existing Hindi line, Kruti Dev PDFs) are answered today by Adobe Community threads, Quora, YouTube and thin vendor listicles.** Those are classic signs of a weak results page, and the product's real differentiator (correct Devanagari shaping through a render-and-print pipeline, in the browser, with no upload) is exactly the fix those searchers want. The plan below runs in order. First, repair crawlability, URLs and false claims (weeks 1–3). Second, build real bilingual tool pages and a small set of deep, human-reviewed guides anchored on a published, reproducible Hindi-shaping benchmark (months 1–3). Third, earn off-site mentions through Hindi YouTube, forum answers and CSC-operator communities, which correlate with AI visibility far more than backlinks do (ongoing). Expect results slowly. In Ahrefs' 2025 data only **1.74% of new pages reached Google's top 10 within a year**, so long-tail Hindi queries are the realistic 3–12 month target, and generic "compress pdf" is not ([Ahrefs](https://ahrefs.com/blog/how-long-does-it-take-to-rank-in-google-and-how-old-are-top-ranking-pages/)).

*Evidence note:* this report comes from a read-only audit of the repository (`web-app/`) plus web research. The live site, Search Console, keyword tools and several primary Google, OpenAI and Cloudflare pages were blocked from the research sandbox. So live HTTP behavior is inferred from repo config, **no keyword volume here was measured directly**, and some platform facts come from secondary reporting. Each such point is flagged where it matters.

## The site's strongest content is invisible to crawlers

The most damaging problems are structural, and they sit underneath all the SEO work already done. Four of them are headline issues. Several smaller issues are listed after them.

### Homepage and tool URLs send contradictory signals

The first line of [`_redirects`](../web-app/_redirects) is `/ /edit/ 302`. The redirect stub at [`index.html`](../web-app/index.html) still declares `canonical https://hindipdfeditor.com/`. [`sitemap.xml`](../web-app/sitemap.xml) lists `/` as its first URL. Every article's logo and breadcrumb "Home" link points at `/`. So Google gets told four different things about which URL is the homepage.

The five tools are not separate pages either. They are query-string states of one single-page app (`/edit/?tool=merge` and so on). Their raw-HTML canonical is `/edit/`. JavaScript rewrites that canonical to `/edit/?tool=x` only after the page renders ([`seo.ts`](../web-app/editor/src/lib/seo.ts)). Google's JavaScript SEO guidance specifically warns against a JS canonical that differs from the raw HTML one ([Google](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)).

### Most AI crawlers can't read the product or marketing pages

`/edit/` is a plain `vite build` with no prerendering and no `<noscript>` fallback ([`editor/index.html`](../web-app/editor/index.html)). That means the hero H1, feature copy, comparison table, use cases and FAQ all render only in the browser.

Vercel studied GPTBot, ClaudeBot, PerplexityBot and other AI crawlers. **They fetch JavaScript files but do not execute them** ([Vercel](https://vercel.com/blog/the-rise-of-the-ai-crawler)). For ChatGPT, Claude and Perplexity, the product therefore exists only as head metadata, JSON-LD, llms.txt and the 16 static articles.

### Hindi pages are missing, and hreflang is broken almost everywhere

The Hindi UI exists only as client state. It is chosen from `?lang=`, localStorage or `navigator.language`, and never gets a URL of its own ([`i18n.tsx`](../web-app/editor/src/lib/i18n.tsx)). Google says to use a dedicated URL for each language, not cookies or browser-language switching ([Google](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)).

Hreflang makes things worse:

- **12 of 16 articles declare `en`, `hi` and `x-default` all pointing to themselves.** So English pages claim to be the Hindi version, and some Devanagari pages claim to be English. For example, [`fix-broken-hindi-fonts-in-pdf`](../web-app/articles/fix-broken-hindi-fonts-in-pdf/index.html), lines 13–15, verified in the repo.
- The four real Hindi–English pairs are not reciprocal, and they aren't even true translations. "How to edit a Hindi PDF" is paired with "why fonts break".
- The generator hard-codes this block ([`seo-worker.mjs`](../web-app/scripts/seo-worker.mjs), ~lines 143–145), so every future article would inherit it.

Google ignores hreflang that isn't bidirectional ([Google](https://developers.google.com/search/docs/specialty/international/localized-versions)). In effect the site has **zero working language clusters**, and Hindi searchers can land only on 8 Devanagari articles and 4 legal pages.

### A missing 404 page probably turns bad URLs into soft 404s

There is no `404.html` (verified). Cloudflare Pages treats a project without one as a single-page app. It serves the root `index.html` with a 200 status for unknown paths ([Cloudflare](https://developers.cloudflare.com/pages/configuration/serving-pages/)). Here that root is a meta-refresh to `/edit/`, which Search Console typically flags as a soft 404. This is inferred, because live status codes could not be tested.

### Smaller hygiene problems add up

- **Duplicate structured data.** The rendered `/edit/` page carries two JSON-LD graphs with the same `@id`s: a static one with 7 FAQs and an injected one with 9. Tool pages keep the hub's FAQPage and HowTo even though that content isn't visible there ([`seo.ts`](../web-app/editor/src/lib/seo.ts)).
- **Stale-cache risk.** `/assets/*` is served `max-age=31536000, immutable` even though `site.css`, `site.js` and `analytics.js` have no content hash ([`_headers`](../web-app/_headers)). Returning visitors could run stale CSS or analytics code for up to a year after a deploy.
- **Internal playbook is public.** `prepare-publish.mjs` copies the internal `SEO_GEO_AEO_PLAYBOOK.md` into the public build ([`prepare-publish.mjs`](../web-app/scripts/prepare-publish.mjs), line 16).
- **Heavy images.** The OG image is a **997 KB 2560×1440 PNG**, and the logo is a 182 KB 1024 px PNG shown at 32 px. Both are costly on low-end Indian mobile connections.
- **Long titles.** About 12 of 16 article titles run over 70 characters, up to 103.
- **Emoji in the UI.** A "✨" emoji sits in every article eyebrow, which breaks the repo's own no-emoji design rule.

### Schema that no longer earns rich results

Google restricted FAQ rich results to government and health sites in 2023. It then fully deprecated them: a notice went up in May 2026, and Search Console removed FAQ reporting in June and its API support in August ([Search Engine Journal](https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/)). HowTo rich results were already gone ([Google](https://developers.google.com/search/blog/2023/08/howto-faq-changes)).

The `SoftwareApplication` block is not eligible for a rich result either. It lacks `aggregateRating` and `review`, uses `priceCurrency: USD`, and claims iOS, Windows, macOS and Linux support that the README does not document ([Google](https://developers.google.com/search/docs/appearance/structured-data/software-app)).

Visible FAQ content is still worth keeping for users and answer engines. But the markup should be one clean graph per page, with no duplicates.

## Claims the code can't back up will spread through answer engines

Answer engines lift sentences straight from source pages. That makes factual accuracy an SEO issue now, not just a compliance issue. Four published claims don't match the code.

**"Vector PDF."** llms.txt, llms-full.txt, the HowTo JSON-LD and several articles promise vector or "vector-accurate" output. The web exporter rasterizes each page with `html2canvas` and embeds it through `pdf.addImage(imgData, 'JPEG', …)` ([`exportPdf.ts`](../web-app/editor/src/lib/exportPdf.ts), line 78, verified). So **web exports are image-only and not text-searchable.** Whether the Android export keeps vector text was not verified.

**"Convert Kruti Dev to Unicode."** The Kruti Dev titles promise conversion. The product's own rule says it detects legacy fonts, fails closed, and allows only "raster-only Unicode replacement" of edited spans. It never decodes the legacy text ([AGENTS.md](../AGENTS.md)).

**Fonts and absolute claims.** "Embedded Mangal" appears in copy, but only Noto Sans and Noto Serif Devanagari ship with the product. There is also a "100% correct ligature shaping" claim with no published test behind it.

**Unsourced competitor claims.** Acrobat, Canva, Smallpdf and iLovePDF are said to use "naive 1:1 character mapping", with no citations and no test evidence.

These claims create two separate problems. First, users who arrive from a ChatGPT or AI Overview answer expecting searchable vector output or true Kruti Dev conversion will be disappointed. That hurts reviews and the click-satisfaction signals Google's leaked NavBoost system is built around: good, bad and last-longest clicks ([SparkToro](https://sparktoro.com/blog/an-anonymous-source-shared-thousands-of-leaked-google-search-api-documents-with-me-everyone-in-seo-should-see-them/)). Second, the claims throw away the site's most citable asset: a differentiator it can actually prove.

There is a real, documented pain behind that differentiator. Adobe Community threads from 2024–2026 describe Acrobat Pro edits in which "all the Hindi matras get scattered". Users say the problem "has existed for many years and has not been fixed" ([Adobe Community](https://community.adobe.com/t5/acrobat-discussions/hindi-language-all-pdf-edit-problem-edit-is-mismatch-not-accurate/td-p/15538131)). Microsoft Q&A has a matching thread for the Edge PDF editor ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/2403087/issue-with-editing-hindi-text-in-pdf-using-microso)).

A dated, reproducible benchmark would turn that pain into proof. Take the repo's fixture PDF (known conjuncts, matras and a reph), run it through Hindi PDF Editor, Acrobat, Edge, Smallpdf and iLovePDF, and publish screenshots. That page does the job the unsourced claims only pretend to do.

A second trust issue is more serious. Several articles tell users to change official government documents. The UP Police article says to "select the candidate name, roll number, or exam date line to mask and type the corrected text". The land-record article says to "mask the outdated plot number, farmer name, or acreage field… suitable for printing and submission" ([UP Police article](../web-app/articles/up-police-bharti-admit-card-hindi-pdf-edit/index.html); [land-record article](../web-app/articles/khasra-khatauni-land-record-hindi-pdf-edit/index.html)).

For topics that touch legal and financial outcomes (YMYL), this reads as enabling forgery. Quality raters, app-store reviewers and lawyers would likely see it that way. No legal review was done, so treat that as a judgment call. It is also the opposite of the trust Google's helpful-content guidance calls the most important part of E-E-A-T ([Google](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)).

The fix is to change the framing. Help people **prepare a correction application, affidavit or self-declaration** in clean Hindi, and send them to the issuing authority for the official correction. The existing Hindi affidavit and e-District pieces already point this way.

## Hindi-breakage queries are the ground a new site can win

The keyword space splits in two. On one side is a small, underserved **Hindi-specific core**. On the other is a huge **generic utility shell** that a few giants own. India drove roughly **48M visits to iLovePDF in August 2026, 29.3% of its traffic** (Similarweb and Ahrefs estimates via search snippets). One Ahrefs figure puts "compress pdf" at 1.6M monthly searches, though the sources disagree on whether that is India or global ([Similarweb](https://www.similarweb.com/website/ilovepdf.com/); [Ahrefs](https://ahrefs.com/websites/compress2go.com)).

The generic shell is locked up by iLovePDF, Smallpdf, Adobe, PDF24, Sejda, 11zon and Pi7. They all have localized `/hi/` pages, so even Devanagari searches for generic utilities run into strong incumbents ([iLovePDF hi](https://www.ilovepdf.com/hi/merge_pdf); [PDF24 hi](https://tools.pdf24.org/hi/ocr-pdf)).

The Hindi-specific core looks different. Search for "PDF में हिंदी टेक्स्ट एडिट कैसे करें टूटे अक्षर" ("how to edit Hindi text in a PDF, broken letters") and you get Adobe and Smallpdf localized pages, a tiny Hindi tool site and pdfsimpli. **No result directly addresses the broken letters** ([Adobe in_hi](https://www.adobe.com/in_hi/acrobat/how-to/pdf-editor-pdf-files.html); [ramtoriya](https://ramtoriya.com/hindi-text-to-pdf-converter/)).

The garbled copy-paste cluster is similar. It is answered by Quora, Adobe Community, an academic blog and DocSet.in. The Digital Orientalist post explains why: legacy fonts store "क" as "d" ([Quora](https://www.quora.com/How-do-I-copy-the-Hindi-text-from-PDF-when-it-is-displaying-some-garbage-English-values-while-copying); [Digital Orientalist](https://digitalorientalist.com/2025/12/02/why-extracting-hindi-text-from-pdfs-is-so-much-harder-than-english-and-how-you-can-do-it/)).

"Hindi PDF editor" itself is held by vendor listicles and programmatic pages. UPDF's "4 Top Hindi PDF Editors in 2026" ranks UPDF first, and SignNow runs a generic "Free Online PDF Editor for Hindi" page. Neither sells correct shaping ([UPDF](https://updf.com/edit-pdf/hindi-pdf-editor/); [SignNow](https://www.signnow.com/features/online-pdf-editor-for-hindi-free)).

When forums, user-generated answers and listicles fill the top results, it usually means nobody specialized has claimed the query yet.

The priority table below uses researcher estimates for demand and difficulty. None of it is measured, so check it in Google Keyword Planner and Search Console before committing effort.

| Priority | Cluster | Example queries | Language and page type | Est. demand / difficulty |
|---|---|---|---|---|
| P1 | Broken or garbled Hindi in PDFs | hindi pdf matra problem; copy hindi text from pdf garbage; mangal font pdf problem; PDF में हिंदी अक्षर टूट रहे हैं | EN + Devanagari explainer and how-to, tool CTA | Low–Med / Low |
| P1 | Core editor | hindi pdf editor; edit hindi text in pdf online free; हिंदी PDF एडिटर | Dedicated EN and HI tool landing pages | Med / Med |
| P1 | Comparison and alternatives | best hindi pdf editor; Acrobat/Smallpdf Hindi alternative | EN comparison page built on the shaping benchmark | Low–Med / Low–Med |
| P2 | Hinglish how-to | hindi pdf edit kaise kare; pdf me hindi kaise likhe mobile se | Hinglish title and slug, Devanagari body, embedded Hindi video | Med / Low–Med |
| P2 | Kruti Dev / Devlys *PDF* (not text converters) | kruti dev pdf edit; krutidev pdf unicode | EN + HI page stating raster-only replacement honestly | Low–Med for PDF variants (head term is High/High) |
| P3 | Hindi OCR, Hindi PDF to Word | hindi ocr online free; hindi pdf to word without font change | Only if the product actually ships these | Med / Med |
| P3 | Sarkari size targets | compress pdf to 100kb / 200kb; PDF का साइज कम कैसे करें | One page with presets, timed to exam windows | High / Med–High |
| P4 | Generic utilities | merge, split, compress, jpg to pdf | Standard tool pages; long-term only | Very high / Very high |

Match the script to how people actually type each query.

- **Devanagari pages** fit the problem and editor queries. Those results pages are thin, and a Devanagari page also shows off the product's rendering.
- **Hinglish** fits the "kaise kare" how-to queries. Users type in Latin script but read Hindi. Canva's "Aasani se PDF ko Edit Kare" and MiOffice's "PDF Jodne Ka Tarika" already rank with Hinglish titles ([Canva](https://www.canva.com/pdf-editor/); [MiOffice](https://mioffice.ai/go/pdf-merge-hindi)).
- **English** fits comparison and size-target pages.

Keep URLs ASCII or transliterated, because Devanagari slugs turn into percent-encoded strings when shared in chat. Put Devanagari in the title, meta description and H1 of Hindi pages, since native searchers expect Devanagari in the results ([Gaurav Tiwari](https://gauravtiwari.org/seo-for-regional-languages-in-india/); [Likho](https://likholabs.in/blog/hindi-seo-optimization-2026)). There is no hreflang code for Hinglish. Work Hinglish phrasing into the FAQs and how-to steps rather than building a third language version.

## Fewer, deeper bilingual pages beat a daily article bot

The site's content engine points the wrong way for 2026. A GitHub Action ([`seo-worker.yml`](../.github/workflows/seo-worker.yml)) published one templated article a day from 2026-08-18 to 2026-08-25, then ran out of queue. Each piece follows the same pattern: a "Direct Answer", one or two H2s, four step cards, one or two FAQs and a CTA. Visible text runs 289–623 words. The author is always "Hindi PDF Editor Team", and datePublished always equals dateModified.

**10 of 16 articles link to no other article**, and the topic hub lists them without an `ItemList`. Topic selection is actually strong and different from what the generic tools cover: UP e-District self-declarations, Bihar Parimarjan Plus affidavits, e-stamp print margins, 100 KB portal limits. The execution is what fails.

Google's current position rewards a small set of deep pages over a large set of thin ones. The March 2024 core update folded "helpful content" into core ranking. Its scaled-content-abuse policy covers generating "many pages without adding value for users", whether AI, humans or templates made them ([Google](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)). 2026 has already had core updates in March and May and spam updates in March, June and August ([Search Engine Land](https://searchengineland.com/google-may-2026-core-update-rollout-is-now-complete-479119); [SEO Kreativ](https://www.seo-kreativ.de/en/blog/google-march-2026-spam-update/)). Trade reports, which are anecdotal and come from low-authority sources, describe templated programmatic pages losing 40–90% of traffic in those updates.

Recovery is slow and uncertain. Lily Ray tracked 130 sites hit hardest in 2023, and 129 had declined further since. HouseFresh took about two years to recover, after deleting hundreds of thin pages and adding first-hand testing evidence and author pages ([SERPs.io](https://serps.io/blog/helpful-content-update-recovery); [PPC Land](https://ppc.land/housefresh-achieves-notable-traffic-recovery-after-google-algorithm-impacts-2/)). Because a classifier-level demotion takes so long to undo, this site should avoid one from the start.

The target architecture copies what works for iLovePDF and Smallpdf: **one indexable, prerendered URL for each distinct tool, in each language**, with a shared nav linking all tools ([DEV Community](https://dev.to/hypeschool/how-smallpdf-gets-customers-for-its-pdf-tool-suite-p32)). For this site that means:

- **Pages:** an English homepage at `/`, a Hindi homepage at `/hi/`, and path-based tool pages in both languages. Examples: an English "edit Hindi PDF" page and its `/hi/` twin, plus merge, split, compress and translate.
- **Page content:** the working tool above the fold, then a short how-to with real screenshots, a visible FAQ written in natural Hinglish phrasing, links to 3–5 related tools, and reciprocal hreflang (`en`, `hi`, `x-default`).
- **Engine loading:** load the heavy PDF code on interaction to protect INP (Google's responsiveness metric, where 200 ms or less counts as good). That code includes the 595 kB `pdf-lib` chunk, `tesseract.js` and `html2canvas`.

Size-target sarkari pages (100 KB, 200 KB and so on) should be **one page with presets** unless each size has genuinely different behavior. Near-identical copies fit the scaled-content-abuse profile.

On top of the tool pages, build a small library of deep guides. About **8–12 human-reviewed pieces** should replace the 16 thin ones: merge the weak ones into stronger pages and 301-redirect the old URLs. Each guide needs the following:

- **A named author or reviewer.** Add `Person` schema, an About page, and honest "last updated" dates. Link Organization `sameAs` to GitHub and the Play Store.
- **Sourced facts.** Actual portal upload limits linked to official notices. SSC rules, for example, are photo 20–50 KB and signature 10–20 KB ([ExamMint](https://resizer.exammint.in/ssc-cgl/)).
- **Real screenshots** of Devanagari before and after an edit.
- **An `image` in the Article schema.** No article has one today.

Four assets anchor the library:

1. The **Hindi shaping benchmark** described earlier.
2. An **honest "Kruti Dev PDFs: what we do and don't do" explainer**.
3. A **"why Hindi breaks in PDFs" explainer** in English and Devanagari.
4. A **privacy-architecture page** showing that merge, split, compress and OCR run in the browser, and that translation goes to a Gemini proxy only with consent.

Time the calendar to exam cycles. The SSC CGL 2026 application window ran 21 May – 22 June, with a correction window 29 June – 1 July ([PW](https://www.pw.live/ssc/exams/ssc-cgl-2026-exam)). SSC publishes an annual calendar ([Adda247](https://www.adda247.com/exams/ssc/ssc-calendar-2026/)). So refresh sarkari pages 2–3 weeks before each major window opens. This seasonality is inferred from exam windows; Google Trends data could not be pulled to confirm it.

## AI answer engines reward indexing, mentions and quotable facts, not llms.txt

GEO, AEO, LLMO and AIEO are overlapping labels for one goal: getting retrieved, quoted and recommended by LLM answer surfaces. No authoritative source separates them. The term "GEO" comes from a KDD 2024 paper led by IIT Delhi and Princeton researchers ([arXiv](https://arxiv.org/abs/2311.09735)). The practical point is that **nearly every answer engine that cites links sits on top of a conventional web index**:

- **Google** AI Overviews and AI Mode use Google's index. Google states there are no special requirements beyond being indexed and eligible for a snippet ([Google](https://developers.google.com/search/docs/appearance/ai-features)).
- **ChatGPT search** is widely reported to draw on Bing's index. One vendor analysis found it cited only about **15% of the pages it retrieved** ([Detekia](https://detekia.fr/en/blog/comment-chatgpt-choisit-ses-sources)).
- **Copilot** grounds its answers on Bing.

So the first GEO move is the technical fix list above, and the second is **Bing Webmaster Tools plus IndexNow**. Bing's AI Performance report (public preview February 2026) shows which pages Copilot cites and the grounding queries it used to find them ([Bing](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview)). Google's June 2026 "Generative AI performance" report in Search Console counts citation impressions in AI Overviews and AI Mode, but not clicks ([Google](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)).

A time-sensitive platform change needs checking this week. Cloudflare split AI crawlers into **Search, Agent and Training** categories in July 2026. Secondary reports say that **from 15 September 2026, free-plan zones block the Agent and Training categories by default on pages that show ads, while Search stays allowed** ([Help Net Security](https://www.helpnetsecurity.com/2026/07/02/cloudflare-ai-crawler-controls/); [Crawl Lab](https://crawl-lab.com/en/blog/robots-txt/cloudflare-blocks-ai-crawlers-september-2026/)).

The site's [`robots.txt`](../web-app/robots.txt) allows everything, but robots.txt does not override a Cloudflare block. The exact rule for Pages projects, and whether "shows ads" applies to this site, could not be confirmed. The owner should open the zone's AI crawler controls and set the categories:

- **Search: allow.**
- **Agent: allow.** This covers ChatGPT-User, Perplexity-User and Claude-User fetching a page live when someone asks about it.
- **Training: a deliberate choice.** Allowing it helps a free tool that wants brand awareness in future models.

Then confirm in the Cloudflare analytics that OAI-SearchBot, Bingbot, PerplexityBot and Claude-SearchBot actually receive 200 responses. Blocking Google-Extended would not remove the site from AI Overviews, which use Googlebot ([Google](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers)).

On-page, the best evidence available is the GEO paper's controlled experiment. Adding **cited sources, quotations and statistics raised a page's visibility in generated answers by roughly 30–40%**, and keyword stuffing did not help. Gains were far larger for lower-ranked sources: adding citations reportedly lifted a rank-5 source by about 115% ([arXiv PDF](https://arxiv.org/pdf/2311.09735); [DerivateX summary](https://derivatex.agency/blog/princeton-geo-paper-plain-english/)).

The caveat is that the experiment rewrote text inside a simulated engine with a fixed set of retrieved sources. It shows how to get quoted once retrieved, not how to get retrieved. For a small site that will rarely rank #1, this is still the most encouraging lever: short, quotable definitions, sourced numbers and dated test results. The shaping benchmark is exactly this kind of content. Answer-first formatting and question-shaped headings are sensible practice, but no controlled study supports them.

**Off-site signals matter more.** Ahrefs studied 75,000 brands:

- **Branded web mentions** correlated 0.664 with AI Overview visibility.
- **Backlinks** correlated only 0.218.
- **YouTube mentions** were the strongest signal in the May 2026 update, at about 0.737 ([Ahrefs](https://ahrefs.com/blog/ai-overview-brand-correlation/); [BusinessWire](https://www.businesswire.com/news/home/20260526119691/en/Across-75000-Brands-YouTube-Mentions-Are-the-Strongest-Signal-of-AI-Visibility-New-Ahrefs-Report-Reveals)).

These are brand-level correlations, skewed by brand size, and Ahrefs sells mention tracking, so read them as direction rather than precise effect sizes. They still point the same way as the citation-share studies, where Reddit, Wikipedia and YouTube dominate AI citations ([Semrush](https://www.semrush.com/blog/most-cited-domains-ai/)).

Language could be an advantage here. Johns Hopkins researchers found that multilingual retrieval systems build answers from sources in the query's language when those exist, and fall back to English sources when they don't ([TechXplore](https://techxplore.com/news/2025-09-digital-language-multilingual-ai-bias.html)). AI Mode has supported Hindi since 2025 ([Search Engine Land](https://searchengineland.com/google-expands-ai-mode-beyond-english-461680)). Real Devanagari tool pages therefore face little competition when a Hindi prompt triggers retrieval. No study has measured this for Devanagari pages specifically, so treat it as plausible, not proven.

**llms.txt is not worth further investment.** Google's Gary Illyes said Google doesn't support it. An Ahrefs study reportedly found that **of 500M+ AI-bot visits, only 408 requested llms.txt** ([1ClickReport](https://www.1clickreport.com/blog/llms-txt-evidence-2026)). Keep the existing file, correct its false claims, and sync llms-full.txt, which is missing 8 of the 16 guides. Then stop spending time on it.

India's largest AI surface, **Meta AI on WhatsApp**, has reportedly about 142M monthly users in India ([MediaNama](https://www.medianama.com/2026/04/223-metas-new-ai-model-muse-spark-whatsapp-indian-users/)). It has no documented publisher-facing crawler or citation mechanism. Brand mentions on the open web are the only lever for it.

To measure all this without paid trackers:

- **GA4:** the site's [`analytics.js`](../web-app/assets/analytics.js) already classifies AI referrers.
- **Search Console:** the Generative AI performance report.
- **Bing:** the AI Performance report.
- **Cloudflare:** crawler analytics.
- **A monthly prompt panel:** about 20 prompts in English, Devanagari and Hinglish, run logged-out 2–3 times each across ChatGPT, Gemini, AI Mode, Perplexity, Copilot and Meta AI. Repetition matters because AI answers vary from run to run.

## Distribution in India runs through YouTube, forums and CSC operators

Google's Gary Illyes says links are no longer a top-three ranking factor and that pages "need very few" of them ([Search Engine Land](https://searchengineland.com/links-google-search-ranking-factor-gary-illyes-432422)). The AI-visibility data rewards mentions over links. So off-page work here should create **real usage and brand searches**, not a link count. Paid link packages and PBNs (private blog networks) are common in Indian SEO marketplaces and break Google's link-spam policy ([Google](https://developers.google.com/search/docs/essentials/spam-policies#link-spam)).

### YouTube

Hindi YouTube is the top channel on both counts: it has the strongest AI-visibility correlation, and demand is already proven. Tutorials titled "Hindi pdf file kaise edit kare" exist and rank for Hinglish how-to queries ([YouTube](https://www.youtube.com/watch?v=CRNoYjPQA5g)). A phone-recorded demo does the job. Show the same sentence edited in Acrobat, with the matras scattered, and then in Hindi PDF Editor, with the matras intact. Put "Hindi PDF Editor" in the title and description, add Shorts cut from it, and embed the video in the matching how-to page.

After that, pitch mid-sized Hindi tech-tutorial creators. MyHindiTricks' PDF-editing post dates from 2018, which makes it a natural "updated for Hindi text" outreach target ([MyHindiTricks](https://www.myhinditricks.com/2018/02/pdf-file-edit-kaise-kare.html)).

### Forums and Q&A

Many people who hit this problem are already posting about it in unresolved Adobe Community and Microsoft Q&A threads, and on Hindi and English Quora ([Adobe Community](https://community.adobe.com/t5/acrobat-discussions/hindi-language-pdf-page-edit-problem/td-p/15527463); [Hindi Quora](https://hi.quora.com/%E0%A4%AA%E0%A5%80%E0%A4%A1%E0%A5%80%E0%A4%8F%E0%A4%AB-%E0%A4%AB%E0%A4%BE%E0%A4%87%E0%A4%B2-%E0%A4%A4%E0%A5%88%E0%A4%AF%E0%A4%BE%E0%A4%B0-%E0%A4%95%E0%A4%B0%E0%A4%A8%E0%A5%87-%E0%A4%95%E0%A5%87)). Answer the exact question first, disclose "I built this", and link only when the tool solves that problem.

On Reddit, keep self-promotion under roughly 10% of activity. Build-story posts ("why Devanagari breaks in every PDF editor") suit r/developersIndia and r/SideProject ([Redship](https://redship.io/blog/reddit-self-promotion-rules)). Draft answers already exist in [`COMMUNITY_LAUNCH_KIT.md`](../web-app/docs/marketing/COMMUNITY_LAUNCH_KIT.md), but there's no record they were posted.

### CSC and cyber-cafe operators

These operators are the most India-specific lever. CSC village-level entrepreneurs (VLEs) and cyber-cafe operators prepare documents for sarkari applicants. They gather in Telegram and Facebook communities such as Smart CSC Help and the India VLE Association ([Telegram](https://t.me/s/smartcschelp); [Facebook](https://www.facebook.com/p/CSC-Digital-Seva-India-VLE-Association-100066899291745/)). They also already adopt free toolkits: Photocopywala markets "200+ Smart CSC & Cyber Cafe Tools" to them ([Photocopywala](https://photocopywala.in/cyber-cafe-tools/)).

Approach group admins with a tool that fixes a daily operator pain. Don't mass-post. Forwarded spam gets reported and removed.

### Link and listing targets

- **Sarkari-tool sites** that could cross-link, such as ExamToolkit and SarkariRojgaar tools ([ExamToolkit](https://examtoolkit.in/photo-signature-resizer-for-sarkari-form/)).
- **Tool directories and launch sites:** AlternativeTo (as an alternative to Acrobat, Smallpdf and iLovePDF), SaaSHub and Product Hunt. Their submission rules weren't verified.
- **Show HN or IndieHackers** for developer credibility.
- **An open-source Devanagari shaping or legacy-font-detection module on GitHub.** The project's repo already shows up for "Hindi PDF editor app" searches ([GitHub](https://github.com/manisense/hindipdfeditor)).
- **Indian tech press** such as YourStory, Inc42 and MediaNama. The story angle is "why Hindi breaks in every PDF editor, and an Indian developer's fix". YourStory's February 2026 piece on iLovePDF out-trafficking Amazon.in shows the appetite for PDF-tool stories ([YourStory](https://yourstory.com/2026/02/ilovepdf-beats-amazon-india-traffic)).

Wikipedia is out of reach until there are about 3–5 independent, in-depth articles about the product ([WP:NCORP](https://en.wikipedia.org/wiki/Wikipedia:Notability_(organizations_and_companies))). A Wikidata item can follow the first independent coverage.

### The Android app and the website should reinforce each other

The connection is brand demand and verified links. There is no direct ranking link between a Play listing and web rankings. Three steps:

1. **Host `/.well-known/assetlinks.json`** on the Pages domain, and add `autoVerify` intent filters in the app. Tool URLs shared on WhatsApp then open straight in the app ([Android](https://developer.android.com/training/app-links/verify-applinks)). Firebase App Indexing is no longer recommended, and Dynamic Links shut down in August 2025 ([Firebase](https://firebase.google.com/docs/app-indexing?hl=en); [AppsFlyer](https://www.appsflyer.com/blog/mobile-marketing/fdl-deprecation-deep-linking/)).
2. **Add a native hi-IN Play listing.** Keep loanwords like "PDF" and "free" in English, and put "Hindi PDF Editor" in the title of both the en-IN and hi-IN listings ([AppTweak](https://www.apptweak.com/en/aso-blog/how-to-localize-your-app-in-india)). Play also supports up to 50 custom store listings targeted by search keyword ([Play Console](https://play.google.com/console/about/customstorelistings/)).
3. **Use screenshots that show Devanagari before and after an edit.** That proves the differentiator at a glance.

## A prioritized 90-day action plan

The plan is ordered by leverage and dependency. Crawlability and truthfulness come first, because every later tactic depends on them. Before starting, confirm the audit's inferences on the live site: HTTP status codes, rendered DOM, the Search Console coverage report, and Cloudflare settings. Per the repo's rules ([AGENTS.md](../AGENTS.md)), vet any prerender or SSG dependency for maintenance status before adding it. Also update the spec and AGENTS.md in the same commit as any behavior change, such as the new URL architecture.

| # | When | Action | Where | Why it matters |
|---|---|---|---|---|
| 1 | Week 1 | Check Cloudflare AI crawler controls after the 15 Sep change: Search and Agent allowed, Training a deliberate choice. Confirm AI bots get 200s. | Cloudflare dashboard | AI engines can't cite what they can't fetch |
| 2 | Week 1 | Register Bing Webmaster Tools, submit the sitemap, enable IndexNow (Cloudflare Crawler Hints). Verify Search Console and turn on its Generative AI report. | External | ChatGPT and Copilot draw on Bing; these are the only citation dashboards |
| 3 | Week 1 | Correct false claims: "vector" → image-based PDF (web); "convert Kruti Dev" → "edit Kruti Dev PDFs with Unicode replacement"; drop Mangal, "100%", unsourced competitor claims and the unsupported OS list; USD → INR | `llms.txt`, `llms-full.txt`, `editor/index.html`, `faqData.ts`, `ComparisonSection.tsx`, article titles and step 4s | Answer engines repeat claims word for word; mismatched expectations hurt satisfaction signals |
| 4 | Week 1 | Rewrite the admit-card and land-record articles around correction applications, affidavits and the issuing authority | `articles/up-police-…`, `articles/khasra-khatauni-land-record-…`, `faqData.ts` | YMYL and forgery-adjacent risk |
| 5 | Week 1 | Add `404.html`; remove the playbook from `prepare-publish.mjs`; fix the `immutable` cache on unhashed `/assets/*`; remove "✨" | `web-app/`, `_headers`, `scripts/` | Soft 404s, info leak, stale deploys, design-rule breach |
| 6 | Week 1 | Pause the daily article worker, and fix its hreflang, dates and sitemap-lastmod logic before any reuse | `.github/workflows/seo-worker.yml`, `scripts/seo-worker.mjs` | Stops scaled-content risk and bug propagation |
| 7 | Weeks 2–3 | Make `/` a real static English homepage with the hero, features, comparison, FAQ and links in raw HTML. Remove the 302. Point breadcrumbs, the sitemap and Organization `url` to it. | `_redirects`, `index.html`, `sitemap.xml`, `seo.ts` | One homepage URL; content visible to non-JS crawlers |
| 8 | Weeks 2–4 | Prerender path-based tool pages (English plus `/hi/` twins) with raw-HTML canonical, H1, how-to and FAQ; load the PDF engine on interaction | `editor/` build, `tools.ts`, `App.tsx` | Tool URLs become indexable pages; protects INP |
| 9 | Weeks 2–4 | Build `/hi/` homepage and Hindi tool pages; reciprocal hreflang `en`/`hi`/`x-default` on true pairs only; add hreflang to English legal pages; remove self-referencing pairs | `hi/`, all article heads, sitemap | Currently zero working language clusters |
| 10 | Weeks 3–4 | One JSON-LD graph per page with a single `@id` per entity. FAQPage only where the Q&A is visible. Add Article `image`, `ItemList` on the hub, and Organization `sameAs` (GitHub, Play). | `editor/index.html`, `seo.ts`, articles | Removes conflicting signals; supported types only |
| 11 | Weeks 3–6 | Publish the Hindi shaping benchmark (fixture PDF through 4–5 named tools, dated screenshots, method) in English and Devanagari | New page + `fix-broken-hindi-fonts-in-pdf` | The main citable, linkable proof asset; quotable stats for GEO |
| 12 | Weeks 4–8 | Merge the 16 thin articles into 8–12 deep, human-reviewed guides with a named author or reviewer, an About page, sourced portal rules, real screenshots and cross-links; 301 the merged URLs | `articles/` | Beats scaled-content risk; E-E-A-T |
| 13 | Weeks 3–6 | Record 3–5 Hindi/Hinglish YouTube demos plus Shorts (Acrobat before vs this tool after); embed on matching pages | YouTube | Strongest AI-visibility correlate; owns video results for "kaise kare" queries |
| 14 | Weeks 4–12 | Disclosed, answer-first replies on Adobe Community, Microsoft Q&A and Hindi/English Quora; one build-story post on r/developersIndia or r/SideProject | External | Reaches people already searching; creates mentions |
| 15 | Weeks 6–12 | CSC/VLE admin outreach; sarkari-tool cross-links; AlternativeTo, SaaSHub, Product Hunt and Show HN; press pitch built on the benchmark | External | Brand searches and real usage in the Hindi belt |
| 16 | Weeks 4–8 | `assetlinks.json` plus App Links; native hi-IN Play listing with Devanagari before/after screenshots | `web-app/.well-known/`, mobile app, Play Console | App–web reinforcement and brand ownership |
| 17 | Monthly | Review Search Console (queries with impressions, branded filter), Bing AI Performance, GA4 AI referrals, Cloudflare bot hits, and the 20-prompt tri-script panel. Plan exam-window refreshes from the SSC calendar. | Ops | Iterate on pages that show impressions; the data replaces this report's estimates |

## Conclusion

The site has been working from the top of the stack down: llms.txt, bot allow-lists, FAQ schema and daily articles. Crawlability, URL identity and truthful claims have been missing underneath. The most useful change of view is that **in 2026 the Google and AI-engine problems are mostly the same problem**. Answer engines retrieve from Google's and Bing's indexes, can't run the JavaScript this site depends on, and quote pages word for word. Fixing prerendering, hreflang and claim accuracy therefore counts twice.

The real strategic asset is not a keyword list. It is **proof**: a reproducible Devanagari shaping test that nobody in the market has published, set against years of documented Acrobat matra complaints. That one artifact feeds the comparison page, the YouTube demos, the forum answers, the press pitch and the "statistics and citations" that the only controlled GEO study rewards.

The main uncertainties are demand size and timing. No keyword volumes were measured, and new pages rarely break into the top 10 within a year. So the first 90 days should be judged by indexation, Hindi long-tail impressions, Bing and Google AI citation counts, and branded searches, not by traffic.
