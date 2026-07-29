# Open-Source Landscape

## How to use this list

Repository metadata was checked on 2026-07-29. Stars are approximate attention snapshots, not quality or usage. “Freshness” is a recent repository push, not necessarily a stable release.

Recommendations:

- **Reuse** — permissively licensed code or data can be incorporated with required notices and review.
- **Integrate** — prefer an API, process, exporter, or optional sidecar boundary.
- **Study** — use the interface or architecture as research, not a foundation.
- **Avoid copying** — no usable license, archived/fragile dependency, source-available restriction, or copyleft conflict with the intended proprietary hosted core.

This is product research, not legal advice. Perform a dependency and file-level license review before shipping.

## Recommended initial open stack

```text
CLI and schema
  TypeScript + JSON Schema
  SQLite locally; optional DuckDB/Parquet for analysis/export

Site evidence
  Crawlee for HTTP/browser crawl orchestration
  Playwright for rendered inspection
  Lighthouse + CrUX/web-vitals for performance evidence
  extruct/schema.org for structured data
  Readability/Trafilatura for primary-content extraction

Google evidence
  Existing TrafficClaw GA4/GSC clients
  Official Google Analytics MCP patterns

Logs and agents
  open collector/middleware adapters
  versioned bot registry
  OpenTelemetry export where useful

Hosted scale
  PostgreSQL first
  object storage for raw artifacts
  ClickHouse only when event volume justifies it
```

Do not adopt a complete analytics platform as the product core. The differentiation is the evidence model and cross-source workflows.

## 1. Crawl, rendering, performance, and technical SEO

