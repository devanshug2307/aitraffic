# Complete Feature Catalog

This is the broad opportunity set, not a commitment to build everything. Priority codes:

- **P0** — initial wedge or required foundation;
- **P1** — core differentiation after the foundation works;
- **P2** — expansion for agencies, verticals, or deeper workflows;
- **P3** — later bet, ecosystem feature, or expensive data product.

Packaging codes:

- **OSS** — open CLI/local mode;
- **Pro** — hosted individual/team plan;
- **Agency** — multi-client and branded workflows;
- **Ent** — enterprise, warehouse, security, or high-volume usage.

Evidence codes:

- **O** — observed;
- **S** — sampled;
- **I** — inferred;
- **A** — action/change.

## 1. Platform, identity, and onboarding

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-001 | CLI install and project initialization | Start from a terminal in minutes and create a portable config. | A | P0 | OSS |
| F-002 | Browser-based Google OAuth | Connect GA4 and GSC without creating service-account credentials. | A | P0 | Pro |
| F-003 | Local/BYO Google OAuth | Keep credentials and data on the user’s machine or infrastructure. | A | P0 | OSS |
| F-004 | Property/site discovery | List accessible GA4 properties and GSC sites, then save a default mapping. | O | P0 | OSS |
| F-005 | Multiple Google accounts | Switch client/account context without credential confusion. | O | P1 | Pro/Agency |
| F-006 | Least-privilege scope explainer | Show exactly why each OAuth permission is requested. | O | P0 | OSS/Pro |
| F-007 | Token status, revoke, and delete | Let users inspect access, revoke tokens, and erase hosted data. | O/A | P0 | All |
| F-008 | Domain ownership and source health | Confirm the domain, connectors, freshness, quota, and last successful sync. | O | P0 | All |
| F-009 | Workspace and client context | Isolate domains, properties, people, prompts, and reports. | O | P1 | Pro/Agency |
| F-010 | RBAC, SSO, SCIM, audit log | Meet enterprise access and governance requirements. | O | P2 | Ent |
| F-011 | Secrets vault and customer-managed keys | Protect OAuth refresh tokens and connector credentials. | O | P1/P2 | Pro/Ent |
| F-012 | Consent and retention controls | Configure source-specific collection, region, and deletion policies. | O | P1 | Pro/Ent |

## 2. Google Search Console and search performance

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-020 | Search performance report | Query clicks, impressions, CTR, and average position by date/query/page/country/device/search type. | O | P0 | OSS |
| F-021 | Current-versus-previous comparison | See absolute and relative changes with aligned periods. | O/I | P0 | OSS |
| F-022 | Winners and losers | Find the pages and queries contributing most to growth or decline. | O/I | P0 | OSS/Pro |
| F-023 | High-impression, low-CTR opportunities | Prioritize titles/snippets where presentation may improve clicks. | O/I | P0 | OSS/Pro |
| F-024 | Striking-distance queries | Find relevant pages ranking near a user-defined opportunity band. | O/I | P0 | OSS/Pro |
| F-025 | Content decay | Identify sustained page/query declines with seasonality and volume context. | O/I | P0 | Pro |
| F-026 | Cannibalization candidates | Find query groups where multiple URLs alternate or split visibility. | O/I | P0 | Pro |
| F-027 | Brand/non-brand classification | Separate known branded demand from generic discovery. | O/I | P1 | Pro |
| F-028 | Search appearance analysis | Compare rich-result and supported search-appearance performance. | O | P1 | Pro |
| F-029 | Image, video, news, Discover views | Make vertical search types first-class rather than hidden filters. | O | P1 | Pro |
| F-030 | Hourly/fresh-data monitor | Detect launches, incidents, or fast-moving changes while marking incomplete data. | O | P2 | Pro/Ent |
| F-031 | Search Console GenAI report import | Ingest the dedicated UI/export data when a property is eligible. | O | P0/P1 | Pro |
| F-032 | GenAI API capability detector | State whether the connected public API currently exposes the required dimensions; fall back honestly. | O | P0 | OSS |
| F-033 | URL inspection workflow | Inspect index status and canonical state for a selected set of important URLs. | O | P1 | Pro |
| F-034 | Sitemap management | List, submit, and monitor sitemaps with explicit write permission. | O/A | P1 | OSS/Pro |
| F-035 | Search anomaly alerts | Alert on material changes after accounting for freshness, baseline, and day-of-week patterns. | O/I | P1 | Pro |
| F-036 | Query-page intent mismatch | Compare query intent with page purpose and conversion path. | O/I | P1 | Pro |
| F-037 | SEO forecast range | Project scenarios with assumptions and uncertainty, not one precise traffic promise. | I | P2 | Pro/Agency |
| F-038 | Bing Webmaster connector | Query registered sites, traffic/rank, keywords, links, and crawl statistics; manage sitemaps/submissions with explicit permission. | O/A | P2 | OSS/Pro |
| F-039 | Cross-search-engine normalization | Compare Google and Bing evidence without pretending their metrics and definitions are identical. | O/I | P2 | Pro |

