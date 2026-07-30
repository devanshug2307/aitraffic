# SEO audit

1. Describe and run `site.full_audit` against the canonical public site URL.
   Start with 25 pages, Google `auto`, and the top ten findings unless the user
   requests another bounded scope. This composes the crawl and matching Google
   opportunity evidence without requiring Google.
2. Inspect coverage before interpreting findings. State page and sitemap limits,
   omitted URLs, fetch failures, and whether the crawl was complete.
3. Group exact rule IDs under access/indexing, canonical, metadata, structured
   data, internal links, sitemap, and cross-page consistency.
4. Inspect `result.google.status`. In `auto` mode, do not block the technical
   audit when Google is unavailable, mismatched, or fails. Use Google
   `required` only when the user explicitly needs Google evidence.
5. Prioritize confirmed blockers and high-demand pages over cosmetic findings.
6. Return no more than ten primary actions unless the user requests a complete
   backlog. Include affected URLs, evidence references, effort, and verification.
7. When the user wants a repeatable baseline or later verification, use the CLI
   fallback with `--save`; history is intentionally a local CLI write rather
   than an MCP capability side effect.

CLI fallback:

```bash
aitraffic audit https://example.com --limit 25 --google auto --save --format json
aitraffic audit history --limit 10 --format json
aitraffic audit compare --latest --format json
```
