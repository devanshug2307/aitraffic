# GSC and GA4 opportunities

1. Check `google_connection_status`. Stop the Google portion if the selected
   profile, GA4 property, or Search Console site is missing. Confirm that the
   selected Search Console property covers the audited site; ask the user when
   that relationship cannot be established.
2. Describe and run `google.opportunities` with a 28-day period by default.
3. Preserve equal-period dates, row caps, anonymized-query limitations, GA4
   data-quality metadata, and normalized-path join caveats.
4. Rank existing-demand opportunities using impressions, position, property
   baseline CTR, clicks, trend, landing outcomes, confidence, and effort.
5. Run `site.audit_opportunities` when technical page evidence will clarify the
   top opportunities.
6. When the user wants durable work tracking, save a unified audit and route to
   [opportunity-queue.md](opportunity-queue.md). Google opportunity absence is
   not deterministic verification.
6. Do not forecast clicks or revenue unless the user explicitly asks for a
   clearly labeled scenario model.

CLI fallback:

```bash
aitraffic opportunities --days 28 --format json
aitraffic audit opportunities --days 28 --limit 5 --format json
```