## 3. GA4, first-party analytics, and business outcomes

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-040 | GA4 acquisition report | Inspect users, sessions, engagement, key events, and revenue by channel/source/medium/campaign. | O | P0 | OSS |
| F-041 | Native AI Assistant channel view | Use GA4’s current `AI Assistant` channel and `ai-assistant` medium. | O | P0 | OSS |
| F-042 | Extended AI referrer normalization | Track known assistant domains while preserving native GA4 values and source URL. | O | P0 | OSS/Pro |
| F-043 | AI landing-page report | Show which pages receive AI referrals and how those visits behave. | O | P0 | Pro |
| F-044 | AI conversions and revenue | Connect AI-attributed visits to configured key events and transaction revenue. | O | P0 | Pro |
| F-045 | Search-to-site bridge | Join GSC page/query trends to GA4 landing-page engagement and conversion at compatible grains. | O/I | P0 | Pro |
| F-046 | Funnel analysis | Find where search- or AI-acquired users drop before conversion. | O/I | P1 | Pro |
| F-047 | Journey analysis | Compare common paths for AI, organic search, direct, paid, and referral cohorts. | O/I | P1 | Pro |
| F-048 | Cohort and retention | Determine whether acquired users return or produce later value. | O | P1 | Pro |
| F-049 | Assisted-evidence report | Show associations across touchpoints without claiming causal attribution. | O/I | P1 | Pro |
| F-050 | CRM and payment joins | Link qualified leads, pipeline stages, subscriptions, refunds, and revenue. | O | P1/P2 | Pro/Ent |
| F-051 | First-party lightweight event collector | Capture page, referral, conversion, and agent-commerce events when GA4 is insufficient. | O | P1 | OSS/Pro |
| F-052 | UTM and campaign governance | Generate, validate, and monitor campaign tagging for AI partnerships and owned distribution. | O/A | P2 | Pro |
| F-053 | Data-quality diagnostics | Detect missing tags, self-referrals, duplicate events, attribution breaks, and sudden cardinality changes. | O/I | P1 | Pro |
| F-054 | Cost and ROI view | Combine execution cost, content cost, prompt cost, and observed business outcomes. | O/I | P2 | Pro/Agency |

GA4’s `AI Assistant` channel covers recognized assistant referrals. It is not “all AI traffic.” Google AI Overviews and AI Mode are measured through Google Search surfaces rather than being assumed to be assistant referrals, and no-referrer influence remains unknown.

