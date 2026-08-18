# The 2026 SEO / GEO / AEO / AIEO Playbook
### A universal, fill-in-the-blanks operating system for ranking in Google Search and getting cited in AI answers — executable by any AI agent, for any website.

*Last verified against primary sources: August 2026. Search algorithms and AI platforms change fast — before a new run of this playbook, re-check the "Sources & Recheck Protocol" at the very end.*

---

## 0. How This Playbook Works (read this first)

This is not a generic listicle. It is an **operating procedure**. An AI agent (or a human) should be able to take this document plus a single website, and execute a customized SEO/GEO/AEO program from it, in order:

1. **Fill in Section 3 (Site Intake Protocol) first.** Every later phase references the variables gathered there (`{{SITE_URL}}`, `{{NICHE}}`, `{{GOAL}}`, etc.). Do not skip intake — a playbook run without intake is generic advice, not a customized program.
2. **Work the phases in order** (Technical → Content → Structured Data → AI Visibility → Authority → Measurement). Each phase depends on the one before it holding up. Do not chase AI-citation tactics on a site that fails basic indexability — it will not work.
3. **Every checklist item is a task**, not trivia. Convert each unchecked box into a ticket: owner, due date, done/not-done.
4. **Distinguish "confirmed by the platform" from "industry consensus" from "contested/unproven."** This playbook tags claims accordingly ( ✅ Confirmed · 🔶 Consensus · ⚠️ Contested ) so you don't spend budget on theater. Where Google, in particular, has published an official position, that position is quoted and treated as authoritative over any third-party "hack."
5. **Re-run Section 3 and Section 9 (Measurement) on a fixed cadence** (monthly at minimum) — this is a loop, not a one-time project.

---

## 1. The 2026 Reality Check — one discipline, several surfaces

For years, "SEO," "GEO" (Generative Engine Optimization), "AEO" (Answer Engine Optimization), and "AIEO/AIO" (AI [Engine] Optimization) were marketed as separate disciplines requiring separate tactics. As of **May 15, 2026**, Google published its first official guidance on this directly, and it is unambiguous — ✅ Confirmed, primary source:

> "From Google Search's perspective, optimizing for generative AI search is optimizing for the search experience, and thus still SEO." — Google Search Central, *Optimizing your website for generative AI features on Google Search*

Google's generative features (AI Overviews, AI Mode) work via **retrieval-augmented generation (RAG)** and **query fan-out**: they pull from the same Search index, ranked by the same core quality/ranking systems, then synthesize an answer with visible source links. There is no separate "AI index" to optimize for on Google — if you're not indexed and ranking normally, you will not be cited in Google's AI answers either.

**However — and this is the part generic guides miss** — Google is not the only place answers get generated. ChatGPT Search, Perplexity, Claude, Microsoft Copilot, and the standalone Gemini app each have their **own retrieval pipelines, their own crawlers, and their own citation behavior**, largely independent of Google's index and ranking systems. Research cited industry-wide in 2026 found only around **2% overlap** between a domain's Google top-10 rankings and its ChatGPT citations for the same queries — these are genuinely separate visibility games layered on the same content. 🔶 Consensus.

**The operating model this playbook uses:**

- **One content and technical foundation** (Sections 4–6): built to Google's official SEO standard, because it is the best-documented, highest-traffic, and most rigorously enforced standard that exists, and every other engine's quality bar tracks it loosely.
- **One additional, platform-aware visibility layer** (Section 7): because Google's index is not the only retrieval system in the market, and being crawlable + citable on ChatGPT/Perplexity/Claude/Copilot is a distinct, addressable surface with its own crawler rules and citation mechanics — even though it uses the *same underlying content*, not different content.

Do not build two versions of your content. Build one excellent, well-structured, well-sourced version, then make sure every retrieval system (Google's and everyone else's) can technically reach it and has a reason to cite it.


---

## 2. Glossary (so every acronym in this doc is unambiguous)

| Term | Meaning |
|---|---|
| **SEO** | Search Engine Optimization — getting found and ranked in traditional search engines (primarily Google, also Bing). |
| **GEO** | Generative Engine Optimization — structuring content so generative AI systems (ChatGPT, Perplexity, Gemini, Google AI Overviews, Claude) select and cite it in synthesized answers. |
| **AEO** | Answer Engine Optimization — originally about featured snippets/voice search; now largely folded into GEO since most "answer engines" are generative. |
| **AIEO / AIO** | AI [Engine/Search] Optimization — umbrella marketing terms covering the same territory as GEO. Treat as synonyms. |
| **RAG** | Retrieval-Augmented Generation — the technique AI search features use: retrieve relevant, ranked documents from an index, then generate an answer grounded in them. This is *why* SEO fundamentals still gate AI visibility. |
| **Query fan-out** | A generative engine silently issuing several related sub-queries to gather more source material before answering one user question. Means your content should cover a topic's adjacent questions, not just the literal query. |
| **E-E-A-T** | Experience, Expertise, Authoritativeness, Trustworthiness — Google's quality framework used by human Search Quality Raters to evaluate content; not a direct ranking factor but the model the ranking systems are trained to approximate. |
| **YMYL** | "Your Money or Your Life" — content that could affect health, financial stability, safety, or (as of the 2025 guideline update) civic/election decisions. Held to the highest E-E-A-T bar. |
| **Core Web Vitals (CWV)** | LCP, INP, CLS — Google's field-measured page-experience metrics; part of the ranking system, and a tiebreaker in competitive SERPs. |
| **Citation share / AI share of voice** | The % of a defined set of AI-answer prompts in which your brand/domain is mentioned or linked, tracked per-platform. The AI-era equivalent of rank tracking. |
| **Topical authority** | The degree to which a site is judged comprehensive and trustworthy on an entire subject, not just a single ranking keyword — built via pillar/cluster content architecture and internal linking. |
| **llms.txt** | A proposed (not standardized) Markdown file at a site's root listing key pages for LLMs to read. Contested value — see Section 7.4. |

