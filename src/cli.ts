#!/usr/bin/env node

import { runDoctor } from "./commands/doctor.js";
import {
  acquisitionPeriods,
  buildAcquisitionReport,
} from "./analysis/acquisition.js";
import { compareAuditRuns } from "./analysis/auditComparison.js";
import {
  runCapability,
  type CapabilityRunParameters,
  type FullAuditEnvelope,
} from "./capabilities/run.js";
import {
  configureGoogleConnector,
  readGoogleConnectorConfig,
  selectLocalGoogleConnector,
  validateGoogleProfile,
} from "./connectors/google/config.js";
import {
  configureGoogleOAuthClient,
  getGoogleOAuthStatus,
  loginGoogleOAuthProfile,
  revokeGoogleOAuthProfile,
} from "./connectors/google/oauth.js";
import {
  createGoogleDataProvider,
  resolveOptionalGoogleDataProvider,
} from "./connectors/google/provider.js";
import type {
  GscAggregationType,
  GscDataState,
  GscDimensionFilter,
  GscFilterDimension,
  GscFilterOperator,
  GoogleConnectorConfig,
  GoogleDataProvider,
  GscSearchType,
} from "./connectors/google/types.js";
import { createSystemGoogleVault } from "./connectors/google/vault.js";
import { classifyUserAgent } from "./core/agentRegistry.js";
import {
  describeCapability,
  listCapabilities,
} from "./core/capabilities.js";
import { evidenceJsonSchema } from "./core/evidence.js";
import { analyzeLogFile } from "./core/logs.js";
import {
  listAuditRuns,
  readAuditRun,
  saveAuditRun,
} from "./core/auditRuns.js";
import {
  explainQueuedOpportunity,
  listQueuedOpportunities,
  syncOpportunityQueue,
  updateOpportunityStatus,
} from "./core/opportunityQueue.js";
import {
  CHANGE_TYPES,
  createChangeRecord,
  listChangeRecords,
  showChangeRecord,
  type ChangeType,
} from "./core/changeRecords.js";
import {
  type AgentIntegration,
  initializeProject,
} from "./core/project.js";
import {
  AppError,
  failure,
  success,
  type CommandResult,
} from "./core/result.js";
import { VERSION } from "./core/version.js";
import { serveMcp } from "./mcp/server.js";
import {
  inspectOnboarding,
  runOnboardingWizard,
} from "./onboarding/wizard.js";
import {
  repairAgentRegistration,
  type RegistrationAgent,
} from "./onboarding/registrations.js";

type OutputFormat = "text" | "json";

interface ParsedArguments {
  positional: string[];
  format: OutputFormat;
  verbose: boolean;
}

const HELP = `AItraffic — terminal-first AI visibility evidence

Usage:
  aitraffic onboard [--dry-run]
  aitraffic onboard --check [--format json]
  aitraffic setup [--dry-run]
  aitraffic init [--agent codex|claude-code|both] [--site URL] [--force]
  aitraffic doctor [--repair codex|claude-code|both] [--dry-run|--yes] [--expect-fingerprint VALUE]
  aitraffic schema evidence
  aitraffic logs import <path>
  aitraffic crawlers <path>
  aitraffic classify <user-agent>
  aitraffic auth google configure (--from-client-json PATH | --from-env-file PATH)
  aitraffic auth google login --profile NAME
  aitraffic auth google status [--profile NAME]
  aitraffic auth google revoke --profile NAME [--dry-run] [--local-only]
  aitraffic google configure --adapter-script PATH --profile NAME [--ga4-property ID] [--gsc-site SITE] [--dry-run]
  aitraffic google select --profile NAME [--ga4-property ID] [--gsc-site SITE] [--dry-run]
  aitraffic google status
  aitraffic google inventory [--profile NAME]
  aitraffic ga4 report [--start DATE] [--end DATE] [--dimensions CSV] [--metrics CSV] [--limit N] [--offset N]
  aitraffic gsc report [--start DATE] [--end DATE] [--dimensions CSV] [--limit N] [--offset N] [--type TYPE] [--data-state STATE] [--aggregation TYPE] [--filter DIMENSION:OPERATOR:EXPRESSION]
  aitraffic report acquisition [--days N]
  aitraffic opportunities [--days N] [--max-rows N] [--min-impressions N]
  aitraffic opportunities sync (--from RUN_ID | --latest) [--dry-run]
  aitraffic opportunities list [--status active|open|planned|dismissed|verified|all] [--observation present|not_observed|unknown|all] [--source technical|google-opportunity] [--priority critical|high|medium|low|info] [--site URL] [--limit N]
  aitraffic opportunities explain <OPP_ID>
  aitraffic opportunities update <OPP_ID> --status open|planned|dismissed --reason TEXT [--dry-run]
  aitraffic changes record --opportunity <OPP_ID> --url <URL> [--url <URL>] --type metadata|content|internal-links|structured-data|technical|measurement|other [--git-commit REF] [--deployment REF] [--before-hash SHA256] [--after-hash SHA256] [--note TEXT] [--concurrent-change TEXT] [--dry-run]
  aitraffic changes list [--opportunity <OPP_ID>] [--url <URL>] [--limit N]
  aitraffic changes show <CHANGE_ID>
  aitraffic crawl <URL> [--limit N] [--concurrency N] [--sitemap auto|none|URL] [--max-sitemaps N]
  aitraffic audit <URL> [--save] [--google auto|off|required] [--technical-only] [--focus all|indexing|internal-links|structured-data] [--top N]
  aitraffic audit history [--limit N]
  aitraffic audit show <RUN_ID>
  aitraffic audit compare <OLDER_RUN_ID> <NEWER_RUN_ID>
  aitraffic audit compare --latest
  aitraffic audit page <URL> [--timeout-ms N] [--max-bytes N] [--max-redirects N]
  aitraffic audit opportunities [--limit N] [--days N] [--max-rows N] [--min-impressions N]
  aitraffic capabilities list
  aitraffic capabilities describe <id>
  aitraffic capabilities run <id> [capability options]
  aitraffic mcp serve
  aitraffic version

Global options:
  --format text|json   Output mode; text is the default
  --json               Alias for --format json
  --verbose            Show the complete text payload instead of a summary
  --help, -h           Show this help
`;

const ONBOARD_HELP = `AItraffic guided onboarding

Usage:
  aitraffic onboard
  aitraffic onboard --dry-run
  aitraffic onboard --check [--format json]
  aitraffic onboard --non-interactive [--format json]
  aitraffic setup

Options:
  --dry-run           Review choices without writing project or agent configuration
  --check             Inspect project, agents, and Google state without prompting
  --non-interactive   Alias for --check; never prompts or writes
  --help, -h          Show this help
`;

function parseGlobalArguments(argv: string[]): ParsedArguments {
  const positional: string[] = [];
  let format: OutputFormat = "text";
  let verbose = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--verbose") {
      verbose = true;
      continue;
    }
    if (value === "--json") {
      format = "json";
      continue;
    }
    if (value === "--format") {
      const requested = argv[index + 1];
      if (requested !== "text" && requested !== "json") {
        throw new AppError(
          "INVALID_FORMAT",
          "--format must be either text or json.",
        );
      }
      format = requested;
      index += 1;
      continue;
    }
    if (value?.startsWith("--format=")) {
      const requested = value.slice("--format=".length);
      if (requested !== "text" && requested !== "json") {
        throw new AppError(
          "INVALID_FORMAT",
          "--format must be either text or json.",
        );
      }
      format = requested;
      continue;
    }
    if (value !== undefined) {
      positional.push(value);
    }
  }

  return { positional, format, verbose };
}

function extractOption(
  args: string[],
  name: string,
): { value?: string; remaining: string[] } {
  const remaining: string[] = [];
  let found: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === name) {
      const optionValue = args[index + 1];
      if (!optionValue || optionValue.startsWith("--")) {
        throw new AppError(
          "MISSING_OPTION_VALUE",
          `${name} requires a value.`,
        );
      }
      found = optionValue;
      index += 1;
      continue;
    }
    if (value?.startsWith(`${name}=`)) {
      found = value.slice(name.length + 1);
      continue;
    }
    if (value !== undefined) {
      remaining.push(value);
    }
  }

  const result: { value?: string; remaining: string[] } = { remaining };
  if (found !== undefined) {
    result.value = found;
  }
  return result;
}

