# AItraffic

Open, terminal-first evidence for how search engines and AI systems discover, crawl, cite, refer, and convert traffic.

The project is designed to be directly usable by humans, Codex, Claude Code, CI jobs, and any MCP-compatible agent.

[aitraffic.dev](https://aitraffic.dev) · [npm](https://www.npmjs.com/package/aitraffic) · [GitHub](https://github.com/devanshug2307/aitraffic) · Apache-2.0 · Node.js 20+

## Current alpha

The working alpha includes:

- a zero-prompt CLI contract with human and JSON output;
- project initialization and environment diagnostics;
- a versioned evidence JSON Schema;
- local Nginx/Apache combined-log and NDJSON import;
- honest AI crawler/agent classification with `user_agent_only` verification labels;
- native Google OAuth with PKCE, state validation, named profiles, refresh, and revoke;
- native OS credential-store persistence with no CLI or plaintext token fallback;
- a credential-isolating adapter for existing local Google OAuth profiles;
- typed read-only GA4 and Google Search Console reports;
- an equal-period AI/search acquisition report with explicit limitations;
- a local read-only MCP server with Google, log, and evidence tools;
- Codex and Claude Code setup guidance;
- research and roadmap documentation under `docs/research/`.

AItraffic does not yet include scheduled collection or a hosted connector. Native OAuth is local and bring-your-own-client: the person running the CLI creates the Google OAuth client, completes consent in Google, and keeps credentials in the OS credential store. Tokens are never printed or exposed through MCP.

## Quick start

```bash
npx -y aitraffic@latest doctor
npx -y aitraffic@latest init --agent both --site https://example.com
npx -y aitraffic@latest schema evidence --format json
npx -y aitraffic@latest logs import access.log --format json
```

Connect Google directly:

```bash
# Put GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and the exact redirect URI in
# a private file. The default redirect is:
# http://localhost:3000/api/auth/callback/google
npx -y aitraffic@latest auth google configure \
  --from-env-file /absolute/path/to/.env.google

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
npx -y aitraffic@latest report acquisition --days 28 --format json
```

Before login, enable the Google Analytics Data API, Google Analytics Admin API, and Search Console API in your Google Cloud project. Create a Web application OAuth client and register the redirect URI exactly. See the [Google connector guide](docs/guides/google-connector.md) for the complete setup and the optional TrafficClaw/external-adapter path.

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
npx -y aitraffic@0.2.0 version
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
aitraffic auth google configure --from-env-file PATH
aitraffic auth google login --profile NAME
aitraffic auth google status [--profile NAME]
aitraffic auth google revoke --profile NAME [--dry-run] [--local-only]
aitraffic google configure --adapter-script PATH --profile NAME [--ga4-property ID] [--gsc-site SITE] [--dry-run]
aitraffic google select --profile NAME [--ga4-property ID] [--gsc-site SITE] [--dry-run]
aitraffic google status
aitraffic google inventory [--profile NAME]
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

Node.js 20 or newer is required.

## License

Apache-2.0. See [LICENSE](LICENSE).
