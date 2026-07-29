# Roadmap and Validation

## Roadmap rule

Do not build the complete feature catalog in order. Ship one credible evidence loop, charge for it, and expand from observed usage.

The loop:

```text
connect → observe → diagnose → approve action → verify → report
```

## Phase 0: Decisions and design partners (weeks 0–2)

### Product decisions

- Confirm the relationship: “AI Traffic by TrafficClaw.”
- Reserve package/repository/organization names.
- Choose Apache-2.0 or MIT for the open components.
- Define observed, sampled, inferred, action, and unknown evidence classes.
- Define the initial bot taxonomy and verification levels.
- Publish security and data-retention principles before requesting OAuth.

### Design partners

Recruit:

- 3 technical founders;
- 3 in-house SEO/growth teams;
- 4 agencies with several client sites.

Qualification:

- owns a site with meaningful GSC/GA4 data;
- can supply or connect a server/CDN log source;
- has a real search/AI acquisition question;
- agrees to a recurring workflow;
- has authority to pay for a pilot.

### Interviews

Ask for the last real investigation:

- What changed?
- Which tools and exports were used?
- Where was the evidence inconclusive?
- What decision was made?
- How long did it take?
- What would a trustworthy answer be worth?

Do not ask “would you use an AI SEO CLI?” in isolation.

### Exit criteria

- at least 5 users provide real data;
- at least 3 repeat the workflow;
- at least 3 agree to a paid pilot or paid concierge report;
- one narrow outcome clearly dominates.

## Phase 1: Open foundation (weeks 2–6)

### Deliverables

1. `@aitraffic/cli` or equivalent package.
2. Versioned evidence schema and JSON Schema.
3. Local config and SQLite store.
4. Google local/BYO auth.
5. GSC site discovery and performance reports.
6. GA4 property discovery and AI Assistant/referral/conversion reports.
7. Generic log importer.
8. Bot taxonomy with verification metadata.
9. Basic site access/indexability audit.
10. Stable JSON output.
11. Local MCP server with read-only tools.
12. Example datasets, fixtures, and redaction guidance.

### Initial commands

```bash
aitraffic init
aitraffic auth google
aitraffic sites
aitraffic search report --since 28d
aitraffic referrals --channel ai-assistant
aitraffic logs import access.ndjson
aitraffic crawlers
aitraffic audit https://example.com
aitraffic report --json
aitraffic mcp serve
```

### Reuse

- Extract stable functions from current Google services.
- Reuse existing PageSpeed, schema, opportunity, and report patterns.
- Use a permissive crawler/audit component where it reduces work.
- Keep the web UI out of the critical path.

### Exit criteria

- clean setup on macOS/Linux and CI;
- reproducible JSON fixture tests;
- no tokens in output/logs;
- five partner sites complete a report;
- at least one finding is independently verified on three sites;
- users can export everything.

## Phase 2: Hosted wedge (weeks 6–12)

### Deliverables

- managed Google OAuth;
- encrypted token storage, revoke/delete, and source health;
- scheduled GSC/GA4 sync;
- Cloudflare connector plus generic log upload;
- hosted evidence history;
- weekly digest;
- one evidence-oriented dashboard;
- core opportunity rules:
  - search/answer-time agent blocked;
  - crawler errors on important pages;
  - high-impression/low-CTR;
  - content decay;
  - AI referrals with low conversion;
  - GSC/GA4 landing-page gap;
- change annotations;
- remote read-only MCP/API;
- Dodo/Stripe billing as appropriate to existing TrafficClaw operations.

### Paid pilot

Offer:

- one domain;
- Google + Cloudflare/log source;
- weekly evidence report;
- one monthly investigation;
- $29–$99 depending on segment.

Charge from the beginning. Concierge analysis is acceptable while the rules mature.

### Exit criteria

- 10 paying sites;
- at least 60% four-week retained usage or digest engagement;
- at least 5 tracked actions;
- at least 3 customers say a recurring report/action saves meaningful time or money;
- connector support load remains manageable;
- gross margin is understood for each job type.

