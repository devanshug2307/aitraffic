# Structured data

1. Run `site.page_audit` for a target URL or `site.crawl` for site-level syntax
   coverage.
2. Report JSON-LD blocks observed in returned static HTML, parse success,
   syntax errors, and observable `@type` values.
3. Distinguish no block observed from proof of absence when JavaScript could
   inject markup.
4. Do not call parseable JSON-LD valid Schema.org markup or rich-result
   eligible.
5. For a proposed repair, prepare a minimal reviewable diff and preserve the
   page's actual entities. Do not invent ratings, authors, prices, or other
   claims.
6. Recommend the relevant Google Rich Results Test and Schema Markup Validator
   as follow-up verification.

CLI fallback:

```bash
aitraffic audit page https://example.com/page --format json
```