## 4. AI crawler, user-agent, and server evidence

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-060 | Cloudflare log connector | Ingest requests, bot metadata, response status, cache, path, and timing. | O | P0 | Pro |
| F-061 | Generic log import | Parse Nginx, Apache, CDN, object storage, and common JSON log formats. | O | P0 | OSS |
| F-062 | Framework middleware | Add drop-in Next.js/Node/Python/edge event collection. | O | P0 | OSS |
| F-063 | Bot taxonomy | Separate search, agent/user-directed, training, transaction, SEO, monitoring, and unknown automation. | O/I | P0 | OSS |
| F-064 | Verification state | Label cryptographically verified, published-IP/rDNS verified, user-agent-only, suspected, or unknown traffic. | O/I | P0 | OSS/Pro |
| F-065 | Spoof detection | Flag user agents that fail official IP, signature, ASN, rDNS, or behavioral checks. | O/I | P1 | Pro/Ent |
| F-066 | Crawl-to-page coverage | Show important pages never fetched, recently fetched, blocked, errored, or overfetched by bot class. | O/I | P0 | Pro |
| F-067 | Training versus answer-time policy | Explain and test crawler controls separately for training, search, and user-directed access. | O/A | P0 | OSS/Pro |
| F-068 | Robots and WAF conflict detector | Diagnose when robots allows a bot but CDN/WAF/auth/rendering blocks it. | O/I | P0 | OSS/Pro |
| F-069 | Fetch replay and response audit | Reproduce headers, redirect chain, content negotiation, and rendered/returned body. | O | P1 | Pro |
| F-070 | Crawl-to-referral ratio | Compare crawler requests with later observable human referrals without claiming direct causality. | O/I | P1 | Pro |
| F-071 | Agent transaction events | Track tool calls, cart, checkout, purchase, and failure events initiated by verified agents. | O | P2 | Pro/Ent |
| F-072 | Content access/licensing evidence | Measure allowed, blocked, paid, or licensed content access. | O | P3 | Ent |
| F-073 | Content abuse and cost alerts | Alert on aggressive crawlers, bandwidth spikes, repeated failures, or policy violations. | O/I | P1 | Pro/Ent |

## 5. Technical SEO and site health

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-080 | Site crawler | Discover pages, status codes, redirects, canonicals, robots directives, headings, metadata, links, media, and structured data. | O | P0 | OSS |
| F-081 | Rendered versus raw HTML comparison | Find JavaScript content and link discovery failures. | O/I | P1 | Pro |
| F-082 | Indexability matrix | Explain robots, meta robots, X-Robots-Tag, canonical, status, authentication, and sitemap conflicts. | O/I | P0 | OSS |
| F-083 | Redirect and URL hygiene | Detect chains, loops, soft 404 candidates, mixed protocols, fragments, parameters, and malformed URLs. | O/I | P0 | OSS |
| F-084 | Canonical consistency | Compare declared, sitemap, internal-link, redirect, hreflang, and observed Google canonical signals. | O/I | P0 | Pro |
| F-085 | XML sitemap audit | Check reachability, lastmod quality, indexability, orphaned entries, omissions, and size limits. | O/I | P0 | OSS |
| F-086 | Robots policy editor/tester | Simulate crawler access and generate a reviewable change, not an automatic ranking claim. | O/A | P0 | OSS |
| F-087 | Internal-link graph | Find orphan pages, excessive depth, weak hubs, broken links, and misleading anchors. | O/I | P1 | Pro |
| F-088 | Faceted-navigation and crawl-space audit | Detect unbounded combinations, duplicate paths, and wasted crawling. | O/I | P2 | Pro |
| F-089 | Pagination and infinite-scroll audit | Confirm crawlable sequential links and stable URLs. | O/I | P1 | Pro |
| F-090 | Hreflang validator | Test reciprocal links, valid codes, canonical consistency, and `x-default`. | O/I | P1 | OSS/Pro |
| F-091 | Mobile rendering/content parity | Compare important content, metadata, links, and structured data across mobile and desktop. | O/I | P1 | Pro |
| F-092 | HTTPS/security basics | Detect mixed content, certificate, HSTS, unsafe forms, and security headers relevant to user trust. | O/I | P1 | OSS |
| F-093 | Core Web Vitals field monitoring | Monitor CrUX LCP, INP, and CLS by origin/page group and device. | O | P1 | Pro |
| F-094 | Lighthouse lab audits | Diagnose performance, accessibility, best-practice, and SEO issues with versioned results. | O/I | P0 | OSS/Pro |
| F-095 | Accessibility checks | Use deterministic automated checks and label areas requiring human review. | O/I | P1 | OSS/Pro |
| F-096 | Uptime and deploy-correlated SEO incidents | Link availability, status, robots, canonical, or rendering regressions to releases. | O/I | P1 | Pro |
| F-097 | IndexNow submission | Notify participating engines of changed URLs after ownership setup; state that receipt does not guarantee indexing. | O/A | P2 | OSS/Pro |
| F-098 | Restricted Google Indexing API guardrail | Permit Indexing API actions only for currently eligible job/broadcast page use cases; reject “instant indexing” for ordinary URLs. | O/A | P2 | OSS/Pro |

