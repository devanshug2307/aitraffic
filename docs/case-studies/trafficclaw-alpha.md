# TrafficClaw Alpha Dogfood Report

Collected at `2026-07-29T18:55:31.516Z` through AItraffic's read-only external Google adapter.

## Scope

- Existing local profile: `trafficclaw`
- Explicit GA4 selection: TrafficClaw's selected property
- Explicit Search Console selection: `sc-domain:trafficclaw.com`
- Current and previous windows: 28 inclusive days
- GA4 freshness: through the last completed UTC day available to the run
- Search Console freshness: three-day lag, `final` data
- Inventory capability check: 14 GA4 properties and 13 Search Console sites were available to the profile

No OAuth credential was imported into AItraffic. The report process received only Google API result JSON.

## Observed GA4 aggregates

| Metric | Current | Previous | Change |
|---|---:|---:|---:|
| All sessions | 443 | 476 | -6.9% |
| All users | 362 | 381 | -5.0% |
| All engaged sessions | 346 | 347 | -0.3% |
| Observable AI sessions | 3 | 4 | -25.0% |
| Observable AI users | 3 | 4 | -25.0% |
| Observable AI engaged sessions | 3 | 3 | 0.0% |
| AI session share | 0.68% | 0.84% | -0.16 percentage points |
| Key events | 0 | 0 | Unknown |
| Revenue | 0 | 0 | Unknown |

The observable AI sessions in the current window came from `chatgpt.com` and landed on one page. The sample is too small for a trend claim. A one-session change produces the reported 25% decline.

Zero key events and zero revenue should be treated as a measurement gap until the property's event and revenue configuration is confirmed. They do not establish that the traffic created no business value.

## Observed Search Console aggregates

| Metric | Current | Previous | Change |
|---|---:|---:|---:|
| Clicks in returned rows | 9 | 20 | -55.0% |
| Impressions in returned rows | 74 | 91 | -18.7% |
| Aggregate CTR | 12.2% | 22.0% | -9.8 percentage points |
| Impression-weighted position | 4.86 | 4.02 | 0.84 positions worse |
| Returned query/page rows | 14 | 10 | +4 rows |

Search Console may omit anonymized or low-volume queries, so these are aggregates of the returned rows, not a guarantee of complete query-level demand.

## Inferred opportunity

The deterministic opportunity rule found one query/page row with:

- 17 impressions;
- 0 clicks;
- 0% CTR;
- average position 6.94.

This is a review candidate, not a ranking promise. The recommended review is to check intent fit, direct-answer clarity, title/snippet quality, entity evidence, and internal links before changing the page.

The public case study intentionally omits the query and page strings. Agent output can retain those locally, while a later share/export renderer should support explicit redaction.

## What the dogfood run validated

- The local profile boundary works without copying Google tokens.
- Property and site selection is explicit.
- CLI stdout remains one JSON result.
- GA4 and Search Console can be queried concurrently through one provider interface.
- Current and previous periods are equal in length.
- Search Console lag is applied separately from GA4 freshness.
- Native `AI Assistants` classification and disclosed source matching can coexist.
- Observations, inferences, and limitations remain separate.
- The same report service is available to CLI and MCP callers.

## Product gaps exposed by the run

1. Add GA4 property metadata and retain the property's timezone in report provenance.
2. Split native `AI Assistants` rows from registry-matched referral rows so users can audit the normalization.
3. Add a key-event and revenue measurement-health check before showing conversion conclusions.
4. Add share/export redaction for queries, landing pages, property IDs, and profile labels.
5. Add pagination cursors and completeness metadata even when the first run is below API limits.
6. Add a saved local report artifact with content hashing, without making stdout impure.
7. Add a standalone packaged OAuth provider so users do not need an external adapter script.
8. Add the hosted TrafficClaw provider only after tenant authorization, mandatory encryption, revocation, and audit logging exist.

## Interpretation

The useful conclusion is not that AI traffic is growing or declining. The useful conclusion is that TrafficClaw has a measurable but very small AI-referral baseline, one concrete search snippet/page candidate, and an unverified conversion measurement layer. The next action is measurement hardening plus a focused page review, followed by another equal-period run.
