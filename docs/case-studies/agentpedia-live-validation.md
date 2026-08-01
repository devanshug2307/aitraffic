# Agentpedia Live Validation

Validated locally on 2026-07-31 against `https://agentpedia.codes` using
AItraffic's bounded public crawl and an existing read-only Google adapter.

## Purpose

This dogfood run tested whether the unified audit produces useful,
repeatable evidence on a real site without flooding a coding agent's context
or turning incomplete provider data into false conclusions.

No site content, Google setting, credential, or remote resource was changed.
Google profile labels, resource IDs, queries, and page-level business data are
intentionally omitted from this document.

## Commands

```bash
aitraffic doctor
aitraffic audit https://agentpedia.codes \
  --google required \
  --save \
  --limit 25 \
  --opportunity-limit 10 \
  --top 15
aitraffic opportunities sync --latest --dry-run
aitraffic opportunities sync --latest

# Run the same bounded audit again.
aitraffic audit https://agentpedia.codes \
  --google required \
  --save \
  --limit 25 \
  --opportunity-limit 10 \
  --top 15
aitraffic audit compare --latest
aitraffic opportunities sync --latest
```

Use `--format json` for the complete machine-readable result or `--verbose`
for expanded terminal output.

## Result

| Check | Observed result |
|---|---:|
| Requested and observed URLs | 34 / 34 |
| Pages technically audited | 25 |
| Failed page audits | 0 |
| Technical findings | 0 |
| Invalid JSON-LD findings | 0 |
| Fragment-induced overlap findings | 0 |
| Site-owned sitemap defect findings | 0 |
| Pages compared across immediate repeat runs | 25 |
| Pages with changed semantic hashes | 0 |
| Google opportunities retained across the comparison | 27 |
| Duplicate opportunities created on second sync | 0 |

The sitemap exposed more URLs than the configured audit discovery limit. The
run therefore reported partial, truncated coverage and the number of omitted
URLs. That is an AItraffic sampling constraint, not a site sitemap defect.

Search Console query/page evidence was also incomplete. The comparison kept
opportunities that appeared in both runs, marked the Google comparison
partial, and did not infer that an absent row was resolved.

## Corrections validated by the run

- JSON-LD is parsed from the complete script content instead of display-text
  truncation.
- Fragment variants are aggregated to one document URL before overlap
  analysis.
- Internal sitemap retention limits affect coverage metadata rather than
  creating a site defect.
- Page-change comparison uses a semantic hash that ignores volatile
  executable scripts but still changes for visible or structured content.
- Default text output is compact and summary-first; complete JSON remains
  available.
- Partial Search Console runs can preserve repeated observations without
  claiming complete appearance or disappearance.
- Queue synchronization is stable across equivalent repeat runs.

## Interpretation

This result establishes repeatability for one bounded live-site scenario. It
does not prove full-site coverage, indexing, ranking, AI citations, or future
behavior. The same workflow should still be validated on additional sites with
different platforms, sitemap sizes, and Google data volumes.