function extractRepeatedOption(
  args: string[],
  name: string,
): { values: string[]; remaining: string[] } {
  const remaining: string[] = [];
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === name) {
      const optionValue = args[index + 1];
      if (!optionValue || optionValue.startsWith("--")) {
        throw new AppError(
          "MISSING_OPTION_VALUE",
          `${name} requires a value.`,
        );
      }
      values.push(optionValue);
      index += 1;
      continue;
    }
    if (value?.startsWith(`${name}=`)) {
      values.push(value.slice(name.length + 1));
      continue;
    }
    if (value !== undefined) {
      remaining.push(value);
    }
  }

  return { values, remaining };
}

function takeFlag(
  args: string[],
  name: string,
): { present: boolean; remaining: string[] } {
  return {
    present: args.includes(name),
    remaining: args.filter((value) => value !== name),
  };
}

function assertNoUnknownOptions(args: string[]): void {
  const unknown = args.find((value) => value.startsWith("-"));
  if (unknown) {
    throw new AppError("UNKNOWN_OPTION", `Unknown option: ${unknown}`);
  }
}

function commaSeparated(
  value: string | undefined,
  fallback: string[],
): string[] {
  if (value === undefined) {
    return fallback;
  }
  if (value === "none") {
    return [];
  }
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new AppError("INVALID_LIST", "Comma-separated option cannot be empty.");
  }
  return values;
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  label: string,
  maximum: number,
): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new AppError(
      "INVALID_NUMBER",
      `${label} must be an integer from 1 to ${maximum}.`,
    );
  }
  return parsed;
}

function nonNegativeInteger(
  value: string | undefined,
  fallback: number,
  label: string,
  maximum: number,
): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new AppError(
      "INVALID_NUMBER",
      `${label} must be an integer from 0 to ${maximum}.`,
    );
  }
  return parsed;
}

function enumOption<const T extends readonly string[]>(
  value: string | undefined,
  fallback: T[number],
  label: string,
  allowed: T,
): T[number] {
  const selected = value ?? fallback;
  if (!allowed.includes(selected)) {
    throw new AppError(
      "INVALID_OPTION_VALUE",
      `${label} must be one of: ${allowed.join(", ")}.`,
    );
  }
  return selected;
}

const GSC_FILTER_DIMENSIONS = [
  "query",
  "page",
  "country",
  "device",
  "searchAppearance",
] as const;

const GSC_FILTER_OPERATORS = [
  "contains",
  "equals",
  "notContains",
  "notEquals",
  "includingRegex",
  "excludingRegex",
] as const;

function parseGscFilter(value: string): GscDimensionFilter {
  const firstSeparator = value.indexOf(":");
  const secondSeparator = value.indexOf(":", firstSeparator + 1);
  if (firstSeparator < 1 || secondSeparator <= firstSeparator + 1) {
    throw new AppError(
      "INVALID_GSC_FILTER",
      "--filter must use DIMENSION:OPERATOR:EXPRESSION.",
    );
  }
  const dimension = value.slice(0, firstSeparator);
  const operator = value.slice(firstSeparator + 1, secondSeparator);
  const expression = value.slice(secondSeparator + 1);
  if (!(GSC_FILTER_DIMENSIONS as readonly string[]).includes(dimension)) {
    throw new AppError(
      "INVALID_GSC_FILTER_DIMENSION",
      `Filter dimension must be one of: ${GSC_FILTER_DIMENSIONS.join(", ")}.`,
    );
  }
  if (!(GSC_FILTER_OPERATORS as readonly string[]).includes(operator)) {
    throw new AppError(
      "INVALID_GSC_FILTER_OPERATOR",
      `Filter operator must be one of: ${GSC_FILTER_OPERATORS.join(", ")}.`,
    );
  }
  if (!expression) {
    throw new AppError(
      "INVALID_GSC_FILTER",
      "Filter expression cannot be empty.",
    );
  }
  return {
    dimension: dimension as GscFilterDimension,
    operator: operator as GscFilterOperator,
    expression,
  };
}

function parseOpportunityOptions(args: string[]): {
  parameters: {
    days: number;
    maxRows: number;
    minImpressions: number;
  };
  remaining: string[];
} {
  const days = extractOption(args, "--days");
  const maxRows = extractOption(days.remaining, "--max-rows");
  const minImpressions = extractOption(
    maxRows.remaining,
    "--min-impressions",
  );
  return {
    parameters: {
      days: positiveInteger(days.value, 28, "--days", 366),
      maxRows: positiveInteger(
        maxRows.value,
        50_000,
        "--max-rows",
        100_000,
      ),
      minImpressions: positiveInteger(
        minImpressions.value,
        100,
        "--min-impressions",
        1_000_000,
      ),
    },
    remaining: minImpressions.remaining,
  };
}

function parseSiteAuditOptions(args: string[]): {
  parameters: {
    timeoutMs: number;
    maxBytes: number;
    maxRedirects: number;
  };
  remaining: string[];
} {
  const timeout = extractOption(args, "--timeout-ms");
  const maxBytes = extractOption(timeout.remaining, "--max-bytes");
  const maxRedirects = extractOption(
    maxBytes.remaining,
    "--max-redirects",
  );
  return {
    parameters: {
      timeoutMs: positiveInteger(
        timeout.value,
        10_000,
        "--timeout-ms",
        30_000,
      ),
      maxBytes: positiveInteger(
        maxBytes.value,
        2 * 1024 * 1024,
        "--max-bytes",
        10 * 1024 * 1024,
      ),
      maxRedirects: nonNegativeInteger(
        maxRedirects.value,
        5,
        "--max-redirects",
        10,
      ),
    },
    remaining: maxRedirects.remaining,
  };
}

function parseOpportunityAuditOptions(args: string[]) {
  const opportunity = parseOpportunityOptions(args);
  const limit = extractOption(opportunity.remaining, "--limit");
  const site = parseSiteAuditOptions(limit.remaining);
  return {
    parameters: {
      ...opportunity.parameters,
      ...site.parameters,
      limit: positiveInteger(limit.value, 5, "--limit", 20),
    },
    remaining: site.remaining,
  };
}

function parseCrawlOptions(args: string[]) {
  const limit = extractOption(args, "--limit");
  const concurrency = extractOption(limit.remaining, "--concurrency");
  const sitemap = extractOption(concurrency.remaining, "--sitemap");
  const maxSitemaps = extractOption(
    sitemap.remaining,
    "--max-sitemaps",
  );
  const maxSitemapBytes = extractOption(
    maxSitemaps.remaining,
    "--max-sitemap-bytes",
  );
  const site = parseSiteAuditOptions(maxSitemapBytes.remaining);
  return {
    parameters: {
      ...site.parameters,
      limit: positiveInteger(limit.value, 25, "--limit", 500),
      concurrency: positiveInteger(
        concurrency.value,
        3,
        "--concurrency",
        10,
      ),
      sitemap: sitemap.value ?? "auto",
      maxSitemaps: positiveInteger(
        maxSitemaps.value,
        20,
        "--max-sitemaps",
        100,
      ),
      maxSitemapBytes: positiveInteger(
        maxSitemapBytes.value,
        5 * 1024 * 1024,
        "--max-sitemap-bytes",
        10 * 1024 * 1024,
      ),
    },
    remaining: site.remaining,
  };
}

function parseFullAuditOptions(args: string[]) {
  const technicalOnly = takeFlag(args, "--technical-only");
  const google = extractOption(technicalOnly.remaining, "--google");
  if (technicalOnly.present && google.value !== undefined) {
    throw new AppError(
      "CONFLICTING_AUDIT_GOOGLE_OPTIONS",
      "--technical-only cannot be combined with --google.",
    );
  }
  const opportunityLimit = extractOption(
    google.remaining,
    "--opportunity-limit",
  );
  const focus = extractOption(opportunityLimit.remaining, "--focus");
  const top = extractOption(focus.remaining, "--top");
  const crawl = parseCrawlOptions(top.remaining);
  const opportunity = parseOpportunityOptions(crawl.remaining);
  return {
    parameters: {
      ...crawl.parameters,
      ...opportunity.parameters,
      google: technicalOnly.present
        ? ("off" as const)
        : enumOption(
            google.value,
            "auto",
            "--google",
            ["auto", "off", "required"] as const,
          ),
      opportunityLimit: positiveInteger(
        opportunityLimit.value,
        5,
        "--opportunity-limit",
        20,
      ),
      focus: enumOption(
        focus.value,
        "all",
        "--focus",
        [
          "all",
          "indexing",
          "internal-links",
          "structured-data",
        ] as const,
      ),
      top: positiveInteger(top.value, 10, "--top", 100),
    },
    remaining: opportunity.remaining,
  };
}