## 6. On-page, content, entity, and information architecture

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-100 | Title and snippet diagnostics | Find missing, duplicate, truncated, boilerplate, or intent-mismatched titles/descriptions. | O/I | P0 | OSS |
| F-101 | Heading and answer structure | Check descriptive hierarchy, direct answers, steps, tables, comparisons, and scannability where useful. | O/I | P0 | OSS/Pro |
| F-102 | Content inventory and clustering | Group pages by topic, type, template, intent, traffic, conversion, and freshness. | O/I | P1 | Pro |
| F-103 | Search-intent alignment | Compare page purpose with the queries and outcomes it attracts. | O/I | P1 | Pro |
| F-104 | Content gap analysis | Find relevant topics, questions, entity attributes, or use cases missing from the site. | S/I | P1 | Pro |
| F-105 | Information-gain review | Identify commodity summaries and opportunities for firsthand data, experience, tools, or a distinctive point of view. | I | P1 | Pro |
| F-106 | Claim and citation inventory | Extract factual claims, source URLs, publication dates, and unsupported statements. | O/I | P1 | Pro |
| F-107 | Freshness and factual-drift monitor | Recheck time-sensitive facts, availability, pricing, authors, and linked sources. | O/I | P1 | Pro |
| F-108 | Author and reviewer evidence | Audit visible authorship, credentials, disclosures, bios, and topic expertise signals without inventing them. | O/I | P1 | Pro |
| F-109 | Entity consistency | Reconcile brand, organization, product, person, location, and identifier facts across pages and profiles. | O/I | P1 | Pro |
| F-110 | Structured-data validation | Parse JSON-LD/Microdata/RDFa, validate syntax and Google-feature requirements, and compare markup with visible content. | O/I | P0 | OSS |
| F-111 | Schema graph visualization | Show entity nodes, stable `@id` references, and conflicts across page templates. | O/I | P1 | Pro |
| F-112 | Internal-link suggestions | Suggest relevant contextual links with a reason, source, destination, and reviewable anchor. | I/A | P1 | Pro |
| F-113 | Content brief grounded in evidence | Build a brief from first-party queries, user needs, competitor/source gaps, and original-research opportunities. | O/S/I | P1 | Pro |
| F-114 | Content diff and quality gate | Review a proposed change for factual support, duplication, spam risk, accessibility, and intent fit. | I/A | P0/P1 | OSS/Pro |
| F-115 | Template-level issue detection | Group repeated problems so one component fix can improve many URLs. | O/I | P1 | Pro |
| F-116 | Prune, merge, redirect, or update recommendation | Treat removal as a governed decision using traffic, links, conversions, uniqueness, and user need. | O/I/A | P2 | Pro |

## 7. Authority, reputation, distribution, and off-site evidence

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-120 | Mention and citation discovery | Find where the brand, products, people, and original data are discussed or cited. | O/S | P1 | Pro |
| F-121 | Linked versus unlinked mention review | Identify legitimate outreach or correction opportunities. | O/I | P2 | Pro |
| F-122 | Repeated source-gap analysis | Find third-party domains repeatedly cited or ranking for the buyer’s topics. | S/I | P1 | Pro |
| F-123 | Digital PR opportunity queue | Turn original data, tools, and expert commentary into relevant distribution ideas. | I/A | P2 | Pro/Agency |
| F-124 | Review and reputation feed | Monitor supported first-party/authorized review sources and response needs. | O/I | P2 | Pro |
| F-125 | Brand fact conflict detector | Find stale or contradictory names, descriptions, addresses, prices, and policies across owned/public profiles. | O/I | P2 | Pro |
| F-126 | Competitor source graph | Compare which sources, communities, and page types support competitor visibility. | S/I | P1 | Pro |
| F-127 | Link-risk and spam guardrails | Flag manipulative outreach, paid-link footprints, or autogenerated distribution plans before execution. | I | P1 | OSS/Pro |

