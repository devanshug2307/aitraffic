import { auditPage, type PageAuditAnalysis } from "../analysis/pageAudit.js";
import {
  crawlSite,
  type SiteCrawlAnalysis,
} from "../analysis/siteCrawl.js";
import { buildOpportunityAnalysis } from "../analysis/opportunities.js";
import { createSiteHttpClient } from "../connectors/site/http.js";
import type {
  GoogleConnectorConfig,
  GoogleDataProvider,
} from "../connectors/google/types.js";
import type { SiteHttpClient } from "../connectors/site/types.js";
import {
  capabilityRunId,
  describeCapability,
  type CapabilityCoverage,
  type CapabilityRunEnvelope,
  type CapabilitySource,
} from "../core/capabilities.js";
import { AppError } from "../core/result.js";
import { SCHEMA_VERSION } from "../core/version.js";

export interface CapabilityRunContext {
  google?: {
    config: GoogleConnectorConfig;
    provider: GoogleDataProvider;
  };
  siteClient?: SiteHttpClient;
  now?: Date;
}

export interface CapabilityRunParameters {
  days?: number;
  maxRows?: number;
  minImpressions?: number;
  url?: string;
  limit?: number;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  concurrency?: number;
  sitemap?: "auto" | "none" | string;
  maxSitemaps?: number;
  maxSitemapBytes?: number;
}

type OpportunityAnalysis = Awaited<
  ReturnType<typeof buildOpportunityAnalysis>
>;

export type GoogleOpportunityEnvelope = CapabilityRunEnvelope<
  OpportunityAnalysis["summary"] & {
    periods: OpportunityAnalysis["periods"];
    sourceCoverage: OpportunityAnalysis["coverage"];
  },
  OpportunityAnalysis["observations"][number],
  OpportunityAnalysis["findings"][number],
  OpportunityAnalysis["recommendations"][number]
>;

export type PageAuditEnvelope = CapabilityRunEnvelope<
  PageAuditAnalysis["summary"],
  PageAuditAnalysis["observations"][number],
  PageAuditAnalysis["findings"][number],
  PageAuditAnalysis["recommendations"][number]
>;

export type SiteCrawlEnvelope = CapabilityRunEnvelope<
  SiteCrawlAnalysis["summary"] & {
    pages: SiteCrawlAnalysis["pages"];
  },
  SiteCrawlAnalysis["observations"][number],
  SiteCrawlAnalysis["findings"][number],
  SiteCrawlAnalysis["recommendations"][number]
>;

export interface OpportunityPageAudit {
  url: string;
  sourceFindingRefs: string[];
  audit: PageAuditEnvelope | null;
  error: { code: string; message: string } | null;
}

export type OpportunityAuditEnvelope = CapabilityRunEnvelope<
  {
    selectedPages: number;
    completedAudits: number;
    failedAudits: number;
    opportunityRunId: string;
    pageAudits: OpportunityPageAudit[];
  },
  OpportunityAnalysis["observations"][number] | PageAuditAnalysis["observations"][number],
  OpportunityAnalysis["findings"][number] | PageAuditAnalysis["findings"][number],
  OpportunityAnalysis["recommendations"][number] | PageAuditAnalysis["recommendations"][number]
>;

function combinedCoverage(analysis: OpportunityAnalysis): CapabilityCoverage {
  const coverages = [
    analysis.coverage.currentGsc,
    analysis.coverage.previousGsc,
    analysis.coverage.ga4,
  ];
  return {
    requested: coverages.reduce(
      (total, coverage) => total + coverage.requestedRows,
      0,
    ),
    observed: coverages.reduce(
      (total, coverage) => total + coverage.observedRows,
      0,
    ),
    omitted: null,
    truncated: coverages.some((coverage) => coverage.truncated),
    sampled: false,
    partial: coverages.some((coverage) => coverage.partial),
    incompleteReasons: [
      ...new Set(coverages.flatMap((coverage) => coverage.incompleteReasons)),
    ],
  };
}

