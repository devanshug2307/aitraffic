import type {
  Ga4ReportResponse,
  GoogleConnectorConfig,
  GoogleDataProvider,
  GscReportResponse,
} from "../connectors/google/types.js";

const AI_SOURCE_PATTERNS = [
  /(^|\.)chatgpt\.com$/i,
  /(^|\.)openai\.com$/i,
  /(^|\.)perplexity\.ai$/i,
  /(^|\.)claude\.ai$/i,
  /(^|\.)anthropic\.com$/i,
  /(^|\.)gemini\.google\.com$/i,
  /(^|\.)bard\.google\.com$/i,
  /(^|\.)copilot\.microsoft\.com$/i,
  /(^|\.)you\.com$/i,
  /(^|\.)phind\.com$/i,
  /(^|\.)poe\.com$/i,
  /(^|\.)grok\.com$/i,
  /(^|\.)x\.ai$/i,
  /(^|\.)mistral\.ai$/i,
  /(^|\.)chat\.deepseek\.com$/i,
  /(^|\.)meta\.ai$/i,
  /(^|\.)kimi\.com$/i,
  /(^|\.)qwen\.ai$/i,
] as const;

interface MetricTotals {
  sessions: number;
  totalUsers: number;
  engagedSessions: number;
  keyEvents: number;
  totalRevenue: number;
}

interface Ga4ParsedRow extends MetricTotals {
  channelGroup: string;
  source: string;
  medium: string;
  landingPage: string;
}

interface SearchTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  rows: number;
}

