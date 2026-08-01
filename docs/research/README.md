# aitraffic.dev Product Research

> Product, open-source, SEO, GEO/AEO, architecture, monetization, and validation research
> Research snapshot: 2026-07-29
> Intended relationship: **AI Traffic by TrafficClaw**

> [!IMPORTANT]
> This directory is a dated research snapshot, not the current implementation
> queue. See the authoritative [Project status](../STATUS.md) before selecting
> the next feature.

## Executive answer

`aitraffic.dev` should not become a second generic analytics dashboard, a prompt rank tracker, or a thin GA4/GSC MCP wrapper. Each of those markets already has substantial free and paid supply.

The strongest product is an **open, agent-native AI acquisition evidence layer** that connects:

1. what Google Search and its generative features showed;
2. what AI crawlers and user-directed agents actually requested;
3. where brands, pages, and competitors appeared in sampled AI answers;
4. which people clicked from AI assistants;
5. which visitors converted or produced revenue;
6. which code or content change preceded the result.

The CLI, MCP server, API, dashboard, and scheduled reports should all expose the same evidence model. Every result should state whether it is:

- **Observed** — first-party or platform data such as a log request, GSC impression, GA4 session, or conversion.
- **Sampled** — a reproducible observation from a particular prompt, model, locale, account state, and time.
- **Inferred** — a diagnosis or opportunity computed from observed or sampled evidence.
- **Unknown** — a relationship that the available data cannot establish.

This is the differentiator: not a mysterious “AI visibility score,” but a traceable answer to:

> What changed, where in the acquisition chain did it change, what should an agent do next, and what outcome can we honestly associate with the action?

## Terminology

The request used “SU, AU, and GU.” This research treats that as the commonly used **SEO, AEO, and GEO** categories and expands the scope where useful:

| Term | Practical meaning in this research |
|---|---|
| SEO | Search Engine Optimization: discovery, crawling, indexing, ranking eligibility, presentation, and organic-search measurement. |
| AEO | Answer Engine Optimization: making accurate, useful answers easy to find, understand, extract, and attribute. |
| GEO | Generative Engine Optimization: improving legitimate visibility and citation potential in generative search and assistants. |
| LLMO / AIO | Overlapping market labels for LLM or AI-search optimization. They are treated as product-language variants, not separate sciences. |
| Agent readiness | Making a site safely discoverable, understandable, usable, and measurable by user-directed software agents. |

None of these labels creates a shortcut around helpful content, crawlability, clear entities, reliable facts, or strong distribution. Google’s current guidance says foundational SEO remains relevant to generative Search and that special AI files or markup are not required.

## Product boundary

### Build

- A unified evidence schema and local-first store.
- Read-only Google OAuth onboarding for GA4 and GSC.
- CDN, server-log, application middleware, and optional first-party event collectors.
- AI referral, crawler, prompt, citation, conversion, and change-event normalization.
- CLI, JSON output, MCP resources/tools, REST API, webhooks, and scheduled jobs.
- Evidence-aware diagnoses, opportunity ranking, experiments, and before/after verification.
- Multi-client reporting, alerts, provenance, audit logs, and access controls.

### Integrate

- Google Search Console, GA4, PageSpeed Insights, CrUX, Merchant Center, Business Profile, and GitHub.
- Cloudflare and other CDN/log sources.
- Existing permissively licensed crawlers, validators, accessibility tools, and analytics components where appropriate.
- CMSs, deployment platforms, CRMs, payment providers, warehouses, and BI tools.
- MCP and A2A as access/distribution protocols; commerce protocols only where the user has a commerce use case.

### Do not make the core product

- Another broad GA4 replacement.
- A raw user-agent regex dashboard.
- An MCP server with no higher-level product.
- A single opaque visibility or “AI-readiness” score.
- An `llms.txt` generator sold as a ranking lever.
- A generic AI writer or mass autopublisher.
- Guaranteed rankings, citations, traffic, or causal revenue attribution.

## Recommended product promise

> **Measure and improve how search engines and AI agents discover, cite, visit, and convert on your site—from the terminal.**

Supporting proof points:

- Open CLI and evidence schema.
- Local/BYO-credential mode.
- Hosted OAuth and scheduled collection when convenience is needed.
- Provenance on every metric.
- One workflow from diagnosis through change and verification.

