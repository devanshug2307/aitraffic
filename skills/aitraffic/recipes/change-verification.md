# Change verification

1. Before proposing a change, save the unified audit baseline with
   `aitraffic audit <URL> --save --format json`. Preserve its run ID, URL,
   period, coverage, evidence references, and current page observations.
2. Prepare a dry run or code diff. State the expected mechanism, possible side
   effects, rollback, and exact post-change check.
3. Treat a broad request to fix or install as approval to prepare the patch,
   not to apply an unseen diff or deploy it. Wait for explicit approval of the
   proposed change before editing files or external systems.
4. After implementation, rerun the same bounded audit with `--save`, then use
   `aitraffic audit compare <OLDER_RUN_ID> <NEWER_RUN_ID> --format json`.
   Match the target and crawl options. Treat `unknown` as a coverage limitation,
   not a pass or failure.
5. For GSC or GA4 outcomes, use comparable later periods and preserve
   seasonality, incomplete-data, and external-change caveats.
6. Say "associated with" rather than "caused" unless a suitable experiment
   supports causality.
7. Saved audits are private local evidence artifacts, not deployed change
   records. Do not invent `change record`, `change verify`, or automatic
   rollback commands.
