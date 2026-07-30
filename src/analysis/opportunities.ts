import { acquisitionPeriods } from "./acquisition.js";
import {
  fetchPaginatedGa4Report,
  fetchPaginatedGscReport,
} from "../connectors/google/pagination.js";
import type {
  Ga4ReportResponse,
  Ga4ReportCoverage,
  GoogleConnectorConfig,
  GoogleDataProvider,
  GscReportCoverage,
  GscRow,
} from "../connectors/google/types.js";

export type OpportunitySignal =
  | "low_ctr"
  | "striking_distance"
  | "declining_clicks";

export interface LandingOutcome {
  sessions: number;
  engagedSessions: number;
  engagementRate: number | null;
  keyEvents: number;
  totalRevenue: number;
}

export interface OpportunityObservation {
  id: string;
  evidenceClass: "observed";
  source: "gsc" | "ga4";
  sourceRef:
    | "src_gsc_current"
    | "src_gsc_previous"
    | "src_ga4_landing_outcomes";
  period: { start: string; end: string };
  retrievedAt: string;
  page: string;
  query?: string;
  current?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  previous?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  landingOutcome?: LandingOutcome;
}

export interface OpportunityFinding {
  id: string;
  classification: "inferred";
  kind: "page_query" | "cannibalization";
  priority: "high" | "medium" | "low";
  page: string | null;
  query: string;
  signals: OpportunitySignal[] | ["multiple_pages"];
  reason: string;
  metrics: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number | null;
    clickChange: number | null;
    competingPages?: Array<{
      page: string;
      clicks: number;
      impressions: number;
    }>;
    additionalCompetingPages?: number;
    landingOutcome?: LandingOutcome;
  };
  evidenceRefs: string[];
}

export interface OpportunityRecommendation {
  id: string;
  classification: "action";
  findingRefs: string[];
  action: string;
  approvalRequired: true;
  verification: {
    command: string;
    minimumWaitDays: number;
    successCriteria: string;
  };
  doNotClaim: string[];
}

export interface SearchMovement {
  comparison: "matched" | "previous_only";
  query: string;
  page: string;
  currentClicks: number | null;
  previousClicks: number;
  clickChange: number | null;
}

export interface OpportunityAnalysis {
  generatedAt: string;
  periods: ReturnType<typeof acquisitionPeriods>;
  coverage: {
    currentGsc: GscReportCoverage;
    previousGsc: GscReportCoverage;
    ga4: Ga4ReportCoverage;
  };
  summary: {
    propertyCtrBaseline: number;
    pagesToReview: number;
    cannibalizedQueries: number;
    highPriorityFindings: number;
    winners: SearchMovement[];
    losers: SearchMovement[];
    previousOnly: SearchMovement[];
  };
  observations: OpportunityObservation[];
  findings: OpportunityFinding[];
  recommendations: OpportunityRecommendation[];
  warnings: string[];
}

interface SearchRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

