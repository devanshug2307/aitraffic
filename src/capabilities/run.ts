import { buildOpportunityAnalysis } from "../analysis/opportunities.js";
import type {
  GoogleConnectorConfig,
  GoogleDataProvider,
} from "../connectors/google/types.js";
import {
  capabilityRunId,
  describeCapability,
  type CapabilityCoverage,
  type CapabilityRunEnvelope,
} from "../core/capabilities.js";
import { AppError } from "../core/result.js";
import { SCHEMA_VERSION } from "../core/version.js";

export interface CapabilityRunContext {
  config: GoogleConnectorConfig;
  provider: GoogleDataProvider;
  now?: Date;
}

export interface CapabilityRunParameters {
  days?: number;
  maxRows?: number;
  minImpressions?: number;
}

function combinedCoverage(
  analysis: Awaited<ReturnType<typeof buildOpportunityAnalysis>>,
): CapabilityCoverage {
  const coverages = [
    analysis.coverage.currentGsc,
    analysis.coverage.previousGsc,
    analysis.coverage.ga4,
  ];
  const requested = coverages.reduce(
    (total, coverage) => total + coverage.requestedRows,
    0,
  );
  const observed = coverages.reduce(
    (total, coverage) => total + coverage.observedRows,
    0,
  );
  return {
    requested,
    observed,
    omitted: null,
    truncated: coverages.some((coverage) => coverage.truncated),
    sampled: false,
    partial: coverages.some((coverage) => coverage.partial),
    incompleteReasons: [
      ...new Set(
        coverages.flatMap((coverage) => coverage.incompleteReasons),
      ),
    ],
  };
}

export async function runCapability(
  capabilityId: string,
  parameters: CapabilityRunParameters,
  context: CapabilityRunContext,
) {
  const definition = describeCapability(capabilityId);
  if (!definition) {
    throw new AppError(
      "UNKNOWN_CAPABILITY",
      `Unknown capability: ${capabilityId}`,
    );
  }
  if (capabilityId !== "google.opportunities") {
    throw new AppError(
      "CAPABILITY_NOT_IMPLEMENTED",
      `Capability is registered but not implemented: ${capabilityId}`,
    );
  }
  if (!context.config.ga4Property || !context.config.gscSite) {
    throw new AppError(
      "GOOGLE_RESOURCES_NOT_SELECTED",
      "google.opportunities requires a selected GA4 property and Search Console site.",
    );
  }

  const startedAt = new Date().toISOString();
  const analysis = await buildOpportunityAnalysis(
    context.provider,
    context.config,
    {
      ...parameters,
      ...(context.now !== undefined ? { now: context.now } : {}),
    },
  );
  const completedAt = new Date().toISOString();
  const envelope: CapabilityRunEnvelope<
    typeof analysis.summary & {
      periods: typeof analysis.periods;
      sourceCoverage: typeof analysis.coverage;
    },
    (typeof analysis.observations)[number],
    (typeof analysis.findings)[number],
    (typeof analysis.recommendations)[number]
  > = {
    schemaVersion: SCHEMA_VERSION,
    run: {
      id: capabilityRunId(),
      capabilityId,
      startedAt,
      completedAt,
      mode: "read-only",
    },
    subject: {
      profile: context.config.profile,
      site: context.config.gscSite,
      ga4Property: context.config.ga4Property,
    },
    sources: [
      {
        id: "src_gsc_current",
        provider: "google-search-console",
        method: "searchAnalytics.query",
        subject: context.config.gscSite,
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
        subject: context.config.gscSite,
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
        subject: context.config.ga4Property,
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
  return envelope;
}
