# Public SEO Skill Research and Integration Plan

> Research snapshot: 2026-07-30
> Scope: public agent skills for SEO, AEO, GEO, Google Search Console, GA4, site quality, structured data, content, and programmatic SEO
> Product target: the local-first `aitraffic` CLI, MCP server, and first-party skills for Codex and Claude Code

## Executive decision

Public skills should be used as a structured source of product ideas, workflow patterns, and test cases. They should not become the implementation layer or an unreviewed runtime dependency.

A skill is never an evidence source and never a runtime authentication mechanism. Evidence comes from the connected platform, fetched page, imported file, server log, reproducible sample, or verified code/deployment state.

The product architecture should remain:

```text
public skill research
        |
        v
official-source verification
        |
        v
deterministic aitraffic CLI capability
        |
        +--> stable JSON and evidence schema
        +--> MCP tool for agents
        +--> first-party aitraffic skill
        +--> human-readable report
```

This gives `aitraffic` the speed benefit of learning from the public ecosystem without inheriting stale SEO claims, unsafe credential handling, remote prompt changes, or opaque scoring.

The recommended release order is:

1. `0.4.0` — Google Intelligence.
2. `0.5.0` — Technical Site Evidence.
3. `0.6.0` — First-Party Agent Skills.
4. `0.7.0` — Opportunity Queue and Change Verification.
5. `0.8.0` — Reproducible GEO/AEO Observation.
6. `0.9.0` — Reviewable Actions and Programmatic SEO.

Everything in these releases can be developed and tested locally before the website or hosted product is launched.

## Local implementation progress

The first `0.4.0` value slice is implemented locally and remains unpublished:

| Item | State | Interface |
|---|---|---|
| Shared capability registry | Complete | `capabilities list/describe/run` |
| Shared read-only run envelope | Complete | CLI JSON and MCP return the same contract |
| GSC pagination and coverage | Complete for opportunity runs | Row caps, pages fetched, truncation, and incomplete-data reasons are explicit |
| GA4 pagination and coverage | Complete for opportunity runs | Server-side Organic Search filter, row pagination, thresholding/cardinality-loss metadata, and quota metadata retention |
| Rich GSC request controls | Complete | offset, search type, data state, aggregation, and repeated AND filters |
| Existing-demand opportunities | Complete | low CTR against the property baseline and positions 4–20 |
| Equal-period winners and losers | Complete | top click gains and losses |
| Cannibalization candidates | Complete | multiple meaningful pages for the same returned query |
| GA4 landing outcomes | Complete | Organic Search sessions, engagement, key events, and revenue joined by normalized path |
| Unified agent workflow | Complete | `aitraffic opportunities --days 28` and `aitraffic_run` |
| Saved run history / evidence retrieval | Complete locally in `0.7.0` | Opt-in private `.aitraffic/runs/` snapshots plus history/show/compare CLI |
| Durable opportunity queue | Complete locally in `0.7.0` | Stable IDs, dry-run sync, list/explain/update, occurrence history, evidence state, and technical verification |
| Safe public HTTP fetch and redirect policy | Complete locally | Public HTTP(S), default ports, DNS/IP validation on every hop, bounded time/bytes/redirects |
| robots.txt parsing and Googlebot decision | Complete locally | RFC-style longest-match rule with allow on equal specificity |
| Static HTML technical evidence | Complete locally | HTTP, metadata, canonical, headings, links, and JSON-LD syntax |
| Single-page capability | Complete locally | `audit page`, `page audit`, and `site.page_audit` |
| Opportunity-to-page orchestration | Complete locally | `audit opportunities --limit 5` and `site.audit_opportunities` |
| Bounded sitemap and static-link crawl | Complete locally in `0.5.1` | `crawl <URL>`, `site.crawl`, compact observations, explicit partial/truncated coverage |
| First-party agent router skill | Complete locally in `0.6.0` | One `aitraffic` skill, ten task recipes, four shared references, MCP-first/CLI-fallback workflow, and drift tests |
| Unified technical and Google audit | Complete locally in `0.6.1` | `aitraffic audit <URL>` and `site.full_audit`; Google auto/off/required, property match guard, focus, compact priority order |
| Coverage-aware audit comparison | Complete locally in `0.7.0` | Page changes; persistent/new/resolved/unknown technical findings; comparable Google opportunity movement |
| Unbounded or rendered crawl | Not started | Deliberately excluded; rendering remains a later sampled mode |
| Public first-party router skill | Complete locally in `0.6.0` | Install with `npx skills add devanshug2307/aitraffic --skill aitraffic` after the repository is pushed |

This slice answers the first useful question—“which pages should I review now,
why, what could I change, and how should I verify it?”—without adding write
actions, hidden scores, or a dashboard dependency.

## Research method

The research used four levels of evidence:

1. `skills.sh` and `npx skills find` for discovery and install-count signals.
2. Primary GitHub repositories for skill instructions, scripts, license, maintenance, and implementation patterns.
3. Official Google, Schema.org, Chrome, and analytics documentation for technical truth.
4. The current `aitraffic` code and product research for feasibility and product fit.

Install count and GitHub stars are attention signals, not proof that a skill is correct or safe. A popular skill can still contain:

- stale platform information;
- unsupported ranking percentages;
- incorrect crawler assumptions;
- insecure environment-variable or token workflows;
- hidden reliance on paid external APIs;
- instructions that are unsuitable for a non-interactive CLI;
- recommendations presented without evidence.

The review therefore uses three decisions:

- **Adapt** — reproduce a useful workflow or deterministic capability inside `aitraffic`.
- **Integrate** — call a documented external tool or API behind an optional connector.
- **Reject** — do not copy or expose the pattern because it is misleading, unsafe, duplicative, or outside the product thesis.

## Current product baseline

The current local `0.3.0` implementation already provides a strong platform layer:

| Capability | State | Current interface |
|---|---|---|
| Guided Codex and Claude Code onboarding | Complete | `aitraffic onboard` |
| Project initialization and health | Complete | `init`, `doctor`, `onboard --check` |
| Local read-only Google OAuth | Complete | `auth google configure/login/status/revoke` |
| Google resource selection | Complete | `google inventory/select/status` |
| Generic GA4 reporting | Complete | `ga4 report` |
| Generic Search Console reporting | Complete | `gsc report` |
| AI referral and search acquisition comparison | Partial | `report acquisition` |
| Access-log parsing | Partial | `logs import`, `crawlers` |
| Claimed agent classification | Partial | `classify` |
| Evidence JSON Schema | Complete foundation | `schema evidence` |
| MCP server | Complete foundation | Fourteen read-only tools, including list/describe/run and project-local opportunity queue reads |
| Bounded single-page technical audit | Complete locally | `audit page <URL>` |
| Bounded sitemap/static-link crawler | Complete locally | `crawl <URL> --limit 25` |
| Rendered technical crawler | Missing | Deliberately deferred beyond `0.5.1` |
| Dedicated first-party skills | Complete locally | First-party router plus ten bounded recipes |
| Local history and opportunity queue | Complete locally | Private audit history, comparison, stable queue, and evidence-aware lifecycle |
| Reproducible prompt/citation panel | Missing | Planned for `0.8.0` |

