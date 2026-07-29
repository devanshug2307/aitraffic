# AItraffic

Open, terminal-first evidence for how search engines and AI systems discover, crawl, cite, refer, and convert traffic.

The project is designed to be directly usable by humans, Codex, Claude Code, CI jobs, and any MCP-compatible agent.

[aitraffic.dev](https://aitraffic.dev) · [GitHub](https://github.com/devanshug2307/aitraffic) · Apache-2.0 · Node.js 20+

## Current alpha

The working alpha includes:

- a zero-prompt CLI contract with human and JSON output;
- project initialization and environment diagnostics;
- a versioned evidence JSON Schema;
- local Nginx/Apache combined-log and NDJSON import;
- honest AI crawler/agent classification with `user_agent_only` verification labels;
- a credential-isolating adapter for existing local Google OAuth profiles;
- typed read-only GA4 and Google Search Console reports;
- an equal-period AI/search acquisition report with explicit limitations;
- a local read-only MCP server with Google, log, and evidence tools;
- Codex and Claude Code setup guidance;
- research and roadmap documentation under `docs/research/`.

AItraffic does not yet own a standalone OAuth flow, scheduled collection, or a hosted connector. The current Google path deliberately reuses an explicit external local profile and never imports or prints its tokens.

## Quick start

```bash
npm install
npm run build

node dist/src/cli.js doctor
node dist/src/cli.js init --agent both --site https://example.com
node dist/src/cli.js schema evidence --format json
node dist/src/cli.js logs import examples/sample-access.log
```

Connect an existing read-only Google profile:

```bash
node dist/src/cli.js google configure \
  --adapter-script /absolute/path/to/google-data.mjs \
  --profile work \
  --ga4-property 123456789 \
  --gsc-site sc-domain:example.com \
  --dry-run

# Review the dry run, then repeat without --dry-run.
node dist/src/cli.js google status --format json
node dist/src/cli.js google inventory --format json
node dist/src/cli.js report acquisition --days 28 --format json
```

The adapter configuration contains only a script path, profile label, and explicit resource IDs. OAuth credentials remain in the external profile store.

After publishing or linking the package locally:

```bash
aitraffic doctor
aitraffic init --agent both
aitraffic logs import access.log --format json
aitraffic mcp serve
```

Until the npm package is published, run the public GitHub release directly:

```bash
npx -y github:devanshug2307/aitraffic version
npx -y github:devanshug2307/aitraffic doctor --format json
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
aitraffic init [--agent codex|claude-code|both] [--site URL] [--force]
aitraffic doctor
aitraffic schema evidence
aitraffic logs import <path>
aitraffic crawlers <path>
aitraffic classify <user-agent>
aitraffic google configure --adapter-script PATH --profile NAME [--ga4-property ID] [--gsc-site SITE] [--dry-run]
aitraffic google status
aitraffic google inventory
aitraffic ga4 report [--start DATE] [--end DATE] [--dimensions CSV] [--metrics CSV] [--limit N]
aitraffic gsc report [--start DATE] [--end DATE] [--dimensions CSV] [--limit N]
aitraffic report acquisition [--days N]
aitraffic mcp serve
aitraffic version
```

Every non-MCP command supports `--format text|json`.

## Codex

Build once, then register the local stdio server:

```bash
codex mcp add aitraffic -- node "$PWD/dist/src/cli.js" mcp serve
codex mcp get aitraffic
```

Or use the public GitHub source without cloning:

```bash
codex mcp add aitraffic -- npx -y github:devanshug2307/aitraffic mcp serve
```

Codex should read [AGENTS.md](AGENTS.md) for the repository-specific contract.

## Claude Code

The checked-in `.mcp.json` makes the local server available at project scope after the project is built and approved by Claude Code.

Or register it explicitly:

```bash
claude mcp add --scope project aitraffic -- node "$PWD/dist/src/cli.js" mcp serve
```

Or use the public GitHub source:

```bash
claude mcp add --scope user aitraffic -- npx -y github:devanshug2307/aitraffic mcp serve
```

Claude Code should read [CLAUDE.md](CLAUDE.md), which points to the same engineering and evidence rules.

See [Agent integrations](docs/guides/agent-integrations.md) for local development, published-package, JSON, and security examples.

The proposed Google connector extraction and TrafficClaw hosted/local boundary
is documented in the
[TrafficClaw Google reuse plan](docs/guides/trafficclaw-google-reuse.md).
The implemented alpha adapter is documented in the
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
npm run typecheck
npm test
npm run check
```

Node.js 20 or newer is required.

## License

Apache-2.0. See [LICENSE](LICENSE).
