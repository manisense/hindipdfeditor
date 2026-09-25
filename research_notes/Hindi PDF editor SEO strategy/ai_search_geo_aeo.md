# AI Search Optimization (GEO / AEO / LLMO) for a Small Free Hindi PDF Editor Tool Site (state as of Sept 2026)

> Method note: research done 2026-09-25. Several primary sources (developers.google.com, platform.openai.com, blog.cloudflare.com, arxiv.org, ahrefs.com) were **blocked by this environment's egress proxy**, so their content was read only through search-engine snippets and secondary write-ups. Claims marked "[primary not fetched]" should be spot-checked against the primary URL before being quoted as fact. Many "GEO statistics" pages are published by vendors that sell AI-visibility tracking (Peec AI, Profound, Otterly, Semrush, Ahrefs Brand Radar, Similarweb AI Search, etc.) — they have a commercial interest in the discipline seeming important and measurable. This is flagged per finding.

## 1. Definitions and how each AI engine selects/cites sources

### Takeaway
GEO, AEO, LLMO, AIO/AIEO and "AI SEO" are overlapping marketing labels for one thing: making a site retrievable, quotable and recommended by LLM-based answer surfaces. Almost every answer engine that cites links (Google AI Overviews/AI Mode, ChatGPT search, Copilot, Perplexity) is a retrieval layer sitting on top of a conventional web index, so being crawlable, indexed and ranking in Google and Bing remains the prerequisite; "GEO" is mostly about what happens after retrieval (whether the model picks and quotes your page).

