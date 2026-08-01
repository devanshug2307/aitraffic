# TrafficClaw Live Validation

Validated locally on 2026-07-31 against `https://trafficclaw.com` using
AItraffic's bounded public crawl and an existing read-only Google adapter.

No site content, Google setting, credential, or remote resource was changed.
Profile labels, resource IDs, query strings, and private page-level business
data are intentionally omitted.

## First two-pass result

| Check | Observed result |
|---|---:|
| Pages technically audited per run | 15 |
| Failed page audits | 0 |
| Google opportunities crossing the configured threshold | 0 |
| Technical findings retained across both runs | 7 |
| Pages with changed hashes | 2 |
| Duplicate opportunities created on second sync | 0 |

The repeated crawl and queue workflow worked, but the findings revealed a
classification boundary rather than seven actionable SEO defects:

- a Cloudflare-managed email-protection endpoint was crawled as a content page;
- an authentication API endpoint was treated as an SEO landing page;
- generated utility routes were mixed into sitemap-absence reporting;
- the two changing hashes belonged to utility or generated dynamic targets,
  not ordinary content pages.

[Cloudflare documents `/cdn-cgi/`](https://developers.cloudflare.com/fundamentals/reference/cdn-cgi-endpoint/)
as a provider-managed endpoint and recommends excluding it from SEO crawlers.
[Auth.js uses `/api/auth/`](https://authjs.dev/) as its authentication handler
namespace. AItraffic now excludes automatically discovered URLs in those two
deterministic namespaces from SEO page auditing. A person can still audit one
explicitly by passing it as the seed URL.

## Interpretation

The useful validated behavior is connector reuse, bounded collection, and
idempotent queue synchronization. The original technical count must not be
presented as seven site defects. The corrected repeat run below confirms that
provider-managed and authentication routes no longer enter the automatic SEO
page set while potentially actionable public-page observations remain.

## Corrected two-pass result

The same isolated project, Google selections, crawl limits, and command options
were used for two additional runs after the utility-route correction.

| Check | Corrected result |
|---|---:|
| Pages technically audited per run | 13 |
| Automatically discovered utility URLs skipped | 2 |
| Failed page audits | 0 |
| Technical findings retained across both corrected runs | 2 |
| Pages with changed semantic hashes | 1 |
| Duplicate opportunities created | 0 |

The Cloudflare, authentication, missing-description, robots, and false
internal-link-error noise disappeared. The two remaining technical
observations concern a public noindex page and a linked public page absent from
the parsed sitemap set; both require human intent review rather than an
automatic change.

The one remaining hash change belonged to a generated embed page. AItraffic
keeps that change visible because a general `/embed/` exclusion could hide
legitimate public content. A future exclusion should require a deterministic
signed-utility signal rather than treating every embed URL as non-content.

Queue reconciliation created no duplicates. One previously observed technical
error was verified as absent. Four utility-specific historical items became
`unknown`, not “fixed,” because intentionally skipped URLs are not negative
evidence.
