# Monetization and Packaging

## Monetize operation and outcomes, not access to open data

The best commercial model is:

> Open CLI, collectors, schema, and local mode; paid hosted OAuth, automation, history, browser observations, collaboration, reporting, and scale.

This aligns user trust with the business:

- technical users can inspect the code and keep credentials local;
- the hosted product removes setup and operational work;
- agencies pay for multi-client leverage;
- enterprises pay for governance, volume, integration, and support;
- nobody is trapped because the data model and export are open.

## What buyers will not reliably pay for

Avoid making these the paid core:

- an AI-referrer regex;
- a one-time audit score;
- a single `llms.txt` file;
- raw crawler request counts;
- an OAuth bridge with no workflows;
- one prompt result;
- a generic AI content generator;
- unverifiable “share of model” estimates;
- dashboards that reproduce free GA4, GSC, or Cloudflare views.

Google and free/open-source products already compress those features toward zero.

## What buyers do pay for

### Technical founder or solo SEO

- secure, fast setup;
- hosted sync and history;
- alerts and weekly digest;
- actionable cross-source diagnoses;
- small prompt/citation panel;
- agent access without managing cloud credentials.

Likely test range: **$19–$39/month**.

### In-house growth/SEO team

- several domains;
- GSC + GA4 + log + prompt evidence;
- conversion and revenue joins;
- opportunity queue;
- experiments and change verification;
- API/integrations and team workflows.

Likely test range: **$79–$149/month**.

### Agency

- many isolated client workspaces and Google accounts;
- templates and saved investigations;
- reports, portals, delivery, and white label;
- approval, issue, and implementation workflow;
- predictable usage and margins.

Likely test range: **$249–$499/month** before high-volume add-ons.

### Enterprise/publisher/platform

- large log volume and long retention;
- SSO/SCIM/RBAC/audit;
- warehouse and private networking;
- data residency/retention;
- customer-managed encryption;
- custom connectors and SLAs;
- agent identity, policy, or commerce observability.

Sell annually, generally **$12k+ per year** depending on volume and obligations. Do not publish a low “unlimited” enterprise plan before costs are understood.

## Recommended launch packaging

Use these as pricing tests, not permanent truth:

| Capability | Community | Starter | Pro | Agency | Enterprise |
|---|---:|---:|---:|---:|---:|
| Price test | $0 | $29/mo | $99/mo | $299/mo | Custom |
| Mode | Local/BYO | Hosted | Hosted | Hosted | Hosted/private |
| Domains | Local projects | 1 | 5 | 25 | Contract |
| Users | Local | 1 | 5 | 15 | SSO/RBAC |
| Google OAuth | BYO/local | Managed | Managed | Multi-account | Managed/private |
| GSC + GA4 reports | Yes | Yes | Yes | Yes | Yes |
| Evidence history | Local | 90 days | 25 months | 36 months | Custom |
| Log import | File/local | Limited | Included allowance | Higher allowance | Usage/SLA |
| Prompt observations | BYOK/manual | Small credit pool | Repeated panels | Multi-client pool | Contract |
| AI crawler verification | Local registry | Basic | Advanced | Advanced | Policy/custom |
| Opportunities | Deterministic local | Core | Full cross-source | Multi-client | Custom |
| Change verification | Manual/local | Basic | Experiments | Client workflows | Advanced |
| Weekly reports/alerts | Local/manual | Yes | Advanced | Branded/scheduled | Custom |
| API/MCP | Local | Limited remote | Full allowance | Higher allowance | SLA/private |
| Warehouse export | Files | Files | Optional | Optional | Included |
| White label | No | No | No | Yes | Optional |
| SSO/SCIM/audit | No | No | Basic audit | Audit | Full |
| Support | Community | Email | Priority | Agency | SLA |

### Why not charge mainly by seat

The core cost drivers are:

- browser prompt runs;
- model/API calls;
- log/event ingestion;
- retention and raw artifacts;
- crawl/render work;
- scheduled report volume;
- support and enterprise obligations.

