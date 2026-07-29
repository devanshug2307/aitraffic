# Google Connector Alpha

## What is implemented

AItraffic can use an existing local, read-only Google profile through an explicit external command adapter. The adapter returns JSON for:

- connection status;
- GA4 property and Search Console site inventory;
- GA4 `runReport`;
- Search Console Search Analytics queries.

AItraffic adds typed command results, explicit resource selection, provenance, equal-period comparison, AI-referral normalization, and deterministic opportunity rules.

This is the first bridge from TrafficClaw's proven Google behavior into the open CLI. It is not yet a standalone OAuth implementation or a hosted TrafficClaw API.

## Security boundary

The external profile owns OAuth consent, token refresh, and private token storage. AItraffic stores only:

```json
{
  "schemaVersion": "0.1.0",
  "adapter": "external-command",
  "scriptPath": "/absolute/path/to/google-data.mjs",
  "profile": "work",
  "ga4Property": "123456789",
  "gscSite": "sc-domain:example.com"
}
```

The local file is `.aitraffic/google.json`, is mode `0600`, and is ignored by Git. It must never contain access tokens, refresh tokens, client secrets, authorization codes, cookies, or passwords.

The adapter is launched with `execFile` through the current Node executable. No shell is used. Child stdout must contain one JSON document. On failure, AItraffic reports a structured error without echoing child stdout or stderr.

## Configure

First review a dry run:

```bash
aitraffic google configure \
  --adapter-script /absolute/path/to/google-data.mjs \
  --profile work \
  --ga4-property 123456789 \
  --gsc-site sc-domain:example.com \
  --dry-run \
  --format json
```

Then repeat without `--dry-run`. The command validates that the adapter script is readable, normalizes the profile label, strips an optional `properties/` prefix from the GA4 ID, and writes the local selection atomically.

Inventory is always explicit:

```bash
aitraffic google status --format json
aitraffic google inventory --format json
```

AItraffic never silently selects the first property or site.

## Read-only reports

```bash
aitraffic ga4 report \
  --start 28daysAgo \
  --end yesterday \
  --dimensions sessionSource,sessionMedium,landingPagePlusQueryString \
  --metrics sessions,totalUsers,engagedSessions,keyEvents,totalRevenue \
  --limit 10000 \
  --format json

aitraffic gsc report \
  --start 2026-06-30 \
  --end 2026-07-27 \
  --dimensions query,page \
  --limit 25000 \
  --format json
```

The unified report uses yesterday as the GA4 end date and three days ago as the Search Console end date. It compares equal inclusive periods:

```bash
aitraffic report acquisition --days 28 --format json
```

It reports:

- all observable GA4 traffic;
- traffic classified by GA4's native `AI Assistants` channel or a disclosed source-domain registry;
- AI sessions, users, engagement, key events, revenue, sources, and landing pages;
- Search Console clicks, impressions, CTR, and impression-weighted position;
- current-versus-previous changes;
- deterministic query/page opportunities for returned rows in positions 4–20 with at least 10 impressions.

The report does not claim that a Search Console query caused a GA4 session, that a crawler visit created a citation, or that an AI referral caused revenue.

## Adapter contract

An adapter must accept these commands:

```text
status
inventory --profile NAME
ga4 --profile NAME --property ID --start DATE --end DATE --dimensions CSV|none --metrics CSV --limit N
gsc --profile NAME --site SITE --start YYYY-MM-DD --end YYYY-MM-DD --dimensions CSV --limit N --offset N --type web --data-state final
```

It must:

- write exactly one JSON value to stdout;
- write diagnostics only to stderr;
- return non-zero on failure;
- use read-only Google scopes;
- keep raw credentials outside its responses;
- require explicit property and site identifiers.

## Next connector milestone

The next open-source milestone is a packaged standalone local OAuth provider with:

- PKCE and state validation;
- incremental read-only consent;
- OS credential-store or authenticated-encryption persistence;
- named-profile status and revocation;
- the same `GoogleDataProvider` interface, so CLI and MCP contracts do not change.

TrafficClaw hosted mode should remain a separate provider: AItraffic receives short-lived capability access and typed report results, while refresh tokens remain in TrafficClaw's encrypted server-side vault.