| Project | Snapshot | License | Useful capability | Recommendation |
|---|---:|---|---|---|
| [GoogleChrome/lighthouse](https://github.com/GoogleChrome/lighthouse) | ~30.6k stars; active Jul 2026 | Apache-2.0 | Performance, accessibility, SEO, and best-practice audits | **Reuse/sidecar.** A versioned deterministic primitive; do not rebuild. |
| [GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci) | ~7k; active Mar 2026 | Apache-2.0 | Audit history, budgets, and regression gates | **Reuse patterns.** Good model for deploy checks and evidence regression CI. |
| [apify/crawlee](https://github.com/apify/crawlee) | ~25.1k; active Jul 2026 | Apache-2.0 | HTTP/browser crawling, queues, retries, rate control | **Reuse.** Strong foundation for `aitraffic crawl`. |
| [microsoft/playwright](https://github.com/microsoft/playwright) | ~93.7k; active Jul 2026 | Apache-2.0 | Browser rendering and interaction | **Reuse** for owned-site render checks. Do not make policy-fragile consumer-account automation the core. |
| [StJudeWasHere/seonaut](https://github.com/StJudeWasHere/seonaut) | ~745; active May 2026 | MIT | Full-site links, redirects, headings, and metadata audit | **Reuse selectively/study** as a traditional SEO baseline. |
| [sitespeedio/sitespeed.io](https://github.com/sitespeedio/sitespeed.io) | ~5k; active Jul 2026 | MIT | Multi-page performance monitoring | **Integrate** as an optional advanced performance adapter. |
| [GoogleChrome/web-vitals](https://github.com/GoogleChrome/web-vitals) | ~8.6k; active Jul 2026 | Apache-2.0 | Client-side Core Web Vitals measurement | **Reuse** for optional first-party field telemetry. |
| [dequelabs/axe-core](https://github.com/dequelabs/axe-core) | Mature/active | MPL-2.0 | Automated accessibility rules | **Reuse with license review** as one audit layer; retain human-review caveat. |
| [mozilla/readability](https://github.com/mozilla/readability) | ~11.4k; active Jul 2026 | Apache-2.0 | Primary article-content extraction | **Reuse** for clean-text and rendered-content comparison. |
| [adbar/trafilatura](https://github.com/adbar/trafilatura) | ~6.4k; active Jul 2026 | Apache-2.0 | Text and metadata extraction | **Reuse**, especially for content/source analysis. |
| [scrapinghub/extruct](https://github.com/scrapinghub/extruct) | ~967; active Apr 2026 | BSD-3-Clause | JSON-LD, Microdata, RDFa, OpenGraph extraction | **Reuse.** Strong structured-data evidence extractor. |
| [schemaorg/schemaorg](https://github.com/schemaorg/schemaorg) | ~6.2k; active Jul 2026 | Apache-2.0 | Schema.org vocabulary and releases | **Reuse the vocabulary/data**, pinning versions. |
| [RDFLib/rdflib](https://github.com/RDFLib/rdflib) | ~2.5k; active Jul 2026 | BSD-3-Clause | RDF graphs, normalization, SPARQL | **Reuse** only if RDF provides clear value to the entity/evidence graph. |
| [seontology/seontology](https://github.com/seontology/seontology) | ~65; active Jul 2026 | MIT | Early ontology for SEO concepts and provenance | **Study/reuse cautiously.** Too immature for a hard core dependency. |
| [Yoast/wordpress-seo](https://github.com/Yoast/wordpress-seo) | ~2k; active Jul 2026 | GPL | Large practical SEO rule set and WordPress integration | **Integrate/learn.** Do not copy GPL code into a closed core without accepting obligations. |

### Decision

Use Crawlee + selective Playwright rendering and emit raw page facts. Run Lighthouse/axe/structured-data extraction as versioned auditors. Keep heuristic recommendations in a separate layer so rules can be updated and challenged.

## 2. Language, entities, and content analysis

| Project | Snapshot | License | Useful capability | Recommendation |
|---|---:|---|---|---|
| [explosion/spaCy](https://github.com/explosion/spaCy) | ~33.8k; active 2026 | MIT code | Named entities and linguistic processing | **Reuse**, checking model-weight licenses separately. |
| [RDFLib/rdflib](https://github.com/RDFLib/rdflib) | ~2.5k | BSD-3-Clause | Entity graph operations | **Reuse** if graph queries justify the Python component. |
| [mozilla/readability](https://github.com/mozilla/readability) | ~11.4k | Apache-2.0 | Article content extraction | **Reuse** for content comparison. |
| [adbar/trafilatura](https://github.com/adbar/trafilatura) | ~6.4k | Apache-2.0 | Main text, metadata, and document extraction | **Reuse** instead of a new extraction pipeline. |

Use deterministic parsing before LLM extraction. Store the extraction tool/model and version. A model-detected “entity” is an inference unless the page or a structured source explicitly provides it.

## 3. Keyword, SERP, and rank tracking

| Project | Snapshot | License | Useful capability | Recommendation |
|---|---:|---|---|---|
| [towfiqi/serpbear](https://github.com/towfiqi/serpbear) | ~2k; active May 2026 | MIT | Keyword rank tracking, providers, GSC integration | **Study/reuse patterns or integrate.** Direct Google scraping is brittle and policy-sensitive. |
| [serpapi/serptrail](https://github.com/serpapi/serptrail) | ~40; active Jul 2026 | MIT | New SEO/GEO monitoring application | **Watch**, not a foundation. |
| [eliasdabbas/advertools](https://github.com/eliasdabbas/advertools) | ~1.4k; active Jun 2026 | MIT | Crawl, keyword, SERP/ads analysis utilities | **Reuse** for analyst workflows or export tooling. |
| [GeneralMills/pytrends](https://github.com/GeneralMills/pytrends) | ~3.7k; archived 2024 | License unclear in metadata; unofficial | Unofficial Google Trends access | **Avoid as core.** Archived and frequently broken by upstream changes. |

### Supply gap

There is no lightweight open-source substitute for a commercial web-scale:

- backlink index;
- keyword-volume/clickstream database;
- historical SERP corpus;
- global competitive traffic model.

Those products require expensive collection and licensing. Use first-party GSC, a licensed API chosen by the customer, or imports. Do not represent scraped or guessed data as equivalent.

## 4. GA4, GSC, CLI, and MCP

| Project | Snapshot | License | Useful capability | Recommendation |
|---|---:|---|---|---|
| [googleanalytics/google-analytics-mcp](https://github.com/googleanalytics/google-analytics-mcp) | ~2.8k; active Jul 2026 | Apache-2.0 | Official Admin/Data API MCP, core/realtime reports | **Reuse patterns/integrate.** Keep GA tool shapes aligned with Google. |
| [google/mcp](https://github.com/google/mcp) | ~4.4k; active Jul 2026 | Apache-2.0 | Google MCP conventions and implementations | **Reference/integrate.** Useful for auth and tool conventions. |
| [AminForou/mcp-gsc](https://github.com/AminForou/mcp-gsc) | ~1.3k; active Jul 2026 | MIT | Search Analytics, URL Inspection, sitemaps, SEO workflows | **Reuse/integrate after security review.** |
| [ncosentino/google-search-console-mcp](https://github.com/ncosentino/google-search-console-mcp) | Small; active Jul 2026 | MIT | Lightweight GSC MCP implementations | **Study**, not a product anchor. |
| [daidalytics/google-analytics-cli](https://github.com/daidalytics/google-analytics-cli) | Small; active Jul 2026 | No root license detected | Broad GA CLI and agent output patterns | **Study interface; avoid copying** until licensed. |

Many other GSC MCP repositories exist with single- or double-digit adoption. Feature count is not defensibility. The aitraffic advantage must be:

- one login/context;
- cross-source normalization;
- provenance;
- evidence-to-action workflows;
- history and verification.

## 5. GEO/AEO, citations, and AI visibility

| Project | Snapshot | License | Useful capability | Recommendation |
|---|---:|---|---|---|
| [Auriti-Labs/geo-optimizer-skill](https://github.com/Auriti-Labs/geo-optimizer-skill) | ~629; active Jul 2026 | MIT | CLI/Python/MCP audits, schema, robots, entities, citations, logs | **Reuse selectively.** Validate every heuristic; do not import ranking claims uncritically. |
| [danishashko/geo-aeo-tracker](https://github.com/danishashko/geo-aeo-tracker) | ~212; active Jul 2026 | MIT | Local multi-model mentions, citations, competitors, audits | **Study/reuse components.** Provider behavior remains a fragile dependency. |
| [mverab/eGEOagents](https://github.com/mverab/eGEOagents) | ~143; active Jul 2026 | MIT | Multi-agent GEO research workflows | **Study** workflow patterns; evaluate quality before reuse. |
| [anyin-ai/aperture](https://github.com/anyin-ai/aperture) | ~22; active Jul 2026 | MIT | BYOK/self-hosted AI visibility | **Study.** Product posture matches developer demand but coverage is young. |
| [AutomateLab-tech/citation-intelligence](https://github.com/AutomateLab-tech/citation-intelligence) | Small; active 2026 | MIT | Citation analysis with explicit observation-method labels | **Reuse methodology ideas**, especially fidelity/provenance labels. |
| [webappski/aeo-platform](https://github.com/webappski/aeo-platform) | Small; active Jul 2026 | MIT | Zero-dependency CLI for mention/crawlability checks | **Study**, not a dependency. |
| [federicodeponte/aeo-mentions-crawler](https://github.com/federicodeponte/aeo-mentions-crawler) | Small; Mar 2026 | No license detected | Multi-model brand-mention monitoring | **Avoid copying.** |
| [AnswerDotAI/llms-txt](https://github.com/AnswerDotAI/llms-txt) | Active proposal | Permissive project; verify files | `llms.txt` proposal and tooling | **Optional validator only.** No Google ranking claim. |
| [GoogleCloudPlatform/knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog) | Active | Check relevant directory/spec | Open Knowledge Format specification | **Adapter when demanded.** Not a public-search ranking system. |

### Decision

Open source already supplies prompt runners and “AI readiness” audits. Build the cross-source evidence graph, not another mention counter.

## 6. AI referrers, crawlers, and agent analytics

| Project | Snapshot | License | Useful capability | Recommendation |
|---|---:|---|---|---|
| [ai-robots-txt/ai.robots.txt](https://github.com/ai-robots-txt/ai.robots.txt) | ~4k; active Jul 2026 | MIT | Maintained AI user-agent list and rule generation | **Reuse as classification input.** UA alone is not verified identity. |
| [Agent-Analytics/agent-analytics](https://github.com/Agent-Analytics/agent-analytics) | Small; active May 2026 | Package says MIT; root license missing | Cloudflare/Docker events, CLI/MCP | **Do not copy until license text is present.** Direct competitive research. |
| [knownagents/node-sdk](https://github.com/knownagents/node-sdk) | Small; active Jul 2026 | Apache-2.0 | Bots, referrals, MCP calls, agent commerce, identity | **Study/reuse adapters** after validating identity methodology. |
| [apideck-libraries/agent-analytics](https://github.com/apideck-libraries/agent-analytics) | Small; active Jun 2026 | MIT | Server/edge middleware with analytics adapters | **Reuse middleware patterns.** Preserve its false-positive caveats. |
| [surfacedby/ai-traffic-alerts-for-cloudflare](https://github.com/surfacedby/ai-traffic-alerts-for-cloudflare) | Small | MIT | Cloudflare AI traffic alerts | **Study/integrate** for a narrow connector. |

Cloudflare already provides AI Crawl Control and bot analytics for Cloudflare sites. aitraffic should add cross-CDN normalization, verified identity, page value, GSC/GA4 joins, and action/verification—not reproduce the same table.

## 7. General web and product analytics

| Project | Snapshot | License | Recommendation |
|---|---:|---|---|
| [umami-software/umami](https://github.com/umami-software/umami) | ~38k; active Jul 2026 | MIT | **Integrate or reuse event-model ideas.** Best permissive general-analytics reference. |
| [PostHog/posthog](https://github.com/PostHog/posthog) | ~37.4k; active Jul 2026 | MIT core; enterprise directories separate | **Integrate; reuse only clearly MIT files.** Maintain file-level provenance. |
| [plausible/analytics](https://github.com/plausible/analytics) | ~28.2k; active Jul 2026 | AGPL-3.0 | **Separate service/API integration.** Avoid a closed derivative unless accepting AGPL duties. |
| [matomo-org/matomo](https://github.com/matomo-org/matomo) | ~21.7k; active Jul 2026 | GPL-3.0 | **Integrate via API.** Broad but heavy and copyleft. |
| [rybbit-io/rybbit](https://github.com/rybbit-io/rybbit) | ~12.5k; active Jul 2026 | AGPL-3.0 | **Study/integrate**, not a proprietary embedded fork. |
| [Openpanel-dev/openpanel](https://github.com/Openpanel-dev/openpanel) | ~6.2k; active Jul 2026 | AGPL-3.0 | **Study/integrate**, with the same copyleft boundary. |
| [FrigadeHQ/trench](https://github.com/FrigadeHQ/trench) | ~1.6k; active 2026 | MIT | **Consider** as permissive event infrastructure if the simple stack becomes insufficient. |

Do not rebuild funnels, replay, flags, experiments, warehouses, and every dashboard. Integrate with the user’s analytics system and own AI acquisition evidence.

## 8. Agent protocols, identity, and observability

| Project | Snapshot | License | Useful capability | Recommendation |
|---|---:|---|---|---|
| [modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol) | ~8.8k; active Jul 2026 | Project in Apache/MIT transition; docs licensing differs | MCP specification and schemas | **Implement the spec via SDK; do not fork it.** Pin versions. |
| [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | ~89k; active Jul 2026 | Repository/project licensing varies | Reference servers | **Reference selectively.** Check each server and dependency. |
| [a2aproject/A2A](https://github.com/a2aproject/A2A) | ~25.1k; active Jul 2026 | Apache-2.0 | Agent cards, discovery, tasks | **Later adapter.** MCP is the immediate tool surface. |
| [agentgateway/agentgateway](https://github.com/agentgateway/agentgateway) | ~4.1k; active Jul 2026 | Apache-2.0 | Agent/MCP policy, routing, observability | **Enterprise integration**, not an initial rebuild. |
| [spiffe/spire](https://github.com/spiffe/spire) | ~2.5k; active Jul 2026 | Apache-2.0 | Workload identity | **Optional enterprise integration.** Too heavy for first login. |
| [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector) | ~7.3k; active Jul 2026 | Apache-2.0 | Logs, metrics, and traces | **Reuse/export.** Consider aitraffic semantic conventions. |
| [langfuse/langfuse](https://github.com/langfuse/langfuse) | ~32.1k; active Jul 2026 | MIT core; separate enterprise code | Prompt traces, evals, datasets | **Integrate/export or reuse MIT core only.** Not acquisition analytics. |
| [traceloop/openllmetry](https://github.com/traceloop/openllmetry) | ~7.3k; active Jul 2026 | Apache-2.0 | OpenTelemetry LLM instrumentation | **Reuse** for optional tool/agent tracing. |
| [Arize-ai/phoenix](https://github.com/Arize-ai/phoenix) | ~10.8k; active Jul 2026 | Elastic License 2.0 | AI evaluation and observability | **Integrate.** ELv2 is source-available, not permissive OSS. |

MCP, A2A, Web Bot Auth, UCP, AP2, and x402 solve different problems. Expose them as specific adapters, not as one “agent score.”

## 9. Data and visualization infrastructure

| Project | Snapshot | License | Recommendation |
|---|---:|---|---|
| [duckdb/duckdb](https://github.com/duckdb/duckdb) | ~39.8k; active Jul 2026 | MIT | **Use optionally** for fast local Parquet/CSV analytical queries. |
| [ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse) | ~48.9k; active Jul 2026 | Apache-2.0 | **Hosted scale path** for large request/event facts. |
| [apache/superset](https://github.com/apache/superset) | ~74k; active Jul 2026 | Apache-2.0 | **Export/integrate** for analyst BI, not the product UI. |
| [grafana/grafana](https://github.com/grafana/grafana) | ~75.8k; active Jul 2026 | AGPL-3.0 | **External operations integration/sidecar**, not copied UI. |

SQLite and PostgreSQL are sufficient for the initial product. Add specialized stores only after real volume and query patterns are measured.

## 10. License decision guide

| License/state | Practical product treatment |
|---|---|
| Apache-2.0 | Preferred for reusable infrastructure; includes an express patent grant. Retain notices. |
| MIT / BSD | Generally permissive; retain copyright/license notices. |
| MPL-2.0 | File-level copyleft; modifications to covered files require source availability. Review architecture. |
| GPL-3.0 | Strong copyleft for distributed combined/derivative works. Prefer process/API boundary unless the product accepts GPL. |
| AGPL-3.0 | Extends source obligations to network interaction for modified covered software. Do not assume SaaS avoids obligations. |
| Elastic License / source available | Not equivalent to OSI open source; often restricts offering as a service. Integrate under its terms. |
| Mixed open-core | Review each file/directory; never assume the whole repository has the permissive core license. |
| No license | Copyright defaults to all rights reserved. Do not copy code. |

## 11. What to open source

Recommended Apache-2.0:

- CLI;
- evidence schema and JSON Schema;
- source capability registry;
- bot/agent identity registry;
- log and event collectors;
- local storage/query mode;
- import/export;
- deterministic audits;
- MCP server;
- connector SDK;
- experiment manifest;
- fixtures and example reports.

Reasons:

- trust-sensitive credential and measurement paths are inspectable;
- third parties can add connectors;
- users can keep local data;
- Apache-2.0 is permissive and includes a patent grant;
- the hosted service still owns operational value.

## 12. What not to build

- Another general analytics clone.
- A new full browser automation framework.
- A web-scale backlink or keyword database without the capital/data rights.
- A fork of MCP or A2A.
- A user-agent-only “verified AI bot” database.
- A source-available dependency represented as permissive open source.
- A closed product built by copying AGPL/GPL/no-license code.
- A ranking system whose “science” is unreviewed repository heuristics.

## 13. Adoption plan

1. Create a dependency/license register before importing code.
2. Prefer official SDKs and primary platform APIs.
3. Wrap third-party components behind internal interfaces.
4. Pin versions and record the component version on emitted evidence.
5. Add redacted fixtures and contract tests for every connector.
6. Maintain an upstream-security/update process.
7. Publish notices and attribution with releases.
8. Contribute generic fixes upstream rather than maintaining unnecessary forks.

The open-source ecosystem supplies nearly every low-level primitive. aitraffic.dev should win by composing them into an honest acquisition evidence system.
