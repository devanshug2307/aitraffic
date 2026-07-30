# Command contract

## Preferred MCP sequence

Use:

```text
get_project_status
aitraffic_list_capabilities
aitraffic_describe_capability
aitraffic_run
```

Registered capability IDs:

| ID | Use |
|---|---|
| `site.page_audit` | One public page without Google authentication |
| `site.crawl` | Bounded sitemap and static-link crawl without Google authentication |
| `google.opportunities` | GSC demand joined to GA4 Organic Search landing outcomes |
| `site.audit_opportunities` | Google opportunities plus bounded audits of priority pages |

Compatibility MCP tools include `google_connection_status`,
`list_google_resources`, `run_gsc_report`, `run_ga4_report`,
`analyze_ai_acquisition`, `analyze_log_file`, and `classify_user_agent`.

## CLI fallback

Always request JSON for agent use:

```bash
aitraffic doctor --format json
aitraffic capabilities list --format json
aitraffic capabilities describe site.crawl --format json
aitraffic capabilities run site.crawl --url https://example.com --limit 25 --format json
aitraffic crawl https://example.com --limit 25 --format json
aitraffic audit page https://example.com/page --format json
aitraffic opportunities --days 28 --format json
aitraffic audit opportunities --days 28 --limit 5 --format json
aitraffic report acquisition --days 28 --format json
aitraffic crawlers access.log --format json
```

Prefer an installed executable, project-local dependency, or locally built
checkout. If none exists, ask before retrieving a package and use an explicit
version such as `npx -y aitraffic@0.6.0`; do not silently execute
`aitraffic@latest`. Pin every CI or reproducible automation command.

## Failure handling

- Exit `0`: command succeeded; still inspect coverage.
- Exit `2`: expected configuration or input error; report the remediation.
- Exit `1`: unexpected command failure; preserve the error without inventing
  findings.
- If Google is unavailable, continue with `site.page_audit` or `site.crawl`
  when that still answers part of the request.
- Never retry OAuth or resource selection on the user's behalf.
- Treat `aitraffic init` and interactive onboarding as local writes rather than
  read-only diagnostics.
