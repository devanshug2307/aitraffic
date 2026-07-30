import { randomUUID } from "node:crypto";

import { SCHEMA_VERSION } from "./version.js";

export type CapabilitySideEffects = "none" | "local-write" | "external-write";

export interface CapabilityDefinition {
  id: string;
  title: string;
  category: string;
  purpose: string;
  sideEffects: CapabilitySideEffects;
  costClass: "free" | "metered";
  inputSchema: Record<string, unknown>;
  outputContract: string[];
  limitations: string[];
}

export interface CapabilityCoverage {
  requested: number;
  observed: number;
  omitted: number | null;
  truncated: boolean;
  sampled: boolean;
  partial: boolean;
  incompleteReasons: string[];
}

export interface CapabilitySource {
  id: string;
  provider: string;
  method: string;
  subject: string;
  period: { start: string; end: string };
  retrievedAt: string;
  evidenceClass: "observed";
  caveats: string[];
}

export interface CapabilityRunEnvelope<
  Result,
  Observation,
  Finding,
  Recommendation,
> {
  schemaVersion: typeof SCHEMA_VERSION;
  run: {
    id: string;
    capabilityId: string;
    startedAt: string;
    completedAt: string;
    mode: "read-only";
  };
  subject: {
    profile: string;
    site: string | null;
    ga4Property: string | null;
  };
  sources: CapabilitySource[];
  coverage: CapabilityCoverage;
  result: Result;
  observations: Observation[];
  findings: Finding[];
  recommendations: Recommendation[];
  artifacts: [];
  warnings: string[];
}

const CAPABILITY_DEFINITIONS = [
  {
    id: "google.opportunities",
    title: "Google search opportunities",
    category: "search-performance",
    purpose:
      "Prioritize pages to improve using equal-period Search Console performance and current GA4 landing-page outcomes.",
    sideEffects: "none",
    costClass: "free",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          minimum: 1,
          maximum: 366,
          default: 28,
        },
        maxRows: {
          type: "integer",
          minimum: 1,
          maximum: 100000,
          default: 50000,
          description:
            "Maximum rows fetched independently from each GA4 and Search Console period.",
        },
        minImpressions: {
          type: "integer",
          minimum: 1,
          maximum: 1000000,
          default: 100,
        },
      },
      additionalProperties: false,
    },
    outputContract: [
      "coverage",
      "result",
      "findings",
      "recommendations",
      "observations",
      "warnings",
    ],
    limitations: [
      "Search Console returns top rows and can omit anonymized queries.",
      "GA4 and Search Console are joined at normalized landing-page path, not user or session level.",
      "Recommendations are deterministic heuristics, not traffic forecasts.",
    ],
  },
] as const satisfies readonly CapabilityDefinition[];

export function listCapabilities(): CapabilityDefinition[] {
  return CAPABILITY_DEFINITIONS.map((definition) => ({ ...definition }));
}

export function describeCapability(
  capabilityId: string,
): CapabilityDefinition | undefined {
  const definition = CAPABILITY_DEFINITIONS.find(
    ({ id }) => id === capabilityId,
  );
  return definition === undefined ? undefined : { ...definition };
}

export function capabilityRunId(): string {
  return `run_${randomUUID()}`;
}
