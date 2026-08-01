import assert from "node:assert/strict";
import test from "node:test";

import { buildOpportunityAnalysis } from "../src/analysis/opportunities.js";
import { runCapability } from "../src/capabilities/run.js";
import {
  fetchPaginatedGa4Report,
  fetchPaginatedGscReport,
} from "../src/connectors/google/pagination.js";
import type {
  Ga4ReportRequest,
  Ga4ReportResponse,
  GoogleDataProvider,
  GscReportRequest,
  GscReportResponse,
} from "../src/connectors/google/types.js";
import type { SiteHttpClient } from "../src/connectors/site/types.js";

const CONFIG = {
  schemaVersion: "0.1.0" as const,
  adapter: "local-oauth" as const,
  profile: "test",
  ga4Property: "123456",
  gscSite: "sc-domain:example.com",
};

class OpportunityProvider implements GoogleDataProvider {
  readonly gscRequests: GscReportRequest[] = [];
  readonly ga4Requests: Ga4ReportRequest[] = [];

  async status() {
    return { configured: true, profileCount: 1 };
  }

  async inventory() {
    return {
      profile: "test",
      ga4Properties: [],
      searchConsoleSites: [],
    };
  }

  async ga4Report(
    _property: string,
    request: Ga4ReportRequest,
  ): Promise<Ga4ReportResponse> {
    this.ga4Requests.push(request);
    return {
      dimensionHeaders: [
        { name: "hostName" },
        { name: "landingPagePlusQueryString" },
      ],
      metricHeaders: [
        { name: "sessions" },
        { name: "engagedSessions" },
        { name: "keyEvents" },
        { name: "totalRevenue" },
      ],
      rowCount: 2,
      rows: [
        {
          dimensionValues: [
            { value: "example.com" },
            { value: "/pricing?utm_source=test" },
          ],
          metricValues: [
            { value: "100" },
            { value: "70" },
            { value: "5" },
            { value: "250" },
          ],
        },
        {
          dimensionValues: [
            { value: "example.com" },
            { value: "/docs" },
          ],
          metricValues: [
            { value: "20" },
            { value: "10" },
            { value: "0" },
            { value: "0" },
          ],
        },
      ],
    };
  }

  async gscReport(
    _site: string,
    request: GscReportRequest,
  ): Promise<GscReportResponse> {
    this.gscRequests.push(request);
    const current = request.start === "2026-06-30";
    return {
      responseAggregationType: "byPage",
      rows: current
        ? [
            {
              keys: [
                "ai traffic analytics",
                "https://example.com/pricing",
              ],
              clicks: 5,
              impressions: 500,
              ctr: 0.01,
              position: 7,
            },
            {
              keys: [
                "ai traffic analytics",
                "https://example.com/docs",
              ],
              clicks: 2,
              impressions: 150,
              ctr: 2 / 150,
              position: 12,
            },
            {
              keys: ["geo analytics", "https://example.com/geo"],
              clicks: 30,
              impressions: 200,
              ctr: 0.15,
              position: 3,
            },
          ]
        : [
            {
              keys: [
                "ai traffic analytics",
                "https://example.com/pricing",
              ],
              clicks: 20,
              impressions: 500,
              ctr: 0.04,
              position: 6,
            },
            {
              keys: [
                "ai traffic analytics",
                "https://example.com/docs",
              ],
              clicks: 3,
              impressions: 120,
              ctr: 0.025,
              position: 11,
            },
            {
              keys: ["geo analytics", "https://example.com/geo"],
              clicks: 10,
              impressions: 180,
              ctr: 10 / 180,
              position: 4,
            },
            {
              keys: ["lost query", "https://example.com/lost"],
              clicks: 50,
              impressions: 600,
              ctr: 50 / 600,
              position: 2,
            },
          ],
    };
  }
}