## Suggested command surface

```bash
# Identity and sources
npx aitraffic auth login
aitraffic connect google
aitraffic connect cloudflare
aitraffic connect github
aitraffic sites

# Observed evidence
aitraffic search report --since 30d
aitraffic referrals --channel ai-assistant
aitraffic crawlers --verified --since 7d
aitraffic conversions --source ai
aitraffic changes --since 30d

# Sampled evidence
aitraffic prompts import prompts.csv
aitraffic citations run --panel buyer-intent --repeat 3
aitraffic visibility compare --competitors competitors.txt

# Diagnosis and action
aitraffic audit https://example.com
aitraffic opportunities --goal revenue
aitraffic explain-drop --page /pricing
aitraffic experiment create --pages urls.csv --change schema
aitraffic verify --change CHANGE_ID

# Agent and machine interfaces
aitraffic report --since 30d --json
aitraffic mcp serve
aitraffic api serve
aitraffic schema export
```

Destructive actions such as editing pages, submitting changes, or changing crawler policy should require an explicit write scope and confirmation. Read-only measurement should be the default.

## Knowledge-base map

| Document | Question answered |
|---|---|
| [01-product-thesis-and-market.md](01-product-thesis-and-market.md) | Why this category, who pays, where the whitespace is, and how it fits TrafficClaw. |
| [02-complete-feature-catalog.md](02-complete-feature-catalog.md) | What can be built across SEO, GEO/AEO, analytics, agents, and agency workflows. |
| [03-open-source-landscape.md](03-open-source-landscape.md) | Which open-source projects can be reused, integrated, learned from, or avoided. |
| [04-seo-ranking-playbook.md](04-seo-ranking-playbook.md) | What genuinely helps organic search and how the product should operationalize it. |
| [05-geo-aeo-agent-readiness-playbook.md](05-geo-aeo-agent-readiness-playbook.md) | What is established, useful but unproven, or speculative in AI visibility and agent readiness. |
| [06-data-integrations-and-architecture.md](06-data-integrations-and-architecture.md) | Data model, collectors, CLI/MCP/API surfaces, security, and open-source boundary. |
| [07-monetization-and-packaging.md](07-monetization-and-packaging.md) | Pricing, free/paid boundaries, buyer economics, cost drivers, and expansion revenue. |
| [08-roadmap-and-validation.md](08-roadmap-and-validation.md) | What to ship first, what to defer, and how to validate willingness to pay. |
| [09-source-register.md](09-source-register.md) | Primary sources, repositories, competitors, and community-demand evidence. |
| [10-public-skills-integration-plan.md](10-public-skills-integration-plan.md) | Which public SEO/analytics skills to adapt, integrate, or reject, plus the ordered CLI/MCP/skill implementation plan. |

## Research rules

1. Prefer official documentation and repositories for technical claims.
2. Treat vendor performance claims as claims, not independent evidence.
3. Treat Reddit, Hacker News, Product Hunt, and X as qualitative demand evidence.
4. Treat GitHub stars as attention, not adoption or product quality.
5. Record license risk before reusing code. “Public on GitHub” does not mean reusable.
6. Never equate crawl, citation, click, conversion, and revenue; they are different events.
7. Preserve raw observations and measurement context so results can be audited.
8. Update facts marked “current” before using this research in marketing or investment decisions.

## Current domain and product context

As of the research snapshot:

- `aitraffic.dev` has no resolvable A or AAAA record and no live website.
- `trafficclaw.com` is live.
- This repository already has substantial reusable infrastructure: Google OAuth with GA4/GSC read-only scopes, GA4 and GSC clients, PageSpeed and schema endpoints, opportunity/cannibalization analysis, reporting, alerts, GitHub integration, and a large agent tool surface.

The economical move is therefore:

```text
TrafficClaw hosted product and existing integrations
                       │
                       ▼
        shared AI acquisition evidence layer
             ┌─────────┼─────────┐
             ▼         ▼         ▼
       aitraffic CLI   MCP/API   web dashboard
```

`aitraffic.dev` can be the developer-facing brand, documentation site, open-source home, CLI namespace, and API/MCP surface. TrafficClaw can remain the hosted visual product and billing relationship.
