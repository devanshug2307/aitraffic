# AItraffic Project Status

> Current implementation status and active priority order  
> Last reconciled: 2026-08-02
> Repository package version: `0.8.0`

This document is the source of truth for what AItraffic has shipped, what is
being validated, and what should be built next. Research documents retain their
original snapshots and version proposals for provenance, but their unchecked
items and “immediate next” sections do not override this status.

## Status definitions

- **Shipped** means the capability exists in this repository and has automated
  coverage appropriate to its current local-first scope.
- **Validate now** means the current product loop should be tested on real sites
  before expanding the feature surface.
- **Next** means an approved priority, not a promise that implementation has
  started.
- **Deferred** means deliberately excluded from the current local-first release
  sequence.
- **Research only** means an idea or market possibility, not a committed
  feature.

## Product direction

AItraffic is a terminal-first evidence and action layer for humans, Codex,
Claude Code, CI, and MCP-compatible agents.

For the current beta, AItraffic is a **TrafficClaw product**. TrafficClaw is
the Google OAuth consent and data-processing identity; AItraffic remains the
terminal-first product surface. This does not turn the local CLI into a hosted
connector or relax its local credential and read-only boundaries.

The core workflow is:

```text
connect → observe → diagnose → approve action → record change → verify → report
```

Every result must distinguish observed, sampled, inferred, and unknown
evidence. AItraffic must not promise rankings, indexing, citations, traffic, or
causal revenue.

## Shipped

### Terminal and agent foundation

- Human-readable CLI output and stable JSON output.
- Capability registry, run envelopes, evidence references, provenance,
  coverage, warnings, and limitations.
- Guided onboarding for Codex, Claude Code, Hermes, and OpenClaw.
- Non-interactive onboarding inspection for agents and CI.
- Project initialization and `doctor` diagnostics.
- Codex and Claude Code registration drift detection with semantic local-path
  matching, secret-redacted diagnostics, reviewable dry runs, explicit
  confirmation, post-repair verification, and safe rollback.
- Local read-only MCP server.
- First-party AItraffic skill with evidence-first recipes.

### Google connector

- Native local Google OAuth using PKCE and state validation.
- One-command TrafficClaw Desktop OAuth setup for fresh local CLI users, with
  the Google tokens retained in OS credential storage.
- Imported OAuth client configuration without bundling a client secret in npm.
- Named Google profiles, refresh, status, and revoke.
- OS credential-store persistence with no plaintext-token fallback.
- Explicit GA4 property and Search Console site selection.
- Typed read-only GA4 and Search Console reports with paging metadata.
- Equal-period AI/search acquisition analysis.
- Google opportunity analysis joining Search Console demand with GA4 landing
  outcomes.

### Technical observation

- Local web-log import and AI crawler/user-agent classification.
- Bounded public-page static audit.
- Bounded sitemap and same-site static-link crawl.
- Priority-page audits selected from Google opportunities.
- Unified technical and optional Google evidence audit.
- Explicit handling of partial, capped, filtered, failed, and unavailable data.
- Fragment-normalized page analysis and semantic content hashing that excludes
  volatile executable scripts while retaining visible and structured content.
- Summary-first terminal output with explicit `--verbose` expansion and
  complete stable JSON output.

### History and opportunity workflow

- Private project-local saved audit runs.
- Coverage-aware comparison of compatible audit runs.
- Durable project-local opportunity queue with stable IDs.
- Private local change records linked to opportunities, URLs, implementation
  references, content hashes, and later queue verification state.
- Dry-run synchronization from saved audits.
- Human workflow states: `open`, `planned`, and `dismissed`.
- Evidence states that remain separate from workflow state.
- Deterministic technical verification from comparable later audits.
- Read-only MCP tools to list and explain synchronized opportunities.

## Validate now

Run the complete workflow on at least three to five real sites:

```text
onboard
  → connect/select Google resources
  → run and save an audit
  → synchronize opportunities
  → review and plan one opportunity
  → make the change outside AItraffic
  → run a comparable later audit
  → inspect the verification result
```

Record:

- time to first useful evidence;
- onboarding or MCP registration failures;
- false positives and misleading priorities;
- incomplete-data warnings users overlook;
- opportunities moved from `open` to `planned`;
- planned opportunities that receive a comparable re-audit;
- whether the result changes a real technical or content decision.