Seats are not the primary cost and unlimited collaboration can improve adoption. Use domain/client limits plus included usage pools. Keep additional seats free or inexpensive until enterprise governance creates a genuine seat value.

## Value metrics

Use a hybrid model:

```text
base subscription
+ domains/client workspaces
+ managed prompt/browser credits
+ ingested events/log GB
+ long raw-artifact retention
+ premium connectors/warehouse
+ enterprise security and support
```

### Prompt run unit

Define one billable unit transparently:

```text
1 prompt observation =
  1 prompt × 1 engine/surface × 1 locale × 1 repeat
```

Do not call 50 prompts “50 queries” if the plan runs each across six engines and three repeats. Show budget before scheduling.

### Event/log unit

Offer included volume and predictable overage:

- requests/events or compressed GB;
- aggregate retention versus raw retention;
- no surprise bandwidth charge;
- filters so customers do not ingest irrelevant static assets or known monitoring noise.

### Domain unit

A verified apex domain plus agreed subdomains should generally count as one domain. Avoid charging separately for `www`, app, docs, and locale hosts unless they create material usage.

## Competitive price anchors

Current public list prices demonstrate two different markets:

| Product/category | Current public starting point or notable tier | Implication |
|---|---:|---|
| Agent Analytics | Free 100k events; usage-based Pro | Generic agent analytics is inexpensive and open. |
| Clamp | Free 100k events; paid from $19 | Agent-readable product analytics is price-competitive. |
| Otterly | $29 entry; higher prompt tiers around $189/$489 | Low-cost prompt monitoring exists, but volume gets expensive. |
| Peec | Around $95/$245/$495 | Clean self-serve GEO supports mid-market pricing. |
| Profound | Around $99 starter and $399 growth, annual terms | Enterprise-grade AI visibility supports premium pricing. |
| Semrush AI Visibility | Around $99/domain | Installed SEO suites anchor per-domain add-ons near $100. |
| Ahrefs Brand Radar | From roughly $199 | Large proprietary datasets support a premium. |
| Goodie | Around $399 entry | Closed-loop attribution/action is sold to larger buyers. |
| Scrunch | Several hundred dollars per month | Prompt + crawler + site action sells as a broader platform. |
| Refresh Agent | Roughly $10 for hosted Google access | A hosted GA4/GSC connector by itself has a low ceiling. |

Prices change. Confirm the linked official pages in the source register before publishing comparisons.

## Revenue evidence

Payment-provider-verified public TrustMRR snapshots show adjacent outcomes:

| Company | Verified MRR | Active subscriptions | Implied MRR/subscription | Lesson |
|---|---:|---:|---:|---|
| DataFast | $25,310.58 | 1,246 | ~$20 | Simple analytics can work at low price and high volume. |
| Cometly | $208,441 | 307 | ~$679 | Attribution tied to revenue can command much higher account value. |
| LLM Gateway | $51,403 | 937 | ~$55 | Developer infrastructure can sustain mid-range self-serve spend. |
| Rank Prompt | $29,417 | 210 | ~$140 | AI visibility can monetize when the workflow is valuable. |
| AIRIX | $1,841 | 47 | ~$39 | Lower-price AI visibility exists but scale is not automatic. |
| MentionDesk | $939 | 16 | ~$59 | Mention tracking alone may remain small. |

Do not use founder-edited descriptions or claimed margins as verified economics. Treat these as point-in-time benchmarks, not representative market averages.

## TrafficClaw relationship

Avoid two products charging for the same data.

### Recommended brand/packaging

- **aitraffic.dev Community** — open-source CLI, schema, collectors, local MCP.
- **AI Traffic Cloud** — hosted developer service and API.
- **TrafficClaw** — visual workspace, analytics dashboard, reports, and managed agent experience built on AI Traffic.

Possible bundle:

```text
TrafficClaw Pro includes AI Traffic Cloud Pro
AI Traffic Cloud customers can add TrafficClaw UI
Agency bundle combines client portal + CLI/API + hosted evidence
```

One billing account and one evidence store are preferable.

## Open-source business model

### Publish