test("prioritizes GSC opportunities and joins GA4 landing outcomes", async () => {
  const provider = new OpportunityProvider();
  const analysis = await buildOpportunityAnalysis(provider, CONFIG, {
    days: 28,
    maxRows: 100,
    minImpressions: 100,
    now: new Date("2026-07-30T12:00:00.000Z"),
  });

  const pricing = analysis.findings.find(
    ({ page }) => page === "https://example.com/pricing",
  );
  assert.ok(pricing);
  assert.equal(pricing.priority, "high");
  assert.deepEqual(pricing.signals, [
    "low_ctr",
    "striking_distance",
    "declining_clicks",
  ]);
  assert.equal(pricing.metrics.clickChange, -15);
  assert.equal(pricing.metrics.landingOutcome?.sessions, 100);
  assert.equal(pricing.metrics.landingOutcome?.engagementRate, 0.7);
  assert.equal(pricing.evidenceRefs.length, 3);
  assert.deepEqual(
    pricing.evidenceRefs.map(
      (id) => analysis.observations.find((item) => item.id === id)?.sourceRef,
    ),
    [
      "src_gsc_current",
      "src_gsc_previous",
      "src_ga4_landing_outcomes",
    ],
  );
  assert.equal(
    analysis.findings.some(
      ({ kind, query }) =>
        kind === "cannibalization" &&
        query === "ai traffic analytics",
    ),
    true,
  );
  assert.equal(analysis.summary.winners[0]?.query, "geo analytics");
  assert.equal(analysis.summary.losers[0]?.query, "ai traffic analytics");
  assert.deepEqual(analysis.summary.previousOnly[0], {
    comparison: "previous_only",
    query: "lost query",
    page: "https://example.com/lost",
    currentClicks: null,
    previousClicks: 50,
    clickChange: null,
  });
  assert.equal(
    analysis.recommendations.every(
      ({ approvalRequired }) => approvalRequired,
    ),
    true,
  );
  assert.equal(analysis.recommendations[0]?.verification.minimumWaitDays, 31);
  assert.equal(
    provider.gscRequests.every(
      ({ aggregationType, dataState }) =>
        aggregationType === "byPage" && dataState === "final",
    ),
    true,
  );
  assert.deepEqual(provider.ga4Requests[0]?.dimensionFilter, {
    filter: {
      fieldName: "sessionDefaultChannelGroup",
      stringFilter: {
        matchType: "EXACT",
        value: "Organic Search",
        caseSensitive: false,
      },
    },
  });
});

class FragmentOpportunityProvider extends OpportunityProvider {
  override async gscReport(
    _site: string,
    request: GscReportRequest,
  ): Promise<GscReportResponse> {
    this.gscRequests.push(request);
    const current = request.start === "2026-06-30";
    return {
      rows: current
        ? [
            {
              keys: [
                "fragment query",
                "https://example.com/guide#one",
              ],
              clicks: 1,
              impressions: 120,
              ctr: 1 / 120,
              position: 8,
            },
            {
              keys: [
                "fragment query",
                "https://example.com/guide#two",
              ],
              clicks: 1,
              impressions: 130,
              ctr: 1 / 130,
              position: 8,
            },
            {
              keys: ["real overlap", "https://example.com/one"],
              clicks: 2,
              impressions: 100,
              ctr: 0.02,
              position: 7,
            },
            {
              keys: ["real overlap", "https://example.com/two"],
              clicks: 1,
              impressions: 100,
              ctr: 0.01,
              position: 9,
            },
          ]
        : [
            {
              keys: ["fragment query", "https://example.com/guide"],
              clicks: 20,
              impressions: 250,
              ctr: 0.08,
              position: 7,
            },
            {
              keys: ["real overlap", "https://example.com/one"],
              clicks: 4,
              impressions: 100,
              ctr: 0.04,
              position: 7,
            },
            {
              keys: ["real overlap", "https://example.com/two"],
              clicks: 3,
              impressions: 100,
              ctr: 0.03,
              position: 9,
            },
          ],
    };
  }
}

test("aggregates fragment variants before creating page and overlap opportunities", async () => {
  const analysis = await buildOpportunityAnalysis(
    new FragmentOpportunityProvider(),
    CONFIG,
    {
      days: 28,
      maxRows: 100,
      minImpressions: 100,
      now: new Date("2026-07-30T12:00:00.000Z"),
    },
  );

  const fragmentFindings = analysis.findings.filter(
    ({ query }) => query === "fragment query",
  );
  assert.equal(
    fragmentFindings.filter(({ kind }) => kind === "page_query").length,
    1,
  );
  assert.equal(
    fragmentFindings.some(({ kind }) => kind === "cannibalization"),
    false,
  );
  assert.equal(
    fragmentFindings[0]?.page,
    "https://example.com/guide",
  );
  assert.equal(
    analysis.findings.some(
      ({ kind, query }) =>
        kind === "cannibalization" && query === "real overlap",
    ),
    true,
  );
  assert.deepEqual(
    analysis.observations.find(
      ({ query, current }) =>
        query === "fragment query" && current !== undefined,
    )?.pageVariants,
    [
      "https://example.com/guide#one",
      "https://example.com/guide#two",
    ],
  );
});

test("returns the same opportunity workflow in a capability envelope", async () => {
  const envelope = await runCapability(
    "google.opportunities",
    { days: 28, maxRows: 100, minImpressions: 100 },
    {
      google: {
        config: CONFIG,
        provider: new OpportunityProvider(),
      },
      now: new Date("2026-07-30T12:00:00.000Z"),
    },
  );

  assert.equal(envelope.run.capabilityId, "google.opportunities");
  assert.equal(envelope.run.mode, "read-only");
  assert.equal(envelope.subject.site, "sc-domain:example.com");
  assert.equal(envelope.sources.length, 3);
  assert.equal(envelope.findings.length > 0, true);
  assert.equal(envelope.coverage.partial, false);
  assert.equal(envelope.result.sourceCoverage.currentGsc.observedRows, 3);
});