---

## 3. Site Intake Protocol — fill this in before doing anything else

**Instructions for the executing AI:** gather every field below by (a) crawling/reading the live site, (b) reading any connected Search Console / analytics data, (c) asking the site owner directly for anything not observable. Do not proceed to Section 4 with blank fields — state your assumption explicitly if a field can't be filled and flag it for confirmation.

### 3.1 Core variables (used throughout this playbook as `{{VARIABLE}}`)

| Variable | Field | How to find it |
|---|---|---|
| `{{SITE_URL}}` | Root domain | Given |
| `{{NICHE}}` | Industry / vertical | Homepage, About page, meta description |
| `{{BUSINESS_MODEL}}` | Ecommerce / SaaS / local service / media-publisher / lead-gen / other | Site structure, checkout flow presence |
| `{{PRIMARY_GOAL}}` | Traffic, leads, sales, bookings, ad revenue, brand awareness | Ask the owner; infer from CTAs if unstated |
| `{{TARGET_GEOGRAPHY}}` | Global / country / region / city-level (local business) | Contact page, currency, language, GBP presence |
| `{{IS_YMYL}}` | Yes/No — does the site touch health, finance, safety, legal, or civic topics? | Content review — determines how strict E-E-A-T enforcement must be |
| `{{CMS_STACK}}` | WordPress, Shopify, Webflow, custom, headless, etc. | View source / `wp-content` paths / generator meta tag |
| `{{CURRENT_INDEX_STATUS}}` | Roughly how many pages indexed, any manual actions | `site:{{SITE_URL}}` search + Search Console if available |
| `{{TOP_3_COMPETITORS}}` | Direct competitors ranking for target queries | SERP checks on 5–10 head terms |
| `{{EXISTING_BACKLINK_PROFILE}}` | Rough authority tier, any spammy link history | Any available backlink tool, or note "unknown — audit needed" |
| `{{BUDGET_TIER}}` | DIY / small monthly retainer / full team | Ask the owner — determines how aggressive Section 8 (link building) and Section 12 (roadmap) can be |
| `{{AI_CRAWLER_STANCE}}` | Open to AI training crawlers? Open to AI search/answer crawlers? | Ask the owner — this is a policy decision, not a technical default (see Section 7.3) |

### 3.2 Discovery steps to run once

1. Crawl the homepage + top 20 pages by (assumed) traffic. Note CMS, rendering method (server-rendered vs JS-heavy SPA), URL structure, existing schema.
2. Pull (or ask for) Google Search Console: indexed pages, top queries, CWV report, manual actions, Generative AI performance report if available.
3. Run 5–10 head/money queries in the target niche through a normal Google search and note: who's in the top 3, whether an AI Overview appears, who it cites.
4. Check `{{SITE_URL}}/robots.txt` and note current AI-crawler posture (see Section 7.3 for the reference table).
5. Confirm YMYL status — this single flag changes how strict authorship/citation requirements need to be in Section 5.
6. Confirm whether the business has a physical location / serves a local area — this determines whether Section 8.3 (Local SEO) is in scope at all.


---

## 4. Phase 1 — Technical Foundations

**Why this is Phase 1:** Google states plainly that a page must be indexed and crawlable to appear in *any* Google surface — organic results, AI Overviews, or AI Mode. This is the floor everything else stands on. ✅ Confirmed.

### 4.1 The three non-negotiable indexability gates (Google's own minimum bar)

A page is only eligible to appear in Google Search — full stop — if all three are true:

1. **Googlebot isn't blocked** — not by robots.txt, not by a login wall, not by an accidental `noindex`.
2. **The page returns an HTTP `200` status** — not a 4xx/5xx error, not a redirect chain.
3. **The page has indexable content** — real text Google can parse, and it doesn't violate Google's spam policies.

**Checklist:**
- [ ] `robots.txt` audited at `{{SITE_URL}}/robots.txt` — confirm nothing important is accidentally disallowed
- [ ] No stray `<meta name="robots" content="noindex">` on pages meant to rank
- [ ] Crawl for 4xx/5xx errors and orphaned redirect chains; fix or 301 them
- [ ] Confirm the site is on HTTPS site-wide, no mixed content
- [ ] Confirm site is verified in Google Search Console (this also gates eligibility for the Generative AI performance report and Search's generative AI features per Google's own documentation)

### 4.2 Core Web Vitals — exact 2026 thresholds

Field data (from real Chrome users, Chrome UX Report, 75th percentile, 28-day rolling window) — not lab scores. 🔶 Consensus on thresholds, ✅ Confirmed as an official ranking signal since 2021.

| Metric | Measures | Good | Needs Improvement | Poor |
|---|---|---|---|---|
| **LCP** (Largest Contentful Paint) | Loading speed | ≤ 2.5s | 2.5s–4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | Responsiveness | ≤ 200ms | 200ms–500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | Visual stability | ≤ 0.1 | 0.1–0.25 | > 0.25 |

A page passes CWV only when **≥75% of real visits** hit "Good" on **all three**. INP is the metric most sites fail in 2026 — it requires JavaScript-architecture fixes (breaking up long tasks, yielding to the main thread), not just image compression.

**Checklist:**
- [ ] Pull real CWV data from Search Console's Core Web Vitals report (not just a one-off PageSpeed Insights lab test)
- [ ] Fix whichever metric is in the "Poor" band first
- [ ] LCP fixes: preload the hero image/font, inline critical CSS, use `font-display: swap`, server-side render where possible
- [ ] INP fixes: break up long JavaScript tasks, defer non-critical scripts, avoid heavy third-party tags on interaction paths
- [ ] CLS fixes: explicit `width`/`height` (or `aspect-ratio`) on every image/video/iframe/ad slot, reserve space for dynamically injected content
- [ ] Re-check 3–4 weeks after each deploy (CrUX is a rolling 28-day window — instant validation is not possible)