Do not use feature count as the validation metric. The useful product signal is
verified, evidence-backed work completed per active site.

The first repeatability run is recorded in
[Agentpedia live validation](case-studies/agentpedia-live-validation.md). It
validated 25 stable page comparisons, zero technical false positives, partial
Google comparison semantics, and idempotent opportunity synchronization. This
is one scenario, not completion of the three-to-five-site validation target.

The second run is recorded in
[TrafficClaw live validation](case-studies/trafficclaw-live-validation.md). It
validated connector reuse and queue idempotence, and exposed automatically
discovered Cloudflare/authentication utility routes that are now excluded from
SEO page findings.

## Active priority order

### 1. Google measurement-health diagnostics

Before interpreting business outcomes, report:

- GA4 property timezone and relevant metadata;
- whether key events and revenue fields are configured or merely observed as
  zero;
- partial, capped, thresholded, or otherwise incomplete responses;
- native GA4 AI-assistant classification separately from AItraffic
  registry-matched sources;
- mismatched GA4 and Search Console resource scope.

Unknown or unconfigured measurement must never become a conclusion of “no
conversions” or “no revenue.”

### 2. Read-only Search Console URL Inspection

Inspect only user-selected or opportunity-selected URLs. Preserve the
inspection timestamp, selected property, indexed canonical, coverage result,
last crawl information, and provider limitations.

Treat this as information about Google’s indexed version. Do not describe it as
a live URL test or an indexing guarantee.

### 3. Redacted report export

Export saved investigations as stable JSON and readable Markdown. Default to
redacting profile labels, property IDs, queries, and page URLs from shareable
artifacts, with explicit opt-in inclusion.

### 4. Reproducible GEO/AEO observation

Begin with BYOK or manually collected observation import before automated
multi-provider execution. Preserve provider/surface, prompt hash, locale,
timestamp, repetition, raw response hash, citations, mentions, extraction
version, errors, and refusals.

Report variance and sampling limits instead of manufacturing a universal “AI
ranking.”

### 5. Reviewable change proposals

Only after change records are stable, allow agents to prepare minimal metadata,
structured-data, internal-link, or content diffs. Keep every proposal
reviewable, dry-run first, reversible, and outside automatic publishing.

### 6. Hosted product work

Hosted OAuth, scheduling, remote MCP, teams, dashboards, billing, and long-term
history follow demonstrated recurring local usage. They require privacy terms,
Google verification, encrypted tenant-scoped token storage, deletion controls,
key rotation, incident response, and audited tenant isolation.

## Deferred

- Autonomous editing or publishing.
- Programmatic SEO generation.
- Unbounded or default rendered crawling.
- Web-scale backlink and keyword-volume databases.
- A broad product-analytics replacement.
- Remote write-enabled MCP tools.
- Expensive continuous multi-provider prompt monitoring.
- A single opaque SEO, GEO, AEO, or “AI readiness” score.
- `llms.txt` presented as a ranking or citation mechanism.
- A connector or skill marketplace before repeat usage and security review.

These may be revisited only when real user evidence identifies a concrete gap.

## Release gate for the next implementation slice

A slice is complete only when:

1. the user problem and expected decision are explicit;
2. CLI text and stable JSON behavior are documented;
3. Codex and Claude Code can use it through CLI or an intentionally small MCP
   surface;
4. source coverage, freshness, and limitations remain visible;
5. secrets and crawled content cannot become trusted agent instructions;
6. writes have a dry-run and explicit approval boundary;
7. targeted tests and the complete package check pass;
8. the README, first-party skill, and this status document agree.

## Historical planning documents

These remain useful research and design records:

- [Research roadmap and validation](research/08-roadmap-and-validation.md)
- [Public skills integration plan](research/10-public-skills-integration-plan.md)
- [Onboarding roadmap](product/onboarding-roadmap.md)
- [Agentpedia live validation](case-studies/agentpedia-live-validation.md)
- [TrafficClaw live validation](case-studies/trafficclaw-live-validation.md)

Their old version numbers and immediate-action sections are historical. Use the
active priority order above for current implementation decisions.
