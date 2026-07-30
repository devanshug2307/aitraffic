# AItraffic

Open, terminal-first evidence for how search engines and AI systems discover, crawl, cite, refer, and convert traffic.

The project is designed to be directly usable by humans, Codex, Claude Code, CI jobs, and any MCP-compatible agent.

[aitraffic.dev](https://aitraffic.dev) · [npm](https://www.npmjs.com/package/aitraffic) · [GitHub](https://github.com/devanshug2307/aitraffic) · Apache-2.0 · Node.js 20.12+

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
- a priority-page workflow that safely audits unique pages selected from GA4/GSC opportunities;
- a local read-only MCP server with Google, log, and evidence tools;
- Codex and Claude Code setup guidance;
- research and roadmap documentation under `docs/research/`.

AItraffic does not yet include scheduled collection or a hosted connector. Native OAuth imports a Google Web application client from its downloaded JSON or a private environment file; no client secret is bundled in npm. The person running the CLI personally completes Google consent, and tokens stay in the OS credential store. Tokens are never printed or exposed through MCP.

## Quick start

```bash
npx -y aitraffic@latest onboard

# Read-only, machine-readable inspection for agents and CI.
npx -y aitraffic@latest onboard --check --format json

npx -y aitraffic@latest doctor
npx -y aitraffic@latest init --agent both --site https://example.com
npx -y aitraffic@latest schema evidence --format json
npx -y aitraffic@latest logs import access.log --format json
npx -y aitraffic@latest crawl https://example.com --limit 25 --format json
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

The dedicated AItraffic Google project is currently in Testing, so only listed test users can authorize it and refresh tokens may expire after seven days. Public zero-configuration OAuth requires a hosted token broker plus Google verification; the npm package does not distribute the Web client secret. See the [Google connector guide](docs/guides/google-connector.md) for the beta setup and optional TrafficClaw/external-adapter path.

Install globally if you prefer the shorter executable:

```bash
npm install --global aitraffic
aitraffic doctor
aitraffic init --agent both
aitraffic logs import access.log --format json
aitraffic mcp serve
```

Pin an exact version for reproducible automation:

```bash
npx -y aitraffic@0.5.1 version
```

## Terminal contract

- Human-readable output is the default in a TTY.
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
aitraffic crawl <URL> [--limit N] [--concurrency N] [--sitemap auto|none|URL] [--max-sitemaps N] [--max-sitemap-bytes N]
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
