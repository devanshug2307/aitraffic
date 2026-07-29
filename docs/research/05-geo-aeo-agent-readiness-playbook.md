# GEO, AEO, and Agent-Readiness Playbook

## Start with an evidence ladder

The category is full of practices presented with more confidence than the evidence supports. aitraffic.dev should classify every recommendation.

### Established

Supported by official platform documentation or deterministic first-party evidence:

- foundational SEO and helpful, unique, reliable content remain relevant to Google’s generative Search;
- crawler-specific access rules can influence whether a particular documented crawler can fetch content;
- official server/CDN requests can establish that a crawler accessed a URL;
- raw consumer/API observations can establish what an answer contained at that moment;
- a cited link can establish citation in that observation;
- GA4/referrer/first-party events can establish a visit when the referral is present;
- analytics, CRM, and payment events can establish configured conversions and revenue;
- structured data can help systems understand explicit page entities and can enable supported Google search appearances;
- product and merchant feeds can provide explicit commerce data;
- clear, visible, well-supported answers improve the page for users and make facts easier to extract.

### Useful but not proven as a direct ranking factor

Reasonable quality or interoperability practices whose direct effect on AI answer selection is not established:

- concise answer blocks followed by detail;
- clear definitions, steps, comparisons, tables, and FAQs where they serve users;
- stable entity identifiers and connected schema graphs;
- detailed author/reviewer/method/source information;
- machine-friendly APIs, feeds, OpenAPI, MCP, and content negotiation;
- broad, legitimate mentions and citations on relevant third-party sources;
- measuring whether important answer-time bots can fetch high-value pages;
- prompt panels used as sampled market research;
- `llms.txt` as an optional navigation aid for tools that choose to consume it;
- OKF or other knowledge exports where a known consumer needs them.

### Speculative or misleading when sold as fact

- a universal “AI ranking” across prompts, users, countries, accounts, and model versions;
- guaranteed citation from a schema type, `llms.txt`, word count, “entity density,” or formatting recipe;
- treating one prompt result as a stable position;
- treating bot crawl as proof that content was used in an answer;
- treating citation as proof of referral or revenue;
- inferring “dark AI” visits deterministically from direct traffic;
- creating hundreds of fan-out-query pages mainly to manipulate AI/search responses;
- submitting special Markdown or hidden AI-only content that differs materially from the user-visible page;
- claiming access to a platform’s private internal “visibility” metric without evidence.

## Google’s current position

Google’s July 2026 [guide to generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) says:

- foundational SEO remains relevant;
- unique, useful, non-commodity content is more important than hacks;
- image, video, local, and shopping information create additional opportunities;
- scaled content intended mainly to manipulate results violates spam policies;
- Google Search does not require or use `llms.txt` or other special AI markup for its generative features.

Search Console began rolling out [Generative AI performance reports](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports) to a subset of sites in June 2026. The initial report includes impressions, pages, countries, devices for Search, and time. Treat that first-party report as stronger evidence for Google visibility than reconstructed prompt scraping.

The documented Search Console API currently exposes the standard search types and dimensions but does not document a separate generative-AI report endpoint or dimension. The product should check capabilities rather than silently inventing a proxy.

## Separate the AI acquisition surfaces

### 1. Generative features inside traditional search

Examples: Google AI Overviews, AI Mode, and generative Discover experiences.

Best evidence:

- dedicated Search Console report where available;
- overall GSC performance;
- raw search-result observations for research;
- GA4/first-party visits and conversions.

Primary optimization:

- Google SEO foundations;
- unique and reliable content;
- clear entities and supported structured data;
- accurate local, merchant, image, and video data;
- good page experience and conversion value.

### 2. Answer/search assistants

Examples: ChatGPT Search, Perplexity, Claude search/retrieval, Gemini surfaces, and other citation-bearing assistants.

Best evidence:

- official crawler access documentation and verified logs;
- repeated, context-recorded consumer/API observations;
- raw citations and source URLs;
- referral and conversion events.

Primary optimization:

- permit the relevant search or answer-time crawler according to the business’s policy;
- publish accurate, distinctive, well-supported pages;
- make the entity, offering, constraints, and facts unambiguous;
- earn legitimate presence in sources those systems select;
- measure rather than guarantee.

### 3. User-directed agents

Examples: an assistant asked to visit a page, use a tool, compare products, book, or purchase.

Best evidence:

- cryptographically verified or officially published request identity where available;
- server/API/tool-call logs;
- authorization and transaction traces;
- success/failure and user confirmation events.

