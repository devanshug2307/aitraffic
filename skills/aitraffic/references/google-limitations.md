# Google limitations

## Search Console

- Search Analytics returns top rows rather than a complete query ledger and can
  omit anonymized queries.
- Search Console and GA4 differ in collection, attribution, time zone, privacy,
  and URL handling.
- Equal-period comparisons are descriptive. Seasonality and external changes
  remain possible explanations.

## GA4

- Thresholding, cardinality, consent, retention, channel configuration, and
  incomplete data can affect reports.
- AItraffic joins GSC and GA4 at a normalized landing-page path. It does not
  create user-level attribution.
- Referral and channel labels depend on the property's tracking and channel
  configuration.

## Crawling and indexing

- A successful HTTP fetch is not proof of indexing.
- `robots.txt` controls crawling, not authorization or guaranteed deindexing.
- A `noindex` directive must be observable to a crawler to be acted on.
- A declared canonical is a hint. Cross-domain or non-self canonicals are not
  automatically errors.
- Sitemap inclusion is a discovery and canonical hint; omission is not an
  indexing blocker.

## Structured data and search appearance

- JSON-LD syntax success does not prove Schema.org validity, Google rich-result
  eligibility, policy compliance, or display.
- Missing structured data in returned static HTML does not prove that a
  rendered page has none.
- Titles and descriptions do not have deterministic ranking-safe character
  limits. Do not enforce folklore thresholds.

## AI visibility

- GA4 AI Assistant referrals measure observable visits, not every AI-influenced
  journey.
- Crawler access, training access, search retrieval, citations, mentions, and
  referrals are different evidence surfaces.
- A sampled assistant answer is not a stable global ranking.
