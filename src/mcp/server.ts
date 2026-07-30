import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import { buildAcquisitionReport } from "../analysis/acquisition.js";
import { runCapability } from "../capabilities/run.js";
import { runDoctor } from "../commands/doctor.js";
import { readGoogleConnectorConfig } from "../connectors/google/config.js";
import { createGoogleDataProvider } from "../connectors/google/provider.js";
import { classifyUserAgent } from "../core/agentRegistry.js";
import {
  describeCapability,
  listCapabilities,
} from "../core/capabilities.js";
import { evidenceJsonSchema } from "../core/evidence.js";
import { analyzeLogFile } from "../core/logs.js";
import { resolveReadableProjectFile } from "../core/project.js";
import { VERSION } from "../core/version.js";

function textResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

async function selectedGoogleProvider(projectRoot: string) {
  const config = await readGoogleConnectorConfig(projectRoot);
  if (!config) {
    throw new Error(
      "Google connector is not configured. Run aitraffic google select or aitraffic google configure.",
    );
  }
  return {
    config,
    provider: await createGoogleDataProvider(config),
  };
}

export async function serveMcp(): Promise<void> {
  const projectRoot = process.cwd();
  const server = new McpServer({
    name: "aitraffic",
    version: VERSION,
  });

  server.registerTool(
    "get_project_status",
    {
      description:
        "Inspect the local AItraffic project and agent integration readiness. Read-only.",
      inputSchema: z.object({}),
    },
    async () => textResult(await runDoctor(projectRoot)),
  );

  server.registerTool(
    "get_evidence_schema",
    {
      description:
        "Return the versioned provenance-first JSON Schema used for AItraffic evidence.",
      inputSchema: z.object({}),
    },
    async () => textResult(evidenceJsonSchema),
  );

  server.registerTool(
    "aitraffic_list_capabilities",
    {
      description:
        "List AItraffic capabilities and their read/write behavior. Use this before selecting a workflow.",
      inputSchema: z.object({}),
    },
    async () => textResult(listCapabilities()),
  );

  server.registerTool(
    "aitraffic_describe_capability",
    {
      description:
        "Describe one capability's purpose, input schema, output contract, and limitations.",
      inputSchema: z.object({
        id: z.string().describe("Capability ID returned by the list tool."),
      }),
    },
    async ({ id }) => {
      const definition = describeCapability(id);
      if (!definition) {
        throw new Error(`Unknown capability: ${id}`);
      }
      return textResult(definition);
    },
  );

  server.registerTool(
    "aitraffic_run",
    {
      description:
        "Run a registered read-only capability and return the shared evidence envelope.",
      inputSchema: z.object({
        id: z.string().describe("Capability ID returned by the list tool."),
        url: z.string().url().optional(),
        days: z.number().int().min(1).max(366).optional(),
        maxRows: z.number().int().min(1).max(100_000).optional(),
        minImpressions: z
          .number()
          .int()
          .min(1)
          .max(1_000_000)
          .optional(),
        limit: z.number().int().min(1).max(20).optional(),
        timeoutMs: z.number().int().min(1).max(30_000).optional(),
        maxBytes: z
          .number()
          .int()
          .min(1)
          .max(10 * 1024 * 1024)
          .optional(),
        maxRedirects: z.number().int().min(0).max(10).optional(),
      }),
    },
    async ({
      id,
      url,
      days,
      maxRows,
      minImpressions,
      limit,
      timeoutMs,
      maxBytes,
      maxRedirects,
    }) => {
      if (!describeCapability(id)) {
        throw new Error(`Unknown capability: ${id}`);
      }
      const google =
        id === "site.page_audit"
          ? undefined
          : await selectedGoogleProvider(projectRoot);
      return textResult(
        await runCapability(
          id,
          {
            ...(url !== undefined ? { url } : {}),
            ...(days !== undefined ? { days } : {}),
            ...(maxRows !== undefined ? { maxRows } : {}),
            ...(minImpressions !== undefined ? { minImpressions } : {}),
            ...(limit !== undefined ? { limit } : {}),
            ...(timeoutMs !== undefined ? { timeoutMs } : {}),
            ...(maxBytes !== undefined ? { maxBytes } : {}),
            ...(maxRedirects !== undefined ? { maxRedirects } : {}),
          },
          { ...(google !== undefined ? { google } : {}) },
        ),
      );
    },
  );

  server.registerTool(
    "classify_user_agent",
    {
      description:
        "Classify a claimed crawler or agent user-agent string. This does not verify network identity.",
      inputSchema: z.object({
        userAgent: z.string().describe("The complete HTTP user-agent string."),
      }),
    },
    async ({ userAgent }) => textResult(classifyUserAgent(userAgent)),
  );

  server.registerTool(
    "analyze_log_file",
    {
      description:
        "Analyze a project-local JSON, NDJSON, Apache, or Nginx access log without retaining IP addresses.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("Path relative to the current project root."),
      }),
    },
    async ({ path: logPath }) => {
      const safePath = await resolveReadableProjectFile(logPath, projectRoot);
      return textResult(await analyzeLogFile(safePath));
    },
  );

  server.registerTool(
    "google_connection_status",
    {
      description:
        "Inspect the project-selected read-only Google adapter and resource selection without exposing credentials.",
      inputSchema: z.object({}),
    },
    async () => {
      const config = await readGoogleConnectorConfig(projectRoot);
      if (!config) {
        return textResult({
          configured: false,
          adapter: null,
          selected: null,
        });
      }
      const status = await (await createGoogleDataProvider(config)).status();
      return textResult({
        configured: status.configured,
        adapter: config.adapter,
        profile: config.profile,
        selected: {
          ga4Property: config.ga4Property ?? null,
          gscSite: config.gscSite ?? null,
        },
        profileCount: status.profileCount,
      });
    },
  );

  server.registerTool(
    "list_google_resources",
    {
      description:
        "List GA4 properties and Search Console sites visible to the configured local profile. Read-only.",
      inputSchema: z.object({}),
    },
    async () => {
      const { provider } = await selectedGoogleProvider(projectRoot);
      return textResult(await provider.inventory());
    },
  );

  server.registerTool(
    "run_ga4_report",
    {
      description:
        "Run a read-only GA4 report against the property explicitly selected for this project.",
      inputSchema: z.object({
        start: z.string().default("28daysAgo"),
        end: z.string().default("yesterday"),
        dimensions: z.array(z.string()).default(["date"]),
        metrics: z
          .array(z.string())
          .default(["totalUsers", "sessions", "screenPageViews"]),
        limit: z.number().int().min(1).max(100_000).default(1_000),
        offset: z.number().int().min(0).max(10_000_000).default(0),
      }),
    },
    async ({ start, end, dimensions, metrics, limit, offset }) => {
      const { config, provider } = await selectedGoogleProvider(projectRoot);
      if (!config.ga4Property) {
        throw new Error("No GA4 property is selected for this project.");
      }
      const request = { start, end, dimensions, metrics, limit, offset };
      return textResult({
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
        limitations: [
          "GA4 results may be affected by thresholding, retention, consent, and property configuration.",
        ],
      });
    },
  );

  server.registerTool(
    "run_gsc_report",
    {
      description:
        "Run a read-only Search Console report against the site explicitly selected for this project.",
      inputSchema: z.object({
        start: z.string(),
        end: z.string(),
        dimensions: z.array(z.string()).default(["query"]),
        limit: z.number().int().min(1).max(25_000).default(1_000),
        offset: z.number().int().min(0).max(10_000_000).default(0),
        type: z
          .enum([
            "web",
            "image",
            "video",
            "news",
            "discover",
            "googleNews",
          ])
          .default("web"),
        dataState: z
          .enum(["final", "all", "hourly_all"])
          .default("final"),
        aggregationType: z
          .enum(["auto", "byPage", "byProperty", "byNewsShowcasePanel"])
          .default("auto"),
        filters: z
          .array(
            z.object({
              dimension: z.enum([
                "query",
                "page",
                "country",
                "device",
                "searchAppearance",
              ]),
              operator: z.enum([
                "contains",
                "equals",
                "notContains",
                "notEquals",
                "includingRegex",
                "excludingRegex",
              ]),
              expression: z.string().min(1),
            }),
          )
          .default([]),
      }),
    },
    async ({
      start,
      end,
      dimensions,
      limit,
      offset,
      type,
      dataState,
      aggregationType,
      filters,
    }) => {
      const { config, provider } = await selectedGoogleProvider(projectRoot);
      if (!config.gscSite) {
        throw new Error(
          "No Search Console site is selected for this project.",
        );
      }
      const request = {
        start,
        end,
        dimensions,
        limit,
        offset,
        type,
        dataState,
        aggregationType,
        ...(filters.length > 0
          ? {
              dimensionFilterGroups: [
                { groupType: "and" as const, filters },
              ],
            }
          : {}),
      };
      return textResult({
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
        limitations: [
          "Search Console may omit anonymized or low-volume queries and uses source-specific reporting dates.",
        ],
      });
    },
  );

  server.registerTool(
    "analyze_ai_acquisition",
    {
      description:
        "Compare equal GA4 and Search Console periods, isolate observable AI-assistant referrals, and return deterministic search opportunities.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(366).default(28),
      }),
    },
    async ({ days }) => {
      const { config, provider } = await selectedGoogleProvider(projectRoot);
      return textResult(
        await buildAcquisitionReport(provider, config, { days }),
      );
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("aitraffic MCP server running on stdio");

  process.once("SIGINT", () => {
    void server.close().finally(() => process.exit(0));
  });
}