### 4.3 Site architecture & crawl efficiency

- [ ] Flat, logical URL structure (`/category/subtopic/page`, no deep unnecessary nesting)
- [ ] XML sitemap present at `{{SITE_URL}}/sitemap.xml`, submitted in Search Console, kept current (no 404s or noindexed URLs listed in it)
- [ ] Internal linking: every important page reachable within 3 clicks of the homepage
- [ ] Canonical tags (`rel="canonical"`) correctly set on every page, especially faceted/filtered or parameterized URLs, to avoid duplicate-content dilution
- [ ] Duplicate content minimized or canonicalized (thin near-duplicate pages waste crawl budget and dilute topical signals)
- [ ] For large sites (10,000+ URLs) or frequently-updated sites: review crawl-budget allocation — make sure Googlebot's limited crawl time is spent on pages that matter, not on faceted-navigation infinite spaces
- [ ] Mobile-first indexing assumed by default — the mobile rendering of a page **is** what Google indexes; test on mobile, not desktop
- [ ] If JavaScript-rendered (SPA/React/Vue): confirm Google can actually render the content (use the URL Inspection tool's rendered HTML view) — don't assume a framework "just works" for SEO
- [ ] International sites: `hreflang` implemented correctly for every locale variant, self-referencing and reciprocal

### 4.4 robots.txt — full reference template

Covers both classic search engines and the split "training vs. search/answer" AI crawlers (see Section 7.3 for the policy discussion — fill in the Allow/Disallow lines based on `{{AI_CRAWLER_STANCE}}` from intake):

```
# robots.txt — {{SITE_URL}}
# Traditional search engines — always allow
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# AI training crawlers — decide per {{AI_CRAWLER_STANCE}}
User-agent: GPTBot
Allow: /            # or Disallow: / to opt OUT of OpenAI model training

User-agent: Google-Extended
Allow: /            # or Disallow: / to opt OUT of Gemini/AI model training on this content

User-agent: ClaudeBot
Allow: /            # or Disallow: / to opt OUT of Anthropic model training

User-agent: CCBot
Disallow: /          # Common Crawl — feeds many third-party model datasets; block by default if unsure

User-agent: Bytespider
Disallow: /          # documented as frequently ignoring robots.txt; block explicitly anyway

# AI search / answer crawlers — allow these if you want to be citable in AI answers
User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

# Default catch-all
User-agent: *
Disallow: /admin/
Disallow: /checkout/
Disallow: /cart/
Disallow: /*?*session=

Sitemap: {{SITE_URL}}/sitemap.xml
```

**Rule of thumb:** blocking a *training* crawler (GPTBot, Google-Extended, ClaudeBot, anthropic-ai) only opts you out of being used as model-training data — it does **not** remove you from that company's live AI-answer product. Blocking the *search/answer* crawler (OAI-SearchBot, PerplexityBot, Claude-SearchBot) **does** remove you from citations in that product. Treat these as two separate decisions. Verify bot identity via reverse DNS in server logs, not just the user-agent string — spoofing is common. Note also that some conversational agents (e.g. `ChatGPT-User`, triggered when a user asks the assistant to visit a specific URL) may not fully respect robots.txt the way a bulk crawler does — real access control for anything sensitive belongs at the server/WAF level, not just in this file.


---

## 5. Phase 2 — Content & On-Page (the part that actually drives rankings)

Every 2026 source, and Google's own guidance, converges on one point: **technical SEO gets you eligible to rank; content quality determines whether you actually do.** Google's official AI-search guidance states this almost as its headline: *"Creating content that people find unique, compelling, and useful will likely influence your website's presence in generative AI search... more than any of the other suggestions in this guide."* ✅ Confirmed.

### 5.1 The "non-commodity content" test (Google's own bar, quoted directly)

Google explicitly distinguishes low-value **commodity content** — generic listicles like "7 Tips for First-Time Homebuyers" that could have been written by anyone, based on nothing but common knowledge — from valuable **non-commodity content**: pieces built on the author's own first-hand experience, data, or expertise, providing a take that doesn't already exist elsewhere on the web.

**Before publishing anything, ask:** *Could a generic AI model or a competitor with zero domain experience have produced this exact piece?* If yes, it is commodity content and Google's guidance says explicitly it will not carry the site.

**Checklist per piece of content:**
- [ ] Contains a unique point of view, first-hand data, an original test/case study, or expert commentary — not just a restatement of what's already ranking
- [ ] Written for `{{NICHE}}`'s actual audience and their real intent, not stuffed for a keyword
- [ ] Organized with genuine, readable structure — clear headings, short paragraphs, logical section order (this also happens to be what both human readers and AI retrieval systems parse best)
- [ ] Backed by real images/video where relevant, not just stock filler
- [ ] If AI-assisted in drafting: a human has verified accuracy, added expertise/experience, and taken editorial accountability for it (see 5.4)

### 5.2 E-E-A-T — Experience, Expertise, Authoritativeness, Trust

Not a direct ranking factor, but the framework Google's human Search Quality Raters use, which the ranking systems are trained to approximate. Weight of enforcement scales with `{{IS_YMYL}}` — YMYL topics (health, finance, safety, legal, civic) get the strictest bar.

| Pillar | What to build |
|---|---|
| **Experience** | First-hand use, testing, or lived involvement with the subject — "I tested this myself" content, real photos/screenshots, specific outcomes/numbers, not textbook paraphrase |
| **Expertise** | Named, credentialed authors with real bios; for YMYL content, credentials that are verifiable (license numbers, degrees, professional affiliations) |
| **Authoritativeness** | Recognition *outside* your own site — being cited, linked to, or quoted by independent, relevant third parties |
| **Trust** | Accurate contact info, clear ownership/About page, transparent editorial policy, secure site, correct/updated facts, honest reviews (no gating, no fake reviews) |

**Checklist:**
- [ ] Every content piece has a real, named author with a bio page
- [ ] `Person` schema linked to `sameAs` profiles (LinkedIn, professional registries, Wikidata where applicable) for named authors — this is what lets Google (and AI systems) resolve *who* wrote it
- [ ] An About/Company page exists with real information — not a placeholder
- [ ] For YMYL content specifically: credentials stated and verifiable; content reviewed on a schedule (quarterly minimum for anything medical/financial/legal)
- [ ] "Last reviewed/updated" dates are honest — a substantive edit, not a cosmetic date-stamp swap. Google's quality systems have specifically been documented penalizing fake-freshness date changes with no real content update.

### 5.3 Topical authority — the pillar/cluster content architecture

Individual keyword-by-keyword content no longer competes well against sites that demonstrate **comprehensive coverage of a topic**. 🔶 Strong consensus, and matches Google's stated preference for depth over thin scaled content.

**Method:**
1. Pick a core topic within `{{NICHE}}` that maps to `{{PRIMARY_GOAL}}`.
2. Build a **topical map**: the pillar topic, its subtopics, and the specific questions real users ask about each — this is your content backlog, planned *before* writing starts.
3. Write one **pillar page** (typically 1,500–4,000+ words, however long full coverage genuinely requires — do not pad) that comprehensively overviews the topic and links out to every cluster page.
4. Write **cluster/spoke pages** (start with 5–10, expand over time) that each go deep on one subtopic, and link back to the pillar and sideways to sibling clusters.
5. Internally link with varied, descriptive anchor text — not the same exact-match phrase repeated everywhere.
6. Repeat for the next pillar. Depth-first beats breadth-first: 10 genuinely thorough, well-linked pages on one topic reliably outperform 50 thin, disconnected ones.

**Checklist:**
- [ ] Topical map documented before content production starts
- [ ] Every cluster page links to its pillar; pillar links to every cluster
- [ ] No keyword cannibalization — check that two pages aren't silently competing for the same query
- [ ] Content gaps identified by comparing your topical map against what `{{TOP_3_COMPETITORS}}` actually cover

### 5.4 AI-assisted content — Google's actual policy (not the myth)

Google does **not** ban AI-assisted content. ✅ Confirmed, quoted directly: *"Using generative AI tools... to generate many pages without adding value for users may violate Google's spam policy on scaled content abuse."* The issue is scale-without-effort, not tool choice.

**Checklist:**
- [ ] AI can be used to research, outline, draft, or summarize — but a human must add genuine expertise, verify every fact, and edit for originality before publishing
- [ ] Never mass-publish AI output "as-is" across many pages purely to cover keyword variations — this is explicitly named as scaled content abuse and is a policy violation, not just a quality nit
- [ ] Where production method is materially relevant to trust, consider disclosing how content was created (Google frames this as a "Who, How, and Why" transparency test)
- [ ] For ecommerce specifically: if using AI-generated product images or AI-written titles/descriptions on Merchant Center feeds, label them per Google Merchant Center's AI-content policy (structured metadata requirement)

### 5.5 On-page elements checklist (per page)

- [ ] Unique, descriptive `<title>` tag (~50–60 characters) with primary intent reflected, not stuffed
- [ ] Unique meta description (~150–160 characters) that earns the click — not required for ranking, but affects CTR
- [ ] One `<h1>`, logical `<h2>`/`<h3>` hierarchy that mirrors the topical map for that page
- [ ] **Answer-first structure for the opening 100–200 words**: state the direct answer to the primary query immediately, then expand. This serves human skimmers, featured snippets, and AI systems doing real-time retrieval (Perplexity, AI Overviews) that weight a page's opening content heavily when deciding what to extract. 🔶 Consensus tactic, low-cost, no downside.
- [ ] Descriptive, keyword-relevant image `alt` text (accessibility + SEO, not a coincidence — Google explicitly ties these together)
- [ ] Internal links to relevant cluster/pillar content
- [ ] Mobile-rendered layout checked, not just desktop
- [ ] No intrusive interstitials blocking main content on entry

### 5.6 Content brief template (fill in per piece)

```
TITLE / PRIMARY QUERY: 
SEARCH INTENT: [informational / commercial / transactional / navigational]
TARGET AUDIENCE & THEIR ACTUAL QUESTION:
UNIQUE ANGLE (what makes this non-commodity — our data/experience/POV):
CLUSTER IT BELONGS TO / PILLAR IT LINKS TO:
QUESTIONS TO ANSWER (from query fan-out — the adjacent things a searcher/AI would also ask):
REQUIRED PROOF POINTS (stats, screenshots, first-hand results, quotes):
AUTHOR (name + credentials):
SCHEMA TYPE(S) TO APPLY:
INTERNAL LINKS OUT / IN:
TARGET WORD COUNT: [only as much as full, non-padded coverage requires]
REVIEW/REFRESH CADENCE:
```


---

## 6. Phase 3 — Structured Data (Schema Markup)

Google is explicit that structured data is **not required** for AI Overviews/AI Mode eligibility and there's no special AI-only schema type. ✅ Confirmed. It remains, however, a genuinely useful lever for rich results, Knowledge Graph entity resolution, and giving *every* retrieval system (Google's and everyone else's) an unambiguous machine-readable description of who you are and what the page is about — cheap to implement, worth doing properly, not worth over-investing in beyond the priority list below.

### 6.1 Priority schema types (cover ~80% of real-world need)

| Schema type | Use on | Why it matters |
|---|---|---|
| **Organization** | Homepage / About page | Establishes brand identity; `sameAs` links (LinkedIn, Wikidata, Crunchbase, etc.) help resolve your entity in the Knowledge Graph |
| **Person** | Author bio pages | Ties named authors to real identities — core E-E-A-T signal |
| **Article / BlogPosting** | Every content/blog page | Author, datePublished, dateModified, headline |
| **Product** (+ `AggregateRating` if genuine reviews exist) | Ecommerce product pages | Enables rich results; do not fabricate ratings |
| **LocalBusiness** | Local/service-area business pages | Address, hours, service area — pairs with Google Business Profile |
| **BreadcrumbList** | All pages with hierarchy | Site structure clarity |
| **FAQPage** | Genuine FAQ content only | Use only where the content is a real, on-page Q&A — do not shoehorn onto non-FAQ pages |

Deploy as **JSON-LD in the `<head>`** (Google's explicitly recommended format — not inline Microdata). Use a single connected entity graph via `@id` references rather than disconnected blocks per page.

### 6.2 Entity graph template

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "{{SITE_URL}}/#organization",
      "name": "{{ORG_NAME}}",
      "url": "{{SITE_URL}}",
      "logo": "{{SITE_URL}}/logo.png",
      "sameAs": [
        "{{LINKEDIN_URL}}",
        "{{WIKIDATA_URL_IF_APPLICABLE}}"
      ],
      "knowsAbout": ["{{TOPIC_1}}", "{{TOPIC_2}}"]
    },
    {
      "@type": "WebSite",
      "@id": "{{SITE_URL}}/#website",
      "url": "{{SITE_URL}}",
      "name": "{{ORG_NAME}}",
      "publisher": { "@id": "{{SITE_URL}}/#organization" }
    },
    {
      "@type": "Person",
      "@id": "{{SITE_URL}}/authors/{{AUTHOR_SLUG}}#person",
      "name": "{{AUTHOR_NAME}}",
      "jobTitle": "{{AUTHOR_TITLE}}",
      "sameAs": ["{{AUTHOR_LINKEDIN}}", "{{AUTHOR_CREDENTIAL_PAGE}}"]
    },
    {
      "@type": "Article",
      "@id": "{{PAGE_URL}}#article",
      "headline": "{{PAGE_TITLE}}",
      "author": { "@id": "{{SITE_URL}}/authors/{{AUTHOR_SLUG}}#person" },
      "publisher": { "@id": "{{SITE_URL}}/#organization" },
      "datePublished": "{{DATE_PUBLISHED}}",
      "dateModified": "{{DATE_MODIFIED}}",
      "mainEntityOfPage": "{{PAGE_URL}}"
    }
  ]
}
```

### 6.3 Validation workflow

- [ ] Lint JSON-LD syntax before deploy (any JSON validator)
- [ ] Validate against Google's **Rich Results Test** for eligibility
- [ ] Confirm in **Schema Markup Validator** that types/properties are spec-correct
- [ ] Crawl the **rendered HTML** (not just template source) after any CMS/plugin update — duplicate or conflicting schema blocks from overlapping plugins/themes is a common, silent failure mode
- [ ] Never mark up content that isn't visible to users — Google treats this as spam and can issue a manual action
- [ ] Keep one canonical `@id` per entity site-wide; don't let multiple pages emit competing `Organization` blocks


---

## 7. Phase 4 — The AI Search Visibility Layer (GEO / AEO / AIEO in practice)

This phase is additive on top of Phases 1–3, not a replacement. It exists because non-Google AI answer engines run their own retrieval, separate from Google's index.

### 7.1 What each platform actually relies on

| Platform | Retrieval mechanism | What actually helps |
|---|---|---|
| **Google AI Overviews / AI Mode** | RAG + query fan-out over Google's own Search index; same ranking/quality systems as organic | Being indexed, ranking well organically, non-commodity content, technical health — no separate tactic exists. ✅ Confirmed by Google directly. |
| **ChatGPT Search** | Fine-tuned model + Bing-powered live retrieval for some queries; model's trained knowledge for others | Standard crawlability for `OAI-SearchBot`; being present in the sources Bing/the web surfaces; strong entity/schema signals; being cited by third parties the model trusts |
| **Perplexity** | Real-time retrieval-heavy, evaluates a page's opening content closely | Answer-first opening paragraphs (see 5.5), crawlability for `PerplexityBot`, clear factual/statistical content that's easy to lift and attribute |
| **Claude (web search / Claude in Chrome, etc.)** | Live retrieval via `Claude-SearchBot` / `Claude-User` when browsing is invoked | Crawlability for Anthropic's search agents; clear, well-structured, factual pages; correct robots.txt distinguishing training vs. search bots |
| **Microsoft Copilot** | Bing index + RAG | Standard Bing/Google-aligned SEO fundamentals; Bing Webmaster Tools indexing |

**The practical takeaway:** there is no tactic here that contradicts good SEO. The delta is entirely about (a) crawler access policy and (b) making content easy to lift, attribute, and trust — not a different writing style "for machines."

### 7.2 Citation-earning content tactics (evidence-backed, not folklore)

Independent research (Princeton's GEO study and subsequent replications) found that a small set of concrete tactics reliably increases citation rates in generative answers, on the order of 30–40% in controlled tests: 🔶 Consensus, research-backed.

- [ ] **Cite your own sources** — link to primary data, studies, or documentation you're referencing; AI systems weight source credibility
- [ ] **Include real statistics and numbers**, not vague qualitative claims — concrete figures are what gets quoted
- [ ] **Include direct, attributable expert quotes** (from a named person on your team, or a genuine third party) — quotable material is citable material
- [ ] **Answer the literal question directly and early** on the page (reinforces Section 5.5)
- [ ] **Cover the fan-out** — the 3–5 adjacent questions a real searcher (or the model's own fan-out queries) would also ask about the same topic, on the same page or clearly linked
- [ ] **Publish genuinely original data** (surveys, benchmarks, internal analysis) — this is the single highest-leverage tactic, because it's the one thing competitors and AI models cannot regenerate from existing web content

### 7.3 AI crawler access policy — the real decision to make

See the robots.txt template in Section 4.4. The decision is genuinely two separate axes, and `{{AI_CRAWLER_STANCE}}` from intake should resolve both:

1. **Training data policy**: do you want your content used to train foundation models (GPTBot, Google-Extended, ClaudeBot, anthropic-ai)? This is an IP/business decision, not an SEO one — blocking these does not reduce your visibility in that company's live answer product.
2. **Answer-citation policy**: do you want to be citable in that company's live AI-answer product (OAI-SearchBot, PerplexityBot, Claude-SearchBot)? Blocking these **does** remove you from citations on that platform. Evidence from large-scale audits shows sites blocking answer-crawlers see meaningfully lower AI-referred traffic without any offsetting benefit — 🔶 consensus across multiple 2026 industry studies. For a site whose `{{PRIMARY_GOAL}}` includes visibility/leads, the default recommendation is: **allow the search/answer bots, decide training-bot access on its own merits.**
3. Whichever you choose, verify actual bot identity via reverse DNS in server logs — user-agent strings alone can be spoofed by non-compliant scrapers, and enforcement for those belongs at the server/CDN/WAF layer, not robots.txt (which only binds compliant crawlers).

### 7.4 llms.txt — the honest verdict (don't oversell this)

⚠️ **Contested / largely unproven — treat as optional, not a priority.** Multiple independent 2026 studies (SE Ranking's 300k-domain analysis, direct AI-bot traffic-log monitoring) found:

- Adoption sits at roughly **8–15% of large sites**, not the near-universal standard some vendors imply
- Major AI search/answer crawlers **overwhelmingly do not fetch `/llms.txt`** in production traffic logs
- Controlled studies found **no measurable correlation** between having an llms.txt file and citation frequency — in at least one machine-learning analysis, including it as a variable *reduced* predictive accuracy for citation likelihood
- **Google has stated on the record it does not use llms.txt and has no plans to** — comparing it to the long-discredited `<meta name="keywords">` tag

**Recommendation:** do not spend meaningful budget here, and do not let any vendor sell it as a GEO requirement. If — and only if — Phases 1–6 are already complete and there is spare, low-priority engineering time, shipping a basic llms.txt costs under a day and has no known downside:

```
# llms.txt — {{SITE_URL}}
# Optional, low-priority. Ship only after Phases 1–6 are complete.
> {{ORG_NAME}}: one-sentence description of what the site/company does.