export interface AcquisitionReport {
  reportVersion: "0.1.0";
  generatedAt: string;
  evidenceClass: {
    platformAggregates: "observed";
    opportunities: "inferred";
  };
  source: {
    adapter: GoogleConnectorConfig["adapter"];
    profile: string;
    ga4Property: string;
    gscSite: string;
  };
  periods: {
    ga4: {
      current: { start: string; end: string };
      previous: { start: string; end: string };
    };
    gsc: {
      current: { start: string; end: string };
      previous: { start: string; end: string };
    };
  };
  observed: {
    ga4: {
      current: {
        allTraffic: MetricTotals;
        aiTraffic: MetricTotals;
        aiSessionShare: number | null;
        topAiSources: Array<{ source: string; sessions: number }>;
        topAiLandingPages: Array<{ page: string; sessions: number }>;
        returnedRows: number;
      };
      previous: {
        allTraffic: MetricTotals;
        aiTraffic: MetricTotals;
        aiSessionShare: number | null;
        returnedRows: number;
      };
      change: {
        aiSessionsPercent: number | null;
        aiKeyEventsPercent: number | null;
        aiRevenuePercent: number | null;
      };
    };
    gsc: {
      current: SearchTotals;
      previous: SearchTotals;
      change: {
        clicksPercent: number | null;
        impressionsPercent: number | null;
      };
    };
  };
  inferred: {
    searchOpportunities: Array<{
      query: string;
      page: string;
      impressions: number;
      clicks: number;
      ctr: number;
      position: number;
      reason: string;
    }>;
  };
  limitations: string[];
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftUtcDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

function inclusivePeriod(end: Date, days: number): { start: string; end: string } {
  return {
    start: dateOnly(shiftUtcDays(end, -(days - 1))),
    end: dateOnly(end),
  };
}

export function acquisitionPeriods(
  days: number,
  now = new Date(),
): AcquisitionReport["periods"] {
  const ga4CurrentEnd = shiftUtcDays(now, -1);
  const ga4Current = inclusivePeriod(ga4CurrentEnd, days);
  const ga4PreviousEnd = shiftUtcDays(
    new Date(`${ga4Current.start}T00:00:00.000Z`),
    -1,
  );
  const gscCurrentEnd = shiftUtcDays(now, -3);
  const gscCurrent = inclusivePeriod(gscCurrentEnd, days);
  const gscPreviousEnd = shiftUtcDays(
    new Date(`${gscCurrent.start}T00:00:00.000Z`),
    -1,
  );

  return {
    ga4: {
      current: ga4Current,
      previous: inclusivePeriod(ga4PreviousEnd, days),
    },
    gsc: {
      current: gscCurrent,
      previous: inclusivePeriod(gscPreviousEnd, days),
    },
  };
}

function finiteNumber(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseGa4Rows(response: Ga4ReportResponse): Ga4ParsedRow[] {
  const dimensions = (response.dimensionHeaders ?? []).map(({ name }) => name);
  const metrics = (response.metricHeaders ?? []).map(({ name }) => name);

  return (response.rows ?? []).map((row) => {
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
    return {
      channelGroup: dimensionValues.sessionDefaultChannelGroup ?? "",
      source: dimensionValues.sessionSource ?? "",
      medium: dimensionValues.sessionMedium ?? "",
      landingPage: dimensionValues.landingPagePlusQueryString ?? "",
      sessions: metricValues.sessions ?? 0,
      totalUsers: metricValues.totalUsers ?? 0,
      engagedSessions: metricValues.engagedSessions ?? 0,
      keyEvents: metricValues.keyEvents ?? 0,
      totalRevenue: metricValues.totalRevenue ?? 0,
    };
  });
}

export function isAiAssistantTraffic(row: {
  channelGroup: string;
  source: string;
}): boolean {
  if (row.channelGroup.trim().toLowerCase() === "ai assistants") {
    return true;
  }
  const source = row.source.trim().replace(/^https?:\/\//i, "").split("/")[0];
  return AI_SOURCE_PATTERNS.some((pattern) => pattern.test(source ?? ""));
}

function sumMetrics(rows: Ga4ParsedRow[]): MetricTotals {
  return rows.reduce<MetricTotals>(
    (total, row) => ({
      sessions: total.sessions + row.sessions,
      totalUsers: total.totalUsers + row.totalUsers,
      engagedSessions: total.engagedSessions + row.engagedSessions,
      keyEvents: total.keyEvents + row.keyEvents,
      totalRevenue: total.totalRevenue + row.totalRevenue,
    }),
    {
      sessions: 0,
      totalUsers: 0,
      engagedSessions: 0,
      keyEvents: 0,
      totalRevenue: 0,
    },
  );
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function share(part: number, total: number): number | null {
  return total === 0 ? null : part / total;
}

function topBy(
  rows: Ga4ParsedRow[],
  field: "source" | "landingPage",
  outputKey: "source" | "page",
): Array<{ source: string; sessions: number } | { page: string; sessions: number }> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = row[field] || "(not set)";
    totals.set(key, (totals.get(key) ?? 0) + row.sessions);
  }
  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([key, sessions]) =>
      outputKey === "source"
        ? { source: key, sessions }
        : { page: key, sessions },
    );
}

function searchTotals(response: GscReportResponse): SearchTotals {
  const rows = response.rows ?? [];
  const totals = rows.reduce<{
    clicks: number;
    impressions: number;
    weightedPosition: number;
  }>(
    (accumulator, row) => ({
      clicks: accumulator.clicks + (row.clicks ?? 0),
      impressions: accumulator.impressions + (row.impressions ?? 0),
      weightedPosition:
        accumulator.weightedPosition +
        (row.position ?? 0) * (row.impressions ?? 0),
    }),
    { clicks: 0, impressions: 0, weightedPosition: 0 },
  );
  return {
    clicks: totals.clicks,
    impressions: totals.impressions,
    ctr: totals.impressions === 0 ? 0 : totals.clicks / totals.impressions,
    position:
      totals.impressions === 0
        ? null
        : totals.weightedPosition / totals.impressions,
    rows: rows.length,
  };
}

function searchOpportunities(
  response: GscReportResponse,
): AcquisitionReport["inferred"]["searchOpportunities"] {
  return (response.rows ?? [])
    .flatMap((row) => {
      const query = row.keys?.[0] ?? "";
      const page = row.keys?.[1] ?? "";
      const impressions = row.impressions ?? 0;
      const clicks = row.clicks ?? 0;
      const ctr = row.ctr ?? 0;
      const position = row.position ?? 0;
      if (
        !query ||
        !page ||
        impressions < 10 ||
        position < 4 ||
        position > 20
      ) {
        return [];
      }
      return [
        {
          query,
          page,
          impressions,
          clicks,
          ctr,
          position,
          reason:
            "Ranks within positions 4-20 with at least 10 returned impressions; review intent fit, answer clarity, internal links, and snippet quality.",
        },
      ];
    })
    .sort((left, right) => right.impressions - left.impressions)
    .slice(0, 20);
}

function summarizeGa4(response: Ga4ReportResponse) {
  const rows = parseGa4Rows(response);
  const aiRows = rows.filter(isAiAssistantTraffic);
  const allTraffic = sumMetrics(rows);
  const aiTraffic = sumMetrics(aiRows);
  return {
    allTraffic,
    aiTraffic,
    aiSessionShare: share(aiTraffic.sessions, allTraffic.sessions),
    topAiSources: topBy(aiRows, "source", "source") as Array<{
      source: string;
      sessions: number;
    }>,
    topAiLandingPages: topBy(aiRows, "landingPage", "page") as Array<{
      page: string;
      sessions: number;
    }>,
    returnedRows: rows.length,
  };
}

export async function buildAcquisitionReport(
  provider: GoogleDataProvider,
  config: GoogleConnectorConfig,
  options: { days?: number; now?: Date } = {},
): Promise<AcquisitionReport> {
  if (!config.ga4Property || !config.gscSite) {
    throw new Error(
      "A selected GA4 property and Search Console site are required.",
    );
  }
  const days = options.days ?? 28;
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new Error("Report days must be an integer from 1 to 366.");
  }
  const now = options.now ?? new Date();
  const periods = acquisitionPeriods(days, now);
  const ga4Request = {
    dimensions: [
      "sessionDefaultChannelGroup",
      "sessionSource",
      "sessionMedium",
      "landingPagePlusQueryString",
    ],
    metrics: [
      "sessions",
      "totalUsers",
      "engagedSessions",
      "keyEvents",
      "totalRevenue",
    ],
    limit: 10_000,
  };
  const gscRequest = {
    dimensions: ["query", "page"],
    limit: 25_000,
    type: "web",
    dataState: "final" as const,
  };