function finiteNumber(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function searchRows(rows: GscRow[] | undefined): SearchRow[] {
  return (rows ?? []).flatMap((row) => {
    const query = row.keys?.[0]?.trim() ?? "";
    const page = row.keys?.[1]?.trim() ?? "";
    if (!query || !page) {
      return [];
    }
    return [
      {
        query,
        page,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      },
    ];
  });
}

function rowKey(row: Pick<SearchRow, "query" | "page">): string {
  return `${row.query}\u0000${row.page}`;
}

function normalizedPageKey(value: string, explicitHost?: string): string {
  try {
    const url = new URL(value, "https://aitraffic.invalid");
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const host =
      explicitHost?.trim().toLowerCase() ||
      (url.hostname === "aitraffic.invalid" ? "" : url.hostname);
    return `${host}${path}`;
  } catch {
    const path = value.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") || "/";
    return `${explicitHost?.trim().toLowerCase() ?? ""}${path}`;
  }
}

function ga4LandingOutcomes(
  response: Ga4ReportResponse,
): Map<string, LandingOutcome> {
  const dimensions = (response.dimensionHeaders ?? []).map(({ name }) => name);
  const metrics = (response.metricHeaders ?? []).map(({ name }) => name);
  const requiredDimensions = ["hostName", "landingPagePlusQueryString"];
  const requiredMetrics = [
    "sessions",
    "engagedSessions",
    "keyEvents",
    "totalRevenue",
  ];
  if (
    requiredDimensions.some((name) => !dimensions.includes(name)) ||
    requiredMetrics.some((name) => !metrics.includes(name))
  ) {
    throw new Error(
      "GA4 opportunity response is missing required dimension or metric headers.",
    );
  }
  const outcomes = new Map<string, Omit<LandingOutcome, "engagementRate">>();

  for (const row of response.rows ?? []) {
    const dimensionValues = Object.fromEntries(
      dimensions.map((name, index) => [
        name,
        row.dimensionValues?.[index]?.value ?? "",
      ]),
    );
    const metricValues = Object.fromEntries(
      metrics.map((name, index) => [
        name,
        finiteNumber(row.metricValues?.[index]?.value),
      ]),
    );
    const path = normalizedPageKey(
      dimensionValues.landingPagePlusQueryString ?? "",
      dimensionValues.hostName,
    );
    const existing = outcomes.get(path) ?? {
      sessions: 0,
      engagedSessions: 0,
      keyEvents: 0,
      totalRevenue: 0,
    };
    outcomes.set(path, {
      sessions: existing.sessions + (metricValues.sessions ?? 0),
      engagedSessions:
        existing.engagedSessions + (metricValues.engagedSessions ?? 0),
      keyEvents: existing.keyEvents + (metricValues.keyEvents ?? 0),
      totalRevenue:
        existing.totalRevenue + (metricValues.totalRevenue ?? 0),
    });
  }

  return new Map(
    [...outcomes.entries()].map(([path, outcome]) => [
      path,
      {
        ...outcome,
        engagementRate:
          outcome.sessions === 0
            ? null
            : outcome.engagedSessions / outcome.sessions,
      },
    ]),
  );
}

function priorityFor(row: SearchRow, clickChange: number): "high" | "medium" | "low" {
  if (clickChange <= -10 || row.impressions >= 1_000) {
    return "high";
  }
  return row.impressions >= 250 || clickChange <= -3 ? "medium" : "low";
}

function recommendationFor(
  finding: OpportunityFinding,
  days: number,
): OpportunityRecommendation {
  const signals = finding.signals as readonly string[];
  const action =
    finding.kind === "cannibalization"
      ? "Confirm whether the competing pages serve the same intent. If they do, consolidate overlapping content and internal-link signals; if they do not, clarify each page's distinct intent."
      : signals.includes("declining_clicks")
        ? "Inspect recent page, template, canonical, indexability, and internal-link changes before editing content. Then restore or improve the element supported by the evidence."
        : signals.includes("low_ctr")
          ? "Review the live result and query intent, then improve the title, description, and opening answer only where the page can substantiate the promise."
          : "Strengthen intent coverage, answer clarity, supporting evidence, and relevant internal links for this query without rewriting unrelated sections.";

  return {
    id: `action_${finding.id.slice("finding_".length)}`,
    classification: "action",
    findingRefs: [finding.id],
    action,
    approvalRequired: true,
    verification: {
      command: `aitraffic opportunities --days ${days} --format json`,
      minimumWaitDays: days + 3,
      successCriteria:
        "Compare an equal-length final-data period after deployment. Treat metric movement as correlation unless an experiment establishes causality.",
    },
    doNotClaim: [
      "The recommended edit guarantees a ranking, click, citation, conversion, or revenue uplift.",
    ],
  };
}

export async function buildOpportunityAnalysis(
  provider: GoogleDataProvider,
  config: GoogleConnectorConfig,
  options: {
    days?: number;
    maxRows?: number;
    minImpressions?: number;
    now?: Date;
  } = {},
): Promise<OpportunityAnalysis> {
  if (!config.ga4Property || !config.gscSite) {
    throw new Error(
      "A selected GA4 property and Search Console site are required.",
    );
  }
  const days = options.days ?? 28;
  const maxRows = options.maxRows ?? 50_000;
  const minImpressions = options.minImpressions ?? 100;
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new Error("Report days must be an integer from 1 to 366.");
  }
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 100_000) {
    throw new Error("maxRows must be an integer from 1 to 100000.");
  }
  if (
    !Number.isInteger(minImpressions) ||
    minImpressions < 1 ||
    minImpressions > 1_000_000
  ) {
    throw new Error(
      "minImpressions must be an integer from 1 to 1000000.",
    );
  }

  const now = options.now ?? new Date();
  const periods = acquisitionPeriods(days, now);
  const gscRequest = {
    dimensions: ["query", "page"],
    type: "web" as const,
    dataState: "final" as const,
    aggregationType: "byPage" as const,
  };
  const [currentGsc, previousGsc, ga4Report] = await Promise.all([
    fetchPaginatedGscReport(
      provider,
      config.gscSite,
      { ...gscRequest, ...periods.gsc.current },
      { maxRows },
    ),
    fetchPaginatedGscReport(
      provider,
      config.gscSite,
      { ...gscRequest, ...periods.gsc.previous },
      { maxRows },
    ),
    fetchPaginatedGa4Report(
      provider,
      config.ga4Property,
      {
        ...periods.ga4.current,
        dimensions: ["hostName", "landingPagePlusQueryString"],
        metrics: [
          "sessions",
          "engagedSessions",
          "keyEvents",
          "totalRevenue",
        ],
        dimensionFilter: {
          filter: {
            fieldName: "sessionDefaultChannelGroup",
            stringFilter: {
              matchType: "EXACT",
              value: "Organic Search",
              caseSensitive: false,
            },
          },
        },
      },
      { maxRows },
    ),
  ]);

  const currentRows = searchRows(currentGsc.response.rows);
  const previousRows = searchRows(previousGsc.response.rows);
  const previousByKey = new Map(
    previousRows.map((row) => [rowKey(row), row]),
  );
  const outcomes = ga4LandingOutcomes(ga4Report.response);
  const totalClicks = currentRows.reduce((sum, row) => sum + row.clicks, 0);
  const totalImpressions = currentRows.reduce(
    (sum, row) => sum + row.impressions,
    0,
  );
  const propertyCtrBaseline =
    totalImpressions === 0 ? 0 : totalClicks / totalImpressions;

  const candidates = currentRows.flatMap((row) => {
    if (row.impressions < minImpressions) {
      return [];
    }
    const previous = previousByKey.get(rowKey(row));
    const clickChange =
      previous === undefined ? 0 : row.clicks - previous.clicks;
    const signals: OpportunitySignal[] = [];
    if (
      row.position > 0 &&
      row.position <= 20 &&
      row.ctr < propertyCtrBaseline
    ) {
      signals.push("low_ctr");
    }
    if (row.position >= 4 && row.position <= 20) {
      signals.push("striking_distance");
    }
    if (
      previous !== undefined &&
      clickChange <= -Math.max(3, Math.ceil(previous.clicks * 0.2))
    ) {
      signals.push("declining_clicks");
    }
    if (signals.length === 0) {
      return [];
    }
    return [{ row, previous, clickChange, signals }];
  });

  candidates.sort((left, right) => {
    const priority = { high: 3, medium: 2, low: 1 } as const;
    const priorityDifference =
      priority[priorityFor(right.row, right.clickChange)] -
      priority[priorityFor(left.row, left.clickChange)];
    return priorityDifference !== 0
      ? priorityDifference
      : right.row.impressions - left.row.impressions;
  });

  const observations: OpportunityObservation[] = [];
  const findings: OpportunityFinding[] = [];
  for (const [index, candidate] of candidates.slice(0, 25).entries()) {
    const currentEvidenceId = `ev_gsc_current_${index + 1}`;
    const landingOutcome = outcomes.get(
      normalizedPageKey(candidate.row.page),
    );
    observations.push({
      id: currentEvidenceId,
      evidenceClass: "observed",
      source: "gsc",
      sourceRef: "src_gsc_current",
      period: periods.gsc.current,
      retrievedAt: now.toISOString(),
      page: candidate.row.page,
      query: candidate.row.query,
      current: {
        clicks: candidate.row.clicks,
        impressions: candidate.row.impressions,
        ctr: candidate.row.ctr,
        position: candidate.row.position,
      },
    });
    const evidenceRefs = [currentEvidenceId];
    if (candidate.previous !== undefined) {
      const previousEvidenceId = `ev_gsc_previous_${index + 1}`;
      observations.push({
        id: previousEvidenceId,
        evidenceClass: "observed",
        source: "gsc",
        sourceRef: "src_gsc_previous",
        period: periods.gsc.previous,
        retrievedAt: now.toISOString(),
        page: candidate.previous.page,
        query: candidate.previous.query,
        previous: {
          clicks: candidate.previous.clicks,
          impressions: candidate.previous.impressions,
          ctr: candidate.previous.ctr,
          position: candidate.previous.position,
        },
      });
      evidenceRefs.push(previousEvidenceId);
    }
    if (landingOutcome !== undefined) {
      const ga4EvidenceId = `ev_ga4_${index + 1}`;
      observations.push({
        id: ga4EvidenceId,
        evidenceClass: "observed",
        source: "ga4",
        sourceRef: "src_ga4_landing_outcomes",
        period: periods.ga4.current,
        retrievedAt: now.toISOString(),
        page: candidate.row.page,
        landingOutcome,
      });
      evidenceRefs.push(ga4EvidenceId);
    }
    findings.push({
      id: `finding_page_${index + 1}`,
      classification: "inferred",
      kind: "page_query",
      priority: priorityFor(candidate.row, candidate.clickChange),
      page: candidate.row.page,
      query: candidate.row.query,
      signals: candidate.signals,
      reason: [
        candidate.signals.includes("declining_clicks")
          ? `Clicks fell by ${Math.abs(candidate.clickChange)} versus the equal previous period.`
          : null,
        candidate.signals.includes("low_ctr")
          ? "CTR is below this property's returned-row baseline for the same period."
          : null,
        candidate.signals.includes("striking_distance")
          ? "Average position is between 4 and 20 with measurable existing demand."
          : null,
      ]
        .filter((value): value is string => value !== null)
        .join(" "),
      metrics: {
        clicks: candidate.row.clicks,
        impressions: candidate.row.impressions,
        ctr: candidate.row.ctr,
        position: candidate.row.position,
        clickChange:
          candidate.previous === undefined ? null : candidate.clickChange,
        ...(landingOutcome !== undefined ? { landingOutcome } : {}),
      },
      evidenceRefs,
    });
  }

  const rowsByQuery = new Map<string, SearchRow[]>();
  for (const row of currentRows) {
    const queryRows = rowsByQuery.get(row.query) ?? [];
    queryRows.push(row);
    rowsByQuery.set(row.query, queryRows);
  }
  const cannibalized = [...rowsByQuery.entries()]
    .flatMap(([query, rows]) => {
      const meaningful = rows
        .filter((row) => row.impressions >= Math.max(10, minImpressions / 10))
        .sort((left, right) => right.impressions - left.impressions);
      const impressions = meaningful.reduce(
        (sum, row) => sum + row.impressions,
        0,
      );
      return meaningful.length >= 2 && impressions >= minImpressions
        ? [{ query, rows: meaningful, impressions }]
        : [];
    })
    .sort((left, right) => right.impressions - left.impressions)
    .slice(0, 10);

  for (const [index, group] of cannibalized.entries()) {
    const reportedRows = group.rows.slice(0, 5);
    const evidenceRefs = reportedRows.map((row, rowIndex) => {
      const id = `ev_cannibal_${index + 1}_${rowIndex + 1}`;
      observations.push({
        id,
        evidenceClass: "observed",
        source: "gsc",
        sourceRef: "src_gsc_current",
        period: periods.gsc.current,
        retrievedAt: now.toISOString(),
        page: row.page,
        query: row.query,
        current: {
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        },
      });
      return id;
    });
    const pages = reportedRows.map((row) => ({
      page: row.page,
      clicks: row.clicks,
      impressions: row.impressions,
    }));
    findings.push({
      id: `finding_cannibal_${index + 1}`,
      classification: "inferred",
      kind: "cannibalization",
      priority:
        reportedRows.reduce((sum, row) => sum + row.impressions, 0) >=
        1_000
          ? "high"
          : "medium",
      page: null,
      query: group.query,
      signals: ["multiple_pages"],
      reason:
        "Multiple returned pages receive meaningful impressions for the same query. This is an overlap candidate, not proof that consolidation is appropriate.",
      metrics: {
        clicks: reportedRows.reduce((sum, row) => sum + row.clicks, 0),
        impressions: reportedRows.reduce(
          (sum, row) => sum + row.impressions,
          0,
        ),
        ctr:
          reportedRows.reduce((sum, row) => sum + row.impressions, 0) === 0
            ? 0
            : reportedRows.reduce((sum, row) => sum + row.clicks, 0) /
              reportedRows.reduce(
                (sum, row) => sum + row.impressions,
                0,
              ),
        position: null,
        clickChange: null,
        competingPages: pages,
        ...(group.rows.length > reportedRows.length
          ? {
              additionalCompetingPages:
                group.rows.length - reportedRows.length,
            }
          : {}),
      },
      evidenceRefs,
    });
  }

  const movements = currentRows
    .flatMap((row) => {
      const previous = previousByKey.get(rowKey(row));
      return previous === undefined
        ? []
        : [
            {
              comparison: "matched" as const,
              query: row.query,
              page: row.page,
              currentClicks: row.clicks,
              previousClicks: previous.clicks,
              clickChange: row.clicks - previous.clicks,
            },
          ];
    });
  const winners = movements
    .filter(({ clickChange }) => clickChange > 0)
    .sort((left, right) => right.clickChange - left.clickChange)
    .slice(0, 10);
  const losers = movements
    .filter(({ clickChange }) => clickChange < 0)
    .sort((left, right) => left.clickChange - right.clickChange)
    .slice(0, 10);
  const currentKeys = new Set(currentRows.map(rowKey));
  const previousOnly = previousRows
    .filter((row) => !currentKeys.has(rowKey(row)))
    .sort((left, right) => right.clicks - left.clicks)
    .slice(0, 10)
    .map<SearchMovement>((row) => ({
      comparison: "previous_only",
      query: row.query,
      page: row.page,
      currentClicks: null,
      previousClicks: row.clicks,
      clickChange: null,
    }));

  const warnings = [
    "Search Console dates use the source reporting timezone and this analysis excludes the latest three days for freshness.",
    "Search Console page/query reports are top-row reports and can omit anonymized or low-volume queries.",
    "GA4 outcomes are joined to Search Console pages by hostname and case-sensitive normalized path; query-string or hostname measurement gaps can reduce match quality.",
    "GA4 landing outcomes are limited to the Organic Search channel group; channel classification and attribution depend on property configuration.",
    "Zero GA4 key events may indicate missing measurement, not an absence of business outcomes.",
    "Winner and loser lists compare only query/page rows returned in both periods. Previous-only rows are reported separately and are not treated as zero.",
    "Findings are deterministic heuristics. Review search intent and page purpose before changing content or consolidation.",
  ];
  if (currentGsc.coverage.truncated || previousGsc.coverage.truncated) {
    warnings.push(
      "A Search Console row cap was reached. Findings are partial and must not be interpreted as a complete site audit.",
    );
  }
  if (ga4Report.coverage.truncated) {
    warnings.push(
      "The GA4 landing-page row limit was reached. Some landing outcomes may be absent.",
    );
  }

  return {
    generatedAt: now.toISOString(),
    periods,
    coverage: {
      currentGsc: currentGsc.coverage,
      previousGsc: previousGsc.coverage,
      ga4: ga4Report.coverage,
    },
    summary: {
      propertyCtrBaseline,
      pagesToReview: findings.filter(({ kind }) => kind === "page_query")
        .length,
      cannibalizedQueries: cannibalized.length,
      highPriorityFindings: findings.filter(
        ({ priority }) => priority === "high",
      ).length,
      winners,
      losers,
      previousOnly,
    },
    observations,
    findings,
    recommendations: findings.map((finding) =>
      recommendationFor(finding, days),
    ),
    warnings,
  };
}