test("audits a bounded set of unique Google opportunity pages", async () => {
  const fetched: string[] = [];
  const siteClient: SiteHttpClient = {
    async get(url) {
      fetched.push(url);
      const robots = url.endsWith("/robots.txt");
      const body = robots
        ? "User-agent: *\nAllow: /"
        : "<html><head><title>Page</title></head><body><h1>Page</h1></body></html>";
      return {
        requestedUrl: url,
        finalUrl: url,
        status: 200,
        redirects: [],
        headers: {
          contentType: robots ? "text/plain" : "text/html",
          contentLength: body.length,
          contentEncoding: null,
          xRobotsTag: [],
        },
        body,
        byteLength: body.length,
        bodyRead: "complete",
        sha256: "test",
        durationMs: 1,
      };
    },
  };
  const envelope = await runCapability(
    "site.audit_opportunities",
    { days: 28, maxRows: 100, minImpressions: 100, limit: 1 },
    {
      google: {
        config: CONFIG,
        provider: new OpportunityProvider(),
      },
      siteClient,
      now: new Date("2026-07-30T12:00:00.000Z"),
    },
  );

  assert.equal(envelope.result.selectedPages, 1);
  assert.equal(envelope.result.completedAudits, 1);
  assert.equal(envelope.result.pageAudits[0]?.sourceFindingRefs.length, 1);
  assert.equal(fetched.length, 2);
  assert.equal(envelope.coverage.partial, false);
});

class PaginatedProvider extends OpportunityProvider {
  override async gscReport(
    _site: string,
    request: GscReportRequest,
  ): Promise<GscReportResponse> {
    this.gscRequests.push(request);
    const offset = request.offset ?? 0;
    const allRows = [0, 1, 2, 3, 4].map((index) => ({
      keys: [`query-${index}`, `https://example.com/${index}`],
      clicks: index,
      impressions: 10,
      ctr: index / 10,
      position: index + 1,
    }));
    return {
      rows: allRows.slice(offset, offset + (request.limit ?? 2)),
    };
  }
}

test("paginates Search Console and marks a reached cap as truncated", async () => {
  const completeProvider = new PaginatedProvider();
  const complete = await fetchPaginatedGscReport(
    completeProvider,
    "sc-domain:example.com",
    {
      start: "2026-07-01",
      end: "2026-07-28",
      dimensions: ["query", "page"],
      dataState: "final",
    },
    { maxRows: 10, pageSize: 2 },
  );
  assert.equal(complete.response.rows?.length, 5);
  assert.equal(complete.coverage.pagesFetched, 3);
  assert.equal(complete.coverage.truncated, false);

  const cappedProvider = new PaginatedProvider();
  const capped = await fetchPaginatedGscReport(
    cappedProvider,
    "sc-domain:example.com",
    {
      start: "2026-07-01",
      end: "2026-07-28",
      dimensions: ["query", "page"],
      dataState: "all",
    },
    { maxRows: 4, pageSize: 2 },
  );
  assert.equal(capped.response.rows?.length, 4);
  assert.equal(capped.coverage.truncated, true);
  assert.equal(capped.coverage.partial, true);
});

class PaginatedGa4Provider extends OpportunityProvider {
  override async ga4Report(
    _property: string,
    request: Ga4ReportRequest,
  ): Promise<Ga4ReportResponse> {
    this.ga4Requests.push(request);
    const offset = request.offset ?? 0;
    const rows = [0, 1, 2, 3, 4].map((index) => ({
      dimensionValues: [{ value: `example.com/${index}` }],
      metricValues: [{ value: String(index) }],
    }));
    return {
      dimensionHeaders: [{ name: "landingPage" }],
      metricHeaders: [{ name: "sessions" }],
      rowCount: rows.length,
      metadata: { dataLossFromOtherRow: true },
      rows: rows.slice(offset, offset + (request.limit ?? 2)),
    };
  }
}

test("paginates GA4 and preserves known incompleteness metadata", async () => {
  const provider = new PaginatedGa4Provider();
  const report = await fetchPaginatedGa4Report(
    provider,
    "123456",
    {
      start: "2026-07-01",
      end: "2026-07-28",
      dimensions: ["landingPage"],
      metrics: ["sessions"],
    },
    { maxRows: 10, pageSize: 2 },
  );

  assert.equal(report.response.rows?.length, 5);
  assert.equal(report.coverage.pagesFetched, 3);
  assert.equal(report.coverage.truncated, false);
  assert.equal(report.coverage.partial, true);
  assert.deepEqual(report.coverage.incompleteReasons, [
    "GA4 data-loss-from-other-row metadata is true",
  ]);
});
