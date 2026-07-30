# Indexing audit

1. Run `site.page_audit` for one URL or `site.crawl` for a bounded site scope.
2. Review requested/final URL, redirect chain, final status, robots evaluation,
   effective robots directives, canonical targets, and sitemap membership.
3. Treat a crawl-blocked page relying on `noindex` as a configuration conflict
   only when those observations are present.
4. Call sitemap absence a gap only when sitemap coverage is complete and the
   page is intended to be canonical and indexable.
5. Say "no checked blocker observed" rather than "indexable."
6. Recommend Search Console URL Inspection as a separate confirmation when the
   question is about Google's actual indexed state.

CLI fallback:

```bash
aitraffic audit page https://example.com/page --format json
aitraffic crawl https://example.com --limit 25 --format json
```