- Apache-2.0 or MIT CLI;
- evidence schema;
- collectors;
- agent registry;
- local database;
- MCP server;
- deterministic audit rules;
- connector SDK;
- fixtures and sample reports.

### Keep hosted

- managed OAuth application and verification;
- managed secret storage;
- job scheduler and reliable backfills;
- browser prompt infrastructure;
- large-volume log storage;
- anomaly/alert delivery;
- team/agency workflows;
- benchmarks;
- enterprise governance;
- support and managed deployment.

### Contribution flywheel

```text
Open collectors and schema
→ more supported sources
→ more local users and trust
→ more hosted conversions
→ more normalized evidence
→ better opt-in benchmarks and workflows
→ stronger hosted value
```

Never use community data for benchmarks without explicit consent, privacy thresholds, and a deletion path.

## Additional revenue lines

### 1. Usage add-ons

- prompt/browser observation packs;
- event/log volume;
- long raw evidence retention;
- additional domains/client workspaces;
- warehouse sync.

### 2. Agency implementation

- onboarding/migration;
- connector setup;
- report templates;
- custom opportunity rules;
- team training.

Keep professional services separate from ARR reporting.

### 3. Managed enterprise deployment

- customer cloud/VPC;
- data-region selection;
- custom identity and retention;
- SLA and support.

### 4. Connector marketplace

Later, allow paid connectors or templates with security review and a revenue share. Do not create a marketplace before the connector SDK and customer base exist.

### 5. Data products

Opt-in, privacy-safe benchmarks could become valuable:

- bot mix by category;
- crawl-to-referral ranges;
- AI referral conversion ranges;
- prompt variance by surface;
- common technical blocks.

Minimum cohort sizes and suppression are mandatory. Never expose a customer’s strategy, prompts, URLs, or performance.

### 6. Agent/commerce observability

If agent-initiated transactions grow, charge for:

- verified agent identity and policy;
- tool/API transaction tracing;
- authorization and confirmation audit;
- failure and fraud diagnostics;
- commerce feed/capability monitoring.

This is a future market, not a first launch assumption.

## Pricing guardrails

- No “unlimited” browser runs, model calls, or logs.
- No surprise token markup hidden from users.
- No charging for data export.
- No enterprise-only security basics such as token revocation.
- No paid claim that a proprietary score equals ranking.
- No plan that makes local/self-hosted intentionally unsafe or crippled.
- No annual lock-in before the product proves recurring value.
- Grandfather early paid design partners for a defined period, not forever.

## Conversion triggers

Show the upgrade at the moment the user feels the hosted value:

| Trigger | Upgrade message |
|---|---|
| Local report works | Schedule this every week and retain history. |
| Google auth setup is difficult | Use managed verified OAuth. |
| First crawler log import works | Stream automatically and alert on blocks/errors. |
| Prompt sample is useful | Repeat across engines/locales with raw history and variance. |
| Opportunity is found | Track the change and verify the outcome. |
| Second client/domain is added | Move to a multi-workspace plan. |
| A report is shared manually | Schedule a branded portal/email. |
| API usage grows | Add higher limits, webhooks, and SLA. |

## Paid-validation plan

Before building the full hosted stack:

1. Recruit 10 technical design partners: founders, in-house SEOs, and agencies.
2. Connect Google plus one log source.
3. Produce a manual evidence report and opportunity queue.
4. Ask for a paid pilot before automating every step.
5. Test three prices per segment.
6. Track which output caused payment:
   - time saved;
   - issue found;
   - conversion insight;
   - client retention/reporting;
   - trustworthy agent access.
7. Refuse “interest” as validation if the buyer will not connect data, schedule a recurring job, or pay.

## Recommended initial commercial bet

Launch:

- a genuinely useful free CLI;
- **Starter at $29** for one hosted domain;
- **Pro at $99** for multi-source measurement, repeated prompt panels, and experiments;
- **Agency at $299** for 25 client domains and reporting;
- custom enterprise usage.

The important test is not which number maximizes signup. It is whether users repeatedly pay for the evidence-to-action loop after the novelty of an AI visibility report wears off.