  const [ga4CurrentRaw, ga4PreviousRaw, gscCurrentRaw, gscPreviousRaw] =
    await Promise.all([
      provider.ga4Report(config.ga4Property, {
        ...ga4Request,
        ...periods.ga4.current,
      }),
      provider.ga4Report(config.ga4Property, {
        ...ga4Request,
        ...periods.ga4.previous,
      }),
      provider.gscReport(config.gscSite, {
        ...gscRequest,
        ...periods.gsc.current,
      }),
      provider.gscReport(config.gscSite, {
        ...gscRequest,
        ...periods.gsc.previous,
      }),
    ]);

  const ga4Current = summarizeGa4(ga4CurrentRaw);
  const ga4Previous = summarizeGa4(ga4PreviousRaw);
  const gscCurrent = searchTotals(gscCurrentRaw);
  const gscPrevious = searchTotals(gscPreviousRaw);

  return {
    reportVersion: "0.1.0",
    generatedAt: now.toISOString(),
    evidenceClass: {
      platformAggregates: "observed",
      opportunities: "inferred",
    },
    source: {
      adapter: config.adapter,
      profile: config.profile,
      ga4Property: config.ga4Property,
      gscSite: config.gscSite,
    },
    periods,
    observed: {
      ga4: {
        current: ga4Current,
        previous: {
          allTraffic: ga4Previous.allTraffic,
          aiTraffic: ga4Previous.aiTraffic,
          aiSessionShare: ga4Previous.aiSessionShare,
          returnedRows: ga4Previous.returnedRows,
        },
        change: {
          aiSessionsPercent: percentChange(
            ga4Current.aiTraffic.sessions,
            ga4Previous.aiTraffic.sessions,
          ),
          aiKeyEventsPercent: percentChange(
            ga4Current.aiTraffic.keyEvents,
            ga4Previous.aiTraffic.keyEvents,
          ),
          aiRevenuePercent: percentChange(
            ga4Current.aiTraffic.totalRevenue,
            ga4Previous.aiTraffic.totalRevenue,
          ),
        },
      },
      gsc: {
        current: gscCurrent,
        previous: gscPrevious,
        change: {
          clicksPercent: percentChange(
            gscCurrent.clicks,
            gscPrevious.clicks,
          ),
          impressionsPercent: percentChange(
            gscCurrent.impressions,
            gscPrevious.impressions,
          ),
        },
      },
    },
    inferred: {
      searchOpportunities: searchOpportunities(gscCurrentRaw),
    },
    limitations: [
      "GA4 observes referrals retained by the browser and analytics configuration; dark AI influence is not measurable here.",
      "AI traffic classification uses GA4's native AI Assistants channel when present and a disclosed source-domain registry otherwise.",
      "GA4 aggregate rows can be thresholded or limited by the selected property and query.",
      "Search Console data uses a three-day lag, final data, and may omit anonymized or low-volume queries.",
      "GA4 sessions and Search Console queries are separate aggregates and are not joined at user or session level.",
      "Opportunity rows are deterministic heuristics, not guaranteed ranking or citation outcomes.",
    ],
  };
}
