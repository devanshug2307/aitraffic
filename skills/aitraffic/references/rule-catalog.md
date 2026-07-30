# Rule catalog

Use this catalog to group returned rule IDs. Preserve the exact AItraffic rule
ID in the final report.

| Area | Examples | Appropriate action boundary |
|---|---|---|
| Fetch and redirects | failed fetch, redirect loop, redirecting sitemap URL | Confirm intended destination before changing routes |
| Crawl control | robots disallow, crawl-blocked noindex | Resolve only when the page is expected to be discoverable |
| Index directives | noindex and sitemap conflict | Confirm page intent before removing directives |
| Canonical | conflicting targets, broken target, sitemap target conflict | Review duplicate strategy and direct live target |
| Metadata | missing or blank title/description | Draft changes; do not write without approval |
| Structured data | invalid JSON-LD syntax | Fix syntax, then use relevant validator |
| Internal links | audited target error, unlinked in complete static crawl | Propose contextual links from relevant pages |
| Sitemap | parse/fetch incomplete, absent from complete set | Repair coverage or add intended canonical URLs |
| Cross-page | duplicate title in audited set | Review intent; templates can be deliberately similar |

Do not create findings from title-length, description-length, exactly-one-H1,
keyword-density, internal-link-count, or "three-click" thresholds.