### Cited Findings
- **GEO** was coined in the academic paper "GEO: Generative Engine Optimization" by Pranjal Aggarwal (IIT Delhi) et al., with Princeton co-authors, published at KDD 2024; it defines generative engines as systems that retrieve sources and synthesize a cited answer, and proposes "visibility" metrics for how much of the answer is attributable to a source — [arXiv 2311.09735](https://arxiv.org/abs/2311.09735); [Princeton listing](https://collaborate.princeton.edu/en/publications/geo-generative-engine-optimization/) [primary not fetched; details via search snippet]
- **AEO (Answer Engine Optimization)** predates LLMs (featured snippets, voice assistants) and is now used interchangeably with GEO; **LLMO** (LLM optimization) and **AIO/AIEO/"AI SEO"** are vendor/agency synonyms with no formal distinction in the literature. (No authoritative source defines distinct boundaries between them — treat as synonyms.) — see gap below.
- **Google AI Overviews / AI Mode**: Google's Search Central guidance (as reported) is that there are no special requirements to appear in AI features beyond normal Search eligibility (indexed, snippet-eligible); standard SEO best practices apply; AI Mode uses "query fan-out" (issuing many related sub-searches) to find supporting pages — [Google Search Central: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) [primary not fetched; from training knowledge + secondary reports — verify]
- Google's June 2026 Search Central documentation reportedly states Google does not use llms.txt for rankings or AI Overviews — [1ClickReport summary](https://www.1clickreport.com/blog/llms-txt-evidence-2026); [Baseline Labs](https://baselinelabs.ai/blog/llms-txt-google-search)
- **AI Mode in India / Hindi**: Google launched AI Mode in Search Labs in India on June 24, 2025, then added Hindi (with Indonesian, Japanese, Korean, Brazilian Portuguese) and later seven more Indian languages (Bengali, Kannada, Malayalam, Marathi, Tamil, Telugu, Urdu) in Oct 2025, alongside Search Live launching in India — [Search Engine Land](https://searchengineland.com/google-expands-ai-mode-beyond-english-461680); [TechCrunch, Oct 8 2025](https://techcrunch.com/2025/10/08/googles-search-live-comes-to-india-ai-mode-gets-more-languages); [The Tech Portal](https://thetechportal.com/2025/10/08/google-launches-search-live-in-india-expands-ai-mode-to-seven-indian-languages)
- **ChatGPT search**: web queries are sent to a search backend (widely reported as Bing's index) and results are filtered/reordered by the model; an AirOps analysis of 548,534 retrieved pages found ChatGPT cited only ~15% of the pages it retrieved — [Detekia summary](https://detekia.fr/en/blog/comment-chatgpt-choisit-ses-sources); [Lemniscate Growth](https://lemniscategrowth.com/blogs/how-chatgpt-search-works.html) (secondary; AirOps is a vendor)
- OpenAI runs separate agents: **GPTBot** (training), **OAI-SearchBot** (indexing for ChatGPT search results), **ChatGPT-User** (live fetch when a user asks about a page) — [Cresva guide](https://cresva.ai/guides/oai-searchbot-robots-txt-chatgpt-visibility); [OpenAI crawler docs](https://platform.openai.com/docs/bots) [primary not fetched]. OpenAI's docs (per training knowledge) say sites that block OAI-SearchBot won't be shown in ChatGPT search answers, though they may still appear as navigational links.
- **Microsoft Copilot / Bing**: Copilot grounds answers on Bing's index. Bing Webmaster Tools launched an "AI Performance" report (public preview Feb 11, 2026) showing which pages are cited in Copilot and Bing AI summaries and the "grounding queries" Copilot generated to retrieve them; expanded June 2026 with intent labels, topic groupings and citation share — [Bing Webmaster Blog](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview); [Bing help: AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c); [Otterly guide](https://otterly.ai/blog/bing-webmaster-tools-ai-performance-report/)
- **Perplexity, Claude**: both run search crawlers (PerplexityBot; Claude-SearchBot) distinct from training crawlers (ClaudeBot) — Cloudflare's taxonomy lists Claude-SearchBot and OAI-SearchBot under "Search" and GPTBot/ClaudeBot/CCBot under "Training" — [Luong Hong Thuan analysis](https://luonghongthuan.com/en/blog/cloudflare-ai-crawler-default-block-september-2026/); [hosting.com](https://hosting.com/blog/cloudflares-new-ai-crawler-defaults-and-what-they-mean-for-site-owners/)
- **Meta AI (WhatsApp)**: India is Meta AI's largest market at ~142M monthly active users (reported); WhatsApp India has 550M+ MAU; Meta replaced Llama with "Muse Spark" from April 8, 2026 (rolling out US first) — [MediaNama](https://www.medianama.com/2026/04/223-metas-new-ai-model-muse-spark-whatsapp-indian-users/); [Hyperleap stats](https://hyperleap.ai/blog/whatsapp-statistics-india-2026) (user-count figures come from stats aggregators, not Meta filings — treat as approximate)
- Engines differ in favored sources: ChatGPT leaned to Wikipedia, Reddit, editorial sites; Google to platforms like Facebook/Yelp; Perplexity to Reddit, LinkedIn, G2 — [Search Engine Land study coverage](https://searchengineland.com/ai-search-engines-cite-reddit-youtube-and-linkedin-most-study-473138); [Semrush 3-month study](https://www.semrush.com/blog/most-cited-domains-ai/)

### Inferences
- For a tool site, the practical pipeline is: (1) get indexed and ranking in Google AND Bing (Bing matters disproportionately because ChatGPT and Copilot draw on it), (2) be allowed through to search/user-fetch bots, (3) have pages whose content is easily extractable and quotable, (4) be mentioned by third parties so the model "knows" the brand when it answers "best Hindi PDF editor" without browsing.
- Meta AI on WhatsApp is the biggest AI assistant surface in India, but there is no documented publisher-facing mechanism (no crawler docs, no referral reporting) for how it cites web sources — it is effectively unoptimizable directly; brand mentions on the open web are the only lever.

### Gaps
- No authoritative source draws a formal distinction between AEO, GEO, LLMO, AIEO; they're used as synonyms.
- Could not find documentation on how Meta AI (WhatsApp) selects/cites web sources, or its crawler (Meta-ExternalAgent/FacebookBot) role in answers.
- Could not verify the exact current wording of OpenAI's and Google's primary docs (egress-blocked).

## 2. What the evidence says about citation factors

### Takeaway
The only peer-reviewed controlled evidence (GEO paper) shows adding cited sources, quotations and statistics to content raises its visibility in generated answers by ~30–40%, with much larger gains for lower-ranked pages and keyword stuffing not helping. Industry correlational studies point to off-site brand mentions (especially YouTube and web mentions) correlating far more with AI visibility than backlinks, and a heavy concentration of citations on Reddit, Wikipedia, YouTube. Most industry numbers are correlational and from vendors.

### Cited Findings
- **GEO paper (Aggarwal et al., KDD 2024)**: tested 9 content-rewrite methods on GEO-bench (~10,000 queries) using a Bing-Chat-like generative engine, validated on Perplexity. Best methods — Cite Sources, Quotation Addition, Statistics Addition, Fluency Optimization, Authoritative voice — improved visibility ~30–41%; Keyword Stuffing, "easy-to-understand" simplification and padding did little or hurt — [arXiv PDF](https://arxiv.org/pdf/2311.09735); [DerivateX plain-English summary](https://derivatex.agency/blog/princeton-geo-paper-plain-english/)
- GEO gains were much larger for lower-ranked sources: adding citations lifted a rank-5 source's visibility by ~115% while cutting the rank-1 source's by ~30%; Quotation Addition ~+100% at rank 5 vs ~−23% at rank 1 — [DerivateX summary](https://derivatex.agency/blog/princeton-geo-paper-plain-english/); [The GEO Community](https://thegeocommunity.com/blogs/generative-engine-optimization/geo-princeton-paper-original-study/) (secondary summaries of the paper; verify exact numbers against the PDF table)
- Caveat: the GEO experiments rewrote source text inside a simulated engine with a fixed retrieved set of 5 sources; they did not test whether a page gets *retrieved* in the first place. Follow-up academic work exists (IF-GEO for multi-query, E-GEO for e-commerce, and "GEO-Flag" for detecting GEO-optimized content, 2026) — [IF-GEO](https://arxiv.org/pdf/2601.13938); [E-GEO](https://arxiv.org/pdf/2511.20867); [GEO-Flag](https://arxiv.org/pdf/2608.16824) (titles only seen; not read)
- **Ahrefs, 75,000 brands** (AI Overviews brand visibility): branded web mentions correlated 0.664 with AI Overview visibility; branded anchors 0.527; branded search volume 0.392; backlinks only 0.218 — [Ahrefs blog](https://ahrefs.com/blog/ai-overview-brand-correlation/) [primary not fetched; numbers consistent across multiple secondary reports e.g. Matt Diggity on X](https://x.com/mattdiggityseo/status/1940303316157936113)
- Ahrefs' May 2026 update: YouTube mentions had the strongest correlation (~0.737) with AI visibility across 75,000 brands — [BusinessWire, May 26 2026](https://www.businesswire.com/news/home/20260526119691/en/Across-75000-Brands-YouTube-Mentions-Are-the-Strongest-Signal-of-AI-Visibility-New-Ahrefs-Report-Reveals); [The Next Web](https://thenextweb.com/news/ahrefs-youtube-mentions-ai-visibility-brand-search). **Vendor bias flag**: Ahrefs sells "Brand Radar" AI-mention tracking; correlations are Spearman on brand-level data and confounded by brand size.
- Ahrefs also found Google AI features appear more biased toward big brands than ChatGPT and Perplexity — [Ahrefs](https://ahrefs.com/blog/branded-web-mentions-visibility-ai-search/) [title/snippet only]
- **Citation concentration**: aggregated 2026 analyses report Reddit, Wikipedia and YouTube as the top-cited domains across engines; one aggregate claims top 15 domains take ~68% of AI citation share vs ~20% in organic search — [Everything-PR 2026 index](https://everything-pr.com/ai-platform-citation-source-index-2026); [Peec AI, 30M sources](https://peec.ai/blog/top-domains-cited-by-ai-search-analysis-based-on-30m-sources); [Semrush](https://www.semrush.com/blog/most-cited-domains-ai/). **Flag**: the "Reddit ≈40%" figure appears in aggregator content; methodologies (prompt sets, engines, weighting) differ widely and numbers conflict (e.g., Wikipedia "26–48% of ChatGPT top-10 answers"); treat only directional.
- "84% of AI citations come from earned media" and "~47.9% of ChatGPT's top citations go to Wikipedia" are circulated figures without clear primary methodology in the source I saw — [Detekia](https://detekia.fr/en/blog/comment-chatgpt-choisit-ses-sources) (low confidence)
- **Freshness**: claims that ChatGPT favors content updated within ~30 days appear in guides but I found no primary controlled study — [Detekia](https://detekia.fr/en/blog/comment-chatgpt-choisit-ses-sources) (low confidence; vendor/agency claim)
- **Bing freshness via IndexNow**: IndexNow notifies Bing (and therefore Copilot's grounding index) immediately of updates — [Gaurav Tiwari guide](https://gauravtiwari.org/bing-webmaster-tools/); [Otterly](https://otterly.ai/blog/bing-webmaster-tools-ai-performance-report/)

### Inferences
- For a small site that will rarely rank #1, the GEO paper's finding that lower-ranked sources gain most from adding citations/statistics/quotes is the most encouraging, evidence-backed tactic — e.g., tool pages and guides that include concrete, sourced numbers (file-size limits, Unicode/Krutidev facts, government-form requirements with links to official sources) and short quotable definitions.
- Because the strongest correlates are off-site (mentions, YouTube, branded search), on-page "GEO tricks" alone will not make a new brand appear for "best Hindi PDF editor" prompts; third-party mentions and Hindi YouTube tutorials are the higher-leverage bets.
- "Answer-first" formatting, FAQ blocks, headings mirroring questions, and schema are widely recommended but supported mainly by practitioner consensus, not controlled studies (see gaps).

### Gaps
- No controlled study found isolating the effect of answer-first formatting, FAQ schema, or structured data on AI citation rates. Google has historically said structured data is not required for AI features [primary not fetched].
- No independent (non-vendor) replication of the Ahrefs brand-mention correlations found.
- No citation-factor study specific to free web tools / utility queries (e.g., "PDF editor") found.

## 3. Does llms.txt get used by major AI engines (2026)?

### Takeaway
No. As of 2026 no major provider (Google, OpenAI, Anthropic, Meta, Perplexity, Mistral) has publicly committed to reading llms.txt in production, Google explicitly says it does not use it, and large log studies show AI bots almost never request it. It's cheap and harmless for a small site but should not be expected to change visibility.

### Cited Findings
- Google's Gary Illyes said in July 2025 Google doesn't support llms.txt and isn't planning to; John Mueller compared it to the keywords meta tag — [WebYes summary](https://www.webyes.com/blogs/does-llms-txt-improve-rankings/); [1ClickReport](https://www.1clickreport.com/blog/llms-txt-evidence-2026)
- Google's June 2026 Search Central docs reportedly state Google does not use llms.txt for rankings or AI Overviews — [1ClickReport](https://www.1clickreport.com/blog/llms-txt-evidence-2026); [Refonte Learning: "Google says skip it"](https://www.refontelearning.com/blog/implementing-llms-txt)
- Ahrefs study of 137,000 sites: 97% of llms.txt files got zero traffic in May 2026; of 500M+ AI-bot visits over 90 days, only 408 targeted llms.txt — [1ClickReport](https://www.1clickreport.com/blog/llms-txt-evidence-2026) (secondary report of an Ahrefs study)
- GPTBot occasionally fetches llms.txt, but OAI-SearchBot (the ChatGPT search crawler) barely requests it; no provider has said it influences answers — [Aria Shaw analysis](https://ariashaw.com/does-llms-txt-actually-work); [1ClickReport](https://www.1clickreport.com/blog/llms-txt-evidence-2026)
- Contrarian/vendor view: some guides still recommend it as "future-proofing" and for developer-doc use by coding agents (IDE tools) — [Limy.ai](https://limy.ai/blog/llms-txt-in-2026-the-full-guide); [Wix Studio myths post](https://www.wix.com/studio/ai-search-lab/llms-txt-myths)

### Inferences
- For the Hindi PDF editor: optional, 10-minute task; put zero expectation on it. Time is better spent on Bing indexing, crawler access, and mentions.

### Gaps
- Could not read llmstxt.org or the Ahrefs primary study directly (egress blocked).

## 4. AI crawler management and Cloudflare defaults (site is on Cloudflare Pages)

### Takeaway
To be citable, allow the *search* and *user-fetch* bots (OAI-SearchBot, ChatGPT-User, PerplexityBot/Perplexity-User, Claude-SearchBot/Claude-User, Bingbot, Googlebot). Blocking *training* bots (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot) is a separate choice that does not remove you from Google AI Overviews. Critically: Cloudflare changed defaults on **Sept 15, 2026** — free-plan zones now block Training and Agent categories by default on pages that show ads; Search stays allowed. The site owner should explicitly check the Cloudflare dashboard.

### Cited Findings
- Cloudflare's July 1, 2026 "Content Independence Day" update introduced three AI crawler categories — **Search, Agent, Training** — with per-category controls — [Help Net Security, Jul 2 2026](https://www.helpnetsecurity.com/2026/07/02/cloudflare-ai-crawler-controls/); [Cloudflare blog](https://blog.cloudflare.com/content-independence-day-ai-options/) [primary not fetched]
- From **Sept 15, 2026**: on pages that display advertising, Training and Agent bots are blocked unless the owner allows them; Search crawlers remain allowed; applies to new customers, new sites added by existing customers, and **all existing free-plan customers**; paid customers could opt out — [Crawl Lab](https://crawl-lab.com/en/blog/robots-txt/cloudflare-blocks-ai-crawlers-september-2026/); [NovaProxy](https://www.novaproxy.io/blog/cloudflare-will-block-ai-crawlers-by-default-on-september-15-2026-heres-what-actually-changes); [Remote Work Europe](https://remoteworkeurope.eu/news/2026/cloudflare-sep-15-ai-default-flip-pay-per-use/)
- Category mapping reported: OAI-SearchBot and Claude-SearchBot = Search (allowed by default); ChatGPT-User-type live fetches = Agent (blocked by default on ad pages); GPTBot, ClaudeBot, CCBot = Training — [Luong Hong Thuan](https://luonghongthuan.com/en/blog/cloudflare-ai-crawler-default-block-september-2026/); [hosting.com](https://hosting.com/blog/cloudflares-new-ai-crawler-defaults-and-what-they-mean-for-site-owners/)
- History: in July 2025 Cloudflare began blocking AI crawlers by default for new domains and launched Pay Per Crawl (HTTP 402) — [Search Engine Land, Jul 2025](https://searchengineland.com/cloudflare-to-block-ai-crawlers-by-default-with-new-pay-per-crawl-initiative-457708); [SERoundtable](https://www.seroundtable.com/cloudflare-block-ai-crawlers-39673.html)
- 2026: Cloudflare replaced Pay Per Crawl with **Pay Per Use** (payment when AI actually uses content in an answer), launch partners Ceramic.ai and You.com — [NoticeMeSenpai](https://noticemesenpai.com/news/cloudflare-blocks-ai-crawlers-default-pay-per-use/); [Remote Work Europe](https://remoteworkeurope.eu/news/2026/cloudflare-sep-15-ai-default-flip-pay-per-use/) (secondary; irrelevant revenue-wise for a free tool site)
- Remote Work Europe notes Cloudflare's own dashboard "makes the problem look worse than it is" (i.e., blocked counts may alarm owners though search bots remain allowed) — [Remote Work Europe](https://remoteworkeurope.eu/news/2026/cloudflare-sep-15-ai-default-flip-pay-per-use/)
- SE Ranking (2025) reported ~73% of websites block at least one AI bot, often unknowingly — [Detekia citing SE Ranking](https://detekia.fr/en/blog/comment-chatgpt-choisit-ses-sources) (secondary)
- Google-Extended controls use of content for Gemini training/grounding in Gemini apps but does **not** affect inclusion in Google Search or AI Overviews (which use Googlebot); to limit AI Overview use, only nosnippet/noindex work — [Google crawler docs](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) [primary not fetched; from training knowledge — verify]

### Inferences
- Concrete Cloudflare checklist for the site: (1) Dashboard → the zone → Security/AI Crawl Control (name may vary): confirm Search = Allow; set Agent = Allow (so ChatGPT-User / Perplexity-User / Claude-User can fetch the tool page when a user asks); decide Training (allowing GPTBot/ClaudeBot/Google-Extended/Applebot-Extended improves the odds the brand exists in future model weights — for a free tool wanting awareness, allowing is reasonable). (2) If Cloudflare "managed robots.txt" is on, check the served robots.txt actually matches intent. (3) Whether the "ads" condition applies depends on whether the pages show ads — verify rather than assume. (4) Cloudflare Pages on a custom domain inherits zone settings; `*.pages.dev` hostnames are not in the user's zone — confirm which hostname is canonical.
- Validate with server/Cloudflare logs (AI Crawl Control analytics) that OAI-SearchBot, Bingbot, PerplexityBot and Claude-SearchBot actually get 200s.

### Gaps
- Could not confirm from Cloudflare primary docs how the Sept 15 rule applies to Cloudflare Pages projects specifically, or the exact definition of "pages that display advertising."
- Exact dashboard menu names not verified.

## 5. AI Overviews' CTR impact, AI referral growth, and measurement

### Takeaway
AI Overviews sharply reduce clicks on informational queries (Ahrefs: −58% CTR for position 1 by Dec 2025), but being *cited* in the Overview partially offsets it. AI referral traffic is small (~1% of visits by most estimates) but more than doubled year over year, with ChatGPT's share falling as Gemini and Claude grow. Measurement tools now exist from Google (Search Console generative AI report, impressions only) and Microsoft (Bing AI Performance), plus GA4 referrer segmentation and paid trackers.

### Cited Findings
- Ahrefs (300,000 keywords, GSC data, Dec 2023 vs Dec 2025): AI Overviews associated with 58% lower average CTR for the top-ranking page, up from a 34.5% reduction measured ~8 months earlier — [BusinessWire, May 18 2026](https://www.businesswire.com/news/home/20260518322756/en/New-Research-Googles-AI-Overviews-Now-Cost-Websites-58-of-Their-Clicks); [Ahrefs original 34.5%](https://ahrefs.com/blog/ai-overviews-reduce-clicks/)
- Secondary reports say brands cited inside the AI Overview earn ~35% more clicks than organic results below it — [Ahrefs CTR study search snippet via BusinessWire/aggregators](https://heybuffy.com/blog/how-much-do-ai-overviews-reduce-clicks) (lower confidence; attribution unclear)
- Study set used informational-intent keywords; tool/transactional queries ("hindi pdf editor online") are less likely to trigger AI Overviews — [Ahrefs update via Tyneside Marketing](https://tynesidemarketing.co.uk/blog/ai-overviews-click-through-rates) (inference in part; no tool-query-specific study found)
- Similarweb: AI platforms drove ~770.7M referral visits/month worldwide (Jun 2025–May 2026), +117% YoY — [Similarweb AI Search stats](https://aisearch.similarweb.com/blog/gen-ai-stats/)
- ChatGPT's May 7, 2026 update turned brand names in answers into clickable links, and ChatGPT referral traffic spiked — [Similarweb](https://www.similarweb.com/blog/insights/ai-news/chatgpt-referral-traffic-triples/); [SE Ranking, May 2026 all-time high](https://seranking.com/blog/chatgpt-referral-traffic-may-2026/)
- ChatGPT's share of gen-AI web traffic fell from ~76% to ~53% over a year; Gemini > 25%; Claude fastest-growing — [Digital Applied citing Similarweb](https://www.digitalapplied.com/blog/ai-referral-traffic-share-2026-gemini-chatgpt-geo-analysis); [Similarweb](https://aisearch.similarweb.com/blog/gen-ai-stats/)
- AI referral traffic ≈1% of total visits (widely cited) — [AuthorityTech](https://authoritytech.io/curated/ai-referral-traffic-brand-citation-measurement-2026)
- **Google Search Console**: AI Mode clicks/impressions count in the main Performance report (not filterable separately); in June 2026 Google introduced dedicated "Generative AI performance" reports — v1 tracks impressions only (URL appearing as citation in AI Overviews/AI Mode), no clicks, position, CTR or queries — [Google Search Central Blog, June 2026](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports); [Search Console Help](https://support.google.com/webmasters/answer/16984139?hl=en); [CrawlRaven](https://crawlraven.com/blog/gsc-ai-performance-reports); [Search Engine Land on AI Mode data](https://searchengineland.com/google-ai-mode-traffic-data-search-console-457076)
- **Bing Webmaster Tools AI Performance** shows cited pages and grounding queries for Copilot — [Bing blog](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview)
- Paid trackers (Profound, Otterly, Peec AI, Semrush AI toolkit, Ahrefs Brand Radar) run fixed prompt sets across engines and report mention/citation share — [Otterly](https://otterly.ai/blog/bing-webmaster-tools-ai-performance-report/); [Peec AI](https://peec.ai/ai-search-geo-statistics). **Flag**: AI answers are non-deterministic and personalized; citation patterns "shift by tens of percentage points within weeks" — [Detekia](https://detekia.fr/en/blog/comment-chatgpt-choisit-ses-sources)

### Inferences
- Measurement stack for a free small site (no paid tools needed initially):
  1. GA4: custom channel group "AI referrals" with a referrer regex such as `chatgpt\.com|chat\.openai\.com|perplexity\.ai|gemini\.google\.com|copilot\.microsoft\.com|claude\.ai|meta\.ai|you\.com` (ChatGPT often appends `utm_source=chatgpt.com`). Note Google AI Overviews/AI Mode clicks arrive as google organic and cannot be separated.
  2. GSC Generative AI report (impressions/citations) + Bing AI Performance (citations + grounding queries).
  3. Cloudflare AI Crawl Control / logs for bot hits by OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot.
  4. Monthly manual prompt panel: ~20 prompts in English, Hindi (Devanagari) and Hinglish (e.g., "hindi pdf edit kaise kare", "हिंदी PDF में टेक्स्ट कैसे बदलें", "best free Hindi PDF editor online", "Krutidev PDF to Unicode") across ChatGPT, Gemini, AI Mode, Perplexity, Copilot, Meta AI on WhatsApp; log mentioned/cited/position in a sheet; run logged-out, repeat 2–3 times given variance.
- A paid tracker is not justified for a free tool until manual tracking shows meaningful AI presence.

### Gaps
- No India-specific AI referral or AI Overview CTR data found.
- No data on click-through for utility/tool queries specifically.

## 6. Entity / brand building for LLMs

### Takeaway
Evidence (correlational) favors off-site brand mentions — especially YouTube — over backlinks. For a small tool, the realistic playbook is: get into third-party "best Hindi PDF tools" lists, publish Hindi YouTube tutorials, answer genuinely on Reddit/Quora, keep brand name/description identical across profiles, and create structured-entity footprints (Wikidata only if notability criteria are honestly met).

### Cited Findings
- Branded web mentions (0.664) and YouTube mentions (~0.737) correlate most with AI visibility; backlinks weakly (0.218) — [Ahrefs](https://ahrefs.com/blog/ai-overview-brand-correlation/); [BusinessWire](https://www.businesswire.com/news/home/20260526119691/en/Across-75000-Brands-YouTube-Mentions-Are-the-Strongest-Signal-of-AI-Visibility-New-Ahrefs-Report-Reveals)
- Reddit, Wikipedia, YouTube are the most-cited domains across AI engines; LinkedIn, review sites (G2), editorial "best of" publishers (TechRadar, Forbes) also rank high — [Semrush](https://www.semrush.com/blog/most-cited-domains-ai/); [Search Engine Land](https://searchengineland.com/ai-search-engines-cite-reddit-youtube-and-linkedin-most-study-473138); [Contently](https://contently.com/2026/04/29/top-sources-llms-cite/)
- Brands recommended in ChatGPT answers got ~2.5x more site visits within 7 days vs comparable brands (Similarweb panel) — [Similarweb stats](https://aisearch.similarweb.com/blog/gen-ai-stats/) (vendor)
- Meta launched Business AI on WhatsApp for Indian small businesses (May 14, 2026), answering from a business's catalogue and website content — [Presenc AI / aggregator](https://presenc.ai/research/meta-ai-usage-statistics-2026) (secondary; verify)

### Inferences
- Priority list for the Hindi PDF editor: (1) Hindi + Hinglish YouTube tutorials ("Hindi PDF me edit kaise kare") with the brand name in title/description and link; (2) outreach to Indian tech blogs / "best free PDF editor for Hindi / Sarkari form" roundups; (3) honest answers on Reddit (r/india, r/IndiaTech, r/UPSC) and Quora Hindi where people ask about editing Hindi PDFs/Krutidev; (4) GitHub repo (if any part open-source) and Play Store listing for the mobile app, using the same brand name and one-line description; (5) Organization + WebApplication/SoftwareApplication schema with `sameAs` linking all profiles; (6) Wikidata item only if there's independent coverage — low-notability items get deleted, and there's no evidence Wikidata alone drives citations. Crunchbase has no demonstrated effect for a non-startup free tool.
- Avoid astroturfing Reddit — moderators remove it and it's a reputational risk; no evidence was found quantifying its effect anyway.

### Gaps
- No direct evidence found that Wikidata/Crunchbase entries increase LLM citations (commonly asserted by agencies, unsupported by studies I found).
- No evidence found on Play Store listings' effect on AI answers.

## 7. Multilingual AI search: Hindi / Hinglish

### Takeaway
Google AI Mode officially supports Hindi (and several Indian languages) since 2025, so Hindi queries do get AI answers. Academic work shows LLM answers differ systematically by query language and that retrieval-augmented systems draw from sources in the query language when available, otherwise defaulting to English sources — meaning genuine Devanagari content is plausibly an advantage for Hindi prompts because competition is thinner. No study specifically measured citation rates for Devanagari vs English pages.

### Cited Findings
- AI Mode supports Hindi (2025) and 7 more Indian languages (Oct 2025) — [Search Engine Land](https://searchengineland.com/google-expands-ai-mode-beyond-english-461680); [TechCrunch](https://techcrunch.com/2025/10/08/googles-search-live-comes-to-india-ai-mode-gets-more-languages)
- Johns Hopkins researchers found multilingual RAG/LLM tools create a "digital language divide": answers are shaped by sources in the user's language when they exist (a Hindi speaker sees Indian-source-shaped answers), and when no documents exist in the query language, answers fall back to English-language perspectives — [TechXplore, Sept 2025](https://techxplore.com/news/2025-09-digital-language-multilingual-ai-bias.html)
- An English–Hindi study found systematic cross-linguistic differences in LLM outputs (complexity, sentiment, quality) — [Springer Discover Education 2026](https://link.springer.com/article/10.1007/s44217-026-01609-4)
- Linguistic bias in LLM-based recommendations (2026 arXiv) — [arXiv 2604.25456](https://arxiv.org/html/2604.25456v1) (title only; not read)

### Inferences
- Provide real Devanagari pages (not machine-thin duplicates) with `hreflang` hi-IN / en-IN, Devanagari titles/H1s, and explicit Hinglish phrasing in FAQs ("Hindi PDF edit kaise kare") since Indian users type romanized Hindi. When a Hindi prompt triggers retrieval, few competing Hindi-language tool pages exist, which increases the odds of being one of the retrieved/cited sources. This is consistent with the project's design rule that Devanagari headlines get equal weight.
- Answer engines may translate Hindi queries into English sub-queries (query fan-out), so maintain strong English pages too.

### Gaps
- No study measured whether Devanagari vs English vs Hinglish content changes citation probability in AI Overviews/ChatGPT for Hindi prompts.
- No data found on how often Hindi/Hinglish queries trigger AI Overviews in India.
- Unknown how Meta AI on WhatsApp handles Hinglish retrieval.

## (Cross-cutting) Concrete tactic list for the site, with evidence strength

(Placed here as synthesis for the report writer; each item references findings above.)

| # | Tactic | Evidence strength |
|---|---|---|
| 1 | Verify Cloudflare AI Crawl Control after Sept 15, 2026: Search = allow, Agent = allow, Training = deliberate choice; check robots.txt served | Strong (platform facts, Sec. 4) |
| 2 | Register + submit sitemap in Bing Webmaster Tools, enable IndexNow; monitor Bing AI Performance | Strong-moderate (ChatGPT/Copilot rely on Bing, Sec. 1, 5) |
| 3 | GSC: watch Generative AI impressions report | Strong (Sec. 5) |
| 4 | Add statistics, cited sources and quotable one-sentence answers to guide/tool pages | Moderate (peer-reviewed but simulated, Sec. 2) |
| 5 | Hindi/Hinglish YouTube tutorials; get into third-party roundups; authentic Reddit/Quora answers | Moderate (correlational, vendor, Sec. 2, 6) |
| 6 | Devanagari + Hinglish content with hreflang | Plausible (indirect academic evidence, Sec. 7) |
| 7 | Schema (SoftwareApplication, FAQ, Organization sameAs) | Weak for AI citation specifically; good SEO hygiene |
| 8 | llms.txt | No evidence of effect (Sec. 3); optional |
| 9 | GA4 AI-referrer channel + monthly manual prompt panel in 3 scripts/languages | Measurement, not ranking |