async function googleProvider(profile?: string): Promise<{
  config: GoogleConnectorConfig;
  provider: GoogleDataProvider;
}> {
  if (profile !== undefined) {
    const config = {
      schemaVersion: "0.1.0" as const,
      adapter: "local-oauth" as const,
      profile: validateGoogleProfile(profile),
    };
    return {
      config,
      provider: await createGoogleDataProvider(config),
    };
  }
  const config = await readGoogleConnectorConfig();
  if (!config) {
    throw new AppError(
      "GOOGLE_NOT_CONFIGURED",
      "Google connector is not configured. Run aitraffic google select or aitraffic google configure.",
    );
  }
  return {
    config,
    provider: await createGoogleDataProvider(config),
  };
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function compactCoverage(value: unknown): string | null {
  const coverage = record(value);
  if (coverage === null) {
    return null;
  }
  const fields = [
    ["requested", coverage.requested],
    ["observed", coverage.observed],
    ["omitted", coverage.omitted],
  ]
    .filter(([, item]) => typeof item === "number")
    .map(([key, item]) => `${key} ${item}`);
  if (coverage.partial === true) {
    fields.push("partial");
  }
  if (coverage.truncated === true) {
    fields.push("truncated");
  }
  return fields.length === 0 ? null : fields.join(" · ");
}

function findingLabel(value: unknown): string | null {
  const item = record(value);
  if (item === null) {
    return null;
  }
  const priority =
    typeof item.priority === "string"
      ? item.priority
      : typeof item.severity === "string"
        ? item.severity
        : "info";
  const title =
    typeof item.title === "string"
      ? item.title
      : typeof item.reason === "string"
        ? item.reason
        : null;
  if (title === null) {
    return null;
  }
  const urls = Array.isArray(item.urls)
    ? item.urls.filter((url): url is string => typeof url === "string")
    : [];
  const page = typeof item.page === "string" ? item.page : urls[0];
  return `[${priority}] ${title}${page ? ` — ${page}` : ""}`;
}

function compactCapability(
  data: UnknownRecord,
): string[] | null {
  const run = record(data.run);
  const result = record(data.result);
  if (run === null || result === null) {
    return null;
  }
  const lines: string[] = [];
  if (typeof run.id === "string") {
    lines.push(`Run: ${run.id}`);
  }
  const subject = record(data.subject);
  const subjectValue =
    typeof subject?.url === "string"
      ? subject.url
      : typeof subject?.site === "string"
        ? subject.site
        : null;
  if (subjectValue !== null) {
    lines.push(`Subject: ${subjectValue}`);
  }
  const coverage = compactCoverage(data.coverage);
  if (coverage !== null) {
    lines.push(`Coverage: ${coverage}`);
  }

  const technical = record(result.technical);
  const technicalSummary = record(technical?.summary);
  if (technicalSummary !== null) {
    const pages =
      typeof technicalSummary.pagesAudited === "number"
        ? technicalSummary.pagesAudited
        : null;
    const failures =
      typeof technicalSummary.pageFailures === "number"
        ? technicalSummary.pageFailures
        : null;
    if (pages !== null) {
      const utilityUrlsSkipped =
        typeof technicalSummary.utilityUrlsSkipped === "number"
          ? technicalSummary.utilityUrlsSkipped
          : 0;
      lines.push(
        `Technical: ${pages} page${pages === 1 ? "" : "s"} audited${
          failures === null ? "" : ` · ${failures} failed`
        }${
          utilityUrlsSkipped > 0
            ? ` · ${utilityUrlsSkipped} utilities skipped`
            : ""
        }`,
      );
    }
  }
  const google = record(result.google);
  if (google !== null) {
    const status =
      typeof google.status === "string" ? google.status : "unknown";
    const selected =
      typeof google.selectedPages === "number"
        ? ` · ${google.selectedPages} selected pages`
        : "";
    lines.push(`Google: ${status}${selected}`);
  }

  const prioritization = record(result.prioritization);
  const prioritized = Array.isArray(prioritization?.findings)
    ? prioritization.findings
    : null;
  const findings = prioritized ?? (Array.isArray(data.findings) ? data.findings : []);
  if (findings.length > 0) {
    const visible = findings
      .slice(0, 10)
      .flatMap((item) => {
        const label = findingLabel(item);
        return label === null ? [] : [label];
      });
    lines.push(`Findings: ${findings.length}`);
    lines.push(...visible.map((label) => `  ${label}`));
    if (findings.length > visible.length) {
      lines.push(
        `  … ${findings.length - visible.length} more; use --verbose or --format json`,
      );
    }
  } else {
    lines.push("Findings: 0");
  }

  const artifacts = Array.isArray(data.artifacts) ? data.artifacts : [];
  for (const artifact of artifacts) {
    const item = record(artifact);
    if (typeof item?.path === "string") {
      lines.push(`Artifact: ${item.path}`);
    }
  }
  const caveats = Array.isArray(data.warnings)
    ? data.warnings.filter(
        (warning): warning is string => typeof warning === "string",
      )
    : [];
  for (const caveat of caveats.slice(0, 5)) {
    lines.push(`Caveat: ${caveat}`);
  }
  if (caveats.length > 5) {
    lines.push(
      `Caveat: ${caveats.length - 5} more; use --verbose or --format json`,
    );
  }
  return lines;
}

function compactOpportunitySync(data: UnknownRecord): string[] {
  const lines: string[] = [];
  if (typeof data.sourceRunId === "string") {
    lines.push(`Source run: ${data.sourceRunId}`);
  }
  const changes = record(data.changes);
  if (changes !== null) {
    lines.push(
      `Changes: ${Object.entries(changes)
        .filter(([, value]) => typeof value === "number")
        .map(([key, value]) => `${key} ${value}`)
        .join(" · ")}`,
    );
  }
  if (typeof data.totalStored === "number") {
    lines.push(`Stored opportunities: ${data.totalStored}`);
  }
  const affected = Array.isArray(data.affected) ? data.affected : [];
  for (const item of affected.slice(0, 10)) {
    const opportunity = record(item);
    if (
      typeof opportunity?.id === "string" &&
      typeof opportunity.title === "string"
    ) {
      lines.push(
        `  ${opportunity.id} [${String(opportunity.priority ?? "info")}] ${opportunity.title}`,
      );
    }
  }
  if (affected.length > 10) {
    lines.push(
      `  … ${affected.length - 10} more; use --verbose or --format json`,
    );
  }
  return lines;
}

function compactOpportunityList(data: UnknownRecord): string[] {
  const lines: string[] = [];
  const summary = record(data.summary);
  if (summary !== null) {
    lines.push(
      `Opportunities: ${String(summary.returned ?? 0)} returned · ${String(summary.stored ?? 0)} stored`,
    );
  }
  const opportunities = Array.isArray(data.opportunities)
    ? data.opportunities
    : [];
  for (const item of opportunities) {
    const opportunity = record(item);
    if (
      typeof opportunity?.id === "string" &&
      typeof opportunity.title === "string"
    ) {
      lines.push(
        `  ${opportunity.id} [${String(opportunity.priority ?? "info")}/${String(opportunity.status ?? "unknown")}] ${opportunity.title}`,
      );
    }
  }
  return lines;
}

function compactChangeRecords(
  command: string,
  data: UnknownRecord,
): string[] | null {
  const lines: string[] = [];
  if (command === "changes list") {
    if (typeof data.totalStored === "number") {
      const records = Array.isArray(data.records) ? data.records : [];
      lines.push(
        `Change records: ${records.length} shown · ${data.totalStored} stored`,
      );
      for (const value of records) {
        const item = record(value);
        if (
          typeof item?.id === "string" &&
          typeof item.opportunityId === "string" &&
          typeof item.type === "string"
        ) {
          lines.push(
            `  ${item.id} [${item.type}] ${item.opportunityId}`,
          );
        }
      }
      return lines;
    }
    return null;
  }
  const change = record(data.record);
  if (change === null) {
    return null;
  }
  if (typeof change.id === "string") {
    lines.push(`Change: ${change.id}`);
  }
  if (typeof change.opportunityId === "string") {
    lines.push(`Opportunity: ${change.opportunityId}`);
  }
  if (typeof change.type === "string") {
    lines.push(`Type: ${change.type}`);
  }
  const urls = Array.isArray(change.urls) ? change.urls : [];
  if (urls.length > 0) {
    lines.push(`URLs: ${urls.length}`);
  }
  if (typeof data.dryRun === "boolean") {
    lines.push(data.dryRun ? "Dry run: no record written" : "Saved locally");
  }
  if (typeof data.storagePath === "string") {
    lines.push(`Storage: ${data.storagePath}`);
  }
  const verification = record(data.verification);
  if (typeof verification?.next === "string") {
    lines.push(`Next: ${verification.next}`);
  }
  return lines;
}

function compactAuditComparison(data: UnknownRecord): string[] {
  const lines: string[] = [];
  const older = record(data.older);
  const newer = record(data.newer);
  if (
    typeof older?.runId === "string" &&
    typeof newer?.runId === "string"
  ) {
    lines.push(`Runs: ${older.runId} → ${newer.runId}`);
  }
  const coverage = record(data.coverage);
  if (coverage !== null) {
    lines.push(
      `Coverage: ${coverage.comparable === true ? "comparable" : "not comparable"} · ${coverage.complete === true ? "complete" : "partial"}`,
    );
  }
  const pages = record(data.pages);
  if (pages !== null) {
    lines.push(
      `Pages: ${String(pages.compared ?? 0)} compared · ${Array.isArray(pages.changed) ? pages.changed.length : 0} changed`,
    );
  }
  const technical = record(data.technicalFindings);
  if (technical !== null) {
    lines.push(
      `Technical findings: ${Array.isArray(technical.persistent) ? technical.persistent.length : 0} persistent · ${Array.isArray(technical.resolved) ? technical.resolved.length : 0} resolved · ${Array.isArray(technical.unknown) ? technical.unknown.length : 0} unknown`,
    );
  }
  const google = record(data.googleOpportunities);
  if (google !== null) {
    lines.push(
      `Google opportunities: ${Array.isArray(google.persistent) ? google.persistent.length : 0} persistent · ${google.complete === true ? "complete" : "partial"} comparison`,
    );
  }
  return lines;
}

function compactDoctor(data: UnknownRecord): string[] | null {
  const doctor = record(data.doctor) ?? data;
  const checks = Array.isArray(doctor.checks) ? doctor.checks : null;
  if (checks === null) {
    return null;
  }
  const lines: string[] = [];
  if (typeof doctor.cwd === "string") {
    lines.push(`Project: ${doctor.cwd}`);
  }
  for (const value of checks) {
    const check = record(value);
    if (
      typeof check?.id === "string" &&
      typeof check.status === "string" &&
      typeof check.message === "string"
    ) {
      lines.push(`  [${check.status}] ${check.id}: ${check.message}`);
    }
  }
  const repairs = Array.isArray(data.repairs) ? data.repairs : [];
  for (const value of repairs) {
    const repair = record(value);
    if (
      typeof repair?.label === "string" &&
      typeof repair.status === "string"
    ) {
      lines.push(`Repair: ${repair.label} · ${repair.status}`);
      const operations = Array.isArray(repair.operations)
        ? repair.operations
        : [];
      for (const rawOperation of operations) {
        const operation = record(rawOperation);
        if (typeof operation?.display === "string") {
          lines.push(`  ${operation.display}`);
        }
      }
    }
  }
  return lines;
}

export function renderText(
  result: CommandResult<unknown>,
  verbose = false,
): string {
  const lines = [result.ok ? `✓ ${result.command}` : `✗ ${result.command}`];

  if (result.data !== undefined) {
    const data = record(result.data);
    const compact =
      verbose || data === null
        ? null
        : result.command === "opportunities sync"
          ? compactOpportunitySync(data)
          : result.command === "doctor" ||
              result.command === "doctor repair"
            ? compactDoctor(data)
          : result.command === "opportunities list"
            ? compactOpportunityList(data)
            : result.command === "changes record" ||
                result.command === "changes list" ||
                result.command === "changes show"
              ? compactChangeRecords(result.command, data)
            : result.command === "audit compare"
              ? compactAuditComparison(data)
              : compactCapability(data);
    if (compact !== null) {
      lines.push(...compact);
    } else
    if (
      typeof result.data === "object" &&
      result.data !== null &&
      !Array.isArray(result.data)
    ) {
      for (const [key, value] of Object.entries(result.data)) {
        lines.push(
          `${humanizeKey(key)}: ${
            typeof value === "string" ? value : JSON.stringify(value, null, 2)
          }`,
        );
      }
    } else {
      lines.push(
        typeof result.data === "string"
          ? result.data
          : JSON.stringify(result.data, null, 2),
      );
    }
  }

  const warnings = verbose ? result.warnings : result.warnings.slice(0, 5);
  for (const warning of warnings) {
    lines.push(`Warning: ${warning}`);
  }
  if (!verbose && result.warnings.length > warnings.length) {
    lines.push(
      `Warning: ${result.warnings.length - warnings.length} more warning(s); use --verbose or --format json`,
    );
  }
  for (const error of result.errors) {
    lines.push(`Error [${error.code}]: ${error.message}`);
  }

  return lines.join("\n");
}

function emit(
  result: CommandResult<unknown>,
  format: OutputFormat,
  verbose = false,
): void {
  const rendered =
    format === "json" ? JSON.stringify(result) : renderText(result, verbose);
  process.stdout.write(`${rendered}\n`);
}

async function analyzeCliLogFile(file: string) {
  try {
    return await analyzeLogFile(file);
  } catch (error) {
    const cause =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (["ENOENT", "EACCES", "EISDIR"].includes(cause)) {
      throw new AppError(
        "LOG_FILE_UNREADABLE",
        `Cannot read log file: ${file}`,
        2,
        { path: file, cause },
      );
    }
    throw error;
  }
}

async function runCommand(args: string[]): Promise<CommandResult<unknown>> {
  const [command, ...rest] = args;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    return success("help", HELP);
  }

  if (command === "version" || command === "--version" || command === "-v") {
    assertNoUnknownOptions(rest);
    return success("version", { version: VERSION });
  }

  if (command === "init") {
    const force = takeFlag(rest, "--force");
    const agent = extractOption(force.remaining, "--agent");
    const site = extractOption(agent.remaining, "--site");
    assertNoUnknownOptions(site.remaining);
    if (site.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${site.remaining[0]}`,
      );
    }

    const integration = agent.value ?? "both";
    if (!["codex", "claude-code", "both"].includes(integration)) {
      throw new AppError(
        "INVALID_AGENT",
        "--agent must be codex, claude-code, or both.",
      );
    }

    const data = await initializeProject({
      force: force.present,
      agentIntegration: integration as AgentIntegration,
      ...(site.value !== undefined ? { siteUrl: site.value } : {}),
    });
    return success("init", data);
  }

  if (command === "doctor") {
    const repair = extractOption(rest, "--repair");
    const dryRun = takeFlag(repair.remaining, "--dry-run");
    const yes = takeFlag(dryRun.remaining, "--yes");
    const expectedFingerprint = extractOption(
      yes.remaining,
      "--expect-fingerprint",
    );
    assertNoUnknownOptions(expectedFingerprint.remaining);
    if (expectedFingerprint.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${expectedFingerprint.remaining[0]}`,
      );
    }
    if (repair.value === undefined) {
      if (
        dryRun.present ||
        yes.present ||
        expectedFingerprint.value !== undefined
      ) {
        throw new AppError(
          "MISSING_REPAIR_TARGET",
          "--dry-run, --yes, and --expect-fingerprint require --repair codex|claude-code|both.",
        );
      }
      return success("doctor", await runDoctor());
    }
    if (!["codex", "claude-code", "both"].includes(repair.value)) {
      throw new AppError(
        "INVALID_AGENT",
        "--repair must be codex, claude-code, or both.",
      );
    }
    if (dryRun.present && yes.present) {
      throw new AppError(
        "CONFLICTING_REPAIR_MODE",
        "Choose --dry-run to review or --yes to apply, not both.",
      );
    }
    if (
      repair.value === "both" &&
      expectedFingerprint.value !== undefined
    ) {
      throw new AppError(
        "AMBIGUOUS_REPAIR_FINGERPRINT",
        "--expect-fingerprint can be used only when repairing one agent.",
      );
    }
    const targets: RegistrationAgent[] =
      repair.value === "both"
        ? ["codex", "claude-code"]
        : [repair.value as RegistrationAgent];
    const repairs = [];
    for (const id of targets) {
      repairs.push(
        await repairAgentRegistration({
          id,
          dryRun: dryRun.present,
          confirmed: yes.present,
          ...(expectedFingerprint.value !== undefined && targets.length === 1
            ? { expectedFingerprint: expectedFingerprint.value }
            : {}),
        }),
      );
    }
    return success("doctor repair", {
      dryRun: dryRun.present,
      repairs,
      doctor: await runDoctor(),
    });
  }

  if (command === "schema" && rest[0] === "evidence") {
    assertNoUnknownOptions(rest.slice(1));
    if (rest.length > 1) {
      throw new AppError("UNEXPECTED_ARGUMENT", `Unexpected argument: ${rest[1]}`);
    }
    return success("schema evidence", evidenceJsonSchema);
  }

  if (command === "logs" && rest[0] === "import") {
    const file = rest[1];
    if (!file) {
      throw new AppError(
        "MISSING_LOG_PATH",
        "Usage: aitraffic logs import <path>",
      );
    }
    assertNoUnknownOptions(rest.slice(2));
    if (rest.length > 2) {
      throw new AppError("UNEXPECTED_ARGUMENT", `Unexpected argument: ${rest[2]}`);
    }
    return success("logs import", await analyzeCliLogFile(file), [
      "Crawler identities are claimed from user-agent strings and are not network-verified.",
    ]);
  }

  if (command === "crawlers") {
    const file = rest[0];
    if (!file) {
      throw new AppError(
        "MISSING_LOG_PATH",
        "Usage: aitraffic crawlers <path>",
      );
    }
    assertNoUnknownOptions(rest.slice(1));
    if (rest.length > 1) {
      throw new AppError("UNEXPECTED_ARGUMENT", `Unexpected argument: ${rest[1]}`);
    }
    return success("crawlers", await analyzeCliLogFile(file), [
      "Crawler identities are claimed from user-agent strings and are not network-verified.",
    ]);
  }

  if (command === "classify") {
    const userAgent = rest.join(" ").trim();
    if (!userAgent) {
      throw new AppError(
        "MISSING_USER_AGENT",
        "Usage: aitraffic classify <user-agent>",
      );
    }
    return success("classify", classifyUserAgent(userAgent));
  }

  if (
    command === "auth" &&
    rest[0] === "google" &&
    rest[1] === "configure"
  ) {
    const envFile = extractOption(rest.slice(2), "--from-env-file");
    const clientJsonFile = extractOption(
      envFile.remaining,
      "--from-client-json",
    );
    assertNoUnknownOptions(clientJsonFile.remaining);
    if (clientJsonFile.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${clientJsonFile.remaining[0]}`,
      );
    }
    if (Boolean(envFile.value) === Boolean(clientJsonFile.value)) {
      throw new AppError(
        "INVALID_GOOGLE_CLIENT_SOURCE",
        "Provide exactly one of --from-client-json or --from-env-file. OAuth client secrets are never accepted as command-line values.",
      );
    }
    const vault = await createSystemGoogleVault();
    const source =
      envFile.value !== undefined
        ? { envFile: envFile.value }
        : { clientJsonFile: clientJsonFile.value ?? "" };
    return success(
      "auth google configure",
      await configureGoogleOAuthClient({
        ...source,
        vault,
      }),
      [
        "The OAuth client is stored in the operating-system credential store, not the project.",
      ],
    );
  }

  if (command === "auth" && rest[0] === "google" && rest[1] === "login") {
    const profile = extractOption(rest.slice(2), "--profile");
    assertNoUnknownOptions(profile.remaining);
    if (profile.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${profile.remaining[0]}`,
      );
    }
    if (!profile.value) {
      throw new AppError("MISSING_GOOGLE_PROFILE", "--profile is required.");
    }
    const vault = await createSystemGoogleVault();
    return success(
      "auth google login",
      await loginGoogleOAuthProfile(profile.value, vault, {
        onInstruction: (message) => console.error(message),
      }),
      [
        "Only read-only Analytics, Search Console, and identity scopes were requested.",
      ],
    );
  }

  if (command === "auth" && rest[0] === "google" && rest[1] === "status") {
    const profile = extractOption(rest.slice(2), "--profile");
    assertNoUnknownOptions(profile.remaining);
    if (profile.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${profile.remaining[0]}`,
      );
    }
    const vault = await createSystemGoogleVault();
    return success(
      "auth google status",
      await getGoogleOAuthStatus(vault, profile.value),
    );
  }

  if (command === "auth" && rest[0] === "google" && rest[1] === "revoke") {
    const dryRun = takeFlag(rest.slice(2), "--dry-run");
    const localOnly = takeFlag(dryRun.remaining, "--local-only");
    const profile = extractOption(localOnly.remaining, "--profile");
    assertNoUnknownOptions(profile.remaining);
    if (profile.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${profile.remaining[0]}`,
      );
    }
    if (!profile.value) {
      throw new AppError("MISSING_GOOGLE_PROFILE", "--profile is required.");
    }
    const vault = await createSystemGoogleVault();
    return success(
      "auth google revoke",
      await revokeGoogleOAuthProfile({
        profile: profile.value,
        vault,
        dryRun: dryRun.present,
        localOnly: localOnly.present,
      }),
      dryRun.present
        ? ["Dry run only; no Google token or local profile was changed."]
        : localOnly.present
          ? [
              "Local-only deletion does not revoke the Google grant. Use this only for an already-invalid credential or when Google is unreachable.",
            ]
          : [],
    );
  }

  if (command === "google" && rest[0] === "configure") {
    const dryRun = takeFlag(rest.slice(1), "--dry-run");
    const script = extractOption(dryRun.remaining, "--adapter-script");
    const profile = extractOption(script.remaining, "--profile");
    const property = extractOption(profile.remaining, "--ga4-property");
    const site = extractOption(property.remaining, "--gsc-site");
    assertNoUnknownOptions(site.remaining);
    if (site.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${site.remaining[0]}`,
      );
    }
    if (!script.value) {
      throw new AppError(
        "MISSING_ADAPTER_SCRIPT",
        "--adapter-script is required.",
      );
    }
    if (!profile.value) {
      throw new AppError("MISSING_GOOGLE_PROFILE", "--profile is required.");
    }
    return success(
      "google configure",
      await configureGoogleConnector({
        scriptPath: script.value,
        profile: profile.value,
        ...(property.value !== undefined
          ? { ga4Property: property.value }
          : {}),
        ...(site.value !== undefined ? { gscSite: site.value } : {}),
        dryRun: dryRun.present,
      }),
      dryRun.present
        ? ["Dry run only; no connector configuration was written."]
        : [
            "This file contains adapter selection only. OAuth credentials remain in the external profile store.",
          ],
    );
  }

  if (command === "google" && rest[0] === "select") {
    const dryRun = takeFlag(rest.slice(1), "--dry-run");
    const profile = extractOption(dryRun.remaining, "--profile");
    const property = extractOption(profile.remaining, "--ga4-property");
    const site = extractOption(property.remaining, "--gsc-site");
    assertNoUnknownOptions(site.remaining);
    if (site.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${site.remaining[0]}`,
      );
    }
    if (!profile.value) {
      throw new AppError("MISSING_GOOGLE_PROFILE", "--profile is required.");
    }
    return success(
      "google select",
      await selectLocalGoogleConnector({
        profile: profile.value,
        ...(property.value !== undefined
          ? { ga4Property: property.value }
          : {}),
        ...(site.value !== undefined ? { gscSite: site.value } : {}),
        dryRun: dryRun.present,
      }),
      dryRun.present
        ? ["Dry run only; no project selection was written."]
        : [
            "This project file contains profile and resource labels only; OAuth credentials remain in the operating-system credential store.",
          ],
    );
  }

  if (command === "google" && rest[0] === "status") {
    assertNoUnknownOptions(rest.slice(1));
    if (rest.length > 1) {
      throw new AppError("UNEXPECTED_ARGUMENT", `Unexpected argument: ${rest[1]}`);
    }
    const config = await readGoogleConnectorConfig();
    if (!config) {
      return success("google status", {
        configured: false,
        adapter: null,
        selected: null,
      });
    }
    const provider = await createGoogleDataProvider(config);
    const providerStatus = await provider.status();
    return success("google status", {
      configured: providerStatus.configured,
      adapter: config.adapter,
      profile: config.profile,
      selected: {
        ga4Property: config.ga4Property ?? null,
        gscSite: config.gscSite ?? null,
      },
      profileCount: providerStatus.profileCount,
    });
  }

  if (command === "google" && rest[0] === "inventory") {
    const profile = extractOption(rest.slice(1), "--profile");
    assertNoUnknownOptions(profile.remaining);
    if (profile.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${profile.remaining[0]}`,
      );
    }
    const { provider } = await googleProvider(profile.value);
    return success("google inventory", await provider.inventory(), [
      "Inventory is read-only. Select resources explicitly with google select or google configure.",
    ]);
  }

  if (command === "capabilities" && rest[0] === "list") {
    assertNoUnknownOptions(rest.slice(1));
    if (rest.length > 1) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${rest[1]}`,
      );
    }
    return success("capabilities list", listCapabilities());
  }

  if (command === "capabilities" && rest[0] === "describe") {
    const capabilityId = rest[1];
    if (!capabilityId) {
      throw new AppError(
        "MISSING_CAPABILITY",
        "Usage: aitraffic capabilities describe <id>",
      );
    }
    assertNoUnknownOptions(rest.slice(2));
    if (rest.length > 2) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${rest[2]}`,
      );
    }
    const definition = describeCapability(capabilityId);
    if (!definition) {
      throw new AppError(
        "UNKNOWN_CAPABILITY",
        `Unknown capability: ${capabilityId}`,
      );
    }
    return success("capabilities describe", definition);
  }

  if (command === "capabilities" && rest[0] === "run") {
    const capabilityId = rest[1];
    if (!capabilityId) {
      throw new AppError(
        "MISSING_CAPABILITY",
        "Usage: aitraffic capabilities run <id>",
      );
    }
    const capabilityArgs = rest.slice(2);
    let parameters: CapabilityRunParameters;
    let remaining: string[];
    if (capabilityId === "site.page_audit") {
      const url = extractOption(capabilityArgs, "--url");
      const options = parseSiteAuditOptions(url.remaining);
      parameters = {
        ...options.parameters,
        ...(url.value !== undefined ? { url: url.value } : {}),
      };
      remaining = options.remaining;
    } else if (capabilityId === "site.crawl") {
      const url = extractOption(capabilityArgs, "--url");
      const options = parseCrawlOptions(url.remaining);
      parameters = {
        ...options.parameters,
        ...(url.value !== undefined ? { url: url.value } : {}),
      };
      remaining = options.remaining;
    } else if (capabilityId === "site.full_audit") {
      const url = extractOption(capabilityArgs, "--url");
      const options = parseFullAuditOptions(url.remaining);
      parameters = {
        ...options.parameters,
        ...(url.value !== undefined ? { url: url.value } : {}),
      };
      remaining = options.remaining;
    } else if (capabilityId === "site.audit_opportunities") {
      const options = parseOpportunityAuditOptions(capabilityArgs);
      parameters = options.parameters;
      remaining = options.remaining;
    } else {
      const options = parseOpportunityOptions(capabilityArgs);
      parameters = options.parameters;
      remaining = options.remaining;
    }
    assertNoUnknownOptions(remaining);
    if (remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${remaining[0]}`,
      );
    }
    if (!describeCapability(capabilityId)) {
      throw new AppError(
        "UNKNOWN_CAPABILITY",
        `Unknown capability: ${capabilityId}`,
      );
    }
    const needsGoogle =
      capabilityId === "google.opportunities" ||
      capabilityId === "site.audit_opportunities";
    const google = needsGoogle ? await googleProvider() : undefined;
    const optionalGoogle =
      capabilityId === "site.full_audit" &&
      parameters.google !== "off"
        ? await resolveOptionalGoogleDataProvider()
        : undefined;
    return success(
      "capabilities run",
      await runCapability(capabilityId, parameters, {
        ...(google !== undefined ? { google } : {}),
        ...(optionalGoogle?.google !== undefined
          ? { google: optionalGoogle.google }
          : {}),
        ...(optionalGoogle?.unavailable !== undefined
          ? { googleUnavailable: optionalGoogle.unavailable }
          : {}),
      }),
    );
  }

  if (command === "crawl") {
    const url = rest[0];
    if (!url) {
      throw new AppError(
        "MISSING_CRAWL_URL",
        "Usage: aitraffic crawl <URL>",
      );
    }
    const options = parseCrawlOptions(rest.slice(1));
    assertNoUnknownOptions(options.remaining);
    if (options.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${options.remaining[0]}`,
      );
    }
    return success(
      "crawl",
      await runCapability(
        "site.crawl",
        { url, ...options.parameters },
        {},
      ),
    );
  }

  if (
    (command === "audit" && rest[0] === "page") ||
    (command === "page" && rest[0] === "audit")
  ) {
    const url = rest[1];
    if (!url) {
      throw new AppError(
        "MISSING_AUDIT_URL",
        "Usage: aitraffic audit page <URL>",
      );
    }
    const options = parseSiteAuditOptions(rest.slice(2));
    assertNoUnknownOptions(options.remaining);
    if (options.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${options.remaining[0]}`,
      );
    }
    return success(
      "audit page",
      await runCapability(
        "site.page_audit",
        { url, ...options.parameters },
        {},
      ),
    );
  }

  if (command === "audit" && rest[0] === "opportunities") {
    const options = parseOpportunityAuditOptions(rest.slice(1));
    assertNoUnknownOptions(options.remaining);
    if (options.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${options.remaining[0]}`,
      );
    }
    const google = await googleProvider();
    return success(
      "audit opportunities",
      await runCapability(
        "site.audit_opportunities",
        options.parameters,
        { google },
      ),
    );
  }

  if (command === "audit" && rest[0] === "history") {
    const limit = extractOption(rest.slice(1), "--limit");
    assertNoUnknownOptions(limit.remaining);
    if (limit.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${limit.remaining[0]}`,
      );
    }
    const history = await listAuditRuns({
      limit: positiveInteger(limit.value, 20, "--limit", 100),
    });
    return success(
      "audit history",
      { runs: history.runs },
      history.warnings,
    );
  }

  if (command === "audit" && rest[0] === "show") {
    const runId = rest[1];
    if (!runId) {
      throw new AppError(
        "MISSING_AUDIT_RUN_ID",
        "Usage: aitraffic audit show <RUN_ID>",
      );
    }
    if (rest.length > 2) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${rest[2]}`,
      );
    }
    const saved = await readAuditRun(runId);
    return success("audit show", {
      storage: saved.descriptor,
      audit: saved.stored.audit,
    });
  }

  if (command === "audit" && rest[0] === "compare") {
    const latest = takeFlag(rest.slice(1), "--latest");
    assertNoUnknownOptions(latest.remaining);
    let olderRunId: string;
    let newerRunId: string;
    if (latest.present) {
      if (latest.remaining.length > 0) {
        throw new AppError(
          "UNEXPECTED_ARGUMENT",
          `Unexpected argument: ${latest.remaining[0]}`,
        );
      }
      const history = await listAuditRuns({ limit: 2 });
      if (history.runs.length < 2) {
        throw new AppError(
          "AUDIT_COMPARISON_REQUIRES_TWO_RUNS",
          "Save at least two audits before using audit compare --latest.",
        );
      }
      olderRunId = history.runs[1]?.runId as string;
      newerRunId = history.runs[0]?.runId as string;
    } else {
      if (latest.remaining.length !== 2) {
        throw new AppError(
          "INVALID_AUDIT_COMPARISON",
          "Usage: aitraffic audit compare <OLDER_RUN_ID> <NEWER_RUN_ID>",
        );
      }
      olderRunId = latest.remaining[0] as string;
      newerRunId = latest.remaining[1] as string;
    }
    if (olderRunId === newerRunId) {
      throw new AppError(
        "SAME_AUDIT_RUN",
        "Audit comparison requires two different run IDs.",
      );
    }
    const [older, newer] = await Promise.all([
      readAuditRun(olderRunId),
      readAuditRun(newerRunId),
    ]);
    return success(
      "audit compare",
      compareAuditRuns(older.stored.audit, newer.stored.audit),
    );
  }

  if (command === "audit") {
    const url = rest[0];
    if (!url) {
      throw new AppError(
        "MISSING_FULL_AUDIT_URL",
        "Usage: aitraffic audit <URL>",
      );
    }
    const save = takeFlag(rest.slice(1), "--save");
    const options = parseFullAuditOptions(save.remaining);
    assertNoUnknownOptions(options.remaining);
    if (options.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${options.remaining[0]}`,
      );
    }
    const optionalGoogle =
      options.parameters.google === "off"
        ? undefined
        : await resolveOptionalGoogleDataProvider();
    const audit = await runCapability(
      "site.full_audit",
      { url, ...options.parameters },
      {
        ...(optionalGoogle?.google !== undefined
          ? { google: optionalGoogle.google }
          : {}),
        ...(optionalGoogle?.unavailable !== undefined
          ? { googleUnavailable: optionalGoogle.unavailable }
          : {}),
      },
    );
    if (!save.present) {
      return success("audit", audit);
    }
    const artifact = await saveAuditRun(audit);
    const savedAudit: FullAuditEnvelope = {
      ...audit,
      artifacts: [...audit.artifacts, artifact],
    };
    return success("audit", savedAudit);
  }

  if (command === "opportunities" && rest[0] === "sync") {
    const from = extractOption(rest.slice(1), "--from");
    const latest = takeFlag(from.remaining, "--latest");
    const dryRun = takeFlag(latest.remaining, "--dry-run");
    assertNoUnknownOptions(dryRun.remaining);
    if (dryRun.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${dryRun.remaining[0]}`,
      );
    }
    if ((from.value === undefined) === !latest.present) {
      throw new AppError(
        "INVALID_OPPORTUNITY_SYNC_SOURCE",
        "Use exactly one of --from RUN_ID or --latest.",
      );
    }
    let runId = from.value;
    if (latest.present) {
      const history = await listAuditRuns({ limit: 1 });
      runId = history.runs[0]?.runId;
      if (runId === undefined) {
        throw new AppError(
          "AUDIT_RUN_NOT_FOUND",
          "No saved audit is available. Run aitraffic audit <URL> --save first.",
        );
      }
    }
    const saved = await readAuditRun(runId as string);
    const sync = await syncOpportunityQueue(saved.stored.audit, {
      dryRun: dryRun.present,
    });
    return success(
      "opportunities sync",
      sync.result,
      sync.warnings,
    );
  }

  if (command === "opportunities" && rest[0] === "list") {
    const status = extractOption(rest.slice(1), "--status");
    const observation = extractOption(status.remaining, "--observation");
    const source = extractOption(observation.remaining, "--source");
    const priority = extractOption(source.remaining, "--priority");
    const site = extractOption(priority.remaining, "--site");
    const limit = extractOption(site.remaining, "--limit");
    assertNoUnknownOptions(limit.remaining);
    if (limit.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${limit.remaining[0]}`,
      );
    }
    if (site.value !== undefined) {
      try {
        new URL(site.value);
      } catch {
        throw new AppError(
          "INVALID_SITE_URL",
          `Invalid site URL: ${site.value}`,
        );
      }
    }
    return success(
      "opportunities list",
      await listQueuedOpportunities({
        status: enumOption(
          status.value,
          "active",
          "--status",
          [
            "active",
            "open",
            "planned",
            "dismissed",
            "verified",
            "all",
          ] as const,
        ),
        observation: enumOption(
          observation.value,
          "present",
          "--observation",
          ["present", "not_observed", "unknown", "all"] as const,
        ),
        ...(source.value === undefined
          ? {}
          : {
              source: enumOption(
                source.value,
                "technical",
                "--source",
                ["technical", "google-opportunity"] as const,
              ),
            }),
        ...(priority.value === undefined
          ? {}
          : {
              priority: enumOption(
                priority.value,
                "medium",
                "--priority",
                ["critical", "high", "medium", "low", "info"] as const,
              ),
            }),
        ...(site.value === undefined ? {} : { site: site.value }),
        limit: positiveInteger(limit.value, 20, "--limit", 100),
      }),
    );
  }

  if (command === "opportunities" && rest[0] === "explain") {
    const opportunityId = rest[1];
    if (!opportunityId) {
      throw new AppError(
        "MISSING_OPPORTUNITY_ID",
        "Usage: aitraffic opportunities explain <OPP_ID>",
      );
    }
    if (rest.length > 2) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${rest[2]}`,
      );
    }
    return success(
      "opportunities explain",
      await explainQueuedOpportunity(opportunityId),
    );
  }

  if (command === "opportunities" && rest[0] === "update") {
    const opportunityId = rest[1];
    if (!opportunityId) {
      throw new AppError(
        "MISSING_OPPORTUNITY_ID",
        "Usage: aitraffic opportunities update <OPP_ID> --status planned --reason TEXT --dry-run",
      );
    }
    const status = extractOption(rest.slice(2), "--status");
    const reason = extractOption(status.remaining, "--reason");
    const dryRun = takeFlag(reason.remaining, "--dry-run");
    assertNoUnknownOptions(dryRun.remaining);
    if (dryRun.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${dryRun.remaining[0]}`,
      );
    }
    if (status.value === undefined || reason.value === undefined) {
      throw new AppError(
        "MISSING_OPPORTUNITY_UPDATE",
        "Both --status and --reason are required.",
      );
    }
    return success(
      "opportunities update",
      await updateOpportunityStatus(
        opportunityId,
        enumOption(
          status.value,
          "open",
          "--status",
          ["open", "planned", "dismissed"] as const,
        ),
        reason.value,
        { dryRun: dryRun.present },
      ),
    );
  }

  if (command === "changes" && rest[0] === "record") {
    const opportunity = extractOption(rest.slice(1), "--opportunity");
    const urls = extractRepeatedOption(opportunity.remaining, "--url");
    const type = extractOption(urls.remaining, "--type");
    const gitCommit = extractOption(type.remaining, "--git-commit");
    const deployment = extractOption(gitCommit.remaining, "--deployment");
    const beforeHash = extractOption(deployment.remaining, "--before-hash");
    const afterHash = extractOption(beforeHash.remaining, "--after-hash");
    const note = extractOption(afterHash.remaining, "--note");
    const concurrentChanges = extractRepeatedOption(
      note.remaining,
      "--concurrent-change",
    );
    const dryRun = takeFlag(concurrentChanges.remaining, "--dry-run");
    assertNoUnknownOptions(dryRun.remaining);
    if (dryRun.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${dryRun.remaining[0]}`,
      );
    }
    if (opportunity.value === undefined || urls.values.length === 0 || type.value === undefined) {
      throw new AppError(
        "MISSING_CHANGE_RECORD_FIELDS",
        "--opportunity, at least one --url, and --type are required.",
      );
    }
    const linked = await explainQueuedOpportunity(opportunity.value);
    const created = await createChangeRecord(
      {
        opportunityId: linked.opportunity.id,
        opportunityTitle: linked.opportunity.title,
        site: linked.opportunity.site,
        urls: urls.values,
        type: enumOption(
          type.value,
          "other",
          "--type",
          CHANGE_TYPES,
        ) as ChangeType,
        ...(gitCommit.value === undefined
          ? {}
          : { gitCommit: gitCommit.value }),
        ...(deployment.value === undefined
          ? {}
          : { deploymentRef: deployment.value }),
        ...(beforeHash.value === undefined
          ? {}
          : { beforeContentHash: beforeHash.value }),
        ...(afterHash.value === undefined
          ? {}
          : { afterContentHash: afterHash.value }),
        ...(note.value === undefined ? {} : { note: note.value }),
        ...(concurrentChanges.values.length === 0
          ? {}
          : { concurrentChanges: concurrentChanges.values }),
      },
      { dryRun: dryRun.present },
    );
    return success("changes record", {
      ...created,
      verification: {
        opportunityId: linked.opportunity.id,
        next: `After a comparable later audit, run aitraffic opportunities sync --latest --format json then aitraffic opportunities explain ${linked.opportunity.id} --format json.`,
      },
    });
  }

  if (command === "changes" && rest[0] === "list") {
    const opportunity = extractOption(rest.slice(1), "--opportunity");
    const url = extractOption(opportunity.remaining, "--url");
    const limit = extractOption(url.remaining, "--limit");
    assertNoUnknownOptions(limit.remaining);
    if (limit.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${limit.remaining[0]}`,
      );
    }
    return success(
      "changes list",
      await listChangeRecords({
        ...(opportunity.value === undefined
          ? {}
          : { opportunityId: opportunity.value }),
        ...(url.value === undefined ? {} : { url: url.value }),
        limit: positiveInteger(limit.value, 20, "--limit", 100),
      }),
    );
  }

  if (command === "changes" && rest[0] === "show") {
    const changeId = rest[1];
    if (!changeId) {
      throw new AppError(
        "MISSING_CHANGE_RECORD_ID",
        "Usage: aitraffic changes show <CHANGE_ID>",
      );
    }
    if (rest.length > 2) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${rest[2]}`,
      );
    }
    const change = await showChangeRecord(changeId);
    let opportunity = null;
    try {
      opportunity = (await explainQueuedOpportunity(change.record.opportunityId))
        .opportunity;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "OPPORTUNITY_NOT_FOUND") {
        throw error;
      }
    }
    return success("changes show", {
      ...change,
      verification: opportunity === null
        ? {
            state: "unknown",
            message:
              "The linked opportunity is no longer in the local queue. The change record remains intact.",
          }
        : {
            state: opportunity.observationState,
            workflowStatus: opportunity.status,
            verification: opportunity.verification,
            latestRunId: opportunity.evidence.latestRunId,
            next: `Run a comparable later audit, synchronize the queue, then inspect this change record again.`,
          },
    });
  }

  if (command === "opportunities") {
    const options = parseOpportunityOptions(rest);
    assertNoUnknownOptions(options.remaining);
    if (options.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${options.remaining[0]}`,
      );
    }
    const { config, provider } = await googleProvider();
    return success(
      "opportunities",
      await runCapability("google.opportunities", options.parameters, {
        google: { config, provider },
      }),
    );
  }

  if (command === "ga4" && rest[0] === "report") {
    const start = extractOption(rest.slice(1), "--start");
    const end = extractOption(start.remaining, "--end");
    const dimensions = extractOption(end.remaining, "--dimensions");
    const metrics = extractOption(dimensions.remaining, "--metrics");
    const limit = extractOption(metrics.remaining, "--limit");
    const offset = extractOption(limit.remaining, "--offset");
    assertNoUnknownOptions(offset.remaining);
    if (offset.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${offset.remaining[0]}`,
      );
    }
    const { config, provider } = await googleProvider();
    if (!config.ga4Property) {
      throw new AppError(
        "GA4_PROPERTY_NOT_SELECTED",
        "No GA4 property is selected. Re-run google select or google configure with --ga4-property.",
      );
    }
    const request = {
      start: start.value ?? "28daysAgo",
      end: end.value ?? "yesterday",
      dimensions: commaSeparated(dimensions.value, ["date"]),
      metrics: commaSeparated(metrics.value, [
        "totalUsers",
        "sessions",
        "screenPageViews",
      ]),
      limit: positiveInteger(limit.value, 1_000, "--limit", 100_000),
      offset: nonNegativeInteger(
        offset.value,
        0,
        "--offset",
        10_000_000,
      ),
    };
    return success(
      "ga4 report",
      {
        evidenceClass: "observed",
        source: {
          connector: "google-analytics-data-api",
          method: "runReport",
          profile: config.profile,
          property: config.ga4Property,
          collectedAt: new Date().toISOString(),
        },
        request,
        response: await provider.ga4Report(config.ga4Property, request),
      },
      [
        "GA4 results may be affected by thresholding, retention, consent, and property configuration.",
      ],
    );
  }

  if (command === "gsc" && rest[0] === "report") {
    const start = extractOption(rest.slice(1), "--start");
    const end = extractOption(start.remaining, "--end");
    const dimensions = extractOption(end.remaining, "--dimensions");
    const limit = extractOption(dimensions.remaining, "--limit");
    const offset = extractOption(limit.remaining, "--offset");
    const type = extractOption(offset.remaining, "--type");
    const dataState = extractOption(type.remaining, "--data-state");
    const aggregation = extractOption(
      dataState.remaining,
      "--aggregation",
    );
    const filters = extractRepeatedOption(
      aggregation.remaining,
      "--filter",
    );
    assertNoUnknownOptions(filters.remaining);
    if (filters.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${filters.remaining[0]}`,
      );
    }
    const { config, provider } = await googleProvider();
    if (!config.gscSite) {
      throw new AppError(
        "GSC_SITE_NOT_SELECTED",
        "No Search Console site is selected. Re-run google select or google configure with --gsc-site.",
      );
    }
    const defaultPeriod = acquisitionPeriods(28).gsc.current;
    const request = {
      start: start.value ?? defaultPeriod.start,
      end: end.value ?? defaultPeriod.end,
      dimensions: commaSeparated(dimensions.value, ["query"]),
      limit: positiveInteger(limit.value, 1_000, "--limit", 25_000),
      offset: nonNegativeInteger(
        offset.value,
        0,
        "--offset",
        10_000_000,
      ),
      type: enumOption(
        type.value,
        "web",
        "--type",
        [
          "web",
          "image",
          "video",
          "news",
          "discover",
          "googleNews",
        ] as const,
      ) as GscSearchType,
      dataState: enumOption(
        dataState.value,
        "final",
        "--data-state",
        ["final", "all", "hourly_all"] as const,
      ) as GscDataState,
      aggregationType: enumOption(
        aggregation.value,
        "auto",
        "--aggregation",
        [
          "auto",
          "byPage",
          "byProperty",
          "byNewsShowcasePanel",
        ] as const,
      ) as GscAggregationType,
      ...(filters.values.length > 0
        ? {
            dimensionFilterGroups: [
              {
                groupType: "and" as const,
                filters: filters.values.map(parseGscFilter),
              },
            ],
          }
        : {}),
    };
    return success(
      "gsc report",
      {
        evidenceClass: "observed",
        source: {
          connector: "google-search-console-api",
          method: "searchAnalytics.query",
          profile: config.profile,
          site: config.gscSite,
          collectedAt: new Date().toISOString(),
        },
        request,
        response: await provider.gscReport(config.gscSite, request),
      },
      [
        "Search Console may omit anonymized or low-volume queries and uses source-specific reporting dates.",
      ],
    );
  }

  if (command === "report" && rest[0] === "acquisition") {
    const days = extractOption(rest.slice(1), "--days");
    assertNoUnknownOptions(days.remaining);
    if (days.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${days.remaining[0]}`,
      );
    }
    const { config, provider } = await googleProvider();
    if (!config.ga4Property || !config.gscSite) {
      throw new AppError(
        "GOOGLE_RESOURCES_NOT_SELECTED",
        "Acquisition report requires both --ga4-property and --gsc-site in the project Google selection.",
      );
    }
    return success(
      "report acquisition",
      await buildAcquisitionReport(provider, config, {
        days: positiveInteger(days.value, 28, "--days", 366),
      }),
    );
  }

  throw new AppError("UNKNOWN_COMMAND", `Unknown command: ${command}`);
}

async function main(): Promise<void> {
  let command = process.argv.slice(2).join(" ") || "help";
  let format: OutputFormat = "text";
  let verbose = false;

  try {
    const parsed = parseGlobalArguments(process.argv.slice(2));
    format = parsed.format;
    verbose = parsed.verbose;
    command = parsed.positional.slice(0, 2).join(" ") || "help";

    if (parsed.positional[0] === "mcp" && parsed.positional[1] === "serve") {
      if (parsed.positional.length > 2) {
        throw new AppError(
          "UNEXPECTED_ARGUMENT",
          `Unexpected argument: ${parsed.positional[2]}`,
        );
      }
      await serveMcp();
      return;
    }

    if (
      parsed.positional[0] === "onboard" ||
      parsed.positional[0] === "setup"
    ) {
      const rest = parsed.positional.slice(1);
      const dryRun = takeFlag(rest, "--dry-run");
      const check = takeFlag(dryRun.remaining, "--check");
      const nonInteractive = takeFlag(
        check.remaining,
        "--non-interactive",
      );
      const help =
        nonInteractive.remaining.includes("--help") ||
        nonInteractive.remaining.includes("-h");
      const remaining = nonInteractive.remaining.filter(
        (value) => value !== "--help" && value !== "-h",
      );
      assertNoUnknownOptions(remaining);
      if (remaining.length > 0) {
        throw new AppError(
          "UNEXPECTED_ARGUMENT",
          `Unexpected argument: ${remaining[0]}`,
        );
      }
      if (help) {
        emit(success("onboard help", ONBOARD_HELP), format, verbose);
        return;
      }
      if (check.present || nonInteractive.present) {
        emit(
          success("onboard check", await inspectOnboarding()),
          format,
          verbose,
        );
        return;
      }
      if (format === "json") {
        throw new AppError(
          "ONBOARDING_INTERACTIVE_JSON_UNSUPPORTED",
          "Interactive onboarding cannot keep stdout as one JSON document. Use --check --format json, or run onboard in text mode.",
        );
      }
      await runOnboardingWizard({ dryRun: dryRun.present });
      return;
    }

    const result = await runCommand(parsed.positional);
    emit(result, format, verbose);
  } catch (error) {
    if (error instanceof AppError) {
      const details =
        error.details === undefined ? {} : { details: error.details };
      emit(
        failure(command, {
          code: error.code,
          message: error.message,
          ...details,
        }),
        format,
        verbose,
      );
      process.exitCode = error.exitCode;
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    emit(
      failure(command, {
        code: "UNEXPECTED_ERROR",
        message,
      }),
      format,
      verbose,
    );
    process.exitCode = 1;
  }
}

await main();
