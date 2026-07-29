# SEO Ranking Playbook

## What the product can and cannot promise

No tool can guarantee a ranking. aitraffic.dev can:

- verify whether a page is technically accessible and eligible;
- find defects and inconsistencies that impede discovery or presentation;
- show authoritative first-party search performance;
- help create clearer, more useful, better-supported pages;
- improve internal discovery and structured meaning;
- prioritize work using traffic and conversion evidence;
- measure whether a change preceded a useful outcome.

It cannot know or reproduce every ranking system, guarantee indexing, purchase authority, or infer causality from a simple before/after chart.

Google’s current [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) and [developer guide](https://developers.google.com/search/docs/fundamentals/get-started-developers) remain the baseline. Google’s 2026 [generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) explicitly says these foundations also apply to generative Search.

## The operating model

```text
Discover → Fetch/render → Index/understand → Select/present → Visit → Satisfy/convert
    │           │                │                 │          │             │
 links,       status,         canonical,        relevance,   CTR,         value,
 sitemap      robots, JS      content, schema   quality      referral      retention
```

The product should diagnose the earliest broken stage rather than prescribe content changes for every problem.

## 1. Discovery and site architecture

### What helps

- Use stable, descriptive URLs.
- Organize pages into logical topical and product/service structures.
- Link important pages with crawlable `<a href>` links.
- Keep important pages within sensible navigation depth.
- Create genuine hub/category pages that help users choose the next step.
- Include new and canonical URLs in accurate XML sitemaps.
- Avoid orphan pages and discovery that depends only on an internal search box.
- For very large sites, control faceted navigation and unbounded URL combinations.

Google explains that internal linkage helps it understand relative page importance and that ecommerce products should be reachable through crawlable navigation, sitemaps, or Merchant Center feeds: [ecommerce site structure](https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure).

### Product workflows

```bash
aitraffic crawl https://example.com --render auto
aitraffic links graph --orphans --depth-over 4
aitraffic sitemap audit
aitraffic architecture suggest-hubs
```

The output should group problems by template/component. “Fix one category component affecting 4,213 URLs” is more useful than 4,213 duplicate alerts.

### Guardrails

- A shallow URL is not automatically important; internal linkage and user value matter.
- Reorganizing stable URLs can create migration risk.
- A sitemap helps discovery but does not guarantee indexing.
- More internal links are not inherently better; links should be useful and interpretable.

## 2. Crawlability, rendering, and indexability

### What helps

- Return the correct HTTP status.
- Keep redirects direct and intentional.
- Allow required CSS, JavaScript, images, and APIs to be fetched.
- Make primary content and links available in rendered output.
- Keep robots.txt, meta robots, X-Robots-Tag, authentication, WAF, and CDN behavior consistent with the intended policy.
- Use `noindex` for index control where appropriate; do not rely on robots.txt alone to remove an already known URL.
- Avoid soft 404s, redirect loops, infinite crawl spaces, and accidental environment indexing.
- Monitor deploys for changes to status, rendering, canonical, robots, and sitemap behavior.

Google’s [crawling and indexing documentation](https://developers.google.com/search/docs/crawling-indexing) is the source of truth for Google-specific behavior.

### Product workflows

```bash
aitraffic inspect https://example.com/pricing
aitraffic render diff https://example.com/pricing
aitraffic indexability --important-pages money-pages.csv
aitraffic deploy check --base main --head HEAD
```

An indexability result should explain the full decision:

```text
Fetch: 200
Robots.txt: allowed for Googlebot
Meta robots: index,follow
X-Robots-Tag: absent
Canonical: self-referencing
Rendered primary content: present
Sitemap: included
Internal links: 14
GSC observation: indexed, Google canonical matches
```

### Guardrails

- A technically indexable URL may still not be indexed or ranked.
- JavaScript is not automatically bad; inaccessible or delayed primary content is the issue.
- Crawl volume alone is not success.
- A URL Inspection result is an observation with its own freshness, not a permanent truth.

## 3. Canonicalization and duplication

### What helps

- Redirect retired or truly duplicate URLs when there is a clear permanent replacement.
- Use consistent canonical URLs across internal links, sitemaps, structured data, hreflang, and redirects.
- Keep a unique page when the intent, product, location, or user value is genuinely distinct.
- Control tracking parameters, sorting, filtering, print versions, and protocol/host duplicates.
- During migrations, map old URLs to the closest useful new destination and monitor the transition.

### Product workflows

- Build a canonical cluster for every duplicate group.
- Compare declared canonical with Google-selected canonical where available.
- Detect conflicting signals.
- Generate a migration map and validate it before deployment.
- Monitor important legacy URLs and incoming links after launch.

### Guardrails

- Duplicate content is not automatically a penalty.
- Canonical is a signal, not a command.
- Redirecting many unrelated pages to a home page is not a valid migration.
- “Prune it” should require evidence about user need, links, conversions, uniqueness, and alternatives.

## 4. Titles, snippets, headings, and page purpose

### What helps

- Give each page a concise, descriptive title aligned with its real purpose.
- Make the visible main heading and opening content immediately clarify the subject.
- Use headings to expose a meaningful hierarchy, not just visual styling.
- Write descriptions and page copy for human decisions rather than keyword repetition.
- Keep important facts, prices, availability, dates, authors, and policies visibly current.
- Match the searcher’s need with the appropriate page type: guide, product, category, comparison, definition, tool, documentation, or support page.

### Product workflows

```bash
aitraffic pages intent-mismatch
aitraffic snippets opportunities --min-impressions 1000
aitraffic metadata review --template product
aitraffic headings audit
```

The opportunity engine should use GSC evidence:

- high impressions and low CTR;
- title or rich-result change correlated with a drop;
- multiple URLs competing for the same intent;
- page content that does not answer the queries attracting impressions;
- good search visits but poor next-step or conversion behavior.

### Guardrails

- Pixel or character limits are diagnostic approximations, not ranking rules.
- Repeating a query in every heading is not useful optimization.
- CTR changes can come from result layout, competitors, query mix, device, geography, or brand demand.

## 5. Helpful, reliable, people-first content

Google’s current AI-search guidance emphasizes unique, compelling, non-commodity content and warns against creating many query variations mainly to manipulate results. This should become a product quality gate.

### What helps

- Answer a real user need completely enough to support a decision or task.
- Add firsthand experience, original research, data, tools, examples, images, or demonstrations.
- Make factual claims specific and traceable to reliable sources.
- Show visible authorship, review, disclosures, and relevant expertise where they matter.
- Explain methods, limitations, and dates for research or comparisons.
- Update time-sensitive facts and retire misleading information.
- Cover a topic coherently rather than cloning near-identical pages for every wording variation.
- Keep conversion paths useful and avoid intrusive layouts that undermine the page.

### Content types worth operationalizing

| Type | Strong version | Weak version |
|---|---|---|
| Definition | Clear meaning, scope, examples, distinctions, and source | Circular one-sentence rewrite |
| How-to | Preconditions, ordered steps, checks, edge cases, outcome | Generic numbered list |
| Comparison | Named criteria, evidence, tradeoffs, audience fit, disclosed method | Undisclosed affiliate table |
| Review | Firsthand testing, artifacts, limitations, alternatives | Paraphrased specifications |
| Original research | Method, sample, raw/derived data, date, limitations | Unsupported “statistics” |
| Tool/calculator | Useful output, transparent inputs/formula, indexable explanation | Lead form with no value |
| Documentation | Stable concepts, examples, errors, versioning, changelog | Marketing copy posing as docs |
| Product/service page | Exact outcome, audience, capabilities, proof, constraints, next step | Keyword-stuffed brochure |
| Location page | Real location/service details, staff, proof, hours, local context | Swapped city-name template |

### Product workflows

```bash
aitraffic content inventory
aitraffic content information-gain --against top-sources
aitraffic claims audit --stale-after 365d
aitraffic brief create --query-cluster CLUSTER_ID
aitraffic content review --diff HEAD~1..HEAD
```

The tool should propose where to add original value, not synthesize more commodity prose.

### Guardrails

- Word count and keyword density are not quality measures.
- A content score must not become a recipe for producing lookalike pages.
- AI assistance is not itself a violation; scaled low-value or deceptive output is the risk.
- Do not fabricate authors, credentials, quotations, customers, tests, reviews, or sources.

## 6. Structured data and entity clarity

Google says structured data can help it understand content and make a page eligible for supported rich results. It does not guarantee display or a ranking increase. Follow Google’s [general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), use its feature documentation for Google behavior, and use Schema.org as the broader vocabulary.

### What helps

- Choose the most specific relevant type.
- Include required properties and accurate recommended properties.
- Keep markup consistent with visible content.
- Use stable `@id` identifiers to connect an organization, website, authors, products, offers, locations, and content where useful.
- Ensure referenced images and URLs are crawlable.
- Validate syntax, feature eligibility, and deployed output.
- Monitor template changes for widespread errors.

### High-value use cases

- `Organization` / relevant subtype and a consistent brand identity.
- `WebSite`, `BreadcrumbList`, and navigational clarity.
- `Article`, `NewsArticle`, author, date, image, and publisher information.
- `Product`, `Offer`, shipping, return, availability, identifiers, and merchant listing requirements.
- `LocalBusiness` and specific business subtypes.
- `VideoObject`, `Recipe`, `Event`, `JobPosting`, `SoftwareApplication`, or other supported types only where the page actually qualifies.

Google announced that FAQ rich results stopped appearing on May 7, 2026 and plans Search Console API deprecation for that appearance. FAQ sections can still help users, but aitraffic.dev should not sell FAQ markup as a general rich-result shortcut.

### Product workflows

- Parse and graph all structured data.
- Validate Google-supported features separately from generic Schema.org vocabulary.
- Compare markup with visible content and product feeds.
- Generate a diff, not a blind overwrite.
- Measure a controlled rollout using Search Console, as Google itself recommends.

## 7. Page experience, performance, and accessibility

### What helps

- Make the site secure, mobile-usable, fast enough, stable, and accessible.
- Monitor field experience with CrUX rather than relying only on a lab score.
- Use Lighthouse and deterministic audits to diagnose causes.
- Prioritize high-traffic/high-conversion templates and the worst user cohorts.
- Correlate regressions with releases and third-party scripts.

Useful official sources:

- [CrUX API](https://developer.chrome.com/docs/crux/guides/crux-api)
- [PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started)
- [Lighthouse](https://github.com/GoogleChrome/lighthouse)

The PageSpeed API documentation says its included CrUX field data is planned for discontinuation and recommends querying CrUX APIs directly. Architecture should therefore store Lighthouse lab data and CrUX field data as separate sources.

### Product workflows

```bash
aitraffic vitals report --device mobile
aitraffic lighthouse run --pages top-landing-pages
aitraffic performance regressions --since-deploy DEPLOY_ID
aitraffic accessibility audit
```

### Guardrails

- A perfect Lighthouse score is not the business goal.
- Core Web Vitals are not a substitute for relevance and value.
- Lab and field data answer different questions.
- Automated accessibility checks do not replace human testing.

## 8. Search presentation and vertical discovery

### Ecommerce

Combine:

- crawlable product/category structure;
- Product/Offer structured data;
- Merchant Center product feeds;
- consistent price, availability, shipping, return, identifiers, and category;
- real product content, images, reviews, comparisons, and support;
- pagination and faceted-navigation control.

Google recommends structured data and Merchant Center feeds together where possible: [ecommerce SEO guidance](https://developers.google.com/search/docs/specialty/ecommerce).

### Local

Combine:

- accurate Business Profile data;
- consistent business name, address, phone, hours, services, and categories;
- useful location/service pages;
- visible reviews and response workflow where permitted;
- relevant LocalBusiness data;
- local organic, map, call, direction, lead, and store outcome measurement.

### International

Combine:

- genuinely localized content and offers;
- stable locale-specific URLs;
- correct reciprocal hreflang and `x-default`;
- canonical alignment;
- local currency, policies, address, availability, and conversion;
- performance by country/language rather than one global average.

### Images and video

Make important media discoverable, high quality, contextually explained, fast, and represented with appropriate metadata/sitemaps. Google’s generative AI guidance also says images and video create additional ways to appear.

### News and publishers

Audit:

- dates, bylines, corrections, publisher identity, and visible sourcing;
- article and news sitemap requirements;
- crawl/access rules and paywall implementation;
- Discover and news performance;
- original reporting versus commodity summaries;
- AI crawler access, citation, referral, and content-use policy as separate dimensions.

## 9. Authority and reputation

No open-source package can recreate a full commercial web-scale backlink index cheaply. The honest product choices are:

- use GSC’s available link information;
- integrate a licensed backlink/brand-monitoring provider;
- accept customer warehouse/export data;
- crawl a constrained, lawful source set for a specific investigation;
- use prompt citations and public mentions as a separate, sampled graph.

Useful work includes:

- find important unlinked or misattributed mentions;
- identify sources that repeatedly support competing entities;
- correct stale brand facts and broken citations;
- turn genuinely original research or tools into relevant outreach;
- monitor reputation and review sources with authorization;
- flag manipulative link schemes and spam.

The product should not sell bulk link generation, paid-link automation, comment spam, or fake reputation.

## 10. Measurement and experiments

Every recommendation should ship with a measurement plan.

### Minimum change record

```yaml
change_id: chg_123
hypothesis: Clarifying the product title will improve qualified CTR.
pages:
  - /product/widget
changed_at: 2026-08-04T10:30:00Z
change_type: title
primary_metric: gsc_ctr
guardrails:
  - gsc_impressions
  - ga4_key_event_rate
expected_delay: 28d
confounders:
  - promotion_start
  - sitewide_navigation_release
```

### Analysis levels

1. **Deterministic verification** — Did the deployed HTML, status, schema, link, or policy change as intended?
2. **Descriptive before/after** — What moved, with explicit caveats?
3. **Matched comparison** — Did changed pages move differently from similar unchanged pages?
4. **Controlled test** — Where practical and policy-safe, use defined treatment/control groups and stopping rules.
5. **Causal claim** — Rare; only when design and data justify it.

## 11. How the opportunity engine should rank work

Do not rank work by “number of warnings.” Use:

```text
priority =
  evidence_strength
  × affected_business_value
  × likely_addressability
  × expected_learning
  × confidence
  ÷ estimated_effort_and_risk
```

Each opportunity should include:

- affected pages, queries, cohorts, or templates;
- observed evidence and freshness;
- why the system thinks this is a bottleneck;
- alternative explanations;
- action and expected mechanism;
- required permission;
- verification method;
- rollback path;
- no claim of guaranteed lift.

## 12. Agent-safe SEO

Agents are especially useful for:

- recurring diagnostics;
- evidence collection and report preparation;
- code and content diffs;
- sitemap/schema/internal-link validation;
- issue creation;
- post-deploy verification;
- reconciling large, repetitive datasets.

Require human approval or strict policy for:

- publishing or deleting pages;
- changing canonical, robots, redirects, or hreflang at scale;
- outreach or reputation responses;
- submitting many URLs;
- editing prices, availability, legal claims, health/finance content, or business facts;
- spending money or changing ad/campaign settings.

The outcome is not “autonomous SEO.” It is **faster, traceable SEO work with bounded agents and measurable results**.
