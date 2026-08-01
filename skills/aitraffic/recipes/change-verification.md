# Change verification

1. Before proposing a change, save the unified audit baseline with
   `aitraffic audit <URL> --save --format json`. Preserve its run ID, URL,
   period, coverage, evidence references, and current page observations.
2. Prepare a dry run or code diff. State the expected mechanism, possible side
   effects, rollback, and exact post-change check.
3. Treat a broad request to fix or install as approval to prepare the patch,
   not to apply an unseen diff or deploy it. Wait for explicit approval of the
   proposed change before editing files or external systems.
4. Record the approved implementation locally before verification. First
   preview it with `--dry-run`; after the user confirms, save the exact
   opportunity, affected URL(s), change type, and any known concurrent work:

   ```bash
   aitraffic changes record --opportunity OPP_ID --url URL --type metadata --note "WHAT CHANGED" --dry-run --format json
   ```

   Never invent a Git commit, deployment reference, content hash, or change
   that was not observed or supplied by the user.
5. After implementation, rerun the same bounded audit with `--save`, then use
   `aitraffic audit compare <OLDER_RUN_ID> <NEWER_RUN_ID> --format json`.
   Match the target and crawl options. Treat `unknown` as a coverage limitation,
   not a pass or failure.
6. Preview `aitraffic opportunities sync --latest --dry-run --format json`,
   then apply it after approval. A comparable technical resolution can move
   the queue item to `verified`; Google absence cannot.
7. Use `aitraffic changes show CHANGE_ID --format json` to connect the change
   record to the queue's current observation and verification state.
8. For GSC or GA4 outcomes, use comparable later periods and preserve
   seasonality, incomplete-data, and external-change caveats.
9. Say "associated with" rather than "caused" unless a suitable experiment
   supports causality.
10. Saved audits and change records are private local evidence artifacts.
    Do not invent automatic implementation or rollback commands.
