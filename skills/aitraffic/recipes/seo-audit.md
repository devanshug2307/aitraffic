# SEO audit

1. Describe `site.crawl`, then run it against the canonical public site URL.
   Start with 25 pages unless the user requests another bounded scope.
2. Inspect coverage before interpreting findings. State page and sitemap limits,
   omitted URLs, fetch failures, and whether the crawl was complete.
3. Group exact rule IDs under access/indexing, canonical, metadata, structured
   data, internal links, sitemap, and cross-page consistency.
4. If Google is connected and the user wants prioritization, run
   `site.audit_opportunities` for up to five pages. Do not block the technical
   audit when Google is unavailable.
5. Prioritize confirmed blockers and high-demand pages over cosmetic findings.
6. Return no more than ten primary actions unless the user requests a complete
   backlog. Include affected URLs, evidence references, effort, and verification.

CLI fallback:

```bash
aitraffic crawl https://example.com --limit 25 --format json
aitraffic audit opportunities --days 28 --limit 5 --format json
```