## Phase 3: Reproducible AI visibility (months 3–5)

### Deliverables

- prompt-panel schema and importer;
- small manual/BYOK runner;
- managed browser/API adapters for selected engines;
- raw answer and citation archive;
- exact provenance;
- repeated runs and variance;
- normalized citation/source graph;
- competitor and source-gap workflow;
- strict prompt budget controls;
- join to crawler/referral/page/conversion evidence.

### Launch constraint

Support fewer surfaces well. A matrix of every assistant × country × language × account type is operationally expensive and hard to interpret.

Suggested starting panel:

- 20–50 high-intent prompts;
- 2–3 surfaces;
- one locale;
- 2–3 repeats at a useful cadence.

### Exit criteria

- customers understand panel scope without training;
- raw answers explain every aggregate;
- run variance is visible;
- prompt cost stays within plan economics;
- at least 5 customers act on a source, page, or fact gap;
- none of the product copy implies global rank.

## Phase 4: Closed-loop actions (months 4–7)

### Deliverables

- unified opportunity queue;
- GitHub issue creation;
- draft pull request for deterministic code changes;
- CMS draft integrations for one or two demanded systems;
- change registry and deploy linkage;
- deterministic post-deploy verification;
- experiment definition and matched before/after view;
- approvals, policies, budgets, and rollback.

### Start with safe changes

- metadata/schema diff;
- internal-link suggestion;
- sitemap/robots validation;
- broken link/redirect fix;
- structured data/page/feed conflict;
- report/issue generation.

Do not begin with mass content publishing or unsupervised canonical/robots changes.

### Exit criteria

- 20 changes tracked end to end;
- deterministic verification catches failures;
- at least 5 customers repeat the action workflow;
- recommendations rejected by users are logged with reasons;
- no material unauthorized or silent change.

## Phase 5: Agency product (months 6–9)

### Deliverables

- multiple Google accounts and client workspaces;
- saved investigation templates;
- multi-client source-health and anomaly view;
- branded client portal/report;
- scheduled email/Slack/webhook;
- approval and assignee flow;
- 25-domain plan and usage pool;
- API/export;
- agency onboarding and migration.

### Exit criteria

- 5 paying agencies;
- at least 3 use it for 5+ clients;
- reports replace a real manual process;
- agency gross margin works after prompt/log usage;
- clients can inspect evidence, not only a score.

## Phase 6: Vertical and enterprise expansion (months 9–18)

Build only the verticals demanded by retained customers.

### Ecommerce

- Merchant Center;
- Product/Offer/page/feed reconciliation;
- inventory, price, shipping, returns;
- UCP/agentic-commerce readiness only with design partners;
- agent transaction observability.

### Local

- Business Profile;
- location facts and structured data;
- review/reputation workflow;
- call/direction/lead outcomes.

### Publisher

- high-volume crawl analytics;
- article/news sitemap and source evidence;
- content policy/licensing;
- paid access or pay-per-crawl experiments.

### Enterprise

- SSO/SCIM/RBAC;
- audit and approval;
- warehouse;
- data region/retention;
- private deployment;
- SLA.

## Prioritization score

Score candidate features:

```text
feature score =
  paid_user_frequency
  × outcome_value
  × differentiation
  × evidence_quality
  × reuse_leverage
  ÷ build_and_operating_cost
```

Add a hard gate:

> Does this feature make the evidence-to-action loop stronger, or is it a separate product?

If it is separate, integrate or defer.

## Build / integrate / defer

### Build now

- evidence schema and provenance;
- CLI and stable JSON;
- cross-source joins;
- opportunity and change model;
- source capability/health;
- trust/security UX;
- Google + logs + small prompt-panel workflows.

### Integrate

- Lighthouse/CrUX/PageSpeed;
- a permissive crawler foundation;
- Schema.org/Google validation rules;
- Cloudflare and log platforms;
- GitHub/CMS;
- Merchant Center/Business Profile when demanded;
- licensed backlink/SERP/keyword data rather than a fake homemade index.