The next work should extend this foundation rather than replace it with third-party skills.

## Public skill ecosystem

Install counts below are a discovery snapshot and will change.

### Tier A: primary sources to learn from

| Source | Adoption and maintenance signal | Most useful patterns | Decision | Required correction or boundary |
|---|---:|---|---|---|
| [Ian Nuttall SEO](https://github.com/iannuttall/seo) | New repository created 2026-07-10; about 69 stars; Apache-2.0; active | One router skill, report registry, `list -> describe -> run`, local GSC/GA4/crawl, report verification guidance, shared CLI/MCP schemas | Treat as the closest direct OSS competitor and an architecture benchmark | These mechanics are now table stakes; do not create a cosmetic clone or compete on report count |
| [Google Analytics Data API Basics](https://skills.sh/google/skills/google-analytics-data-api-basics) and [Admin API Basics](https://skills.sh/google/skills/google-analytics-admin-api-basics) | About 1.6K installs each; official `google/skills` repository about 15.3K stars; Apache-2.0; active | Authoritative request schemas, `getMetadata`, `checkCompatibility`, official client patterns, account/property inventory | Use as the primary skill-level GA4 implementation reference | Examples use Google Cloud auth patterns and the Admin API includes writes; retain AItraffic's own least-privilege local OAuth and read-only default |
| [Corey Haines Marketing Skills: SEO Audit](https://skills.sh/coreyhaines31/marketingskills/seo-audit) | About 174.2K installs; repository about 42.4K stars; MIT; active | Broad audit routing, priority order, explicit audit report structure, schema-rendering caveat | Adapt workflow and report structure | Verify every threshold and platform claim; do not inherit subjective scoring |
| [Corey Haines Marketing Skills: Programmatic SEO](https://skills.sh/coreyhaines31/marketingskills/programmatic-seo) | About 110.5K installs; same active repository | Intent-first page patterns, unique-value gates, template planning, internal-link planning, post-launch monitoring | Adapt later for `0.9.0` | Never turn this into mass publishing; require uniqueness and indexation safeguards |
| [Corey Haines Marketing Skills: AI SEO](https://skills.sh/coreyhaines31/marketingskills/ai-seo) | About 99.3K installs; same active repository | Citation-versus-recommendation distinction, content extractability, prompt monitoring vocabulary | Adapt concepts selectively | Contains stale and overconfident claims, including pre-June-2026 Search Console guidance and unsupported lift percentages |
| [Addy Osmani Web Quality Skills](https://github.com/addyosmani/web-quality-skills) | SEO about 36K installs; CWV about 18K; repository about 2.6K stars; MIT | Lighthouse-aligned checks, current Core Web Vitals thresholds, accessibility/performance grouping | Adapt deterministic checks and remediation patterns | Reject approximate ranking-factor percentages and fixed universal title/URL rules |
| [Firecrawl SEO Audit Workflow](https://skills.sh/firecrawl/firecrawl-workflows/firecrawl-seo-audit) | About 29.8K installs; official Firecrawl repository; ISC | Collection plan, source list, rerun inputs, separation of technical findings from strategy guesses | Adapt workflow; integrate Firecrawl only as optional connector | Hosted API key is required; local crawler must remain the default OSS path |
| [AgriciDaniel Claude SEO](https://github.com/AgricIDaniel/claude-seo) | About 12.8K stars; MIT; active; individual audit/technical/programmatic skills around 4K installs | Conditional specialist routing, drift baselines, dependency sequencing, falsifiability, deterministic runner scripts | Adapt orchestration and verification ideas selectively | Large context surface and arbitrary health scores; the separate Codex repository has no detected license and must remain reference-only |
| [Bhanunamikaze Agentic SEO Skill](https://github.com/Bhanunamikaze/Agentic-SEO-Skill) | About 804 stars; MIT; active; 89 scripts and tests | Evidence collectors, confidence labels, finding verifier, indexability matrix, report artifacts, multi-agent routing | Evaluate and port individual deterministic ideas | Do not import the monolith or numeric score; quickstart uses `curl \| bash`, installer can target many IDEs, and every selected script still needs security and behavior tests |
| [Sanity Agent Toolkit SEO/AEO](https://skills.sh/sanity-io/agent-toolkit/seo-aeo-best-practices) | About 4.8K installs; official Sanity repository; MIT; active | CMS-aware implementation guidance, metadata/schema/content modeling separation | Integrate as a later CMS-specific adapter/reference | Sanity-specific guidance should not become the generic crawler model |

Primary repositories were inspected at these research commits:

| Repository | Commit | Last commit date in checkout | License |
|---|---|---:|---|
| `iannuttall/seo` | `ada9e44` | 2026-07-28 | Apache-2.0 |
| `google/skills` | `c8b3209` | 2026-07-29 | Apache-2.0 |
| `coreyhaines31/marketingskills` | `7868cb9` | 2026-07-27 | MIT |
| `addyosmani/web-quality-skills` | `95d6e25` | 2026-06-14 | MIT |
| `firecrawl/firecrawl-workflows` | `1a6b302` | 2026-06-19 | ISC |
| `AgricIDaniel/claude-seo` | `09d37c7` | 2026-07-20 | MIT |
| `Bhanunamikaze/Agentic-SEO-Skill` | `6919916` | 2026-05-26 | MIT |
| `OpenClaudia/openclaudia-skills` | `c2e0d86` | 2026-07-30 | MIT |
| `sanity-io/agent-toolkit` | `dfcdd28` | 2026-07-29 | MIT |
| `kostja94/marketing-skills` | `70987ba` | 2026-06-09 | MIT |
| `aaron-he-zhu/aaron-marketing-skills` | `fc66c03` | 2026-07-30 | Apache-2.0 |

These commit IDs document the research snapshot; they are not approved vendoring pins. Any future reuse decision must inspect the exact file again and pin the source selected for reuse.

### Tier B: useful secondary references

| Source | Signal | Useful area | Decision |
|---|---:|---|---|
| [OpenClaudia Skills](https://github.com/OpenClaudia/openclaudia-skills) | About 605 stars; MIT; repository active but SEO/GA/GSC files are relatively stale | The phrasing “not yet cited” is correctly separated from “not indexed” | Reject its OAuth/API runtime patterns; do not use as a connector reference |
| [Kostja Marketing Skills: Search Console](https://skills.sh/kostja94/marketing-skills/google-search-console) | About 1.3K installs; repository about 776 stars; MIT | CTR opportunities, striking-distance queries, cannibalization report layout | Adapt analysis patterns after official verification |
| [Aaron Marketing Skills](https://github.com/aaron-he-zhu/aaron-marketing-skills) | Active replacement repository; about 2.5K stars; Apache-2.0 | Keyword research, internal-linking, content-quality and technical-check workflows | Inspect the active repository only; port ideas selectively |
| [Anthropic Knowledge Work SEO Audit](https://skills.sh/anthropics/knowledge-work-plugins/seo-audit) | About 2.7K installs | Agent-oriented audit workflow from a reputable source | Keep on watchlist and compare against the first-party audit skill |
| [ReScience SEO-GEO](https://opc.dev/skills/seo-geo) | About 38K installs | Combined audit -> implement -> validate -> monitor sequence | Adapt only the workflow sequence; reject obsolete meta-keyword advice, optimistic FAQ treatment, and claimed GEO boosts |
| [Calm North Optimize for AI](https://skills.sh/calm-north/seojuice-skills/optimize-for-ai) | About 6.6K installs | AI-search workflow terminology | Research reference only until claims and repository trust are verified |

OpenClaudia's Google recipes use deprecated or unsafe OAuth patterns for a public CLI, including out-of-band-style flows and secrets in environment files. Some write examples conflict with read-only scopes, and several GEO reports are wrappers over paid external APIs with data egress. Borrow only the honest reporting language, not the implementation.

The old `aaron-he-zhu/seo-geo-claude-skills` results still rank well in search, but the old project points users to the active `aaron-marketing-skills` repository. Do not copy installation commands or code from a moved/frozen source without checking the replacement.

### Ecosystem gaps

Search results show strong demand for broad SEO audits but much weaker supply for first-party analytics:

| Category | Strongest discovery result | Interpretation |
|---|---:|---|
| Broad SEO audit | About 174.2K installs | Crowded workflow layer; differentiate through real evidence and actions |
| Programmatic SEO | About 110.5K installs | Strong interest, but high spam and quality risk |
| AI SEO | About 99.3K installs | Strong interest, inconsistent technical truth |
| Technical web quality | About 36K installs | Good source of deterministic checks |
| Core Web Vitals | About 18K installs | Mature enough to integrate from official APIs/tools |
| Keyword research | About 6.8K installs | Useful, but external search-volume supply is usually paid |
| Content quality | About 5.2K installs | Mostly heuristic; should be labeled inferred |
| Internal linking | About 5K installs | Good agentic opportunity because a precise code diff is possible |
| Search Console | About 1.3K installs | Weak skill supply; native official API implementation is preferable |
| GA4 | About 1.6K installs for Google's official Data/Admin basics; community GA4 skills mostly below 400 | Use Google's skills as specification examples while keeping native AItraffic auth and implementation |
| GEO/AEO | One combined ReScience pack about 38K, Sanity about 4.8K, most standalone GEO tools below 1K | Demand exists, but claims are inconsistent; measurement discipline is the differentiator |
| Schema-specific skills | Mostly below 600 installs | Build deterministic extraction/validation, not prompt-only generation |
| Change-impact SEO | Mostly below 150 installs | Large product opportunity for `aitraffic` |

### Closest direct competitor and product implication

Ian Nuttall's new `seo` repository is the closest public implementation to the original `aitraffic` plan. It already offers:

- a local TypeScript CLI;
- Google Search Console and Google Analytics connections;
- technical crawling and saved crawl comparisons;
- a packaged agent skill;
- MCP access;
- a report registry with `list`, `describe`, and `run`;
- AI-referral, prompt-observation, change-measurement, programmatic SEO, Bing, and research-provider reports;
- evidence/findings/recommendation separation;
- verification guidance attached to findings.

This changes the competitive bar. The following are useful architecture but no longer differentiation:

- “SEO from the terminal”;
- local Google credentials;
- one agent skill;
- crawl plus GSC and GA4;
- dozens of reports;
- MCP access;
- JSON output.

`aitraffic` should differentiate through a tighter evidence and action lifecycle:

1. One cross-source evidence ledger covering crawler fetch, platform visibility, sampled citation, referral, conversion, code change, and later measurement.
2. Explicit coverage objects that prevent partial, capped, sampled, filtered, or missing data from becoming zero or an all-clear.
3. Native support for the 2026 Search Console GenAI report export and capability detection.
4. Native GA4 AI Assistants reconciliation while preserving raw source/medium and keeping Google AI search classified separately.
5. Safe code-aware change proposals, approval boundaries, deployment annotations, and outcome verification.
6. Revenue/lead evidence and first-party log evidence joined without claiming causality.
7. A compact capability registry and evidence retrieval API designed around agent context limits.

The moat should be the auditable chain:

```text
source observation
    -> evidence ID and coverage
    -> deterministic or inferred finding
    -> reviewable action
    -> deployed change identity
    -> later observed outcome
    -> honest causal boundary
```

### Patterns to reject

The following patterns must not be copied into `aitraffic`, even when they appear in popular skills:

1. Fixed percentages for “content,” “backlinks,” “technical SEO,” or other alleged ranking-factor weights.
2. A single opaque SEO, GEO, AEO, authority, E-E-A-T, or readiness score.
3. Claims that a specific content format produces a universal citation lift.
4. Claims that allowing a training crawler necessarily allows citation, or that blocking it necessarily prevents citation.
5. Treating `GPTBot`, `Google-Extended`, user-directed fetchers, search crawlers, and training crawlers as equivalent.
6. Presenting `llms.txt`, OKF, MCP, A2A, or WebMCP as a Google ranking requirement.
7. Presenting FAQ or HowTo schema as a guaranteed rich-result tactic.
8. Treating GA4's AI Assistants channel as all AI influence or all Google generative-search traffic.
9. Calling Search Console standard API rows complete.
10. Calling URL Inspection API output a live-page test.
11. Treating a single prompt response as an AI ranking.
12. Automatically applying content, robots, sitemap, schema, redirect, or indexing changes without review.
13. Loading remote `SKILL.md` instructions at runtime.
14. Executing remote install scripts through `curl | bash`.
15. Allowing a skill or MCP client to read OAuth tokens.

## Product capability map

Each capability should be registered once and exposed through CLI shortcuts, the compact MCP surface, and skill recipes.

A capability definition should contain:

```json
{
  "id": "gsc.existing-demand",
  "category": "search-performance",
  "purpose": "Find pages and queries with observed existing demand.",
  "input_schema": {},
  "output_schema": {},
  "side_effects": "none",
  "cost_class": "free",
  "read_order": ["coverage", "findings", "evidence", "limitations"],
  "do_not_claim": [
    "Expected clicks are not a forecast.",
    "Average position is not a stable rank observation."
  ],
  "verification": {
    "capability": "change.verify"
  }
}
```

The generic CLI path should be:

```bash
aitraffic capabilities list --category search-performance --format json
aitraffic capabilities describe gsc.existing-demand --format json
aitraffic capabilities run gsc.existing-demand --params-file input.json --format json
aitraffic evidence get RUN_ID --refs EVIDENCE_IDS --format json
```

Human-friendly commands such as `aitraffic gsc opportunities` should remain shortcuts into the same registry.

The compact read-only MCP surface should become:

```text
aitraffic_connection_status
aitraffic_list_capabilities
aitraffic_describe_capability
aitraffic_run
aitraffic_get_evidence
```

Later write-aware tools should remain separate:

```text
aitraffic_plan_change
aitraffic_apply_change
aitraffic_verify_change
```

This prevents dozens of report-specific MCP schemas from consuming agent
context. The fourteen current read-only MCP tools can remain as compatibility
shortcuts while the registry is introduced.

Each user-facing workflow should then exist at four compatible layers:

| Workflow | CLI | MCP | First-party skill | Evidence |
|---|---|---|---|---|
| Google connection health | `google status`, `google inventory` | `connection_status` or `run(google.inventory)` | `aitraffic` setup recipe | Observed |
| Search performance | `gsc performance` | `run(gsc.performance)` | `aitraffic` performance recipe | Observed |
| Search opportunities | `gsc opportunities` | `run(gsc.existing-demand)` | `aitraffic` opportunity recipe | Observed inputs, inferred opportunity |
| URL index status | `gsc inspect` | `run(gsc.index-status)` | `aitraffic` indexing recipe | Observed platform output |
| Sitemap health | `gsc sitemaps`, `sitemap audit` | `run(gsc.sitemaps)` | `aitraffic` indexing recipe | Observed |
| GA4 acquisition | `ga4 acquisition` | `run(ga4.acquisition)` | `aitraffic` acquisition recipe | Observed |
| AI landing pages and outcomes | `ga4 ai-traffic` | `run(ga4.ai-assistants)` | `aitraffic` acquisition recipe | Observed with attribution limitations |
| GA4 configuration quality | `ga4 quality` | `run(ga4.quality)` | `aitraffic` quality recipe | Observed and inferred |
| Site crawl | `crawl` | `run(crawl.site)` | `aitraffic` audit recipe | Observed |
| Technical audit | `audit technical` | `run(audit.technical)` | `aitraffic` audit recipe | Observed inputs, inferred priority |
| Schema extraction/validation | `schema extract/validate` | `run(schema.validate)` | `aitraffic` schema recipe | Observed |
| Internal-link audit | `links audit` | `run(links.internal)` | `aitraffic` links recipe | Observed and inferred |
| Core Web Vitals | `cwv check/history` | `run(web-vitals.current)` | `aitraffic` web-quality recipe | Observed lab/field data |
| Opportunity queue | `opportunities` | `run(opportunities.list)` | Used by all recipes | Inferred with evidence references |
| Change proposal | `change propose` | `plan_change` | Domain recipe | Action, never automatically applied |
| Change verification | `change verify` | `verify_change` | `aitraffic` verification recipe | Observed before/after plus inferred association |
| Prompt/citation panel | `prompts run`, `citations report` | `run(visibility.prompt-panel)` | `aitraffic` visibility recipe | Sampled |

### Capability run envelope

The current evidence schema is a useful item-level foundation. Capability execution also needs a shared run envelope:

```json
{
  "schema_version": "0.2.0",
  "run": {
    "id": "run_...",
    "capability_id": "gsc.existing-demand",
    "started_at": "2026-07-30T10:00:00Z",
    "completed_at": "2026-07-30T10:00:01Z",
    "actor": "codex",
    "mode": "read-only"
  },
  "subject": {
    "project_id": "example",
    "site": "sc-domain:example.com",
    "ga4_property": "123456789"
  },
  "sources": [],
  "coverage": {
    "requested": 25000,
    "observed": 18231,
    "omitted": null,
    "truncated": false,
    "sampled": false,
    "partial": false,
    "incomplete_reasons": []
  },
  "observations": [],
  "findings": [],
  "recommendations": [],
  "artifacts": [],
  "warnings": []
}
```

Critical rule: partial, capped, filtered, sampled, omitted, or missing data must never be silently converted into zero or an all-clear.

Every finding should reference evidence IDs. Every recommendation should reference findings, declare whether approval is required, and name its pre-deploy and post-deploy verification capabilities.

## Release plan

## `0.4.0` — Google Intelligence

### Goal

Introduce the capability registry and run envelope, then turn raw GA4 and Search Console access into decisions an agent can use.

### Shared capability foundation

Implement before adding many reports:

- a registry shared by CLI and MCP;
- stable capability IDs, schemas, limits, costs, side-effect labels, and `do_not_claim` guidance;
- `capabilities list`, `capabilities describe`, and `capabilities run`;
- `evidence get`;
- the shared run envelope and coverage object;
- compatibility adapters for the existing direct MCP tools;
- schema fixtures that lock the CLI and MCP output contract together.

### Search Console primitives

Extend the current typed provider to support:

- dimensions and dimension filters;
- query, page, country, device, and search-appearance filters;
- web, image, video, news, Google News, and Discover types;
- `final`, `all`, and `hourly_all` data states;
- incomplete-date and incomplete-hour metadata;
- pagination through `startRow`;
- aggregation type;
- source-reported row limits;
- aligned comparison periods.

### Search Console commands

```bash
aitraffic gsc performance --days 28
aitraffic gsc compare --days 28
aitraffic gsc winners --days 28
aitraffic gsc opportunities --days 28
aitraffic gsc striking-distance --min-position 4 --max-position 20
aitraffic gsc cannibalization --days 90
aitraffic gsc decay --days 90
aitraffic gsc channels --days 28
aitraffic gsc inspect https://example.com/page
aitraffic gsc sitemaps list
aitraffic gsc sitemaps submit https://example.com/sitemap.xml --dry-run
aitraffic gsc genai status
aitraffic gsc genai import ./genai-export.csv
aitraffic gsc genai report
```

### GenAI Search Console boundary

Google launched dedicated generative-AI performance reports in June 2026 for a subset of properties. The report currently provides impressions by page, country, device, and date. The public Search Console API reference does not currently document a dedicated GenAI endpoint or filter.

Until a public API is documented:

- `gsc genai status` should report capability, not guess eligibility;
- `gsc genai import` should ingest the official UI export;
- imported rows should carry `source.method = search-console-ui-export`;
- normal Web Search data must not be relabeled as GenAI data;
- direct API support should be added behind capability detection when Google documents it.

### GA4 primitives

Add typed support for:

- metadata;
- compatibility checks;
- realtime reports;
- funnel reports;
- pivot and batch reports;
- quota snapshots;
- sampling metadata;
- thresholding/data-quality warnings;
- custom dimensions, metrics, and channel groups;
- key-event and revenue configuration discovery where available.

### GA4 commands

```bash
aitraffic ga4 acquisition --days 28
aitraffic ga4 ai-traffic --days 28
aitraffic ga4 ai-landing-pages --days 28
aitraffic ga4 conversions --days 28
aitraffic ga4 realtime
aitraffic ga4 funnel ./funnel.yaml
aitraffic ga4 metadata
aitraffic ga4 compatibility
aitraffic ga4 quota
aitraffic ga4 quality
```

`ga4 quality` should detect or explain:

- missing expected events;
- missing or changing key events;
- self-referrals;
- hostname anomalies;
- referral/source cardinality changes;
- duplicate-event risk when observable;
- thresholding, retention, consent, and property-configuration limitations;
- missing revenue values for purchase events;
- unrecognized AI referral domains without overwriting native GA4 values.

### Cross-source output

```bash
aitraffic opportunities --source google
aitraffic report acquisition --days 28
aitraffic report executive --days 28
aitraffic export --format json
aitraffic export --format csv
aitraffic export --format markdown
```

The first opportunity types should be:

- high-impression, low-CTR queries/pages;
- striking-distance queries;
- query/page winners and losers;
- sustained content decline;
- potential query cannibalization;
- high-search-visibility pages with weak engagement;
- AI-referral landing pages with key events or revenue;
- search landing pages with no observable GA4 activity;
- data-quality blockers that make conclusions unsafe.

### Acceptance criteria

- CLI shortcuts and generic capability runs call the same implementation.
- CLI and MCP expose the same input/output schemas for every registered capability.
- Partial, capped, filtered, sampled, omitted, or missing source data remains explicit in `coverage`.
- Every Google response includes method, property/site, period, collection time, freshness, and limitations.
- Search comparisons use equal inclusive periods.
- Fresh/hourly rows are marked incomplete where Google reports incomplete data.
- GSC top-row and anonymized-query limitations are always present.
- GA4 thresholding, retention, consent, sampling, and configuration caveats are preserved.
- No OAuth token, client secret, or authorization code appears in stdout, JSON, MCP, logs, or errors.
- All new commands support non-interactive JSON output.
- MCP schemas are bounded and read-only.
- Unit tests cover pagination, empty data, partial data, quota responses, invalid dimensions, and provider errors.

## `0.5.0` — Technical Site Evidence

### Goal

Produce a local, deterministic site inventory that can support technical SEO, AEO/GEO eligibility, and reviewable fixes.

### Implemented first slice

The local `0.5.0` slice intentionally starts with one bounded page rather than
claiming site-wide coverage:

```bash
aitraffic audit page https://example.com/page --format json
aitraffic page audit https://example.com/page --format json
aitraffic audit opportunities --limit 5 --format json
aitraffic capabilities run site.page_audit --url https://example.com/page --format json
```

It observes HTTP status and redirects, the applicable robots.txt decision,
static title and description, robots directives, canonicals, headings, links,
and JSON-LD parse status. The opportunity workflow selects unique pages from
the existing GSC/GA4 findings, retains their source finding references, and
audits at most the requested limit. A failed page remains an explicit partial
coverage item.

Security is part of the collector contract: only public HTTP(S) URLs on default
ports are accepted; credentials in URLs are rejected; every redirect target is
resolved and checked; mixed public/private DNS answers are blocked; DNS results
are pinned into the request; HTTPS downgrade and unrelated cross-host
redirects are rejected; and response time, bytes, decompression, and redirects
are bounded. Raw HTML and arbitrary response headers are not returned.

Rule wording follows primary documentation:

- [Google robots.txt documentation](https://developers.google.com/search/docs/crawling-indexing/robots/intro) and [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) define crawler access behavior; robots.txt is not reported as a deindexing mechanism.
- [Google robots meta documentation](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) supports direct `noindex` observations; intent is still reviewed before recommending a change.
- [Google canonical documentation](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) treats a declared canonical as a hint, so a missing self-canonical is not automatically failed.
- [Google title-link documentation](https://developers.google.com/search/docs/appearance/title-link) and [snippet documentation](https://developers.google.com/search/docs/appearance/snippet) support checking empty values without inventing universal character limits.
- [Google structured-data guidance](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) requires feature-specific validation; this slice reports JSON syntax and extracted types, not rich-result eligibility.

The current implementation deliberately does not flag H1 counts, heading
sequence, title/description length, keyword density, or missing schema as
ranking defects. It also does not claim orphan pages, broken destination links,
sitemap completeness, selected canonicals, indexing, rankings, or AI citation
eligibility from a single static fetch.

### Implemented bounded crawl (`0.5.1`)

The next local slice adds the shared `site.crawl` capability:

```bash
aitraffic crawl https://example.com --limit 25 --format json
aitraffic capabilities run site.crawl \
  --url https://example.com \
  --limit 25 \
  --format json
```

Discovery uses robots.txt sitemap declarations, an apex/www-scoped
`/sitemap.xml` fallback, XML sitemap indexes, XML URL sets, text sitemaps, and
static internal links. It reuses one robots response per origin, deduplicates
URLs without collapsing them onto canonicals, limits query variants, and
retains discovery source plus sitemap `lastmod` when present.

RSS and Atom feeds are valid Google sitemap formats but are not parsed in this
slice; they remain explicit unsupported-format coverage instead of being
silently treated as empty.

The output is intentionally compact for agents. Each page has a single
observation containing response and indexability state plus counts rather than
raw HTML, full link arrays, or every heading. Page findings are remapped to
that observation. Site rules cover only defensible relationships:

- sitemap-listed URL plus observed `noindex`;
- sitemap-listed URL declaring a different single canonical target;
- sitemap-listed URLs that redirect, without calling redirects inherently bad;
- duplicate non-empty titles within the audited set;
- extracted internal links whose exact audited target returned `4xx` or `5xx`;
- linked pages not observed in a successfully and completely parsed sitemap set;
- pages unlinked from other audited static pages only when the bounded crawl
  itself is complete, with an explicit “not proof of orphaning” limitation.

Primary-source boundaries come from the
[Sitemaps protocol](https://www.sitemaps.org/protocol.html),
[Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
[Google sitemap-index guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps),
and [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html). In particular:

- sitemap URLs must be absolute and are attempted exactly as listed;
- a protocol sitemap can contain at most 50,000 URLs and 50 MB uncompressed,
  while AItraffic deliberately applies a smaller configurable 10 MB safety cap;
- sitemap submission and inclusion are hints, not indexing guarantees;
- broader cross-site sitemap ownership cannot be verified by a local anonymous
  crawler, so this slice stays within exact apex/www host variants;
- partial, capped, unsupported, malformed, compressed-without-content-encoding,
  or failed sitemap inputs remain explicit coverage limitations.

### Commands

The commands below remain the expanded crawler roadmap. `crawl` is complete
locally; the report-specific shortcuts remain future aliases over the same
capability and evidence.

```bash
aitraffic crawl https://example.com --limit 500
aitraffic crawl https://example.com --sitemap auto
aitraffic audit technical
aitraffic audit indexability
aitraffic audit redirects
aitraffic audit canonicals
aitraffic audit onpage
aitraffic audit structured-data
aitraffic audit robots
aitraffic audit sitemap
aitraffic audit hreflang
aitraffic links broken
aitraffic links orphans
aitraffic links graph
aitraffic cwv check https://example.com
aitraffic cwv history https://example.com
```

### Deterministic collectors

The HTTP/static crawler should initially collect:

- requested URL, final URL, status, timing, and redirect chain;
- response content type and relevant headers;
- robots meta and `X-Robots-Tag`;
- declared canonical;
- title, meta description, headings, and visible textual content;
- internal and external links;
- link anchor and follow state;
- crawl depth and discovery source;
- sitemap membership;
- JSON-LD, Microdata, and RDFa when present in returned HTML;
- hreflang;
- images, alt text, dimensions, loading, and source sets;
- content hashes and near-duplicate inputs;
- structured errors and fetch limitations.

Rendered crawling should be optional and later:

```bash
aitraffic crawl https://example.com --render auto
```

The static audit must say `not observed in returned HTML`, not `missing`, when JavaScript rendering may change the result.

### Finding contract

Every finding should contain:

```json
{
  "finding_id": "finding_...",
  "rule_id": "canonical.redirect-target",
  "evidence_class": "observed",
  "status": "fail",
  "severity": "high",
  "confidence": 1,
  "scope": { "url": "https://example.com/page" },
  "evidence_ids": ["evidence_..."],
  "summary": "Declared canonical resolves through a redirect.",
  "limitations": [],
  "suggested_actions": []
}
```

Severity must not be marketed as a Google-supplied priority. It is an `aitraffic` operational priority with a published rule.

### Reuse decision

The Bhanunamikaze repository provides a valuable checklist of deterministic collectors, particularly:

- safe page fetching;
- HTML parsing;
- indexability matrix;
- robots path testing;
- sitemap validation;
- schema validation;
- internal links;
- finding verification;
- report generation.

Before reusing code:

1. review the exact script and transitive dependencies;
2. confirm the MIT license and retain attribution where required;
3. test SSRF, redirects, local/private addresses, decompression limits, and hostile HTML;
4. port the capability into strict TypeScript where it fits the existing runtime;
5. replace numeric scoring with evidence and rule severity;
6. write native tests and fixtures;
7. record the source commit in a NOTICE or provenance file.

### Acceptance criteria

- The crawler never follows a URL into a private/local network by default.
- Page content is treated as untrusted data and never as agent instructions.
- Crawl limits, depth, concurrency, timeout, redirect, and response-size limits are explicit.
- JSON output is stable and independent of terminal rendering.
- Repeated crawls produce comparable URL identities and hashes.
- Rendered and static results remain distinguishable.
- The CLI exits non-zero only for command failure unless `--fail-on` is explicitly used in CI.

## `0.6.0` — First-Party Agent Skills

### Goal

Make the deterministic CLI easy to invoke correctly from Codex and Claude Code.

### Canonical router skill

Maintain one portable source of truth rather than seven independent skills that can drift:

```text
skills/
  aitraffic/
    SKILL.md
    recipes/
      setup-check.md
      seo-audit.md
      gsc-opportunities.md
      ai-acquisition.md
      indexing-audit.md
      schema.md
      internal-links.md
      web-quality.md
      change-verification.md
    references/
      evidence-contract.md
      rule-catalog.md
      google-limitations.md
```

The router should use the capability registry:

```text
list -> describe -> run -> inspect coverage -> fetch cited evidence
     -> propose action -> approval -> apply -> verify
```

Optional discoverability aliases can be published later for high-intent searches such as `aitraffic-gsc-opportunities` or `aitraffic-ai-acquisition`, but they should only route to the canonical skill and must not duplicate instructions.

### Shared skill contract

Every first-party skill should:

1. state its triggers and when not to use it;
2. check `aitraffic doctor` or an equivalent MCP health tool;
3. use MCP first when registered, with CLI JSON as the fallback;
4. keep OAuth login and revoke human-run;
5. call deterministic collection before model interpretation;
6. cite evidence IDs and limitations;
7. separate observed, sampled, inferred, action, and unknown output;
8. avoid SEO guarantees;
9. prepare a dry-run or code diff before any write;
10. verify after a proposed fix;
11. avoid asking for information already available in the project;
12. return a compact summary plus machine-readable artifact paths.

### Installation UX

The existing `skills` CLI should distribute skills. `aitraffic` should not build a second skill package manager.

Target command after the skill folders are published:

```bash
npx skills add devanshug2307/aitraffic --skill aitraffic
```

`aitraffic onboard` should continue to install/register the MCP server. Skill installation is optional because an MCP client can use the tools without a prompt workflow.

### Agent experience

A user should be able to ask:

```text
Use AItraffic to find the best organic-search opportunities from the last
28 days, explain the evidence and limitations, and prepare reviewable changes
for the top three pages. Do not edit files until I approve.
```

The skill should then:

1. inspect Google connection health;
2. collect GSC and GA4 evidence;
3. produce typed opportunities;
4. inspect the affected pages when crawler support exists;
5. explain observed versus inferred results;
6. propose changes;
7. wait for approval before editing;
8. create a change annotation after approval;
9. offer later verification.

### Acceptance criteria

- The same prompt works in Codex and Claude Code.
- The skill never asks users to paste tokens.
- The skill does not invoke shell pipelines assembled from crawled content.
- Each recipe has happy-path, no-data, missing-connector, and provider-failure scenarios.
- Skill instructions and CLI schemas cannot silently drift; CI checks referenced command names.
- Installation is project-scoped by default in documentation.

### Implemented locally (`0.6.0`)

The canonical skill now lives at `skills/aitraffic/` with:

- a concise router in `SKILL.md`;
- setup, general SEO, Google opportunity, AI acquisition, indexing,
  structured-data, internal-link, static web-quality, and change-verification
  recipes;
- shared command, evidence, Google-limitation, and rule-catalog references;
- MCP-first routing with exact CLI JSON fallbacks;
- explicit unauthenticated degradation to `site.page_audit` and `site.crawl`;
- human-only OAuth and approval-required write boundaries;
- automated checks for broken local references, stale capability IDs, unknown
  MCP tools, placeholder text, and invented commands.

The npm package includes the skill folder for inspection and offline reuse.
GitHub installation remains the recommended path for the `skills` CLI.

### Implemented unified audit (`0.6.1`)

The `site.full_audit` capability and `aitraffic audit <URL>` command now
compose existing collectors rather than duplicating their rules:

```bash
aitraffic audit https://example.com --google auto --top 10 --format json
aitraffic capabilities run site.full_audit \
  --url https://example.com \
  --google required \
  --opportunity-limit 5 \
  --focus indexing \
  --format json
```

The technical crawl always runs. Google `auto` adds opportunity and
priority-page evidence only when a complete selected profile exists and the
Search Console property covers the audited URL. Missing, mismatched, or failed
optional Google evidence produces a labeled technical-only report;
`--google required` fails instead. GA4 property-to-domain ownership remains an
explicit unknown.

The unified result:

- retains component run IDs and coverage;
- deduplicates observations, findings, recommendations, and sources by ID;
- reuses identical page fetches during the same run;
- ranks a bounded top list while retaining every raw finding;
- supports all, indexing, internal-link, or structured-data focus without
  changing collection;
- explains the impact basis and confidence for every prioritized item;
- reports implementation effort as unknown until code or CMS inspection;
- never presents the operational order as a Google score, ranking forecast, or
  traffic guarantee.

## `0.7.0` — Opportunity Queue and Change Verification

### Goal

Connect evidence to prioritization, reviewable action, and later outcome measurement.

### Implemented local history foundation

The first `0.7.0` slice implements the evidence baseline needed for honest
verification:

```bash
aitraffic audit https://example.com --save --format json
aitraffic audit history --format json
aitraffic audit show RUN_ID --format json
aitraffic audit compare OLDER_RUN_ID NEWER_RUN_ID --format json
aitraffic audit compare --latest --format json
```

Saving is opt-in and CLI-only. Atomic private files under
`.aitraffic/runs/` retain compact observations, configuration, coverage,
findings, and provenance without raw HTML or credentials. Comparison uses
stable rule-and-scope identities. Page findings can be marked resolved only
when the page is re-observed; site-level findings require matching complete
coverage. A URL absent from the newer bounded crawl is `notObservedInNewer`,
not removed. Google movement is withheld unless resources, period lengths, and
source coverage are comparable.

### Implemented opportunity queue

```bash
aitraffic opportunities sync --latest --dry-run --format json
aitraffic opportunities sync --latest --format json
aitraffic opportunities list --format json
aitraffic opportunities explain OPP_ID --format json
aitraffic opportunities update OPP_ID --status planned --reason "REASON" --dry-run --format json
```

The queue uses deterministic IDs across audit runs, increments occurrences for
recurring findings, and stores bounded history privately under
`.aitraffic/opportunities/`. Human workflow status is separate from evidence
state. Only comparable deterministic technical evidence assigns `verified`;
partial scope produces `unknown`, and Google disappearance produces
`not_observed`. Sync is idempotent per run and rejects chronological rollback.

### Implemented opportunity schema

```json
{
  "id": "opp_...",
  "source": "technical",
  "kind": "TITLE_NOT_OBSERVED_STATIC_HTML_V1",
  "generator": {
    "id": "technical-finding-queue",
    "version": "1.0.0",
    "sourceRule": "TITLE_NOT_OBSERVED_STATIC_HTML_V1"
  },
  "site": "https://example.com/",
  "scope": {
    "urls": ["https://example.com/page"],
    "query": null
  },
  "status": "planned",
  "observationState": "present",
  "priority": "medium",
  "confidence": {
    "label": "high",
    "basis": "Deterministic rule over observed static evidence."
  },
  "impact": {
    "basis": "Deterministic technical severity and rule."
  },
  "effort": {
    "label": "unknown",
    "basis": "Repository or CMS implementation was not inspected."
  },
  "evidence": {
    "latestRunId": "run_...",
    "evidenceRefs": ["ev_..."],
    "occurrences": 2
  }
}
```

### Deferred change-record commands

```bash
aitraffic change propose OPP_ID --dry-run
aitraffic change record --url URL --type title-update
aitraffic change verify CHANGE_ID --after 28d
```

### Verification boundary

Before/after movement is an observed association, not automatic proof of causality. Reports should include:

- change time and content hash;
- comparable pre/post windows;
- day-of-week and incomplete-data handling;
- related sitewide or external changes when known;
- control pages or queries when configured;
- confidence and limitations;
- `associated with`, never `caused`, unless the experiment design supports the claim.

## `0.8.0` — Reproducible GEO/AEO Observation

### Goal

Measure sampled AI visibility without pretending an assistant has one stable ranking.

### Commands

```bash
aitraffic prompts init
aitraffic prompts import ./prompts.csv
aitraffic prompts run --panel buyer-intent --repeat 3 --provider PROVIDER
aitraffic citations report --panel buyer-intent
aitraffic visibility compare --competitors competitors.txt
aitraffic visibility stability --panel buyer-intent
```

### Required provenance

Every answer sample should record:

- provider;
- consumer browser versus provider API versus search API proxy;
- model or surface when observable;
- authenticated/account state when relevant;
- prompt ID and exact prompt text hash;
- locale, country, and device context;
- collection timestamp;
- repetition number;
- raw response hash;
- extracted mentions, citations, source URLs, and recommendation position;
- extraction version;
- errors and refusals.

The report should distinguish:

- retrieved source;
- linked citation;
- unlinked mention;
- recommended brand/product;
- observed AI referral;
- later conversion.

These are different events and must not be joined as a deterministic funnel without a shared identifier.

### Public-skill lessons

Adapt:

- citation-versus-recommendation separation;
- prompt panels;
- competitor/source gaps;
- raw-answer retention;
- rerun inputs;
- no-result reports that remain useful.

Reject:

- one-run visibility scores;
- modeled traffic presented as observed traffic;
- citation claims without raw response provenance;
- hidden paid API dependencies;
- guarantees that content changes will earn citations.

## `0.9.0` — Reviewable Actions and Programmatic SEO

### Goal

Allow agents to prepare safe code/content changes while preserving human review.

### Commands

```bash
aitraffic content brief URL --query QUERY
aitraffic content metadata URL --dry-run
aitraffic links suggest URL
aitraffic links fix URL --dry-run
aitraffic schema generate URL --type TYPE --dry-run
aitraffic schema fix URL --dry-run
aitraffic programmatic plan ./dataset.csv
aitraffic programmatic validate ./plan.yaml
aitraffic programmatic preview ./plan.yaml --pages 5
aitraffic ci audit --fail-on critical
```

### Programmatic SEO quality gates

The workflow should refuse or warn when:

- pages differ only by a keyword/token substitution;
- required data is missing or fabricated;
- pages do not serve distinct search intent;
- internal navigation cannot expose the pages;
- canonicals, sitemap policy, or noindex policy is unresolved;
- the page count exceeds an explicit approved limit;
- content has no unique first-party value;
- the output resembles doorway pages or scaled-content abuse;
- generation would overwrite user files without a diff.

### Approval model

- Collection: read-only and non-interactive.
- Analysis: read-only and non-interactive.
- Proposal: writes only to an explicit artifact/diff path.
- Apply: explicit confirmation or approved agent action.
- External submission: separate write scope and confirmation.
- Verification: read-only.

## Skill supply-chain policy

### Discovery

`find-skills` is already installed. Use it for research:

```bash
npx skills find "seo audit"
npx skills find "technical seo"
npx skills find "google search console"
npx skills find "GA4 analytics"
npx skills find "AI SEO GEO AEO"
npx skills find "programmatic seo"
npx skills find "core web vitals"
```

Do not install every search result.

For a disposable, project-scoped reference environment, the reviewed candidates are:

```bash
npx skills add https://github.com/google/skills --skill google-analytics-data-api-basics
npx skills add https://github.com/google/skills --skill google-analytics-admin-api-basics
npx skills add https://github.com/coreyhaines31/marketingskills --skill seo-audit
npx skills add https://github.com/coreyhaines31/marketingskills --skill ai-seo
npx skills add https://github.com/coreyhaines31/marketingskills --skill programmatic-seo
npx skills add https://github.com/addyosmani/web-quality-skills --skill seo
npx skills add https://github.com/addyosmani/web-quality-skills --skill core-web-vitals
npx skills add https://github.com/addyosmani/web-quality-skills --skill web-quality-audit
npx skills add https://github.com/firecrawl/firecrawl-workflows --skill firecrawl-seo-audit
```

These commands are for inspectable playbook/reference use. Installing them does not authorize `aitraffic` to execute their scripts, use their auth instructions, or treat their claims as evidence.

### Evaluation checklist

Before recommending or adapting a public skill, record:

- repository and exact commit;
- skill path and version;
- install count snapshot;
- repository stars and maintenance date;
- license and attribution requirements;
- scripts and executable files;
- network destinations;
- environment variables and secret access;
- files the skill can read or write;
- external paid services;
- destructive actions;
- unsupported SEO or platform claims;
- whether official documentation supports the workflow;
- test coverage;
- adaptation decision.

### Runtime rules

1. No remote `SKILL.md` fetching during an audit.
2. No arbitrary third-party skill execution inside the `aitraffic` process.
3. No secrets in skill prompts, CLI arguments, reports, or MCP results.
4. No skill access to the credential vault.
5. No shell command built from crawled page content.
6. No unbounded crawl, recursive file access, or network fan-out.
7. Optional connectors must declare network destinations and cost.
8. Vendored or ported code must preserve license notices and source provenance.
9. Dependencies should be pinned through the normal package lock.
10. First-party skills should reference stable CLI/MCP contracts, not internal files.

### License policy

- MIT, ISC, BSD, and Apache-2.0 material can be evaluated for reuse with attribution and notice handling.
- GPL or AGPL code must not be copied into the Apache-2.0 package without a deliberate compatibility decision.
- A public GitHub repository with no license is reference-only.
- Prompt ideas and broad workflows can inspire original implementation, but substantial copied text still requires license compliance and attribution.
- Every reused deterministic rule should prefer the official specification as its normative source.

## Official-source truth boundaries

The product and first-party skills should encode these rules:

1. Google says foundational SEO remains relevant to AI Overviews and AI Mode; no special schema or AI file is required.
2. The dedicated Search Console GenAI report is a limited rollout and currently has a UI export path; public API support must be capability-detected.
3. Search Analytics returns top rows and can omit anonymized queries.
4. Search Analytics fresh/hourly data can be incomplete.
5. URL Inspection API reports Google's indexed view and does not run the live inspection test.
6. Sitemap submission does not guarantee crawling or indexing.
7. Structured data enables understanding and possible rich-result eligibility; it does not guarantee display.
8. FAQ rich results stopped appearing in May 2026 and corresponding API appearance support is scheduled for deprecation in August 2026.
9. GA4 reports are affected by property configuration, consent, retention, thresholding, cardinality, and sometimes sampling.
10. GA4 AI Assistants and AI referral domains do not include all AI influence.
11. Google AI Overviews and AI Mode can be represented inside ordinary organic-search behavior and must not be relabeled as assistant referrals.
12. Core Web Vitals are user-experience/search signals, not a complete ranking formula.
13. E-E-A-T is a useful quality framework, not a public numeric Google score.
14. `llms.txt`, OKF, MCP, A2A, and WebMCP have specific interoperability purposes and are not ranking guarantees.

Primary references:

- [Google AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google Generative AI performance report announcement](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)
- [Search Console GenAI report help](https://support.google.com/webmasters/answer/16984139)
- [Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- [Search Console API reference](https://developers.google.com/webmaster-tools/v1/api_reference_index)
- [GA4 Data API](https://developers.google.com/analytics/devguides/reporting/data/v1/rest)
- [GA4 quotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas)
- [GA4 API schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
- [GA4 funnel reports](https://developers.google.com/analytics/devguides/reporting/data/v1/funnels)
- [Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Schema.org](https://schema.org/docs/schemas.html)
- [Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds)

## Ordered implementation backlog

| Order | Work item | Release | Value | Effort | Risk |
|---:|---|---|---|---|---|
| 1 | Define the shared capability registry and CLI/MCP contract | 0.4 | High | Medium | Low |
| 2 | Add the capability run envelope, coverage object, and evidence retrieval | 0.4 | High | Medium | Medium |
| 3 | Extend typed GSC filters, types, pagination, and freshness metadata | 0.4 | High | Medium | Medium |
| 4 | Add GSC aligned comparison primitive | 0.4 | High | Small | Low |
| 5 | Add low-CTR and striking-distance opportunities | 0.4 | High | Small | Low |
| 6 | Add winners/losers, decay, and cannibalization | 0.4 | High | Medium | Medium |
| 7 | Add URL Inspection read-only workflow | 0.4 | High | Small | Low |
| 8 | Add sitemap listing and dry-run submission | 0.4 | Medium | Small | Medium |
| 9 | Add GA4 metadata, compatibility, quota, and sampling support | 0.4 | High | Medium | Medium |
| 10 | Add AI landing-page, key-event, and revenue reports | 0.4 | High | Medium | Medium |
| 11 | Add GA4 data-quality diagnostics | 0.4 | High | Medium | Medium |
| 12 | Add GenAI capability status and UI export import | 0.4 | High | Medium | High platform-change risk |
| 13 | Define rule and finding schemas | 0.5 | High | Small | Low |
| 14 | Build safe bounded static crawler | 0.5 | High | Large | High |
| 15 | Add robots, sitemap, redirect, canonical, and indexability audits | 0.5 | High | Medium | Medium |
| 16 | Add on-page, schema, image, hreflang, and link collectors | 0.5 | High | Large | Medium |
| 17 | Add PageSpeed/CrUX support | 0.5 | Medium | Medium | Medium |
| 18 | Publish the canonical first-party router skill and recipes | 0.6 | High | Medium | Medium |
| 19 | Add CLI/skill contract tests for Codex and Claude Code | 0.6 | High | Medium | Low |
| 20 | Add local evidence history and stable IDs | 0.7 | High | Large | Medium |
| 21 | Add unified opportunity queue | 0.7 | High | Medium | Medium |
| 22 | Add change annotations and verification | 0.7 | High | Large | High interpretation risk |
| 23 | Add BYOK prompt panel with raw provenance | 0.8 | High | Large | High cost/volatility |
| 24 | Add citation, mention, recommendation, and stability reports | 0.8 | High | Large | High methodology risk |
| 25 | Add reviewable metadata/schema/internal-link changes | 0.9 | High | Medium | Medium |
| 26 | Add programmatic SEO planning and quality gates | 0.9 | Medium | Large | High spam/policy risk |
| 27 | Add CI regression mode | 0.9 | High | Medium | Low |

## Definition of done

This public-skill research is successfully converted into product value when:

1. no third-party skill is required for core GA4, GSC, crawler, or evidence behavior;
2. each adapted capability names its official normative source;
3. reused code has a recorded license and source commit;
4. each CLI result is stable JSON with provenance and limitations;
5. Codex and Claude Code can run the same workflow through MCP or CLI;
6. credentials stay in the local vault and never enter model context;
7. every inferred recommendation points to observed or sampled evidence;
8. every write has an approval and dry-run path;
9. every applied change can be annotated and later checked;
10. the product never promises ranking, citation, indexing, or causal revenue.

## Immediate next action

Start `0.4.0` with the capability/evidence contract and shared Google query primitives rather than writing skill files first:

```text
capability registry and run envelope
    -> typed Google requests
    -> deterministic analyses
    -> stable CLI JSON
    -> compact MCP surface
    -> canonical first-party skill
```

The first implementation slice should contain:

1. Capability registry, `list/describe/run`, and compatibility shortcuts.
2. Run envelope, coverage object, stable evidence IDs, and `evidence get`.
3. GSC filters, paging, search type, freshness, and aligned periods.
4. GSC low-CTR, striking-distance, winners/losers, and cannibalization.
5. URL Inspection and sitemap listing.
6. GA4 metadata, AI landing pages, key events, revenue, and quality warnings.
7. GenAI capability status and official export import.
8. One unified Google opportunity report.

That slice produces direct value in the terminal and gives every later public-inspired skill a trustworthy engine to call.
