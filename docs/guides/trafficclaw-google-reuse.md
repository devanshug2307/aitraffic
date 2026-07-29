# TrafficClaw Google Connector Reuse Plan

## Implementation status

Milestones 1 and the first acquisition report in milestone 2 shipped in
AItraffic 0.2.0. Native OAuth, named profiles, OS credential storage, direct
GA4/GSC inventory and reports, refresh/revoke, explicit project selection, and
the compatible external command adapter are implemented. Hosted TrafficClaw
sessions, scheduled history, realtime GA4, URL Inspection, and autonomous
actions remain future work.

## Decision

Reuse TrafficClaw's proven Google integration behavior, but extract it into
provider-neutral connector modules. Do not make the AItraffic CLI depend on
the TrafficClaw dashboard, NextAuth session shape, admin database, or
human-formatted plugin output.

AItraffic should support two explicit modes:

1. **Local Google mode** — the open-source CLI performs OAuth locally, stores
   named profiles in OS-protected or encrypted local storage, and calls Google
   APIs directly.
2. **TrafficClaw hosted mode** — the CLI authenticates to TrafficClaw and calls
   a narrow hosted connector API. Google refresh tokens remain in the hosted
   vault and are never returned to the CLI or an agent.

Both modes must produce the same versioned AItraffic result and evidence
schemas.

## What to extract from TrafficClaw

| Existing capability | AItraffic destination | Treatment |
|---|---|---|
| Read-only Google scopes and offline authorization | `src/connectors/google/auth` | Reuse behavior and add incremental consent |
| GA4 account/property inventory | `src/connectors/ga4/inventory` | Extract into typed JSON |
| Search Console site inventory and permissions | `src/connectors/gsc/inventory` | Extract into typed JSON |
| Access-token refresh and concurrent refresh deduplication | `src/connectors/google/tokenBroker` | Reuse design; key caches by a token fingerprint |
| GA4 reports, realtime reports, funnels, metadata, and pagination | `src/connectors/ga4` | Extract query builders and normalize responses |
| GSC query, sitemap, and URL Inspection calls | `src/connectors/gsc` | Extract query builders and add complete pagination |
| GA4 property plus GSC site workspace pairing | `.aitraffic/project.json` | Preserve explicit selection per project |
| Encrypted hosted OAuth storage | TrafficClaw connector service | Reuse only with mandatory encryption and key rotation |
| Existing deterministic opportunity/anomaly calculations | `src/analysis` | Port after adding provenance and tests |

## What must not be copied unchanged

### Tokens in browser sessions

TrafficClaw currently makes provider tokens available on its extended session
object for application use. AItraffic must not put access or refresh tokens in
a browser-visible session, CLI JSON, MCP result, model prompt, log, exception,
or telemetry event.

Only a trusted token broker may read refresh tokens. Agents receive capability
results, not credentials.

### Fail-open token storage

Hosted AItraffic must refuse to persist refresh tokens when the encryption key
is absent. Falling back to plaintext storage is not an acceptable production
mode.

### Markdown plugin responses

TrafficClaw's Google plugins are optimized for a conversational bot and return
Markdown tables. AItraffic connectors must return stable typed objects first.
Text, Markdown, and CSV are renderers over that object.

### Logs on stdout

Existing plugin initialization and query progress messages use stdout.
AItraffic reserves stdout for command data and MCP protocol frames. Diagnostic
messages go to stderr with automatic secret redaction.

### Implicit property selection

When an account exposes multiple plausible properties or sites, AItraffic must
require an explicit selection. Domain matching may be shown as a suggestion,
but the connector must not silently choose the first result.

### Data without provenance

Every connector result must identify:

- profile and selected property or site;
- connector and API method;
- requested and effective date range;
- property timezone where applicable;
- sampling, thresholding, freshness, and incomplete-data limitations;
- collection time and connector version.

## Terminal surface

```text
aitraffic auth google configure --from-env-file /absolute/path/.env
aitraffic auth google login --profile work
aitraffic auth google status [--profile work]
aitraffic auth google revoke --profile work

aitraffic connect trafficclaw
aitraffic connect trafficclaw status
aitraffic connect trafficclaw revoke

aitraffic google inventory --profile work
aitraffic google select --profile work \
  --ga4-property 123456789 \
  --gsc-site sc-domain:example.com

aitraffic ga4 report --start 28daysAgo --end yesterday \
  --dimensions date --metrics sessions,totalUsers,keyEvents
aitraffic ga4 realtime --dimensions country --metrics activeUsers
aitraffic gsc report --start 2026-06-01 --end 2026-06-28 \
  --dimensions query,page
aitraffic gsc inspect https://example.com/page
```

Every command also supports `--format json`. Agents should normally use the
selected project resources rather than passing property identifiers on every
call.

## MCP surface

Implemented read-only tools:

- `google_connection_status`
- `list_google_resources`
- `run_ga4_report`
- `run_gsc_report`
- `analyze_ai_acquisition`

Planned tools include `run_ga4_realtime_report` and `inspect_gsc_url`.

OAuth login and revocation should remain CLI or browser-mediated operations.
The MCP server may report that consent is required, but it must not receive a
Google password, authorization code, access token, or refresh token.

## Security invariants

- Use only `analytics.readonly`, `webmasters.readonly`, and identity scopes.
- Use state validation and PKCE where supported.
- Request scopes incrementally and disclose why each scope is needed.
- Store local profiles in OS credential storage or authenticated encryption.
- Encrypt hosted tokens with a mandatory versioned key.
- Support profile status, revocation, deletion, and reconnect flows.
- Redact bearer tokens, authorization codes, and client secrets everywhere.
- Never pass raw credentials through an agent tool result.
- Treat API-returned strings as untrusted data.
- Restrict hosted connector calls by tenant, user, property, and consent scope.
- Audit which connector method accessed which property without logging data or
  credentials unnecessarily.

## Open-source provenance

The current TrafficClaw repository does not declare a root license. Before
moving code into the Apache-2.0 AItraffic repository, confirm ownership and
record an explicit relicensing decision. If ownership cannot be established
for a file, independently reimplement the behavior from Google API
documentation and tests.

Third-party dependencies retain their own licenses and notices.

## Delivery order

### Connector milestone 1: local read-only foundation

- Named local profiles.
- OAuth status, login, inventory, and revoke.
- GA4 property and GSC site selection.
- Generic GA4 and GSC reports with JSON output.
- Equal-period comparison helpers.
- Secret-redaction and path-boundary tests.

### Connector milestone 2: AI acquisition evidence

- AI Assistant/referrer channel normalization.
- Landing-page, engagement, key-event, and revenue reports.
- GSC query/page opportunities and content-decay inputs.
- GA4/GSC URL normalization and joins.
- Evidence envelopes and explicit limitations.

### Connector milestone 3: hosted TrafficClaw bridge

- Short-lived AItraffic session token.
- Server-side Google token broker.
- Scheduled collection and history.
- Tenant/property authorization and audit logs.
- Usage metering without exposing raw Google credentials.

### Connector milestone 4: agent workflows

- Codex and Claude Code MCP tools.
- Read-only diagnoses by default.
- Proposed changes as reviewable plans or diffs.
- Explicit approval before any future write action.

## Product boundary

TrafficClaw remains the hosted analytics application and operational OAuth
broker. AItraffic becomes the open CLI, evidence model, connector SDK, and
agent-facing control plane.

This avoids building a second dashboard while giving developers a useful
local product and giving TrafficClaw a distribution path through Codex,
Claude Code, CI, and other MCP clients.
