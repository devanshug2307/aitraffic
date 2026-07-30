# Evidence contract

Interpret output in this order:

1. `sources`: provider, method, subject, period, retrieval time, and caveats.
2. `coverage`: requested, observed, omitted, truncated, sampled, partial, and
   incomplete reasons.
3. `observations`: directly collected or deterministic values.
4. `findings`: rule results that must point back to evidence or observations.
5. `recommendations`: reviewable actions, not guaranteed outcomes.
6. `warnings`: limitations that affect interpretation.

Use these evidence classes consistently:

| Class | Meaning | Example |
|---|---|---|
| observed | Directly returned by a source | HTTP status, GSC clicks, GA4 sessions |
| sampled | Observed through an explicit sample | Repeated prompt result |
| inferred | Interpretation derived from evidence | Below-baseline CTR opportunity |
| action | Proposed or recorded change | Review title and description |
| unknown | Not answerable from available coverage | JavaScript-rendered metadata in a static crawl |

Do not convert `inferred` into `observed` in the explanation. A deterministic
calculation may be reproducible while its product implication remains an
inference.

## Prioritization

Rank findings using:

1. proven access or indexing conflict on an important page;
2. observed demand or conversion evidence;
3. number and importance of affected URLs;
4. confidence and coverage quality;
5. estimated implementation effort;
6. reversibility and verification cost.

AItraffic severity is an operational priority, not a Google-provided ranking
factor or guaranteed impact score.

## Safe summaries

Prefer:

- "No blocker was observed in the returned static HTML."
- "The page was not observed in the complete sitemap set."
- "This URL was unlinked within the complete bounded static crawl."
- "The selected period shows an association after the change."

Avoid:

- "The page is definitely indexable."
- "This is an orphan page" when crawl coverage is partial.
- "This change caused the traffic increase."
- "This schema will earn a rich result."