Backlink indexes and query-volume databases require expensive proprietary data. Integrate licensed providers or customer warehouse data instead of pretending a lightweight open-source crawler can reproduce Ahrefs or Semrush.

## 8. GEO, AEO, LLM visibility, and citations

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-140 | Prompt-panel builder | Define buyer-intent questions, topic, funnel stage, locale, persona, and evaluation goal. | S/A | P0 | OSS/Pro |
| F-141 | Repeated multi-engine observations | Run a controlled panel across supported assistants with repeats and budget limits. | S | P1 | Pro |
| F-142 | Raw-answer archive | Preserve response, citations, timestamps, model/surface, locale, account state, and run method. | S | P0 | Pro |
| F-143 | Browser-versus-API provenance | State whether an observation came from a consumer UI, official API, search result, proxy, or other method. | S | P0 | All |
| F-144 | Brand mention and recommendation extraction | Detect presence, context, rank/order where meaningful, sentiment, and recommendation language. | S/I | P0 | Pro |
| F-145 | Citation resolution | Normalize cited URLs, redirects, canonical pages, domains, and source types. | S/O | P0 | Pro |
| F-146 | Share of sampled answers | Compare repeated panel presence while clearly naming the panel and uncertainty. | S/I | P1 | Pro |
| F-147 | Test-retest variance | Show how often the answer, recommendation, and citation set changes across repeats. | S/I | P1 | Pro |
| F-148 | Competitor comparison | Explain which competitors appear, in which contexts, and with which sources. | S/I | P1 | Pro |
| F-149 | Citation/source gap | Find authoritative source categories and specific domains used for competitors but not the user. | S/I | P1 | Pro |
| F-150 | Claim-to-source trace | Map answer claims back to cited or likely supporting passages where technically possible. | S/I | P2 | Pro |
| F-151 | Answerability audit | Check whether key questions have clear, supported, current answers on an appropriate page. | O/I | P0 | OSS/Pro |
| F-152 | Entity and fact consistency for AI answers | Find conflicting brand/product/person facts that can cause ambiguous synthesis. | O/S/I | P1 | Pro |
| F-153 | Generative-search landing-page analysis | Combine GSC generative visibility, assistant referrals, engagement, and conversion by page. | O/I | P1 | Pro |
| F-154 | Zero-click evidence report | Report visibility/citation observations separately from referral traffic. | O/S | P1 | Pro |
| F-155 | AI visibility anomaly | Detect a material shift only after accounting for panel, surface, model, and run variance. | S/I | P2 | Pro |
| F-156 | Prompt opportunity discovery | Suggest new panel questions from GSC queries, support/sales logs, site search, and community research. | O/I | P1 | Pro |
| F-157 | Owned versus earned source mix | Distinguish own-site citations from third-party references and public profiles. | S/I | P1 | Pro |

## 9. Agent readiness and agentic commerce

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-160 | Agent access audit | Test whether search, training, and user-directed agents can reach important paths under current robots/WAF/auth rules. | O | P0 | OSS |
| F-161 | Content-negotiation audit | Inspect HTML, JSON, feeds, and optional Markdown representations without assuming special ranking benefit. | O | P1 | OSS/Pro |
| F-162 | Public API/OpenAPI discovery | Find stable machine interfaces and validate authentication/documentation. | O/I | P2 | OSS/Pro |
| F-163 | MCP readiness | Validate tools, resources, prompts, schemas, authorization, error behavior, and dangerous actions. | O/I | P1 | OSS/Pro |
| F-164 | A2A readiness | Validate agent card/capability discovery and task behavior where a site operates an agent service. | O/I | P2 | Pro |
| F-165 | Signed-agent/Web Bot Auth verification | Help agent operators sign requests and site owners validate signatures. | O/A | P2 | OSS/Ent |
| F-166 | Agent-safe action manifest | Publish which actions are read-only, transactional, destructive, rate-limited, or human-approved. | O/A | P1 | OSS/Pro |
| F-167 | Machine-readable catalog/feed quality | Validate product, inventory, price, availability, policy, location, or service feeds. | O/I | P1 | Pro |
| F-168 | UCP/ACP/AP2 integration check | For commerce sites, validate catalog discovery, checkout, order, identity-linking, and payment mandate support on the relevant supported surface. | O/I | P3 | Pro/Ent |
| F-169 | Agent transaction observability | Trace request identity, authorization, tool/API calls, checkout, payment, fulfillment, and failure. | O | P3 | Ent |
| F-170 | Agent error simulation | Test invalid inputs, expired auth, partial failure, retries, idempotency, and confirmation boundaries. | O/I | P2 | Pro/Ent |
| F-171 | `llms.txt` validator | Check syntax and links for teams that choose to publish it, while stating no confirmed Google ranking benefit. | O | P2 | OSS |
| F-172 | OKF/export adapter | Export selected entities or datasets into an interoperable knowledge format where a real consumer exists. | O/A | P3 | OSS/Ent |