## Primary content
- [{{TOP_PAGE_1_TITLE}}]({{URL}}): one-line description
- [{{TOP_PAGE_2_TITLE}}]({{URL}}): one-line description

## About
- [About]({{SITE_URL}}/about)
- [Contact]({{SITE_URL}}/contact)
```

### 7.5 Agentic / browser-agent readiness (emerging, low urgency, cheap to prepare for)

Google's own guidance flags that browser-based AI agents (which navigate sites via screenshots, DOM structure, and the accessibility tree to complete tasks on a user's behalf) are an emerging surface. Preparing for them is mostly a byproduct of already-good practice:

- [ ] Use semantic HTML (proper `<button>`, `<nav>`, `<form>`, heading hierarchy) — helps screen readers *and* agentic parsers identically
- [ ] Keep interactive elements (checkout, forms, filters) keyboard-navigable and clearly labeled
- [ ] Don't gate essential information behind JavaScript interactions an agent can't trigger
- [ ] Treat this as a low-priority "nice to have that falls out of accessibility work," not a standalone initiative


---

## 8. Phase 5 — Authority & Off-Site

### 8.1 Link building & digital PR — what actually still works in 2026

The old playbook (bulk guest posts, directory submissions, private blog networks) is dead — repeated spam updates and increasingly sophisticated link-spam detection have devalued it, and it now carries real penalty risk. 🔶 Strong consensus. Backlinks remain a significant ranking signal, but the bar for what counts as a *quality* link has risen sharply: relevance and editorial context now matter more than raw domain authority.

**What works:**
- [ ] **Digital PR built on original data**: run a small study, survey, or analysis unique to `{{NICHE}}`, then pitch it to journalists/publications as a story, not a link request. One well-executed data study can realistically earn dozens of editorial links from a single campaign.
- [ ] **Expert commentary / source platforms**: respond to journalist queries (the HARO-successor ecosystem — Qwoted, Featured, Connectively, and direct journalist outreach on LinkedIn/X) as a subject-matter expert
- [ ] **Genuinely linkable assets**: tools, calculators, original research, comprehensive guides that people cite because they're useful, not because they were paid for
- [ ] **Relevance over raw authority**: a contextually relevant link from a smaller, on-topic site is worth more than an unrelated high-authority directory link
- [ ] **Unlinked brand mention monitoring**: find existing mentions of `{{ORG_NAME}}` across the web that aren't yet linked, and request the link

**What to avoid (see also Section 10):**
- [ ] Paid link schemes, link farms, excessive reciprocal linking, PBNs
- [ ] Mass, unsolicited guest-post outreach purely for anchor text
- [ ] Buying or exchanging links at volume/directory-submission scale

### 8.2 Reviews & reputation

- [ ] Actively (and honestly) solicit reviews from real customers — do not gate review requests to only satisfied customers, and do not fabricate or incentivize reviews; this is both a policy violation risk and an E-E-A-T/trust signal issue
- [ ] Respond to reviews, positive and negative, professionally — this is itself a trust and engagement signal
- [ ] Never argue publicly in review responses; resolve disputes offline

### 8.3 Local SEO (only if `{{BUSINESS_MODEL}}` is local/service-area — otherwise skip this section)

Google ranks local results on **relevance, distance, and prominence**. Distance isn't controllable; the other two are.

**Google Business Profile (GBP) — the single highest-weighted local signal:**
- [ ] Every field complete: correct primary + secondary categories, hours, service area, attributes
- [ ] NAP (Name, Address, Phone) **identical** across the GBP listing, the website, and every directory — inconsistency actively suppresses rankings
- [ ] Real photos added regularly (not a single bulk upload) — profiles with 100+ real photos measurably outperform sparse ones on both visibility and click-through
- [ ] Google Posts published on a steady cadence (weekly-ish) — signals activity/recency
- [ ] Review volume, recency, and response rate actively managed (see 8.2)
- [ ] City/service-specific landing pages on the website itself, not just the GBP listing, for each area served
- [ ] Local citations (directory listings) consistent and current
- [ ] Local backlinks (chamber of commerce, local press, sponsorships, local association sites) pursued where relevant


---

## 9. Phase 6 — Measurement (rank tracking is no longer the whole picture)

### 9.1 Traditional SEO KPIs (still essential — this is the majority of most sites' traffic)

| Metric | Source | Cadence |
|---|---|---|
| Indexed pages / coverage errors | Search Console → Page Indexing report | Weekly |
| Impressions, clicks, average position, CTR by query | Search Console → Performance report | Weekly |
| Core Web Vitals pass rate | Search Console → CWV report | Monthly, or after any deploy |
| Organic sessions, conversions, revenue | Analytics platform | Weekly |
| Keyword rankings for target queries | Rank tracker of choice | Weekly |
| Backlink profile growth/quality | Backlink tool of choice | Monthly |
| Manual actions / security issues | Search Console | Continuous alerting |

### 9.2 AI-visibility KPIs (the newer, necessary addition)

Because the overlap between Google's organic top-10 and AI-answer citations is small, rank tracking alone will not tell you how visible `{{SITE_URL}}` is inside ChatGPT, Perplexity, Claude, or Gemini. Track these separately:

| Metric | What it means | How to get it |
|---|---|---|
| **Generative AI performance report** | Google's own official reporting on how the site performs inside AI Overviews/AI Mode | Search Console (native, free) |
| **Citation share / AI share of voice** | % of a defined prompt set where the brand is mentioned across platforms | Dedicated AI-visibility platforms (see 14.3) — run a consistent, defined prompt list weekly/monthly |
| **Citation rate vs. mention rate** | Being *linked as a source* vs. just being *named* — these are different and both worth tracking | Same tools; check what each platform reports |
| **Competitor citation share** | Same prompt set, tracking `{{TOP_3_COMPETITORS}}` | Same tools |
| **AI-referral traffic** | Sessions arriving from chat.openai.com, perplexity.ai, claude.ai, etc. | Analytics referral/source-medium reports — set up explicit AI-referrer segments |

**Caveat, stated plainly:** third-party "GEO tracking" tools sample a prompt set and report an estimate — none of them have access to any platform's real internal ranking logic. Treat their numbers as directional trend data, not ground truth, and be skeptical of any vendor claiming otherwise (Google explicitly warns about this for its own Search, and the same caution applies to every AI platform).

### 9.3 Diagnosing a ranking drop

1. Check the Search Status Dashboard / recent update announcements — was a core update, spam update, or Discover update rolling out at the time?
2. In Search Console, compare the 2 weeks before vs. after the suspected event (wait ~7 days after a rollout completes before concluding anything — core update effects can continue to shift for weeks).
3. Identify which specific pages/queries lost visibility — is it site-wide (technical/trust issue) or topic-specific (content-quality issue on that cluster)?
4. Re-audit E-E-A-T signals on the affected pages first — this is the most common recoverable cause in 2025–2026 updates.
5. Do not panic-rewrite everything after one volatile week — core update effects often continue to move for the following 1–2 refresh cycles; a durable fix outlasts the update, a reactive one doesn't.


---

## 10. The Non-Negotiable Rules (the short version, if nothing else gets read)

1. **Indexability beats everything.** A page that isn't crawlable and indexed cannot rank anywhere, on any engine, ever. Fix Phase 1 before touching anything else.
2. **Non-commodity content only.** If a competitor or a generic AI model could produce the identical page from public knowledge, it will not carry rankings or citations — Google says this directly.
3. **One content foundation, not two.** Never build separate "SEO version" and "AI version" content. Build one excellent version and make it accessible to every retrieval system.
4. **Named, real, verifiable authors** on anything that matters, credentials required on YMYL content.
5. **Core Web Vitals in the "Good" band**, measured with real field data, not a one-time lab score.
6. **Structured data as clarity, not decoration.** Implement the priority types correctly; never mark up content that isn't visible on the page.
7. **Links and mentions must be earned**, not purchased or manufactured at scale.
8. **Decide AI-crawler access deliberately**, per bot family, not by accident or by copy-pasting someone else's robots.txt unread.
9. **Track AI-answer visibility separately from Google rankings** — they are genuinely different games with different winners.
10. **Re-run intake and measurement on a fixed cadence.** SEO/GEO is an operating loop, not a one-time deliverable — the algorithm landscape changes every few weeks.

---

## 11. Forbidden Tactics — do not do these, regardless of who suggests it

These map directly to Google's published spam policies and carry real risk of manual action or algorithmic suppression:

- [ ] **Scaled content abuse**: mass-generating pages (AI-written or otherwise) primarily to manipulate rankings, with no real added value — explicitly named by Google as a policy violation, not a gray area
- [ ] **Cloaking**: showing different content to crawlers than to users
- [ ] **Keyword stuffing** in content, GBP business names, alt text, or metadata
- [ ] **Link schemes**: buying/selling links that pass PageRank, excessive link exchanges, PBNs, automated mass link generation
- [ ] **Fake or gated reviews**, review swapping, incentivized reviews without disclosure
- [ ] **Inauthentic "mentions" campaigns** — seeding fake brand mentions across forums/blogs purely to manufacture the *appearance* of organic buzz for AI systems to pick up; Google explicitly calls this out as ineffective and policy-adjacent
- [ ] **Doorway pages** — near-duplicate pages targeting slightly different keyword variants that funnel to the same destination
- [ ] **Sneaky redirects** or deceptive interstitials
- [ ] **Expired-domain abuse**: buying an unrelated expired domain purely to exploit its existing authority for unrelated content


---

## 12. 30-60-90 Day Execution Roadmap (customize dates/owners per `{{BUDGET_TIER}}`)

### Days 1–30 — Foundation
- [ ] Complete Section 3 intake in full
- [ ] Fix all Phase 1 indexability blockers (4.1)
- [ ] Baseline Core Web Vitals; fix any "Poor" metrics (4.2)
- [ ] Audit and correct robots.txt, including AI-crawler policy decision (4.4, 7.3)
- [ ] Verify/claim Google Search Console and (if `{{BUSINESS_MODEL}}` is local) Google Business Profile
- [ ] Deploy priority schema (Organization, Person, Article/Product/LocalBusiness) site-wide (Section 6)
- [ ] Build the topical map for the first pillar topic (5.3)

### Days 31–60 — Content & Authority build-out
- [ ] Publish the first pillar page + 5 cluster pages against the topical map
- [ ] Set up author bio pages with real credentials + Person schema
- [ ] Launch first digital PR / original-data campaign (8.1)
- [ ] Begin systematic review solicitation (8.2)
- [ ] If local: complete full GBP optimization checklist (8.3)
- [ ] Set up AI-visibility tracking with a defined, fixed prompt set (9.2)

### Days 61–90 — Scale & measure
- [ ] Second pillar topic + cluster set published
- [ ] First content-refresh pass on any underperforming existing pages
- [ ] Review Search Console Generative AI performance report; compare AI-referral traffic trend
- [ ] Full technical re-audit (Section 4) to confirm nothing regressed
- [ ] Report against baseline: rankings, organic traffic, AI citation share, conversions
- [ ] Set the recurring operating cadence (Section 13) going forward

---

## 13. Ongoing Operating Cadence (after day 90, this runs indefinitely)

| Cadence | Tasks |
|---|---|
| **Weekly** | Publish against the content calendar; monitor Search Console for new errors; check for any live algorithm update rolling out |
| **Monthly** | Full KPI review (Section 9); backlink profile check; GBP posts/photos refresh if local; re-run the fixed AI-visibility prompt set |
| **Quarterly** | Content refresh pass on aging pillar/cluster pages; full technical audit re-run (Section 4); competitor topical-gap analysis; re-validate robots.txt against any new AI crawlers that have emerged |
| **On every confirmed Google core/spam update** | Run the diagnosis protocol (9.3); do not make reactive changes until the rollout is confirmed complete and data has stabilized |
| **On this playbook's own recheck trigger (Section 15)** | Re-verify every ✅/🔶/⚠️ tagged claim in this document against current primary sources before starting a new client or major campaign |

---

## 14. Tools Stack Reference

| Category | Tools (examples — pick per `{{BUDGET_TIER}}`) |
|---|---|
| Indexing / technical | Google Search Console (free, required), Bing Webmaster Tools, Screaming Frog / Sitebulb for crawls |
| Core Web Vitals | PageSpeed Insights, Search Console CWV report, Chrome UX Report (CrUX) |
| Keyword & competitor research | Ahrefs, Semrush, Google Keyword Planner, Google Trends |
| Schema validation | Google Rich Results Test, Schema Markup Validator, JSONLint |
| Rank tracking | Any dedicated rank tracker (Ahrefs, Semrush, or a lighter-weight tool per budget) |
| Backlink analysis | Ahrefs, Semrush, Majestic |
| Digital PR / journalist outreach | Qwoted, Featured, Connectively, direct LinkedIn/X outreach |
| Local SEO | Google Business Profile manager, a citation-consistency tool |
| AI-visibility / share-of-voice tracking | Category includes Profound, Scrunch AI, Otterly.AI, Peec AI, Botric, LLM Pulse, AthenaHQ — evaluate on multi-platform coverage, citation vs. mention distinction, and export/reporting features; treat all as directional, not authoritative (see 9.2) |
| Analytics | GA4 or equivalent, with explicit AI-referrer segmentation set up |

---

## 15. Sources & Recheck Protocol

This playbook was built from Google's official Search Central documentation (*Optimizing your website for generative AI features on Google Search*, published May 15 2026; *Google Search's guidance on using generative AI content*; *Google Search technical requirements*; the Search Quality Rater Guidelines) plus a broad cross-section of 2026 industry research on Core Web Vitals, schema markup, topical authority, digital PR, AI-crawler behavior, and AI-visibility measurement current as of **August 2026**.

**Before relying on this document for a new engagement, re-verify:**
- [ ] Google's live AI-optimization guide at `developers.google.com/search/docs/fundamentals/ai-optimization-guide` — this is the authoritative, most-likely-to-update source in this entire playbook
- [ ] Current Core Web Vitals thresholds via `web.dev`
- [ ] Whether any named Google core/spam update has landed since this was written, via the Search Status Dashboard
- [ ] Current AI-crawler user-agent list (new ones appear regularly) before deploying the robots.txt template in 4.4
- [ ] llms.txt adoption/efficacy data (Section 7.4) — this is the single fastest-moving, most-contested claim in the document and is worth a fresh check every time

**Tags used throughout:** ✅ Confirmed = stated directly by the platform itself (primarily Google). 🔶 Consensus = converging view across independent 2026 industry research, not platform-confirmed. ⚠️ Contested = actively disputed or unproven — treat with proportionate skepticism and low budget priority.

*— End of playbook —*
