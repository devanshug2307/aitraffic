# Source Register

> Checked for this research on 2026-07-29 unless otherwise stated.

## Source-quality policy

| Grade | Meaning | Use |
|---|---|---|
| A | Official platform documentation, specification, API reference, repository, or direct first-party data | Technical behavior, limits, and current product capability |
| B | Vendor’s own pricing, release, or funding page | Current offer or company claim, clearly attributed |
| C | Payment-provider-verified public revenue record | Point-in-time economics for the verified fields only |
| D | Research paper | Method or study result within its tested setup, not universal production truth |
| E | Community discussion | Qualitative demand, objections, and buyer language; not prevalence or causality |

Founder-written marketplace descriptions, affiliate listicles, search snippets, and uncited “ranking factor” claims are not treated as authoritative.

## 1. Google Search and SEO

| Source | Grade | Supports |
|---|---|---|
| [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) | A | Core site organization, descriptive URLs, content, links, and search basics |
| [Developer’s Search guide](https://developers.google.com/search/docs/fundamentals/get-started-developers) | A | Fetch/render/index basics and structured data |
| [Crawling and indexing documentation](https://developers.google.com/search/docs/crawling-indexing) | A | Google crawl/index control topics |
| [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) | A | JavaScript rendering and discovery |
| [Canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | A | Canonical signals and duplicate URL handling |
| [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) | A | Sitemap formats, limits, and practices |
| [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | A | Content quality questions and people-first guidance |
| [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies) | A | Scaled content abuse and manipulative practices |
| [Page experience guidance](https://developers.google.com/search/docs/appearance/page-experience) | A | Page experience considerations |
| [Website testing guidance](https://developers.google.com/search/docs/crawling-indexing/website-testing) | A | Search-safe testing patterns |
| [Google Search documentation updates](https://developers.google.com/search/updates) | A | Current documentation changes, including 2026 FAQ deprecation |

## 2. Google generative Search

| Source | Grade | Supports |
|---|---|---|
| [Optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) | A | Foundational SEO, non-commodity content, local/shopping/media, mythbusting, no Google need for `llms.txt` |
| [Generative AI performance reports announcement](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports) | A | Initial GSC GenAI report rollout and reported dimensions |
| [May 2026 guide announcement](https://developers.google.com/search/blog/2026/05/a-new-resource-for-optimizing) | A | Google’s stated purpose and scope for generative-search guidance |

The report rollout is to a subset of sites. The current public Search Console API documentation does not document a separate GenAI endpoint/dimension. That statement is an inference from the current API reference and should be rechecked.

## 3. Structured data and vertical Search

| Source | Grade | Supports |
|---|---|---|
| [General structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) | A | Eligibility, accuracy, visible-content parity, no guarantee of display |
| [Structured-data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) | A | Meaning, supported formats, validation, measurement |
| [Search feature gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) | A | Current Google-supported search appearances |
| [Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization) | A | Organization disambiguation and brand details |
| [Merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing) | A | Product/Offer merchant eligibility and fields |
| [Ecommerce SEO guidance](https://developers.google.com/search/docs/specialty/ecommerce) | A | Ecommerce discovery, feeds, structure, pagination |
| [Ecommerce site structure](https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure) | A | Crawlable navigation and relative page importance |
| [Pagination and incremental loading](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading) | A | Crawlable pagination and infinite-scroll concerns |
| [LocalBusiness structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business) | A | Local business markup |
| [Multiregional and multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites) | A | Locale URLs, hreflang, and regional practices |
| [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article) | A | Article/NewsArticle fields |
| [News sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap) | A | News sitemap requirements |
| [Discover guidance](https://developers.google.com/search/docs/appearance/google-discover) | A | Discover eligibility and volatility context |
| [Video SEO](https://developers.google.com/search/docs/appearance/video) | A | Video discovery and watch-page practices |
| [Video structured data](https://developers.google.com/search/docs/appearance/structured-data/video) | A | VideoObject eligibility and fields |
| [Image SEO](https://developers.google.com/search/docs/appearance/google-images) | A | Image discovery and presentation |
| [Schema.org vocabulary](https://schema.org/docs/schemas.html) | A | Broad structured-data vocabulary; not definitive for Google-specific behavior |

## 4. Search Console APIs

| Source | Grade | Supports |
|---|---|---|
| [Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) | A | Dimensions, filters, search types, 25,000 row response limit, freshness metadata |
| [Getting all available performance data](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data) | A | Paging and documented 50,000 rows/day/search-type boundary |
| [URL Inspection API](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect) | A | Inspection of Google’s indexed version and API behavior |
| [Sitemaps API](https://developers.google.com/webmaster-tools/v1/sitemaps) | A | List, submit, and delete sitemap operations |
| [Search Console bulk data export](https://support.google.com/webmasters/answer/12918484) | A | BigQuery export for larger retained datasets |
| [Google Indexing API usage](https://developers.google.com/search/apis/indexing-api/v3/using-api) | A | Restricted eligible use cases; not a general instant-indexing tool |

## 5. GA4 and Google performance data

| Source | Grade | Supports |
|---|---|---|
| [GA4 release notes](https://support.google.com/analytics/answer/9164320) | A | May 13, 2026 AI Assistant channel and `ai-assistant` medium |
| [GA4 default channel definitions](https://support.google.com/analytics/answer/9756891) | A | What is and is not classified in GA4 channels |
| [GA4 Data API schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema) | A | Current metrics and dimensions |
| [GA4 Data API quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart) | A | Authentication and report request pattern |
| [GA4 Data API quotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas) | A | Token and concurrency quotas |
| [GA4 Data API changelog](https://developers.google.com/analytics/devguides/reporting/data/v1/changelog) | A | 200,000 daily Core token change and API evolution |
| [GA4 Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4) | A | Server/offline event collection behavior |
| [PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started) | A | Lighthouse-based audits and planned CrUX-data removal from PSI |
| [CrUX API](https://developer.chrome.com/docs/crux/guides/crux-api) | A | Real-user Chrome experience data |
| [CrUX History API](https://developer.chrome.com/docs/crux/history-api) | A | Historical field performance |
| [Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds) | A | LCP, INP, and CLS good thresholds |

## 6. Indexing and notification outside Google

| Source | Grade | Supports |
|---|---|---|
| [IndexNow documentation](https://www.indexnow.org/documentation) | A | Submission, ownership, batch size, and response behavior |
| [IndexNow FAQ](https://www.indexnow.org/faq) | A | Setup and CMS support context |
| [Bing Webmaster API](https://learn.microsoft.com/en-us/bingwebmaster/) | A | Registered sites, rank/traffic, links, keywords, crawl data, and write capabilities |
| [Bing Webmaster API protocols](https://learn.microsoft.com/en-us/bingwebmaster/api-protocols) | A | Supported API formats and endpoints |
| [Bing URL submission](https://www.bing.com/webmasters/help/URL-Submission-62f2860b) | A | Current submission options and preference for IndexNow |
| [Bing IndexNow help](https://www.bing.com/webmasters/help/indexnow-0z209wby) | A | Bing’s current IndexNow reporting and indexing context |

IndexNow receipt is not a guarantee of crawl, index, or rank.

## 7. AI crawler and agent documentation

| Source | Grade | Supports |
|---|---|---|
| [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots) | A | OAI-SearchBot, GPTBot, ChatGPT-User purposes and published IP sources |
| [Anthropic crawler documentation](https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) | A | Claude training, search, user-directed bots, and controls |
| [Perplexity crawler documentation](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) | A | PerplexityBot/Perplexity-User purposes and IP lists |
| [Google common crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) | A | Google crawler purposes, including Google-Extended context |
| [Cloudflare verified bots](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/) | A | Search/Agent/Training/Transact taxonomy and verification concepts |
| [Cloudflare bot reference](https://developers.cloudflare.com/ai-crawl-control/reference/bots/) | A | Major AI crawler identities |
| [Cloudflare AI traffic analysis](https://developers.cloudflare.com/ai-crawl-control/features/analyze-ai-traffic/) | A | Existing crawl/referrer analytics supply |
| [Cloudflare Web Bot Auth](https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/) | A | Signed request verification |
| [Cloudflare Pay Per Crawl](https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/what-is-pay-per-crawl/) | A | Current pay-per-crawl concept/status |
| [Agent-friendly site UX](https://web.dev/articles/ai-agent-site-ux) | A | Semantic and interaction practices for browser agents |

## 8. Agent and commerce protocols

| Source | Grade | Supports |
|---|---|---|
| [MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture) | A | MCP clients, servers, resources, tools, prompts, and transports |
| [MCP repository](https://github.com/modelcontextprotocol/modelcontextprotocol) | A | Specification and source |
| [MCP 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) | A | Current project direction |
| [A2A repository/specification](https://github.com/a2aproject/A2A) | A | Agent cards, tasks, and inter-agent communication |
| [Linux Foundation A2A project](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) | A | Project governance and origin |
| [Universal Commerce Protocol](https://github.com/Universal-Commerce-Protocol/ucp) | A | Commerce capabilities, discovery, REST/MCP/A2A support |
| [Google UCP implementation guide](https://developers.google.com/merchant/ucp) | A | Current Google AI Mode/Gemini commerce integration and waitlist status |
| [Google UCP engineering overview](https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/) | A | Google and partner intent/use |
| [OpenAI product discovery and ACP](https://openai.com/index/powering-product-discovery-in-chatgpt/) | A | Current ChatGPT product-discovery and merchant-feed surface |
| [Agent Payments Protocol](https://github.com/google-agentic-commerce/AP2) | A | Agent payment authorization sample/spec ecosystem |
| [AP2 specification](https://ap2-protocol.org/ap2/specification/) | A | Payment protocol details |
| [x402 repository](https://github.com/x402-foundation/x402) | A | HTTP payment protocol |
| [x402 documentation](https://docs.cdp.coinbase.com/x402/welcome) | A | Protocol use and agent positioning |
| [OKF specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/HEAD/okf/SPEC.md) | A | Knowledge packaging and metadata |
| [`llms.txt` proposal](https://github.com/AnswerDotAI/llms-txt) | A for proposal existence | Optional community convention, not a ranking source |
| [Chrome Lighthouse `llms.txt` audit](https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt) | A | Optional emerging audit/context, not proof of Search ranking |

## 9. Research on AI visibility measurement

| Source | Grade | Supports and limitation |
|---|---|---|
| [GEO paper](https://arxiv.org/html/2311.09735) | D | Experimental GEO methods in its benchmark; does not establish universal production ranking factors |
| [Don’t Measure Once](https://arxiv.org/abs/2604.07585) | D | Repeated measurement and instability framing; assess methods before productizing |
| [Quantifying Uncertainty in AI Visibility](https://arxiv.org/abs/2603.08924) | D | Uncertainty/variance framing; not a substitute for first-party outcomes |

Use papers to improve methodology, not to turn benchmark results into guaranteed advice.

## 10. Open-source repositories

The detailed license, activity, and reuse assessment is in [03-open-source-landscape.md](03-open-source-landscape.md). Key primary repositories include:

### Crawling and SEO

- [Crawlee](https://github.com/apify/crawlee)
- [Playwright](https://github.com/microsoft/playwright)
- [Lighthouse](https://github.com/GoogleChrome/lighthouse)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Seonaut](https://github.com/StJudeWasHere/seonaut)
- [web-vitals](https://github.com/GoogleChrome/web-vitals)
- [Readability](https://github.com/mozilla/readability)
- [Trafilatura](https://github.com/adbar/trafilatura)
- [extruct](https://github.com/scrapinghub/extruct)
- [Schema.org](https://github.com/schemaorg/schemaorg)
- [SerpBear](https://github.com/towfiqi/serpbear)

### Google and agent connectors

- [Official Google Analytics MCP](https://github.com/googleanalytics/google-analytics-mcp)
- [Google MCP projects](https://github.com/google/mcp)
- [mcp-gsc](https://github.com/AminForou/mcp-gsc)

### GEO and agent analytics

- [Auriti GEO Optimizer](https://github.com/Auriti-Labs/geo-optimizer-skill)
- [GEO/AEO Tracker](https://github.com/danishashko/geo-aeo-tracker)
- [eGEOagents](https://github.com/mverab/eGEOagents)
- [Aperture](https://github.com/anyin-ai/aperture)
- [Citation Intelligence](https://github.com/AutomateLab-tech/citation-intelligence)
- [AI robots list](https://github.com/ai-robots-txt/ai.robots.txt)
- [Known Agents SDK](https://github.com/knownagents/node-sdk)
- [Apideck Agent Analytics](https://github.com/apideck-libraries/agent-analytics)

### Analytics and observability

- [Umami](https://github.com/umami-software/umami)
- [PostHog](https://github.com/PostHog/posthog)
- [Plausible](https://github.com/plausible/analytics)
- [Matomo](https://github.com/matomo-org/matomo)
- [Rybbit](https://github.com/rybbit-io/rybbit)
- [OpenPanel](https://github.com/Openpanel-dev/openpanel)
- [OpenTelemetry Collector](https://github.com/open-telemetry/opentelemetry-collector)
- [Langfuse](https://github.com/langfuse/langfuse)
- [OpenLLMetry](https://github.com/traceloop/openllmetry)
- [DuckDB](https://github.com/duckdb/duckdb)
- [ClickHouse](https://github.com/ClickHouse/ClickHouse)

## 11. Competitive products and public pricing

| Product/source | Grade | Supports |
|---|---|---|
| [Profound pricing](https://www.tryprofound.com/pricing) | B | Current public plans and allowances |
| [Profound Series B](https://www.tryprofound.com/blog/series-b) | B | Company funding announcement |
| [Scrunch pricing FAQ](https://scrunch.com/faqs/what-is-the-pricing-for-scrunch-plans/) | B | Current public starting plans |
| [Peec pricing](https://peec.ai/pricing) | B | Current public plans |
| [Peec funding/ARR announcement](https://peec.ai/blog/we-raised-21m-series-a-to-help-brands-win-in-ai-search) | B | Company-reported funding/ARR |
| [Otterly pricing](https://otterly.ai/pricing) | B | Current public plans |
| [Otterly Agent Analytics](https://help.otterly.ai/agent-analytics) | B | Product capability |
| [Writesonic pricing](https://writesonic.com/pricing) | B | Current public plans |
| [Semrush AI pricing](https://www.semrush.com/pricing/ai/) | B | AI Visibility plan |
| [Ahrefs Brand Radar](https://ahrefs.com/brand-radar) | B | Product/pricing position |
| [Ahrefs Web Analytics](https://ahrefs.com/web-analytics) | B | Free analytics supply |
| [Ahrefs Bot Analytics](https://ahrefs.com/bot-analytics) | B | Cloudflare bot analytics supply |
| [ZipTie pricing](https://ziptie.ai/pricing/) | B | Usage plans and MCP/API add-on |
| [Goodie pricing](https://higoodie.com/pricing/) | B | Current public entry plan |
| [LLMrefs pricing](https://llmrefs.com/pricing) | B | Current public plan |
| [Nightwatch pricing](https://nightwatch.io/pricing) | B | SEO + AI prompt plans |
| [SE Ranking AI Search add-on](https://help.seranking.com/hc/en-us/articles/22120452776476-AI-Search-Add-on) | B | Add-on pricing and coverage |
| [Agent Analytics](https://agentanalytics.sh/) | B | Direct agent-analytics positioning and pricing |
| [Clamp pricing](https://clamp.sh/pricing) | B | Agent-readable analytics price anchor |
| [Unusual Agent Analytics](https://analytics.unusual.ai/) | B | Free open AI crawler analytics |

## 12. Public verified revenue snapshots

Only the payment-provider-verified numeric fields should be treated as verified. Descriptions and positioning may be founder edited.

| Record | Grade |
|---|---|
| [DataFast](https://trustmrr.com/startup/datafast) | C |
| [Cometly](https://trustmrr.com/startup/cometly) | C |
| [LLM Gateway](https://trustmrr.com/startup/llm-gateway) | C |
| [Rank Prompt](https://trustmrr.com/startup/rank-prompt) | C |
| [AIRIX](https://trustmrr.com/startup/airix-aeo-ai-visibility-platform) | C |
| [MentionDesk](https://trustmrr.com/startup/mentiondesk) | C |
| [Landkit](https://trustmrr.com/startup/landkit) | C |
| [TrustMRR API field definitions](https://trustmrr.com/docs/api/get-startup) | A for TrustMRR’s field semantics |

Recheck live values before publishing a market report; MRR and subscriber counts change.

## 13. Community demand and objections

These threads contain self-promotion and potential astroturfing. They are used only to identify user questions and objections.

| Discussion | Grade | Signal |
|---|---|---|
| [Free GA4 AI-traffic checker](https://www.reddit.com/r/Wordpress/comments/1sytmqv/i_made_a_free_tool_to_check_if_ai_tools_are/) | E | Strong interest in simple reports, client sharing, multi-property, and OAuth distrust |
| [GSC with Claude Code](https://www.reddit.com/r/TechSEO/comments/1v5bp1k/anyone_connected_gsc_with_claude_code/) | E | Demand for agent access plus skepticism of random MCP/OAuth vendors |
| [Paying for GEO/AEO tools](https://www.reddit.com/r/aeo/comments/1u7607d/anyone_here_actually_paying_for_geoaeo_tools/) | E | Buyers want pipeline, leads, revenue, and diagnosis rather than vanity reports |
| [GEO agency AMA](https://www.reddit.com/r/aeo/comments/1u3qa3c/ama_i_run_an_ai_seo_aeo_agency_in_ct_getting/) | E | Agency workflow value and service-level willingness to pay |
| [Traffic and mentions](https://www.reddit.com/r/content_marketing/comments/1rs83z2/what_tool_are_you_using_to_track_citations_on_ai/) | E | Explicit demand for visibility and visits together |
| [AI visibility versus bot analytics](https://www.reddit.com/r/SEO_LLM/comments/1v0dms2/ai_visibility_tracking_vs_bot_traffic_analytics/) | E | Users recognize visibility, crawl, and referral as separate layers |
| [Citations versus business impact](https://www.reddit.com/r/GEO_optimization/comments/1u0ab8g/most_geo_tools_track_citations_which_ones_track/) | E | Outcome-measurement gap |
| [20+ AI visibility tools disagree](https://www.reddit.com/r/GEO_optimization/comments/1umrd01/i_tried_at_least_20_ai_visibility_tools_for_my/) | E | Need for raw answers, fixed panels, repeats, and variance |
| [Server-log AI experiment on Hacker News](https://news.ycombinator.com/item?id=47835646) | E | Technical interest in deterministic request evidence |
| [Sitefire launch discussion](https://news.ycombinator.com/item?id=47457472) | E | Price, accuracy, and differentiation objections |

## 14. Current product/domain observations

| Observation | Method | Checked |
|---|---|---|
| `aitraffic.dev` did not resolve to an A/AAAA record | DNS lookup and HTTPS request | 2026-07-29 |
| `trafficclaw.com` returned HTTP 200 | HTTPS HEAD/follow request | 2026-07-29 |
| Existing repository has Google read-only scopes, GA4/GSC services, analytics/SEO routes, PageSpeed/schema/cannibalization/opportunity workflows, GitHub tools, reports, and alerts | Local source inspection | 2026-07-29 |
| `aitraffic` and `@aitraffic/cli` package-name lookups previously returned 404 | npm registry check during research | 2026-07-29 |

Package/domain availability is time-sensitive; recheck immediately before reservation.

## 15. Update schedule

Review:

- Google Search/GA4/GSC API and report capability: monthly;
- crawler identities and published IP/signature methods: weekly or automated;
- MCP/A2A/UCP/AP2/x402 versions: before each related release;
- competitor pricing: quarterly and before public comparison;
- repository stars/activity/licenses: before dependency selection;
- community demand: during each product discovery cycle;
- TrustMRR figures: before any investor or pricing claim.