Primary optimization:

- accessible, stable pages and APIs;
- explicit capabilities and schemas;
- safe OAuth;
- idempotent actions and confirmation boundaries;
- structured errors;
- current product/service/inventory/policy data;
- observability.

### 4. Training crawlers

Training access is a content-policy and commercial decision, not a direct traffic feature. Let the site owner control it separately from search and user-directed access.

## Crawler and agent taxonomy

Do not classify all automation as “AI traffic.”

| Behavior | Meaning | Examples of evidence | Product treatment |
|---|---|---|---|
| Search | Builds or refreshes an index used for discovery/search | Official bot identity, published IP/rDNS/signature | Measure coverage, errors, policy, freshness. |
| Training | Collects material that may be used for model development | Official training crawler identity | Policy, access, bandwidth, licensing; do not count as acquisition. |
| User agent | Fetches on behalf of a human request | Official user-directed agent identity, signed request | Measure requested pages/actions and success, with privacy controls. |
| Transaction agent | Performs a tool, checkout, booking, or other action | Signed identity, auth, tool/API/transaction trace | Measure authorization, conversion, failure, and value. |
| SEO/monitoring | Audits or monitors a site | Known vendor bot | Keep separate from consumer AI visibility. |
| Unknown/suspected | Automation without trustworthy identity | User-agent or behavioral heuristic only | Label as suspected; never name an operator as fact. |

Cloudflare’s current [verified bot taxonomy](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/) distinguishes Search, Agent, Training, Transact, SEO, and other behaviors. That model is a useful normalization base.

### Vendor-specific controls are independent

