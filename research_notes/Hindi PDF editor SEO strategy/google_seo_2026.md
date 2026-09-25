# Classic Google SEO in 2025–2026 for a small, new Hindi/English free PDF-tool site (Cloudflare Pages + Android app)

Method note: research date 2026-09-25. Direct fetches of developers.google.com, status.search.google.com and searchengineland.com were blocked by the sandbox egress proxy, so many findings come from search-result snippets of trade press (SEJ, SERoundtable, SEL) rather than full-text reads. Items tagged **[prior knowledge, not re-verified this session]** come from well-established Google documentation I know of but could not fetch here; the report writer should treat them as high-confidence but unverified. Several secondary "agency blog" sources (digitalapplied.com, 1clickreport.com, orangemonke.com, almcorp.com, thestacc.com, serps.io) are low-authority, SEO-marketing content; their numbers are flagged as such.

## 1. What did the 2024–2026 Google core/spam/helpful-content updates change, how have small/tool sites fared, and what does official guidance say now?

### Takeaway
Since March 2024 the "helpful content" classifier has been folded into core ranking, and three spam policies (scaled content abuse, site reputation abuse, expired domain abuse) are the main enforcement levers; 2026 has already had two core updates (March, May) and three spam updates (March, June, August). Google's official line is unchanged: quality not production method matters (AI content is allowed; mass low-value pages are spam), but independent small sites mostly have not recovered from the 2023–2024 hits, so a new site must win on genuine utility, not volume.