## 10. Vertical SEO and discovery

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-180 | Local SEO workspace | Audit Business Profile consistency, location pages, hours, services, reviews, and LocalBusiness data. | O/I | P2 | Pro/Agency |
| F-181 | Ecommerce workspace | Reconcile Product/Offer markup, Merchant Center feed, page price, availability, shipping, returns, category, and crawl paths. | O/I | P1/P2 | Pro |
| F-182 | Product-feed monitor | Alert on disapprovals, feed/page mismatch, stale inventory, invalid identifiers, and missing attributes. | O/I | P2 | Pro |
| F-183 | Agentic-commerce readiness | Validate Google UCP, OpenAI ACP, feeds/APIs, and measure agent-originated discovery and transaction flow. | O/I | P3 | Pro/Ent |
| F-184 | International SEO workspace | Audit locale targeting, translations, hreflang, canonicals, currency, regional availability, and performance by market. | O/I | P2 | Pro/Agency |
| F-185 | News/publisher workspace | Monitor news sitemaps, dates, bylines, corrections, paywalls, article data, Discover, crawl demand, and source citations. | O/I | P2 | Pro/Ent |
| F-186 | Video workspace | Audit watch pages, thumbnails, transcripts, VideoObject, video sitemaps, and video-search performance. | O/I | P2 | Pro |
| F-187 | Image workspace | Audit discoverability, alt/context, performance, licensing metadata, image sitemaps, and image-search results. | O/I | P2 | Pro |
| F-188 | SaaS/B2B workspace | Join use-case pages, docs, comparison pages, integration pages, branded demand, demos, pipeline, and cited sources. | O/S/I | P1 | Pro |
| F-189 | Programmatic SEO quality control | Audit template uniqueness, crawl-space, data value, scaled-content risk, and conversion outcomes. | O/I | P2 | Pro |

## 11. Agent actions, change intelligence, and verification

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-200 | Unified opportunity queue | Rank actions by evidence strength, affected value, effort, reversibility, and expected learning. | O/S/I | P0 | Pro |
| F-201 | Explanation bundle | Show the evidence, counter-evidence, freshness, formula, and unknowns behind a recommendation. | O/S/I | P0 | All |
| F-202 | GitHub issue creation | Turn an approved finding into a scoped issue with URLs, acceptance criteria, and evidence links. | A | P1 | Pro |
| F-203 | Pull-request draft | Make a reviewable code change with tests and a rollback path. | A | P2 | Pro |
| F-204 | CMS draft | Create a draft or suggested diff without silently publishing. | A | P2 | Pro |
| F-205 | Change annotations | Record deploy, content, schema, redirect, campaign, algorithm, and external events. | O/A | P0 | OSS/Pro |
| F-206 | Before/after verification | Re-run deterministic checks and later compare performance with a suitable baseline/control. | O/I | P0 | Pro |
| F-207 | SEO experiment registry | Define hypothesis, pages, control, guardrails, start/end, primary metric, and stopping rule. | O/A | P1 | Pro |
| F-208 | Quasi-experimental analysis | Use matched pages, difference-in-differences, or interrupted time series where conditions allow. | O/I | P2 | Pro/Ent |
| F-209 | Rollback recommendation | Detect a harmful technical change and prepare a reversible response. | O/I/A | P1 | Pro |
| F-210 | Approval and policy engine | Restrict high-risk tools, require review, and retain who approved what. | O/A | P1/P2 | Pro/Ent |
| F-211 | Agent budget and loop controls | Limit model cost, prompt runs, API quota, crawl rate, retries, and action count. | O/A | P0 | OSS/Pro |