OpenAI’s [crawler documentation](https://developers.openai.com/api/docs/bots) distinguishes:

- `OAI-SearchBot` for ChatGPT search;
- `GPTBot` for possible foundation-model training use;
- `ChatGPT-User` for certain user-directed actions.

Anthropic’s [crawler documentation](https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) distinguishes training, search, and user-directed bots.

Perplexity’s [crawler documentation](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) distinguishes `PerplexityBot` for search and `Perplexity-User` for user actions and publishes IP lists.

Google’s [crawler documentation](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) explains `Google-Extended` separately from Google Search controls.

Crawler rules and identities change. The product needs a versioned remote registry, source URL, last checked time, and verification method.

## Bot verification

### Verification levels

1. **Signed** — a valid HTTP message signature or supported Web Bot Auth identity.
2. **Official IP/rDNS** — user agent plus the operator’s current published ranges or documented reverse-DNS verification.
3. **Platform verified** — trusted CDN metadata identifying a verified bot.
4. **User-agent only** — trivially spoofable; report as a claimed identity.
5. **Behavioral guess** — report as suspected automation with reasons.

Store:

```json
{
  "claimed_agent": "OAI-SearchBot",
  "behavior": "search",
  "verification_level": "official_ip",
  "verification_source": "https://openai.com/searchbot.json",
  "registry_version": "2026-07-29",
  "verified_at": "2026-07-29T08:10:00Z"
}
```

Cloudflare’s [Web Bot Auth](https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/) uses HTTP message signatures and is worth supporting, but it should not be presented as universal adoption.

## Prompt panels done honestly

Prompt monitoring is useful for competitive research only if the sampling frame is visible.

### A panel record needs

- exact prompt;
- prompt category and funnel stage;
- why the prompt matters;
- brand/entity aliases;
- competitors;
- model and surface;
- consumer browser versus official API versus other method;
- account/subscription state where relevant;
- locale, language, geography, device, and personalization state where controllable;
- time;
- answer text or allowed artifact;
- cited URLs;
- repeats;
- run cost and error;
- extraction version.

### Panel construction

Use real sources of customer language:

- first-party GSC queries;
- site search;
- sales calls and call summaries;
- support tickets;
- community research;
- surveys;
- product category and use-case taxonomy;
- paid-search terms;
- competitor comparison questions.

Organize prompts by job:

- learn/define;
- solve/troubleshoot;
- compare;
- shortlist;
- validate;
- choose/buy;
- use/integrate;
- replace/migrate.

Avoid generating thousands of trivial wording variants. Start with a small buying-intent panel users recognize.

### Repetition and variance

For a prompt `p`, engine/surface `e`, and `n` repeated runs, useful descriptive metrics include:

```text
mention_rate(p,e) = runs_with_brand_mention / valid_runs
citation_rate(p,e) = runs_with_owned_url_citation / valid_runs
recommendation_rate(p,e) = runs_with_positive_shortlist_or_recommendation / valid_runs
source_persistence(url,p,e) = runs_citing_url / valid_runs
```

These are rates within the named panel and period—not global market share.

Report:

- numerator and denominator;
- invalid/error runs;
- run-to-run variance;
- exact panel changes;
- surface/model changes;
- confidence interval where statistically meaningful;
- raw evidence access.

Do not average dissimilar engines into one unexplained score.

## Citation and source intelligence

### Useful analyses

- Normalize citation redirects, URLs, canonicals, domains, and page types.
- Separate owned, competitor, publisher, community, marketplace, government, academic, and other source classes.
- Find sources that persist across repeats.
- Find source domains repeatedly supporting competitors.
- Extract which claims or criteria appear alongside a citation.
- Compare cited-source freshness and authority signals.
- Detect citations to stale, broken, syndicated, or incorrect pages.
- Find owned pages cited for the wrong intent.
- Join citation observations with crawler access and human referral evidence, while keeping the events separate.

### Legitimate actions

- correct or update the owned source;
- publish original evidence worth referencing;
- improve a product, documentation, dataset, or tool;
- provide expert contribution to relevant third-party sources;
- correct stale public profiles or factual errors;
- earn reviews, coverage, partnerships, and community participation;
- create a better page for an existing user need.

### Actions to reject

- mass guest-post spam;
- fake reviews or profiles;
- paid citation schemes presented as organic;
- undisclosed synthetic “research”;
- scraping and republishing competitors;
- manipulative pages for every generated fan-out query;
- fabricating statistics or expert quotations.

## Answerable content

An answerable page is still a page for people.

### Useful patterns

- define the subject early;
- give a direct answer before optional detail when the query calls for one;
- use accurate headings;
- use steps for processes;
- use tables for real multi-field comparison;
- state tradeoffs, limitations, prerequisites, and exceptions;
- date time-sensitive claims;
- cite primary evidence close to the claim;
- identify author, reviewer, method, and disclosure where relevant;
- use examples, screenshots, calculations, datasets, or interactive tools;
- link to deeper supporting material;
- make the entity and its relationships consistent.

These patterns may make information easier to use and quote. They are not a guaranteed citation formula.

### Highest-value content investments

1. Original datasets with documented methods and downloadable evidence.
2. Firsthand tests and comparisons with artifacts.
3. Useful free tools, calculators, APIs, templates, or benchmarks.
4. Definitive documentation and troubleshooting.
5. Clear product/service facts, constraints, pricing, availability, and policies.
6. Expert explanations with visible identity and accountability.
7. Timely updates and corrections.

The shared property is **information gain and trust**, not an “AI word pattern.”

## Entities, structured data, and knowledge consistency

### What to do

- maintain one authoritative brand facts record;
- use consistent names, aliases, descriptions, logos, URLs, identifiers, people, products, and locations;
- use relevant Schema.org types and stable `@id` references;
- connect the organization, site, authors, products, offers, locations, and content where accurate;
- reconcile structured data with visible content and feeds;
- keep public profiles and owned pages current;
- expose source and update dates for facts that change.

### What not to claim

Structured data helps machines understand explicit meaning and may enable supported search appearances. It is not a general “LLM ranking switch.” A graph can reveal inconsistency; it cannot manufacture real-world authority.

## `llms.txt`

Treat `llms.txt` as an optional interoperability artifact:

- validate syntax and links;
- generate it from a maintained source, not a stale hand-written list;
- monitor whether identified clients actually request it;
- keep it consistent with user-visible content;
- do not cloak or expose private content;
- do not promise Google ranking benefit.

Google currently says it does not use `llms.txt` for Search. Some documentation sites and tools publish or consume it, so it can still be a convenience for those known consumers.

The product could show:

```text
Published: yes
Valid links: 42/44
Observed requests: 18
Verified consumers: 2
Google Search ranking claim: unsupported
```

## OKF

The [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/HEAD/okf/SPEC.md) is a structured knowledge exchange specification from a Google Cloud project. It may be useful for exporting datasets or entity knowledge to systems that explicitly support it.

It is not official evidence of a Google Search or generative ranking factor. Build an adapter only when a customer or integration has a real consumption path.

## MCP, A2A, and APIs

### MCP

MCP is a standard interface for agents to discover resources, prompts, and tools. It is useful for aitraffic.dev itself and for auditing a customer’s agent interface.

An MCP audit should check:

- tool names and descriptions;
- narrow input/output schemas;
- read versus write distinction;
- authorization and per-user isolation;
- confirmation for consequential actions;
- pagination and rate limits;
- structured errors;
- idempotency;
- prompt-injection boundaries;
- logging and data retention;
- version compatibility.

MCP availability does not itself improve search rank. It makes a service usable to compatible agents.

### A2A

The Linux Foundation’s [A2A project](https://github.com/a2aproject/A2A) addresses communication between agent systems. It is useful if a business operates an agent service with discoverable capabilities and tasks.

Again, this is interoperability, not a general website ranking factor.

### OpenAPI and normal APIs

A stable, documented, authorized API may be more appropriate than MCP for many systems. The product should not force every machine interaction through the newest protocol.

## Commerce and transaction readiness

For ecommerce, visibility without accurate transaction data and usable checkout is incomplete.

### Core data

- product identifiers and variants;
- title, description, category, images;
- price and currency;
- availability and quantity;
- shipping and return policy;
- seller/merchant identity;
- review and rating provenance;
- service area or delivery restriction;
- update time.

Use Google Merchant Center/product structured data for Google surfaces where applicable. Keep page, feed, API, and checkout facts consistent.

### Agent protocols

- [Universal Commerce Protocol](https://github.com/Universal-Commerce-Protocol/ucp) provides capability discovery and commerce primitives with REST, MCP, or A2A transports.
- OpenAI’s current [Agentic Commerce Protocol product-discovery program](https://openai.com/index/powering-product-discovery-in-chatgpt/) lets participating merchants provide product feeds and promotions to ChatGPT through supported delivery paths.
- [Agent Payments Protocol](https://github.com/google-agentic-commerce/AP2) addresses authorization/mandates for agent payments.
- [x402](https://github.com/x402-foundation/x402) provides an HTTP payment protocol with agent use cases.

These are emerging distribution and transaction rails, not SEO requirements. They belong in a later commerce module with explicit demand.

### What to measure

```text
agent discovered capability
→ fetched product/service data
→ authenticated
→ started cart/booking
→ received user confirmation
→ attempted payment/action
→ succeeded/failed/retried
→ fulfilled/refunded
```

Store identity and authorization evidence without exposing sensitive payment data.

## The combined measurement model

For each page/entity/topic, show independent evidence:

```text
ACCESS
  policy allows OAI-SearchBot
  7 verified OAI-SearchBot requests
  2 answer-time agent requests

SELECTION
  Google generative impressions: observed in GSC
  prompt panel: cited in 4/12 valid runs
  competitor cited in 9/12

VISIT
  GA4 AI Assistant sessions: 37
  other known assistant referrals: 11
  dark/direct influence: unknown

OUTCOME
  key events: 5
  observed revenue: $820
  assisted/causal revenue: not established

ACTION
  updated comparison methodology and product facts
  deployed: 2026-07-14
  deterministic verification: passed
  performance evaluation: waiting for 28-day window
```

That is more credible and more useful than “GEO score: 78.”

## Recommended GEO/AEO opportunity types

| Opportunity | Evidence required | Action | Verification |
|---|---|---|---|
| Relevant search bot blocked | Official policy plus reproducible fetch/log | Review robots/WAF policy | Fetch succeeds and verified requests appear |
| Answer-time fetch fails | Official/user-agent evidence plus error | Fix status/auth/rendering for intended public path | Reproducible fetch succeeds |
| Competitor source gap | Repeated prompt panel and normalized citations | Produce/earn a genuinely relevant source | Later repeated panel; source/brand presence |
| Conflicting brand fact | Owned/public source comparison | Correct authoritative records | Conflict resolved; future observation monitored |
| Commodity page | Content/source comparison and user need | Add original evidence or useful tool | User/search/citation outcome over time |
| AI visits but low conversion | Referral and funnel evidence | Improve page offer/path | Key-event rate with guardrails |
| Google GenAI visibility but weak engagement | GSC plus GA4 page evidence | Improve presentation and landing value | CTR/engagement/conversion over suitable window |
| Crawl without citation | Crawl log plus prompt panel | Diagnose selection/source gap; do not “fix crawl” | Selection evidence, not more crawling |

## Final principle

GEO/AEO should become a disciplined extension of:

- technical accessibility;
- helpful and distinctive information;
- explicit, consistent entities and facts;
- trustworthy distribution and third-party support;
- machine interoperability where a real interface exists;
- first-party analytics;
- reproducible sampling;
- honest uncertainty.

That makes aitraffic.dev useful even if the market changes the acronym next year.
