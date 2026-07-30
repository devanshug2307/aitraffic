# Internal links

1. Run `site.crawl` with a scope large enough to support the requested decision.
2. Inspect coverage and discovery sources before using unlinked-page findings.
3. Report a broken target only when its audited destination produced the
   corresponding error evidence.
4. Use "unlinked within this complete bounded static crawl" only when coverage
   is complete. With partial coverage, describe a candidate or unknown.
5. Propose links only from contextually relevant audited pages. Include source,
   destination, suggested anchor intent, and rationale.
6. Do not enforce arbitrary link-count or click-depth thresholds.

CLI fallback:

```bash
aitraffic crawl https://example.com --limit 100 --format json
```
