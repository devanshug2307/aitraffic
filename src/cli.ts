#!/usr/bin/env node

import { runDoctor } from "./commands/doctor.js";
import {
  acquisitionPeriods,
  buildAcquisitionReport,
} from "./analysis/acquisition.js";
import { runCapability } from "./capabilities/run.js";
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
import { createGoogleDataProvider } from "./connectors/google/provider.js";
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

type OutputFormat = "text" | "json";

interface ParsedArguments {
  positional: string[];
  format: OutputFormat;
}

const HELP = `AItraffic — terminal-first AI visibility evidence

Usage:
  aitraffic onboard [--dry-run]
  aitraffic onboard --check [--format json]
  aitraffic setup [--dry-run]
  aitraffic init [--agent codex|claude-code|both] [--site URL] [--force]
  aitraffic doctor
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
  aitraffic capabilities list
  aitraffic capabilities describe <id>
  aitraffic capabilities run <id> [--days N] [--max-rows N] [--min-impressions N]
  aitraffic mcp serve
  aitraffic version

Global options:
  --format text|json   Output mode; text is the default
  --json               Alias for --format json
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

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
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

  return { positional, format };
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

function renderText(result: CommandResult<unknown>): string {
  const lines = [result.ok ? `✓ ${result.command}` : `✗ ${result.command}`];

  if (result.data !== undefined) {
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

  for (const warning of result.warnings) {
    lines.push(`Warning: ${warning}`);
  }
  for (const error of result.errors) {
    lines.push(`Error [${error.code}]: ${error.message}`);
  }

  return lines.join("\n");
}

function emit(result: CommandResult<unknown>, format: OutputFormat): void {
  const rendered =
    format === "json" ? JSON.stringify(result) : renderText(result);
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
    assertNoUnknownOptions(rest);
    if (rest.length > 0) {
      throw new AppError("UNEXPECTED_ARGUMENT", `Unexpected argument: ${rest[0]}`);
    }
    return success("doctor", await runDoctor());
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
    const options = parseOpportunityOptions(rest.slice(2));
    assertNoUnknownOptions(options.remaining);
    if (options.remaining.length > 0) {
      throw new AppError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument: ${options.remaining[0]}`,
      );
    }
    if (!describeCapability(capabilityId)) {
      throw new AppError(
        "UNKNOWN_CAPABILITY",
        `Unknown capability: ${capabilityId}`,
      );
    }
    const { config, provider } = await googleProvider();
    return success(
      "capabilities run",
      await runCapability(capabilityId, options.parameters, {
        config,
        provider,
      }),
    );
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
        config,
        provider,
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

  try {
    const parsed = parseGlobalArguments(process.argv.slice(2));
    format = parsed.format;
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
        emit(success("onboard help", ONBOARD_HELP), format);
        return;
      }
      if (check.present || nonInteractive.present) {
        emit(
          success("onboard check", await inspectOnboarding()),
          format,
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
    emit(result, format);
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
    );
    process.exitCode = 1;
  }
}

await main();