### Defer

- full web-scale backlink index;
- universal keyword-volume database;
- broad product analytics/session replay;
- enterprise data warehouse before volume;
- dozens of model surfaces;
- autonomous publishing;
- agent-commerce/payment protocols without customers;
- marketplace;
- cross-customer benchmarks before consent and scale.

## Validation experiments

## 1. OAuth trust

Variants:

- hosted OAuth;
- local OAuth;
- BYO OAuth;
- service account.

Measure:

- connection completion;
- abandonment at scope consent;
- support load;
- preferred mode by segment;
- willingness to pay for managed auth.

## 2. Primary outcome

Give users four report entry points:

- AI referrals and revenue;
- crawler access/errors;
- search/AI visibility;
- opportunity queue.

Measure which one creates:

- saved report;
- recurring schedule;
- shared output;
- tracked action;
- payment.

## 3. Prompt panel value

Compare:

- one run;
- three repeats with variance;
- raw answers plus source gaps;
- source gaps plus action/verification.

Hypothesis: buyers pay for diagnosis and action more than a larger prompt count.

## 4. CLI versus dashboard

Measure separately:

- installation;
- command repeat;
- JSON/MCP use;
- dashboard use;
- report sharing.

The CLI may drive acquisition and trust while the dashboard/report drives recurring payment.

## 5. Pricing

Run segment-specific tests:

- solo: $19/$29/$39;
- team: $79/$99/$149;
- agency: $249/$299/$499.

Do not compare only signup conversion. Compare 8–12 week retention and usage cost.

## 6. Concierge before automation

Manually produce the complete evidence report for 10 sites. Record:

- time per data source;
- recurring questions;
- missing data;
- mistaken inferences;
- which section gets shared;
- which recommendation gets implemented;
- price accepted.

Automate the repeated high-value work, not every possible chart.

## Product metrics

### North-star candidate

**Verified actions per active site per month**

Definition:

- an action tied to evidence;
- approved or executed;
- deterministic verification completed;
- later evaluation scheduled or completed.

This avoids rewarding more warnings or prompt runs.

### Supporting metrics

- time to first connected evidence;
- source connection success;
- sites with Google + log source;
- weekly active sites;
- saved/repeated investigations;
- opportunity-to-action rate;
- verification completion;
- paid conversion and retention by segment;
- prompt/log gross margin;
- connector failure and support rate;
- export/delete/revoke success;
- percentage of inferences with traceable evidence;
- user-reported false positive/rejection rate.

### Anti-metrics

Do not optimize for:

- number of warnings;
- number of generated pages;
- number of prompt runs;
- crawler request volume;
- score volatility;
- model tokens consumed.

## Kill or pivot criteria

Reconsider the strategy if, after the hosted and prompt phases:

- users will connect Google but not logs or recurring prompts;
- reports are viewed once and not scheduled;
- findings do not produce tracked actions;
- agencies will not pay above low self-serve prices;
- prompt/browser cost makes gross margin structurally poor;
- customers only want a free referrer view;
- the product cannot explain metric differences;
- OAuth/security support overwhelms revenue.

Possible pivots:

- agency reporting and evidence infrastructure;
- developer-only local CLI/MCP with paid support;
- crawler/agent access observability for publishers;
- ecommerce agent readiness and transaction observability;
- TrafficClaw-only internal engine rather than a separate public cloud.

## Immediate next 10 actions

1. Point `aitraffic.dev` to a minimal waitlist/docs page.
2. Reserve npm, GitHub organization/repository, and social names.
3. Publish the product thesis and evidence definitions.
4. Create the evidence schema package and example fixture.
5. Extract one GSC and one GA4 report behind stable functions.
6. Build local OAuth and `aitraffic sites`.
7. Add generic log import and bot verification labels.
8. Run a concierge report for three existing TrafficClaw users.
9. Ask those users to pay for a recurring version.
10. Open-source the first working CLI only after secrets, redaction, and export tests pass.