## 12. Reporting, collaboration, and agency operations

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-220 | Weekly evidence digest | Receive changes, explanations, opportunities, and data-health warnings. | O/S/I | P0 | Pro |
| F-221 | Executive outcome report | Explain visibility, acquisition, conversion, actions, and uncertainty without SEO jargon. | O/S/I | P1 | Pro |
| F-222 | Technical change report | Give developers reproducible commands, affected URLs, logs, and acceptance criteria. | O/I/A | P1 | Pro |
| F-223 | Client report and portal | Share branded, scoped evidence with a client. | O/S/I | P1 | Agency |
| F-224 | Multi-client command center | Monitor connector failures, incidents, opportunity value, and report status across accounts. | O/I | P1 | Agency |
| F-225 | Scheduled PDF/email/Slack/webhook | Deliver reports and alerts in the buyer’s existing workflow. | O/I | P1 | Pro/Agency |
| F-226 | Annotation and commentary | Let humans add campaign, PR, product, algorithm, and business context. | O | P0 | Pro |
| F-227 | Saved investigation/runbook | Re-run the same analysis with versioned inputs and output schema. | O/S/I | P0 | OSS/Pro |
| F-228 | White-label domain and theme | Support agency delivery without hiding evidence provenance. | O | P2 | Agency |
| F-229 | Benchmark cohorts | Compare anonymized, opt-in metrics for similar sites with minimum cohort privacy rules. | I | P3 | Ent |
| F-230 | Data export and warehouse sync | Export raw and normalized evidence to JSON/CSV/Parquet/BigQuery/Snowflake. | O | P1/P2 | OSS/Ent |

## 13. Developer platform

| ID | Capability | User outcome | Evidence | Priority | Package |
|---|---|---|---|---|---|
| F-240 | Stable JSON output and JSON Schema | Let agents and scripts depend on versioned contracts. | O/S/I | P0 | OSS |
| F-241 | REST API and SDKs | Integrate evidence and workflows into products and data pipelines. | O/S/I/A | P1 | Pro/Ent |
| F-242 | MCP server | Query evidence and invoke scoped actions from compatible agents. | O/S/I/A | P0 | OSS/Pro |
| F-243 | Webhooks | Emit source synced, anomaly found, action approved, and experiment completed events. | O/A | P1 | Pro |
| F-244 | Plugin/connector SDK | Let the community add collectors and actions against the common schema. | O/A | P1 | OSS |
| F-245 | Query language | Filter evidence by domain, page, entity, source, class, time, and confidence. | O/S/I | P2 | OSS/Pro |
| F-246 | Evidence fixtures and replay | Test agents and dashboards against deterministic sample datasets. | O/S/I | P0 | OSS |
| F-247 | Source capability registry | Publish which metrics/actions each connector supports, its freshness, and limitations. | O | P0 | OSS |
| F-248 | CLI telemetry opt-in | Measure product usage only with explicit consent and transparent events. | O | P1 | OSS/Pro |
| F-249 | Public status and changelog | Make connector/API breakage visible and machine-readable. | O | P0 | All |

## Initial product slice

The first sellable version should contain only the parts needed for one closed loop:

1. Google auth and source-health checks.
2. GSC search performance plus GA4 AI Assistant/referral and conversion reports.
3. Cloudflare/generic log import with verified-versus-suspected bot classification.
4. Site access/indexability/structured-data checks on important pages.
5. A small, reproducible prompt panel with raw-answer provenance.
6. A unified opportunity queue.
7. Change annotations and later verification.
8. CLI, JSON, MCP, weekly digest, and one hosted dashboard.

Everything else should earn its way onto the roadmap through usage and paid validation.