### Cited Findings
**Update timeline (dates)**
- March 2024 core update: helpful content system merged into core ranking; new spam policies for scaled content abuse, expired domain abuse and site reputation abuse announced (site reputation abuse enforcement began May 2024) **[prior knowledge, not re-verified this session]** — [Google Search Central blog, March 2024](https://developers.google.com/search/blog/2024/03/core-update-spam-policies)
- November 2024: Google tightened site reputation abuse policy — it is "the practice of publishing third-party pages on a site in an attempt to abuse search rankings by taking advantage of the host site's ranking signals," and first-party involvement/oversight no longer exempts such content — [Google Search Central blog, Nov 2024](https://developers.google.com/search/blog/2024/11/site-reputation-abuse); summarized in [Siteimprove](https://www.siteimprove.com/blog/understand-googles-site-reputation-abuse-policy/)
- August 2025 spam update ran Aug 26 – Sep 22, 2025 (~4 weeks) — [SEO Kreativ / dashboard summary](https://www.seo-kreativ.de/en/blog/google-march-2026-spam-update/); [Google spam updates doc](https://developers.google.com/search/docs/appearance/spam-updates)
- A December 2025 core update is referenced in trade coverage — [Dataslayer](https://www.dataslayer.ai/blog/google-core-update-december-2025-what-changed-and-how-to-fix-your-rankings) (date details not verified)
- March 2026 spam update: launched March 24, 2026, completed March 25 (under 20 hours, reportedly fastest ever) — [SEO Kreativ](https://www.seo-kreativ.de/en/blog/google-march-2026-spam-update/)
- March 2026 core update: March 27 – April 8, 2026 (12 days 4 hours); Google: "a regular update designed to better surface relevant, satisfying content for searchers from all types of sites." — [Search Engine Land](https://searchengineland.com/google-march-2026-core-update-rollout-is-now-complete-473883); [SEJ](https://www.searchenginejournal.com/google-confirms-march-2026-core-update-is-complete/571459/)
- May 2026 core update: May 21 – June 2, 2026 (~12 days); observers said it "felt larger" than March 2026 — [Search Engine Land](https://searchengineland.com/google-may-2026-core-update-rollout-is-now-complete-479119); [SERoundtable](https://www.seroundtable.com/google-may-2026-core-update-done-41435.html)
- June 2026 spam update: June 24–26, 2026 — [digitalapplied (low-authority)](https://www.digitalapplied.com/blog/google-june-2026-spam-update-rollout-site-owner-guide); [orangemonke](https://orangemonke.com/blogs/google-june-2026-spam-update/)
- August 2026 spam update: Aug 18 – Aug 21, 2026 (2 days 16 h) — [digitalapplied (low-authority)](https://www.digitalapplied.com/blog/august-2026-spam-update-complete-what-to-measure)
- One tally: 8 ranking updates between March 2025 and mid-2026 (five core, two spam, one Discover) — [Dataslayer](https://www.dataslayer.ai/blog/google-core-update-december-2025-what-changed-and-how-to-fix-your-rankings) (count conflicts with the three 2026 spam updates above; counts depend on cut-off date)

**Effect on small/independent sites**
- Lily Ray examined 130 sites hardest hit by the Sept 2023 Helpful Content Update: 129 had only declined further since. Glenn Gabe tracked ~400 "obliterated" HCU sites; by Aug 2024 only 22% had recovered 20%+ of lost traffic — [SERPs.io summary](https://serps.io/blog/helpful-content-update-recovery) (secondary aggregation of Ray/Gabe data)
- HouseFresh (indie review site, lost ~95% visibility Sept 2023) reported recovery Oct 11, 2025 — ~2 years later; editor: "Hard work and a lot of luck"; it removed hundreds of thin pages, added first-hand testing media, author pages, reduced ad density — [PPC Land](https://ppc.land/housefresh-achieves-notable-traffic-recovery-after-google-algorithm-impacts-2/); background [HouseFresh](https://housefresh.com/david-vs-digital-goliaths/)
- Google has declined to give a date for when independent sites will surface better; stated it would "continue our work to surface more content from creators through a series of improvements" — [SERoundtable](https://www.seroundtable.com/google-no-date-sites-recover-search-39112.html)
- Independent-publisher analysis argues HCUs boosted Reddit and big brands at small publishers' expense — [TourScanner](https://tourscanner.com/google-helpful-content-update-impact-on-independent-publishers) (opinion/advocacy)

**Scaled content / programmatic crackdown**
- Trade reports claim March 2026 core update hit templated low-substance pages with 50–80% traffic drops and May 2026 hit "automated, ad-bloated content," with pSEO operators reporting −40% to −90% — [digitalapplied (low-authority)](https://www.digitalapplied.com/blog/programmatic-seo-after-march-2026-surviving-scaled-content-ban); [1ClickReport (low-authority)](https://www.1clickreport.com/blog/google-may-2026-core-update-programmatic-seo-dead). Not corroborated by Google; treat as anecdotal.
- Google published no new written spam-policy text in 2025, but enforcement expanded to scraped, affiliate-only and programmatic near-duplicate sets (SpamBrain) — [RebelMouse](https://www.rebelmouse.com/google-spam-update-2025)

**Official guidance now**
- Google's AI content position: focus on quality "rather than how content is produced"; appropriate AI/automation use is not against guidelines; using automation "with the primary purpose of manipulating ranking" violates spam policies; generating "many pages without adding value for users may violate" the scaled content abuse policy — [Google: Guidance on generative AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content); original [Feb 2023 blog](https://developers.google.com/search/blog/2023/02/google-search-and-ai-content)
- Google has also published a "Guide to Optimizing for Generative AI Features on Google Search," whose core advice is still unique, useful, people-first content — [Google doc](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide); [Semrush summary](https://www.semrush.com/blog/google-publishes-generative-ai-search-guide/)
- "Helpful, reliable, people-first content" doc with Who/How/Why self-assessment and E-E-A-T (Trust as the most important element) remains the canonical guidance **[prior knowledge, not re-verified this session]** — [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- 2024 API leak (Content Warehouse docs, published May 28, 2024 by Rand Fishkin and Mike King): attributes include `siteAuthority` (despite Google denials of domain authority), NavBoost click re-ranking with goodClicks/badClicks/lastLongestClicks, and `hostAge`; NavBoost's role was also confirmed in DOJ trial testimony — [SparkToro](https://sparktoro.com/blog/an-anonymous-source-shared-thousands-of-leaked-google-search-api-documents-with-me-everyone-in-seo-should-see-them/); [Wikipedia](https://en.wikipedia.org/wiki/2024_Google_Search_documentation_leak); [Hobo Web](https://www.hobo-web.co.uk/the-google-content-warehouse-leak-2024/). Caveat: leak shows attributes exist, not their weights.

### Inferences
- For a free tool site, "helpful" = the tool actually works quickly in-browser with good task completion; NavBoost-style user-satisfaction signals (long clicks, no pogo-sticking back to SERP) likely matter more than word count. A fast, working Hindi-capable editor is the core ranking asset.
- The biggest risk for this project is not a manual penalty but classifier-level demotion from mass-produced near-duplicate pages (e.g. hundreds of "Hindi PDF to X" or city/exam-form pages). Keep page count proportional to real distinct tools/use-cases.
- A new site starts with low `siteAuthority`/`hostAge`-type signals; expect slow early growth regardless of on-page quality.

### Gaps
- Could not read Google's Search Status Dashboard directly; exact start/end for 2025 core updates (March 2025, June 2025, Dec 2025) not verified this session.
- No specific public data found on how PDF/utility tool sites fared in 2025–2026 core updates (Sistrix/Amsive-type winner/loser lists for tool sites not retrieved).
- The "November 2025 helpful content refresh" mentioned by thestacc.com is not corroborated by any Google source; likely inaccurate.

## 2. Tool-site SEO: how iLovePDF/Smallpdf/PDF24-style sites are structured; safe vs risky programmatic SEO in 2026

### Takeaway
The market leaders win with one indexable landing page per tool/task (e.g. /merge-pdf, /compress-pdf), each translated into many languages on separate URLs, a global nav/footer linking every tool, and short supporting how-to/FAQ copy on the tool page plus a blog; this is "programmatic" only in the sense of templated translation of genuinely distinct tools. Safe pSEO in 2026 = each page has distinct utility/data; risky = keyword-swapped templates.

### Cited Findings
- iLovePDF gets 200M+ monthly uniques; its closest competitors are smallpdf.com, sejda.com, freepdfconvert.com — [Similarweb iLovePDF](https://www.similarweb.com/website/ilovepdf.com/); [Semrush competitors](https://www.semrush.com/website/ilovepdf.com/competitors/)
- Smallpdf has "a bazillion pages in their sitemap with pretty much every page translated into multiple languages" as the foundation of its SEO; it ranks top 3 for thousands of queries yet still buys ads — [DEV Community: How Smallpdf gets customers](https://dev.to/hypeschool/how-smallpdf-gets-customers-for-its-pdf-tool-suite-p32)
- Case-study video on Smallpdf's "$30M+ online tool SEO strategy" exists — [YouTube](https://www.youtube.com/watch?v=7JNtAVBjnBE) (not watched; content unverified)
- pSEO that survived 2026 updates reportedly has "real data or real utility a searcher cannot get anywhere else"; safest categories include entity/data pages, integration pages, verified comparison matrices, distinct use-case pages — [digitalapplied (low-authority)](https://www.digitalapplied.com/blog/programmatic-seo-after-march-2026-surviving-scaled-content-ban); [Heroic Rankings](https://heroicrankings.com/seo/content-creation/programmatic-seo/)
- A 512-page pSEO program claimed to survive March 2024 core update; pages with unique data, dense internal linking and use-case sections were rewarded — [thestacc (vendor self-report)](https://thestacc.com/blog/programmatic-seo-case-study/)
- Google's official boundary: generating many pages without adding value "may violate" scaled content abuse policy regardless of whether AI, humans or templates made them — [Google gen-AI guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)

### Inferences
- Recommended architecture for this project: one canonical URL per distinct tool in each language (e.g. `/hi/pdf-edit`, `/en/edit-hindi-pdf`, merge, split, compress, Kruti Dev/legacy-font-to-Unicode, OCR), each with the working tool above the fold, a short "how to" with real screenshots, Hindi-specific FAQ (fonts, conjuncts, Sarkari form use), and links to 3–5 related tools. Hub page linking all tools; breadcrumbs.
- Hindi-specific differentiation (legacy font conversion, Devanagari shaping correctness, Sarkari form sizes/compression targets like "compress PDF to 100KB/200KB") is the realistic moat versus iLovePDF, which serves generic intent. Size-target pages ("compress PDF to 100KB") are a known pattern in India but become risky if they are near-identical; consolidate into one page with presets unless each has distinct functionality.
- Do not mass-generate "exam-form X PDF" pages; that fits the scaled-content-abuse profile.

### Gaps
- Could not fetch iLovePDF/Smallpdf/PDF24 pages directly to document their exact on-page structure, internal link counts or hreflang setups; structure description above is partly inference from the Smallpdf case write-up.
- No verified 2026 traffic data for PDF24 or Indian competitors (e.g. Hindi-specific PDF tools).

## 3. Multilingual/Hindi SEO: hreflang, URL structure, Devanagari vs transliterated slugs, Hinglish, lang attributes, Indic search

### Takeaway
Use separate URLs per language (subdirectories like /hi/ and /en/), reciprocal self-referencing hreflang (`hi`, `en`, plus `x-default`), ASCII/transliterated slugs, Devanagari in titles/meta/H1 for Hindi pages, and cover transliterated/Hinglish query variants in copy; Google detects page language from visible content, not the `lang` attribute.

### Cited Findings
- Google's multilingual guidance: use dedicated URLs per language version rather than cookies/browser-language switching; URL parameters for language are possible but not recommended; Google determines language from visible content and does not use the HTML `lang` attribute or code-level hints for this **[prior knowledge, not re-verified this session]** — [Google: Managing multi-regional and multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
- hreflang rules: each language version must list itself and all alternates (bidirectional); `x-default` for fallback; can be implemented in HTML head, HTTP headers or XML sitemap **[prior knowledge, not re-verified this session]** — [Google: Localized versions (hreflang)](https://developers.google.com/search/docs/specialty/international/localized-versions)
- India-focused practitioners: Google treats Devanagari Hindi and transliterated Hindi as related but distinct; you can rank for transliterated queries with native-script content if both versions appear on-page — [Gaurav Tiwari (2026 guide)](https://gauravtiwari.org/seo-for-regional-languages-in-india/); [Likho Hindi SEO checklist 2026](https://likholabs.in/blog/hindi-seo-optimization-2026)
- Recommendation to use English-transliterated URLs, not Devanagari: Devanagari URLs percent-encode when shared (looks broken in chat/email) and some analytics tools mishandle them — [Gaurav Tiwari](https://gauravtiwari.org/seo-for-regional-languages-in-india/)
- Transliterated titles reduce CTR from native Hindi searchers who expect Devanagari in SERPs; keep URLs English, put Hindi in title and meta description — [Likho](https://likholabs.in/blog/hindi-seo-optimization-2026)
- Use hreflang="hi" to declare Hindi versions; some practitioners say many Indian publishers start without hreflang and add later — [Gaurav Tiwari](https://gauravtiwari.org/seo-for-regional-languages-in-india/) (practitioner opinion; Google recommends hreflang whenever alternates exist)
- Multilingual SEO guides for Hindi/Marathi — [Deseno](https://deseno.co.in/multilingual-seo-hindi-marathi-india/)
- AI Mode (Gemini-powered, launched March 2025) handles complex multi-part queries and multimodal input — [Wikipedia: AI Mode](https://en.wikipedia.org/wiki/AI_Mode)

### Inferences
- Since queries for this niche are heavily English/Hinglish ("hindi pdf edit online", "pdf me hindi kaise likhe", "kruti dev to unicode"), the English page should target English/Hinglish keywords and the Hindi page Devanagari queries ("हिंदी PDF एडिट करें"); include natural Hinglish phrasing in FAQ/how-to sections rather than creating a third "Hinglish" language version (hreflang has no Hinglish code; `hi-Latn` is technically valid BCP 47 but Google support for script subtags is not confirmed).
- Always set `<html lang="hi">`/`lang="en"` for accessibility and font shaping even though Google ignores it for language detection.
- Avoid auto-redirecting by IP/Accept-Language; Googlebot crawls mostly from US IPs and could miss the Hindi version **[prior knowledge]**.

### Gaps
- Could not verify current (2026) Google statements on Indic-language share of queries, or on AI Overviews / AI Mode availability in Hindi (my prior knowledge: AI Overviews expanded to Hindi in India in 2024 and AI Mode added Hindi in 2025 — not re-verified).
- No official Google source found on Devanagari vs. transliterated slugs as a ranking factor; Google generally says URL words are a very light signal (prior knowledge).
- No data on whether `hi-Latn` hreflang is honored.

## 4. Technical: Core Web Vitals (INP), JS rendering for SPA tools, supported structured data, IndexNow/Bing, sitemaps, crawl budget, Search Console

### Takeaway
INP (≤200 ms "good") replaced FID in March 2024; tool pages must server-render/prerender their textual content (static HTML on Cloudflare Pages is ideal) and lazy-load the heavy PDF engine after interaction. FAQ rich results are gone (May 2026) and HowTo earlier; still-useful markup for this site is SoftwareApplication/WebApplication, Organization, WebSite (site name), BreadcrumbList. IndexNow helps Bing/Yandex only; Google relies on sitemaps and links. Crawl budget is a non-issue at this size.

### Cited Findings
**Core Web Vitals / JS**
- INP replaced FID as a Core Web Vital on March 12, 2024; thresholds good ≤200 ms, poor >500 ms **[prior knowledge, not re-verified this session]** — [web.dev INP](https://web.dev/articles/inp)
- Heavy JS bundles hurt INP; partial hydration/island architectures (Astro, newer Next.js) reduce main-thread work and improve INP — [SEO Kreativ JS SEO 2026](https://www.seo-kreativ.de/en/blog/javascript-seo-rendering/); [Medium JS SEO 2025](https://medium.com/@ozehlaw/javascript-seo-the-ultimate-guide-to-ranking-js-sites-in-2025-7baba10b25e3)
- Slow servers, heavy bundles or hydration errors can cause Googlebot to miss main content; use GSC URL Inspection to view rendered HTML and screenshot — [Seed Light](https://seed-light.com/blog/javascript-seo/); [SEO Kreativ](https://www.seo-kreativ.de/en/blog/javascript-seo-rendering/)
- Google describes dynamic rendering as a workaround, not a recommended long-term solution; recommends SSR, static rendering or hydration **[prior knowledge, not re-verified this session]** — [Google: Dynamic rendering](https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering)

**Structured data**
- June 12, 2025 "Simplifying the search results page": Google phased out rich results for Course Info, Claim Review, Estimated Salary, Learning Video, Special Announcement, Vehicle Listing (plus Book Actions per the post); "won't affect how pages are ranked" — [Google Search Central blog, June 2025](https://developers.google.com/search/blog/2025/06/simplifying-search-results)
- HowTo rich results fully deprecated (desktop too) by Sept 2023; FAQ rich results restricted to authoritative government/health sites Aug 2023 — [search summary citing Google](https://developers.google.com/search/blog/2025/06/simplifying-search-results); [The HOTH](https://www.thehoth.com/blog/google-faq-rich-results-deprecated/)
- May 7, 2026: Google added a deprecation notice to FAQ structured-data docs — FAQ rich results no longer appear; Search Console FAQ appearance filter, rich result report and Rich Results Test support removed June 2026; Search Console API support removed August 2026; no blog post; markup may be left in place (unused structured data causes no problems) — [Search Engine Journal](https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/); [Passionfruit](https://www.getpassionfruit.com/blog/what-changed-with-google-drops-faq-rich-results-and-what-to-do-now); [Google doc updates log](https://developers.google.com/search/updates)
- Still-supported types relevant here: SoftwareApplication (app/web-app rich result with rating/price), Organization (logo), WebSite/site names, BreadcrumbList, Article, VideoObject **[prior knowledge, not re-verified this session]** — [Google: Search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery); [SoftwareApplication doc](https://developers.google.com/search/docs/appearance/structured-data/software-app)

**IndexNow, sitemaps, crawl budget**
- IndexNow is supported by Bing, Yandex, Seznam, Naver and others but not by Google; Cloudflare offers IndexNow pings via "Crawler Hints" **[prior knowledge, not re-verified this session]** — [IndexNow.org](https://www.indexnow.org/); [Cloudflare Crawler Hints](https://developers.cloudflare.com/cache/advanced-configuration/crawler-hints/)
- Google's crawl-budget guide targets very large (1M+ pages) or fast-changing (10k+ pages daily) sites; smaller sites generally need only an up-to-date sitemap **[prior knowledge, not re-verified this session]** — [Google: Crawl budget management](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget)

**Search Console**
- Branded-queries filter (AI-assisted classification including multi-language names and misspellings) announced Nov 20, 2025 at Search Central Live Tel Aviv; docs confirmed availability for all eligible sites March 11, 2026 — [SERoundtable](https://www.seroundtable.com/google-search-console-brand-query-filters-40474.html); [SEO Sherpa](https://seosherpa.com/google-expands-search-console-branded-queries-filter-to-all-eligible-sites/); [ALM Corp](https://almcorp.com/blog/google-search-console-branded-queries-filter/)
- Query groups in Search Console Insights introduced in 2025 — [RichClicks](https://www.richclicks.co.uk/digital-magazine/search-console-in-the-age-of-ai-whats-changing)

### Inferences
- Cloudflare Pages static HTML per tool (text, H1, how-to, FAQ, hreflang in `<head>`) with the PDF engine (pdf.js/WASM/fonts) loaded on user action is the best fit for both crawlability and INP. Avoid a hash-routed SPA (`/#/merge`), which Google does not index as separate URLs.
- Large Devanagari web fonts affect LCP/CLS; subset and `font-display: swap`/preload for the Hindi UI.
- Keep FAQ sections as visible content (useful for users, AI Overviews/answer engines) but do not expect FAQ rich results.
- Submit to Bing Webmaster Tools and enable IndexNow; Bing also feeds some AI assistants (inference).

### Gaps
- Could not confirm whether Google changed INP thresholds or CWV weighting in 2025–2026 (none found).
- Could not verify any 2025–2026 changes to Google's JavaScript SEO documentation.
- Could not confirm whether Search Console now reports AI Mode/AI Overview traffic separately (searches returned nothing conclusive).

## 5. Link building and brand signals for new sites; what Google says about links

### Takeaway
Google says links are no longer a top-3 factor and that few links are needed, but the leak shows site-level authority and click signals exist; for a new tool site the realistic plays are genuine mentions (communities, open source/GitHub, Product Hunt, Indian tech/ed press, government-exam communities) that also drive branded searches and real usage.

### Cited Findings
- Gary Illyes (PubCon, 2024): links are important but "people overestimate their importance… I don't agree that it's the top 3 and it hasn't been for some time"; "it is possible to rank without links" — [Search Engine Land](https://searchengineland.com/links-google-search-ranking-factor-gary-illyes-432422); [SERoundtable](https://www.seroundtable.com/google-links-no-longer-a-top-three-ranking-factor-36094.html)
- Illyes: Google needs very few links to rank pages — [Search Engine Journal](https://www.searchenginejournal.com/google-needs-very-few-links/514494/)
- Leak: `siteAuthority` attribute exists; NavBoost uses click data (good/bad/last-longest clicks) — [SparkToro](https://sparktoro.com/blog/an-anonymous-source-shared-thousands-of-leaked-google-search-api-documents-with-me-everyone-in-seo-should-see-them/); [Wikipedia](https://en.wikipedia.org/wiki/2024_Google_Search_documentation_leak)
- Google's spam policies continue to treat buying/selling links for ranking and large-scale link schemes as violations; paid/sponsored links should use `rel="sponsored"`/`nofollow` **[prior knowledge, not re-verified this session]** — [Google spam policies: link spam](https://developers.google.com/search/docs/essentials/spam-policies#link-spam)
- Smallpdf still buys ads despite top rankings (brand and demand building alongside SEO) — [DEV Community](https://dev.to/hypeschool/how-smallpdf-gets-customers-for-its-pdf-tool-suite-p32)

### Inferences
- Highest-leverage link/brand sources for this project: open-sourcing parts (e.g. a Devanagari PDF shaping library or Kruti Dev→Unicode converter) on GitHub/npm; Product Hunt/Hacker News "Show HN" launch; answers in Hindi-typing/government-job communities (Quora Hindi, Reddit r/india, Telegram/YouTube tutorials by exam-prep creators); listings in reputable tool directories; outreach to Indian tech/education blogs. Branded search growth plus satisfied clicks likely feed the site-level signals the leak describes.
- Avoid paid link packages and PBNs common in Indian SEO marketplaces; SpamBrain-era link spam is typically neutralized or penalized.

### Gaps
- No 2025–2026 quantitative study found on which link types move new-domain rankings; no evidence retrieved on Product Hunt/GitHub link value specifically.
- No retrieved Google statement from 2025–2026 updating the "links not top 3" position.

## 6. App + web synergy: Play Store app indexing / deep links, ASO interaction with web SEO

### Takeaway
Firebase App Indexing is effectively retired for Google Search; the current approach is verified Android App Links (assetlinks.json on the web domain) so web URLs open in the app, plus web pages linking to the Play listing and SoftwareApplication markup; web SEO and ASO interact mainly through brand demand and shared keywords rather than any direct ranking mechanism.

### Cited Findings
- Firebase App Indexing is "no longer the recommended way" to index content for Google Search app suggestions; the Google Search App for Android no longer uses local content indexed via Firebase App Indexing — [Firebase App Indexing docs](https://firebase.google.com/docs/app-indexing?hl=en); [Firebase FAQ](https://firebase.google.com/support/faq#firebase-app-indexing)
- Android App Links are the recommended way to link users from search results, websites and other apps to in-app content — [Firebase App Indexing docs](https://firebase.google.com/docs/app-indexing?hl=en); [AppsFlyer](https://www.appsflyer.com/blog/mobile-marketing/fdl-deprecation-deep-linking/)
- Firebase Dynamic Links shut down Aug 25, 2025; links return 404 — [AppsFlyer](https://www.appsflyer.com/blog/mobile-marketing/fdl-deprecation-deep-linking/)
- Discussion of whether Google Search drives app installs — [vmobify](https://vmobify.com/blog/app-seo-google-search-installs) (vendor blog)

### Inferences
- Host `/.well-known/assetlinks.json` on the Cloudflare Pages domain (Pages serves `.well-known` if placed in the build output) and declare `autoVerify` intent filters for tool URLs so users with the app open it directly.
- Add a clear "Get the Android app" CTA with Play link on tool pages; Play listing should link back to the website (developer website field) for entity consistency. Google's Play Store listing pages themselves rank for brand queries, so a consistent brand name across web/app strengthens branded-SERP ownership.
- Avoid intrusive app-install interstitials on mobile web (Google's long-standing intrusive interstitial guidance, prior knowledge).

### Gaps
- No 2025–2026 evidence found on whether Google still shows "app pack"/install buttons in web SERPs for Android app-linked sites, or on quantified ASO↔SEO interaction.

## 7. Realistic timelines for a new domain to rank

### Takeaway
Expect months to years: in Ahrefs' 2025 data only ~1.7% of newly published pages reached the top 10 within a year, the average #1 page is ~5 years old; low-competition long-tail Hindi/Hinglish tool queries are the realistic early wins (3–6+ months), with head terms like "pdf editor" effectively out of reach for a long time.

### Cited Findings
- Ahrefs (May 2025 update): only 1.74% of newly published pages reach the top 10 within one year (down from 5.7% in 2017); average #1 page is ~5 years old (vs ~2 years in 2017); 72.9% of top-10 pages are 3+ years old (up from 59%); 13.7% of top-10 pages are under a year old (down from 22%); of pages that do reach top 10, 40.82% do so within the first month — [Ahrefs study](https://ahrefs.com/blog/how-long-does-it-take-to-rank-in-google-and-how-old-are-top-ranking-pages/) (figures via search snippet; not fetched in full)
- Agencies commonly cite 3–6 months for early movement based on Ahrefs/Semrush data — [FactoryJet](https://factoryjet.com/blog/how-long-does-seo-take-2026-month-by-month-timeline) (low-authority)
- Leak indicates `hostAge` is collected, contradicting Google denials that domain age is considered — [Hobo Web](https://www.hobo-web.co.uk/the-google-content-warehouse-leak-2024/); [Wikipedia](https://en.wikipedia.org/wiki/2024_Google_Search_documentation_leak)
- Recovery from quality demotion can take ~2 years even with major fixes (HouseFresh) — [PPC Land](https://ppc.land/housefresh-achieves-notable-traffic-recovery-after-google-algorithm-impacts-2/)

### Inferences
- Realistic plan: months 0–3 indexing and long-tail impressions (e.g. "kruti dev to unicode pdf", "hindi pdf edit online free", Devanagari queries); months 3–12 first page on low-competition Hindi-specific queries if the tool is genuinely best-in-class; head terms dominated by iLovePDF/Smallpdf/Adobe for years. Launching with quality from day one matters because recovering from an early classifier demotion is slow.
- Since the "40% of eventual top-10 pages get there in month one" stat suggests pages either gain traction quickly or not at all, iterate on pages that show impressions in GSC rather than waiting.

### Gaps
- No Hindi/India-specific timeline data found; the Ahrefs data is keyword-random and global.
