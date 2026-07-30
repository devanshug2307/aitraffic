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
  period: { start: string; end: string } | null;
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
    url: string | null;
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
  {
    id: "site.page_audit",
    title: "Static page technical audit",
    category: "technical-seo",
    purpose:
      "Fetch one public page safely and report reproducible HTTP, robots, metadata, canonical, structured-data syntax, heading, and link observations.",
    sideEffects: "none",
    costClass: "free",
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri" },
        timeoutMs: {
          type: "integer",
          minimum: 1,
          maximum: 30000,
          default: 10000,
        },
        maxBytes: {
          type: "integer",
          minimum: 1,
          maximum: 10485760,
          default: 2097152,
        },
        maxRedirects: {
          type: "integer",
          minimum: 0,
          maximum: 10,
          default: 5,
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
      "Checks only the returned static HTML; it does not render JavaScript.",
      "A single-page audit cannot prove site-wide orphaning, sitemap completeness, or destination link health.",
      "Declared canonicals are hints, and JSON-LD parsing does not prove rich-result eligibility.",
      "Public HTTP(S) targets only; private, local, reserved, credential-bearing, and non-default-port URLs are blocked.",
    ],
  },
  {
    id: "site.crawl",
    title: "Bounded sitemap and link crawl",
    category: "technical-seo",
    purpose:
      "Discover pages from robots.txt, supported sitemaps, and static internal links, then produce bounded page-level and site-level technical evidence.",
    sideEffects: "none",
    costClass: "free",
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri" },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 500,
          default: 25,
        },
        concurrency: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          default: 3,
        },
        sitemap: {
          description:
            "Use auto discovery, disable sitemap discovery with none, or provide an exact same-origin sitemap URL.",
          anyOf: [
            { enum: ["auto", "none"] },
            { type: "string", format: "uri" },
          ],
          default: "auto",
        },
        maxSitemaps: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 20,
        },
        timeoutMs: {
          type: "integer",
          minimum: 1,
          maximum: 30000,
          default: 10000,
        },
        maxBytes: {
          type: "integer",
          minimum: 1,
          maximum: 10485760,
          default: 2097152,
        },
        maxSitemapBytes: {
          type: "integer",
          minimum: 1,
          maximum: 10485760,
          default: 5242880,
        },
        maxRedirects: {
          type: "integer",
          minimum: 0,
          maximum: 10,
          default: 5,
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
      "The crawl is bounded by explicit page, sitemap, byte, time, redirect, concurrency, and URL-variant limits.",
      "Static HTML only; JavaScript-rendered links and metadata are not observed.",
      "Page and sitemap scope is limited to exact apex/www host variants; broader cross-site sitemap ownership cannot be verified locally.",
      "This slice parses XML sitemap indexes, XML URL sets, and text sitemaps; RSS and Atom feeds are reported as unsupported.",
      "Sitemap inclusion is a hint and does not prove crawling, indexing, rankings, or AI citations.",
      "Compressed .xml.gz files require an HTTP content-encoding in this slice; raw gzip sitemap bodies are reported as unsupported coverage.",
    ],
  },
  {
    id: "site.audit_opportunities",
    title: "Audit priority search opportunities",
    category: "technical-seo",
    purpose:
      "Select high-value pages from Google opportunities and attach a bounded static technical audit to each unique public page.",
    sideEffects: "none",
    costClass: "free",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "integer", minimum: 1, maximum: 366, default: 28 },
        maxRows: {
          type: "integer",
          minimum: 1,
          maximum: 100000,
          default: 50000,
        },
        minImpressions: {
          type: "integer",
          minimum: 1,
          maximum: 1000000,
          default: 100,
        },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
        timeoutMs: {
          type: "integer",
          minimum: 1,
          maximum: 30000,
          default: 10000,
        },
        maxBytes: {
          type: "integer",
          minimum: 1,
          maximum: 10485760,
          default: 2097152,
        },
        maxRedirects: {
          type: "integer",
          minimum: 0,
          maximum: 10,
          default: 5,
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
      "Page selection inherits Search Console and GA4 coverage limitations.",
      "Audits at most the requested number of unique opportunity pages.",
      "Checks returned static HTML only and does not render JavaScript.",
      "A page fetch failure is reported as partial coverage rather than hidden.",
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
