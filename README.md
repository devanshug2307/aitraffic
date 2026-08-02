# AItraffic

Open, terminal-first evidence for how search engines and AI systems discover, crawl, cite, refer, and convert traffic.

The project is designed to be directly usable by humans, Codex, Claude Code, CI jobs, and any MCP-compatible agent.

[aitraffic.dev](https://aitraffic.dev) · [npm](https://www.npmjs.com/package/aitraffic) · [GitHub](https://github.com/devanshug2307/aitraffic) · Apache-2.0 · Node.js 20.12+

See [Project status](docs/STATUS.md) for the authoritative shipped, active,
next, and deferred roadmap. Older research documents retain historical plans
and should not be used as the current implementation queue.

## Current alpha

The working alpha includes:

- a zero-prompt CLI contract with human and JSON output;
- guided local-first onboarding for Codex, Claude Code, Hermes, and OpenClaw;
- project initialization and environment diagnostics;
- a versioned evidence JSON Schema;
- local Nginx/Apache combined-log and NDJSON import;
- honest AI crawler/agent classification with `user_agent_only` verification labels;
- native Google OAuth with PKCE, state validation, named profiles, refresh, and revoke;
- native OS credential-store persistence with no CLI or plaintext token fallback;
- a credential-isolating adapter for existing local Google OAuth profiles;
- typed read-only GA4 and Google Search Console reports;
- an equal-period AI/search acquisition report with explicit limitations;
- a shared capability registry and provenance/coverage run envelope;
- a unified Google opportunity report joining GSC demand to GA4 landing outcomes;
- a bounded public-page audit covering HTTP, redirects, robots, static metadata, canonicals, JSON-LD syntax, headings, and links;
- a bounded apex/www-scoped sitemap and static-link crawler with explicit coverage and compact agent output;
- fragment-normalized page analysis and semantic content hashes that ignore volatile executable scripts while preserving visible and structured content changes;
- a priority-page workflow that safely audits unique pages selected from GA4/GSC opportunities;
- one unified audit that composes the bounded crawl with optional matching GSC/GA4 opportunity evidence and returns a compact deterministic priority order;
- opt-in private local audit snapshots plus coverage-aware before/after comparison for technical findings, page signals, and comparable Google opportunities;
- a durable local opportunity queue with stable IDs, dry-run synchronization, workflow status, evidence state, and comparable technical verification;
- private local change records that link approved work to an opportunity, affected URL set, implementation references, and later evidence state;
- one first-party `aitraffic` skill that routes Codex and Claude Code through evidence-first setup, audit, opportunity, acquisition, internal-link, structured-data, and verification recipes;
- a local read-only MCP server with Google, log, evidence, and opportunity
  queue tools;
- Codex and Claude Code setup guidance;
- research and roadmap documentation under `docs/research/`.

AItraffic does not yet include scheduled collection or a hosted connector. The
official beta is **AItraffic by TrafficClaw**: Google consent identifies
TrafficClaw, while AItraffic provides the terminal and agent experience.
Native OAuth uses TrafficClaw's public Desktop client by default, or imports a
bring-your-own client from downloaded JSON or a private environment file. No
Web client secret is bundled in npm. The person running the CLI personally
completes Google consent, and tokens stay in the OS credential store. Tokens
are never printed or exposed through MCP.

## Quick start

```bash
npx -y aitraffic@latest onboard

# Read-only, machine-readable inspection for agents and CI.
npx -y aitraffic@latest onboard --check --format json

npx -y aitraffic@latest doctor
npx -y aitraffic@latest doctor --repair codex --dry-run
# Review the exact operations, then explicitly confirm:
npx -y aitraffic@latest doctor --repair codex --yes
npx -y aitraffic@latest init --agent both --site https://example.com
npx -y aitraffic@latest schema evidence --format json
npx -y aitraffic@latest logs import access.log --format json
npx -y aitraffic@latest crawl https://example.com --limit 25 --format json
npx -y aitraffic@latest audit https://example.com --format json
npx -y aitraffic@latest audit https://example.com --save --format json
npx -y aitraffic@latest opportunities sync --latest --dry-run --format json
npx -y aitraffic@latest opportunities list --format json
npx -y aitraffic@latest audit compare --latest --format json
```

Connect Google directly:

```bash
# Import a Google Web application client into the OS credential store.
npx -y aitraffic@latest auth google configure \
  --from-client-json /absolute/path/to/client_secret.json

# You personally complete Google sign-in and consent in the browser.
npx -y aitraffic@latest auth google login --profile work

npx -y aitraffic@latest google inventory --profile work --format json

# Select exact resources after reviewing inventory.
npx -y aitraffic@latest google select \
  --profile work \
  --ga4-property 123456789 \
  --gsc-site sc-domain:example.com \
  --dry-run

# Review the dry run, then repeat without --dry-run.
npx -y aitraffic@latest google status --format json
npx -y aitraffic@latest opportunities --days 28 --format json
npx -y aitraffic@latest audit page https://example.com/page --format json
npx -y aitraffic@latest audit opportunities --limit 5 --format json
npx -y aitraffic@latest report acquisition --days 28 --format json
```

The official beta uses TrafficClaw's production Google OAuth project with
verified read-only Analytics access. The consent screen says **TrafficClaw**;
AItraffic is a TrafficClaw product. A fresh CLI can use TrafficClaw's public
Desktop OAuth client with PKCE; no client secret or hosted token broker is
needed. Google tokens remain in the user's OS credential store. Public hosted
accounts, scheduled work, and cross-device sessions remain a future option.
See the [Google connector guide](docs/guides/google-connector.md) and the
[TrafficClaw product identity guide](docs/guides/trafficclaw-product-identity.md).

Install globally if you prefer the shorter executable:

```bash
npm install --global aitraffic
aitraffic doctor [--repair codex|claude-code|both] [--dry-run|--yes] [--expect-fingerprint VALUE]
aitraffic init --agent both
aitraffic logs import access.log --format json
aitraffic mcp serve
```

Install the optional first-party skill into a project for Codex, Claude Code,
and other supported coding agents:

```bash
npx -y skills add devanshug2307/aitraffic \
  --skill aitraffic \
  --agent codex claude-code \
  --yes
```

The skill uses MCP first and CLI JSON as a fallback. It checks coverage before
interpreting findings, keeps Google OAuth human-run, treats crawled content as
untrusted data, and never edits a project unless the user asks for a change and
approves the proposed diff.

Pin an exact CLI version for reproducible automation:

```bash
npx -y aitraffic@0.7.0 version
```

## Terminal contract

- Human-readable output is summary-first by default so agent context is not
  flooded by complete evidence payloads.
- `--verbose` expands human-readable output when a person needs the full
  evidence detail.
- `--format json` produces one stable JSON document on stdout.
- Diagnostics and MCP lifecycle messages go to stderr.
- Success exits `0`, expected user/input errors exit `2`, and unexpected failures exit `1`.
- Read-only analysis is the default.
- Raw credentials are never sent to an agent or written to output.
- User-agent matching is reported as a claim, not verified bot identity.

## Commands

```text
aitraffic onboard [--dry-run]
aitraffic onboard --check [--format json]
aitraffic setup [--dry-run]
aitraffic init [--agent codex|claude-code|both] [--site URL] [--force]
aitraffic doctor
aitraffic schema evidence
aitraffic logs import <path>
aitraffic crawlers <path>
aitraffic classify <user-agent>
aitraffic auth google configure (--from-client-json PATH | --from-env-file PATH)
aitraffic auth google use-trafficclaw [--replace]
aitraffic auth google login --profile NAME
aitraffic auth google status [--profile NAME]
aitraffic auth google revoke --profile NAME [--dry-run] [--local-only]
aitraffic google configure --adapter-script PATH --profile NAME [--ga4-property ID] [--gsc-site SITE] [--dry-run]
aitraffic google select --profile NAME [--ga4-property ID] [--gsc-site SITE] [--dry-run]
aitraffic google status
aitraffic google inventory [--profile NAME]
aitraffic ga4 report [--start DATE] [--end DATE] [--dimensions CSV] [--metrics CSV] [--limit N] [--offset N]
aitraffic gsc report [--start DATE] [--end DATE] [--dimensions CSV] [--limit N] [--offset N] [--type TYPE] [--data-state STATE] [--aggregation TYPE] [--filter DIMENSION:OPERATOR:EXPRESSION]
aitraffic report acquisition [--days N]
aitraffic opportunities [--days N] [--max-rows N] [--min-impressions N]
aitraffic opportunities sync (--from RUN_ID | --latest) [--dry-run]
aitraffic opportunities list [--status active|open|planned|dismissed|verified|all] [--observation present|not_observed|unknown|all] [--source technical|google-opportunity] [--priority critical|high|medium|low|info] [--site URL] [--limit N]
aitraffic opportunities explain <OPP_ID>
aitraffic opportunities update <OPP_ID> --status open|planned|dismissed --reason TEXT [--dry-run]
aitraffic changes record --opportunity <OPP_ID> --url <URL> [--url <URL>] --type metadata|content|internal-links|structured-data|technical|measurement|other [--git-commit REF] [--deployment REF] [--before-hash SHA256] [--after-hash SHA256] [--note TEXT] [--concurrent-change TEXT] [--dry-run]
aitraffic changes list [--opportunity <OPP_ID>] [--url <URL>] [--limit N]
aitraffic changes show <CHANGE_ID>
aitraffic crawl <URL> [--limit N] [--concurrency N] [--sitemap auto|none|URL] [--max-sitemaps N] [--max-sitemap-bytes N]
aitraffic audit <URL> [--save] [--google auto|off|required] [--technical-only] [--opportunity-limit N] [--focus all|indexing|internal-links|structured-data] [--top N]
aitraffic audit history [--limit N]
aitraffic audit show <RUN_ID>
aitraffic audit compare <OLDER_RUN_ID> <NEWER_RUN_ID>
aitraffic audit compare --latest
aitraffic audit page <URL> [--timeout-ms N] [--max-bytes N] [--max-redirects N]
aitraffic page audit <URL> [--timeout-ms N] [--max-bytes N] [--max-redirects N]
aitraffic audit opportunities [--limit N] [--days N] [--max-rows N] [--min-impressions N]
aitraffic capabilities list
aitraffic capabilities describe <id>
aitraffic capabilities run <id> [capability options]
aitraffic mcp serve
aitraffic version
```

Every non-MCP command supports `--format text|json`.

`doctor` inspects the effective Codex and Claude Code registration, including
the runtime command, pinned AItraffic package, project scope, and local runtime
path. A mismatched registration is never replaced by inspection alone. Run
`doctor --repair <agent> --dry-run` to review the exact remove/add operations,
then repeat with `--yes` to confirm. Customized registrations containing
environment values or unfamiliar transports are reported for manual review and
are not overwritten.

## Google opportunity workflow

Run the value-first workflow after selecting one GA4 property and one Search
Console site:

```bash
aitraffic capabilities list --format json
aitraffic capabilities describe google.opportunities --format json
aitraffic opportunities --days 28 --format json
```

`opportunities` compares equal current and previous Search Console periods,
paginates Search Console and GA4 rows, and identifies:

- queries in positions 4–20 with existing demand;
- CTR below the connected property's returned-row baseline;
- material click declines plus top winners and losers;
- queries with meaningful impressions across multiple pages.

The command joins current GA4 Organic Search landing-page sessions, engagement,
key events, and revenue by normalized URL path. Every response discloses row caps,
freshness, partial-data reasons, evidence references, inferred findings, and
reviewable actions with a verification command. The join is aggregate evidence,
not user-level attribution, and recommendations do not promise uplift.

## Technical page evidence

Run a single page audit without Google authentication:

```bash
aitraffic audit page https://example.com/page --format json
aitraffic capabilities describe site.page_audit --format json
aitraffic capabilities run site.page_audit \
  --url https://example.com/page \
  --format json
```

After connecting GA4 and Search Console, audit the highest-priority unique
opportunity pages in one bounded run:

```bash
aitraffic audit opportunities --limit 5 --days 28 --format json
```

The fetcher accepts only public HTTP(S) URLs on default ports, resolves and
validates every redirect hop, blocks private/reserved destinations and embedded
credentials, respects an applicable Googlebot robots rule, limits redirects,
response size, and time, and never returns raw HTML. Results describe only the
returned static response. Missing metadata means “not observed in returned
HTML”; it does not prove that JavaScript rendering or search-engine processing
cannot supply it. Canonicals remain hints, and JSON-LD parsing is not a
Schema.org or rich-result eligibility verdict.

## Bounded site crawl

Discover apex/www-scoped pages from robots.txt sitemap declarations, XML sitemap
indexes, XML or text sitemaps, and returned static internal links:

```bash
aitraffic crawl https://example.com --limit 25 --format json
aitraffic crawl https://example.com \
  --sitemap https://example.com/sitemap.xml \
  --limit 100 \
  --concurrency 3 \
  --format json
aitraffic capabilities describe site.crawl --format json
```

The crawl reuses robots.txt across pages, deduplicates normalized URLs, caps
query variants, skips common non-page assets, and reports page, sitemap, byte,
time, redirect, concurrency, and discovery limits. Compact page observations
keep agent context manageable while retaining evidence references. Site-level
findings can identify sitemap/noindex conflicts, sitemap/canonical conflicts,
sitemap URLs that redirect, duplicate titles within the audited set, and
internal links whose exact audited targets returned errors.

Only call the crawl complete when `coverage.partial` and
`coverage.truncated` are both false. Even then, it covers returned static HTML
and supported apex/www-scoped sitemap sources—not JavaScript-rendered navigation,
external sources, indexing, rankings, or AI citations.

## Unified audit

Run the bounded crawl and automatically add matching GSC/GA4 opportunity
evidence when the selected Google resources are available:

```bash
aitraffic audit https://example.com --format json
aitraffic audit https://example.com --technical-only --limit 50 --format json
aitraffic audit https://example.com \
  --google required \
  --opportunity-limit 5 \
  --focus indexing \
  --top 10 \
  --format json
aitraffic capabilities describe site.full_audit --format json
```

Google defaults to `auto`. Missing, incomplete, mismatched, or failed optional
Google evidence is reported explicitly while the technical audit remains
usable. `--google required` fails instead of degrading, and
`--technical-only` avoids Google entirely. The selected Search Console property
must cover the audited URL; AItraffic cannot independently prove that a
selected GA4 property belongs to the same domain.

The compact priority list combines deterministic technical severity with
observed Google demand, deduplicates overlapping page findings, and reuses
page fetches within the run. `--focus` filters only that priority list—the raw
findings remain available. Priority is an operational review order, not a
ranking or traffic forecast, and implementation effort stays unknown until the
repository or CMS is inspected.

## Local audit history and comparison

Save a compact audit before and after a deployment, then compare the same
observed scope:

```bash
aitraffic audit https://example.com --save --format json
aitraffic audit history --limit 10 --format json
aitraffic audit show RUN_ID --format json
aitraffic audit compare OLDER_RUN_ID NEWER_RUN_ID --format json
aitraffic audit compare --latest --format json
```

Saving is opt-in and CLI-only; `site.full_audit` remains a read-only MCP
capability. Snapshots are gitignored under `.aitraffic/runs/`, with the
directory restricted to the current user and JSON files written privately and
atomically. They contain the compact audit envelope, not raw HTML, OAuth
credentials, tokens, cookies, or request bodies.

Comparison reports persistent, newly observed, resolved, and unknown technical
findings; observable page-field changes; newly observed URLs; and URLs not
observed in the newer run. It never labels the latter as deleted. A page-level
finding is resolved only when that page was observed again. Site-level
resolution requires the same target, matching crawl configuration, and
complete untruncated coverage. Google opportunity movement appears only when
both runs used the same GSC/GA4 resources, equal-length periods, and complete
source coverage; it remains associative rather than causal evidence.

## Local opportunity queue

Turn a saved audit into durable, deduplicated work:

```bash
# Review the proposed queue changes first.
aitraffic opportunities sync --latest --dry-run --format json

# Apply the reviewed local queue update.
aitraffic opportunities sync --latest --format json

# The default view is active work that is currently observed.
aitraffic opportunities list --format json
aitraffic opportunities explain OPP_ID --format json

# Review and then apply a human workflow decision.
aitraffic opportunities update OPP_ID \
  --status planned \
  --reason "Prepare the smallest metadata patch" \
  --dry-run \
  --format json
```

The private queue is stored atomically at
`.aitraffic/opportunities/queue.json` with stable opportunity IDs and bounded
per-item history. Workflow status (`open`, `planned`, `dismissed`, `verified`)
is separate from evidence state (`present`, `not_observed`, `unknown`).
Humans can set `open`, `planned`, or `dismissed`; `verified` is reserved for a
deterministic technical finding that disappears under comparable page or
complete site coverage.

Repeated findings increment an occurrence count instead of creating duplicate
tasks. A verified finding that reappears is reopened. Missing or incompatible
Google evidence becomes `unknown`; a Google opportunity that is absent from a
compatible later period is only `not_observed`, never automatically verified.
Sync rejects older runs after a newer site audit has already been processed.

## Local change records

Record an approved implementation without granting AItraffic permission to
edit code, a CMS, or a website:

```bash
# Review the local record before writing it.
aitraffic changes record \
  --opportunity OPP_ID \
  --url https://example.com/pricing \
  --type metadata \
  --git-commit abc123 \
  --note "Updated title and description" \
  --dry-run \
  --format json

# Repeat without --dry-run after review.
aitraffic changes record \
  --opportunity OPP_ID \
  --url https://example.com/pricing \
  --type metadata \
  --git-commit abc123 \
  --note "Updated title and description" \
  --format json
```

Change records are private, append-only local evidence at
`.aitraffic/changes/records.json`. They link the opportunity, affected URLs,
change type, timestamp, optional Git/deployment references, semantic content
hashes, notes, and known concurrent changes. `changes show` reports the linked
opportunity's current evidence state; it never claims a ranking or revenue
change was caused by the recorded work.

With the project MCP server connected, Codex and Claude Code can use
`list_opportunity_queue` and `explain_opportunity` instead of parsing terminal
output. These tools only read the queue bound to the MCP server's current
project. They do not crawl, contact Google, edit files, synchronize the queue,
or change workflow status.

## Codex

Build once, then register the local stdio server:

```bash
codex mcp add aitraffic -- node "$PWD/dist/src/cli.js" mcp serve
codex mcp get aitraffic
```

Or use the published npm package without cloning:

```bash
codex mcp add aitraffic -- npx -y aitraffic@latest mcp serve
```

Codex should read [AGENTS.md](AGENTS.md) for the repository-specific contract.

## Claude Code

The checked-in `.mcp.json` makes the local server available at project scope after the project is built and approved by Claude Code.

Or register it explicitly:

```bash
claude mcp add --scope project aitraffic -- node "$PWD/dist/src/cli.js" mcp serve
```

Or use the published npm package:

```bash
claude mcp add --scope user aitraffic -- npx -y aitraffic@latest mcp serve
```

Claude Code should read [CLAUDE.md](CLAUDE.md), which points to the same engineering and evidence rules.

See [Agent integrations](docs/guides/agent-integrations.md) for local development, published-package, JSON, and security examples.

The guided setup design and hosted-auth milestones are documented in the
[onboarding roadmap](docs/product/onboarding-roadmap.md).

The Google connector extraction and TrafficClaw hosted/local boundary is
documented in the
[TrafficClaw Google reuse plan](docs/guides/trafficclaw-google-reuse.md).
Native OAuth, direct Google APIs, and the compatible external adapter are
documented in the
[Google connector guide](docs/guides/google-connector.md).

## Example log analysis

```bash
aitraffic logs import examples/sample-access.log
```

Example interpretation:

```text
Parsed requests: 5
Claimed AI/search agent requests: 4

OpenAI / OAI-SearchBot: search
OpenAI / ChatGPT-User: agent
Anthropic / ClaudeBot: training
Perplexity / PerplexityBot: search
```

These identities are based on user-agent strings in this bootstrap. They are spoofable and therefore explicitly labeled `user_agent_only`. Published-IP, reverse-DNS, CDN-verified, and signed-request verification belong in the next collector phase.

## Research

Start with the [research index](docs/research/README.md). It covers:

- product thesis and market;
- 179-feature catalog;
- open-source and license landscape;
- SEO and GEO/AEO playbooks;
- data and integration architecture;
- monetization;
- phased roadmap;
- source register.

The first live connector dogfood is documented in the
[TrafficClaw alpha report](docs/case-studies/trafficclaw-alpha.md).

## Development

```bash
npm install
npm run build
npm run typecheck
npm test
npm run check
```

Node.js 20.12 or newer is required.

## License

Apache-2.0. See [LICENSE](LICENSE).