function requireGoogle(context: CapabilityRunContext): {
  config: GoogleConnectorConfig & {
    ga4Property: string;
    gscSite: string;
  };
  provider: GoogleDataProvider;
} {
  if (!context.google) {
    throw new AppError(
      "GOOGLE_NOT_CONFIGURED",
      "This capability requires a selected Google profile, GA4 property, and Search Console site.",
    );
  }
  if (
    !context.google.config.ga4Property ||
    !context.google.config.gscSite
  ) {
    throw new AppError(
      "GOOGLE_RESOURCES_NOT_SELECTED",
      "This capability requires a selected GA4 property and Search Console site.",
    );
  }
  return context.google as {
    config: GoogleConnectorConfig & {
      ga4Property: string;
      gscSite: string;
    };
    provider: GoogleDataProvider;
  };
}

async function runGoogleOpportunities(
  parameters: CapabilityRunParameters,
  context: CapabilityRunContext,
): Promise<GoogleOpportunityEnvelope> {
  const { config, provider } = requireGoogle(context);
  const startedAt = new Date().toISOString();
  const analysis = await buildOpportunityAnalysis(provider, config, {
    ...(parameters.days !== undefined ? { days: parameters.days } : {}),
    ...(parameters.maxRows !== undefined
      ? { maxRows: parameters.maxRows }
      : {}),
    ...(parameters.minImpressions !== undefined
      ? { minImpressions: parameters.minImpressions }
      : {}),
    ...(context.now !== undefined ? { now: context.now } : {}),
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    run: {
      id: capabilityRunId(),
      capabilityId: "google.opportunities",
      startedAt,
      completedAt: new Date().toISOString(),
      mode: "read-only",
    },
    subject: {
      profile: config.profile,
      site: config.gscSite,
      ga4Property: config.ga4Property,
      url: null,
    },
    sources: [
      {
        id: "src_gsc_current",
        provider: "google-search-console",
        method: "searchAnalytics.query",
        subject: config.gscSite,
        period: analysis.periods.gsc.current,
        retrievedAt: analysis.generatedAt,
        evidenceClass: "observed",
        caveats: [
          "Top rows only; anonymized and low-volume queries may be omitted.",
          "Dates follow Search Console source reporting time.",
        ],
      },
      {
        id: "src_gsc_previous",
        provider: "google-search-console",
        method: "searchAnalytics.query",
        subject: config.gscSite,
        period: analysis.periods.gsc.previous,
        retrievedAt: analysis.generatedAt,
        evidenceClass: "observed",
        caveats: [
          "Top rows only; anonymized and low-volume queries may be omitted.",
          "Dates follow Search Console source reporting time.",
        ],
      },
      {
        id: "src_ga4_landing_outcomes",
        provider: "google-analytics-data",
        method: "runReport",
        subject: config.ga4Property,
        period: analysis.periods.ga4.current,
        retrievedAt: analysis.generatedAt,
        evidenceClass: "observed",
        caveats: [
          "Can be affected by consent, retention, thresholding, cardinality, and property configuration.",
        ],
      },
    ],
    coverage: combinedCoverage(analysis),
    result: {
      ...analysis.summary,
      periods: analysis.periods,
      sourceCoverage: analysis.coverage,
    },
    observations: analysis.observations,
    findings: analysis.findings,
    recommendations: analysis.recommendations,
    artifacts: [],
    warnings: analysis.warnings,
  };
}

function pageSources(
  url: string,
  retrievedAt: string,
): CapabilitySource[] {
  return [
    {
      id: "src_robots_txt",
      provider: "public-web",
      method: "GET robots.txt",
      subject: new URL("/robots.txt", url).toString(),
      period: null,
      retrievedAt,
      evidenceClass: "observed",
      caveats: ["robots.txt controls crawling, not guaranteed indexing."],
    },
    {
      id: "src_page_http",
      provider: "public-web",
      method: "GET",
      subject: url,
      period: null,
      retrievedAt,
      evidenceClass: "observed",
      caveats: ["Response status and allowed headers are point-in-time observations."],
    },
    {
      id: "src_static_html",
      provider: "public-web",
      method: "static HTML parse",
      subject: url,
      period: null,
      retrievedAt,
      evidenceClass: "observed",
      caveats: ["JavaScript rendering was not performed."],
    },
  ];
}

function opportunityPageSources(retrievedAt: string): CapabilitySource[] {
  return [
    {
      id: "src_robots_txt",
      provider: "public-web",
      method: "GET robots.txt",
      subject: "selected opportunity pages",
      period: null,
      retrievedAt,
      evidenceClass: "observed",
      caveats: [
        "See each observation payload for its exact URL.",
        "robots.txt controls crawling, not guaranteed indexing.",
      ],
    },
    {
      id: "src_page_http",
      provider: "public-web",
      method: "GET",
      subject: "selected opportunity pages",
      period: null,
      retrievedAt,
      evidenceClass: "observed",
      caveats: [
        "See each observation payload for its exact URL.",
        "Response status and allowed headers are point-in-time observations.",
      ],
    },
    {
      id: "src_static_html",
      provider: "public-web",
      method: "static HTML parse",
      subject: "selected opportunity pages",
      period: null,
      retrievedAt,
      evidenceClass: "observed",
      caveats: [
        "See each observation payload for its exact URL.",
        "JavaScript rendering was not performed.",
      ],
    },
  ];
}

async function runPageAudit(
  parameters: CapabilityRunParameters,
  context: CapabilityRunContext,
): Promise<PageAuditEnvelope> {
  if (!parameters.url) {
    throw new AppError(
      "MISSING_AUDIT_URL",
      "site.page_audit requires a URL.",
    );
  }
  const startedAt = new Date().toISOString();
  const analysis = await auditPage(
    parameters.url,
    {
      ...(parameters.timeoutMs !== undefined
        ? { timeoutMs: parameters.timeoutMs }
        : {}),
      ...(parameters.maxBytes !== undefined
        ? { maxBytes: parameters.maxBytes }
        : {}),
      ...(parameters.maxRedirects !== undefined
        ? { maxRedirects: parameters.maxRedirects }
        : {}),
      ...(context.now !== undefined ? { now: context.now } : {}),
    },
    context.siteClient ?? createSiteHttpClient(),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    run: {
      id: capabilityRunId(),
      capabilityId: "site.page_audit",
      startedAt,
      completedAt: new Date().toISOString(),
      mode: "read-only",
    },
    subject: {
      profile: "public-web",
      site: null,
      ga4Property: null,
      url: analysis.summary.requestedUrl,
    },
    sources: pageSources(
      analysis.summary.finalUrl ?? analysis.summary.requestedUrl,
      analysis.generatedAt,
    ),
    coverage: {
      ...analysis.coverage,
      sampled: false,
    },
    result: analysis.summary,
    observations: analysis.observations,
    findings: analysis.findings,
    recommendations: analysis.recommendations,
    artifacts: [],
    warnings: analysis.warnings,
  };
}

async function runSiteCrawl(
  parameters: CapabilityRunParameters,
  context: CapabilityRunContext,
): Promise<SiteCrawlEnvelope> {
  if (!parameters.url) {
    throw new AppError(
      "MISSING_CRAWL_URL",
      "site.crawl requires a URL.",
    );
  }
  const startedAt = new Date().toISOString();
  const analysis = await crawlSite(
    parameters.url,
    {
      ...(parameters.limit !== undefined ? { limit: parameters.limit } : {}),
      ...(parameters.concurrency !== undefined
        ? { concurrency: parameters.concurrency }
        : {}),
      ...(parameters.sitemap !== undefined
        ? { sitemap: parameters.sitemap }
        : {}),
      ...(parameters.maxSitemaps !== undefined
        ? { maxSitemaps: parameters.maxSitemaps }
        : {}),
      ...(parameters.timeoutMs !== undefined
        ? { timeoutMs: parameters.timeoutMs }
        : {}),
      ...(parameters.maxBytes !== undefined
        ? { maxBytes: parameters.maxBytes }
        : {}),
      ...(parameters.maxSitemapBytes !== undefined
        ? { maxSitemapBytes: parameters.maxSitemapBytes }
        : {}),
      ...(parameters.maxRedirects !== undefined
        ? { maxRedirects: parameters.maxRedirects }
        : {}),
      ...(context.now !== undefined ? { now: context.now } : {}),
    },
    context.siteClient ?? createSiteHttpClient(),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    run: {
      id: capabilityRunId(),
      capabilityId: "site.crawl",
      startedAt,
      completedAt: new Date().toISOString(),
      mode: "read-only",
    },
    subject: {
      profile: "public-web",
      site: null,
      ga4Property: null,
      url: analysis.summary.requestedUrl,
    },
    sources: [
      {
        id: "src_sitemap",
        provider: "public-web",
        method: "bounded sitemap fetch and parse",
        subject: analysis.summary.origin,
        period: null,
        retrievedAt: analysis.generatedAt,
        evidenceClass: "observed",
        caveats: [
          "Only supported, same-origin sitemap documents reached within the configured limits are covered.",
          "Sitemap inclusion is a hint, not proof of indexing.",
        ],
      },
      {
        id: "src_site_crawl",
        provider: "public-web",
        method: "bounded static HTTP crawl",
        subject: analysis.summary.origin,
        period: null,
        retrievedAt: analysis.generatedAt,
        evidenceClass: "observed",
        caveats: [
          "Static HTML only; JavaScript rendering was not performed.",
          "See coverage and incompleteReasons before drawing site-wide conclusions.",
        ],
      },
    ],
    coverage: {
      ...analysis.coverage,
      sampled: false,
    },
    result: {
      ...analysis.summary,
      pages: analysis.pages,
    },
    observations: analysis.observations,
    findings: analysis.findings,
    recommendations: analysis.recommendations,
    artifacts: [],
    warnings: analysis.warnings,
  };
}

function prioritizedPages(opportunities: GoogleOpportunityEnvelope, limit: number) {
  const priority = { high: 0, medium: 1, low: 2 } as const;
  const candidates = opportunities.findings
    .filter(
      (item) =>
        item.kind === "page_query" &&
        item.page !== null &&
        /^https?:\/\//iu.test(item.page),
    )
    .sort(
      (left, right) =>
        priority[left.priority] - priority[right.priority] ||
        right.metrics.impressions - left.metrics.impressions ||
        (left.page ?? "").localeCompare(right.page ?? ""),
    );
  const selectedUrls: string[] = [];
  for (const candidate of candidates) {
    const page = candidate.page as string;
    if (!selectedUrls.includes(page)) {
      selectedUrls.push(page);
    }
    if (selectedUrls.length >= limit) {
      break;
    }
  }
  return selectedUrls.map((url) => ({
    url,
    sourceFindingRefs: candidates
      .filter(({ page }) => page === url)
      .map(({ id }) => id),
  }));
}

async function runOpportunityAudits(
  parameters: CapabilityRunParameters,
  context: CapabilityRunContext,
): Promise<OpportunityAuditEnvelope> {
  if (
    parameters.limit !== undefined &&
    (!Number.isInteger(parameters.limit) ||
      parameters.limit < 1 ||
      parameters.limit > 20)
  ) {
    throw new AppError(
      "INVALID_OPPORTUNITY_AUDIT_LIMIT",
      "site.audit_opportunities limit must be an integer from 1 to 20.",
    );
  }
  const startedAt = new Date().toISOString();
  const opportunities = await runGoogleOpportunities(parameters, context);
  const selected = prioritizedPages(opportunities, parameters.limit ?? 5);
  const pageAudits: OpportunityPageAudit[] = [];
  for (const selection of selected) {
    try {
      pageAudits.push({
        ...selection,
        audit: await runPageAudit(
          {
            url: selection.url,
            ...(parameters.timeoutMs !== undefined
              ? { timeoutMs: parameters.timeoutMs }
              : {}),
            ...(parameters.maxBytes !== undefined
              ? { maxBytes: parameters.maxBytes }
              : {}),
            ...(parameters.maxRedirects !== undefined
              ? { maxRedirects: parameters.maxRedirects }
              : {}),
          },
          context,
        ),
        error: null,
      });
    } catch (error) {
      pageAudits.push({
        ...selection,
        audit: null,
        error: {
          code: error instanceof AppError ? error.code : "PAGE_AUDIT_FAILED",
          message:
            error instanceof Error ? error.message : "Page audit failed.",
        },
      });
    }
  }
  const completed = pageAudits.flatMap(({ audit }) =>
    audit === null ? [] : [audit],
  );
  const failed = pageAudits.length - completed.length;
  const google = requireGoogle(context);
  return {
    schemaVersion: SCHEMA_VERSION,
    run: {
      id: capabilityRunId(),
      capabilityId: "site.audit_opportunities",
      startedAt,
      completedAt: new Date().toISOString(),
      mode: "read-only",
    },
    subject: {
      profile: google.config.profile,
      site: google.config.gscSite ?? null,
      ga4Property: google.config.ga4Property ?? null,
      url: null,
    },
    sources: [
      ...opportunities.sources,
      ...(completed.length > 0
        ? opportunityPageSources(new Date().toISOString())
        : []),
    ],
    coverage: {
      requested: selected.length,
      observed: completed.length,
      omitted: failed,
      truncated: opportunities.coverage.truncated,
      sampled: false,
      partial: opportunities.coverage.partial || failed > 0,
      incompleteReasons: [
        ...opportunities.coverage.incompleteReasons,
        ...(failed > 0 ? [`${failed} selected page audit(s) failed`] : []),
      ],
    },
    result: {
      selectedPages: selected.length,
      completedAudits: completed.length,
      failedAudits: failed,
      opportunityRunId: opportunities.run.id,
      pageAudits,
    },
    observations: [
      ...opportunities.observations,
      ...completed.flatMap(({ observations }) => observations),
    ],
    findings: [
      ...opportunities.findings,
      ...completed.flatMap(({ findings }) => findings),
    ],
    recommendations: [
      ...opportunities.recommendations,
      ...completed.flatMap(({ recommendations }) => recommendations),
    ],
    artifacts: [],
    warnings: [
      ...opportunities.warnings,
      "Priority-page audits use returned static HTML only; browser rendering was not run.",
      ...(failed > 0
        ? ["Some page audits failed; inspect result.pageAudits error fields."]
        : []),
    ],
  };
}

export function runCapability(
  capabilityId: "google.opportunities",
  parameters: CapabilityRunParameters,
  context: CapabilityRunContext,
): Promise<GoogleOpportunityEnvelope>;
export function runCapability(
  capabilityId: "site.page_audit",
  parameters: CapabilityRunParameters,
  context: CapabilityRunContext,
): Promise<PageAuditEnvelope>;
export function runCapability(
  capabilityId: "site.audit_opportunities",
  parameters: CapabilityRunParameters,
  context: CapabilityRunContext,
): Promise<OpportunityAuditEnvelope>;
export function runCapability(
  capabilityId: "site.crawl",
  parameters: CapabilityRunParameters,
  context: CapabilityRunContext,
): Promise<SiteCrawlEnvelope>;
export function runCapability(
  capabilityId: string,
  parameters: CapabilityRunParameters,
  context: CapabilityRunContext,
): Promise<
  | GoogleOpportunityEnvelope
  | PageAuditEnvelope
  | OpportunityAuditEnvelope
  | SiteCrawlEnvelope
>;
export async function runCapability(
  capabilityId: string,
  parameters: CapabilityRunParameters,
  context: CapabilityRunContext,
): Promise<
  | GoogleOpportunityEnvelope
  | PageAuditEnvelope
  | OpportunityAuditEnvelope
  | SiteCrawlEnvelope
> {
  if (!describeCapability(capabilityId)) {
    throw new AppError(
      "UNKNOWN_CAPABILITY",
      `Unknown capability: ${capabilityId}`,
    );
  }
  if (capabilityId === "google.opportunities") {
    return runGoogleOpportunities(parameters, context);
  }
  if (capabilityId === "site.page_audit") {
    return runPageAudit(parameters, context);
  }
  if (capabilityId === "site.crawl") {
    return runSiteCrawl(parameters, context);
  }
  if (capabilityId === "site.audit_opportunities") {
    return runOpportunityAudits(parameters, context);
  }
  throw new AppError(
    "CAPABILITY_NOT_IMPLEMENTED",
    `Capability is registered but not implemented: ${capabilityId}`,
  );
}
