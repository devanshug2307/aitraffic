import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { AppError } from "../../core/result.js";
import type {
  Ga4Property,
  Ga4ReportRequest,
  Ga4ReportResponse,
  GoogleConnectorStatus,
  GoogleDataProvider,
  GoogleInventory,
  GscReportRequest,
  GscReportResponse,
  ExternalGoogleConnectorConfig,
  SearchConsoleSite,
} from "./types.js";

const execFileAsync = promisify(execFile);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function requireRecord(value: unknown, command: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new AppError(
      "GOOGLE_ADAPTER_INVALID_RESPONSE",
      `Google adapter returned an invalid ${command} response.`,
      1,
    );
  }
  return value;
}

function normalizeGa4Properties(value: unknown): Ga4Property[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.property !== "string") {
      return [];
    }
    const property: Ga4Property = { property: item.property };
    if (typeof item.displayName === "string") {
      property.displayName = item.displayName;
    }
    if (typeof item.account === "string") {
      property.account = item.account;
    }
    if (typeof item.accountDisplayName === "string") {
      property.accountDisplayName = item.accountDisplayName;
    }
    return [property];
  });
}

function normalizeSearchConsoleSites(value: unknown): SearchConsoleSite[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.siteUrl !== "string") {
      return [];
    }
    const site: SearchConsoleSite = { siteUrl: item.siteUrl };
    if (typeof item.permissionLevel === "string") {
      site.permissionLevel = item.permissionLevel;
    }
    return [site];
  });
}

export class ExternalGoogleDataProvider implements GoogleDataProvider {
  readonly config: ExternalGoogleConnectorConfig;

  constructor(config: ExternalGoogleConnectorConfig) {
    this.config = config;
  }

  private async run(command: string, options: string[] = []): Promise<unknown> {
    let stdout: string;
    try {
      const result = await execFileAsync(
        process.execPath,
        [this.config.scriptPath, command, ...options],
        {
          encoding: "utf8",
          maxBuffer: 20 * 1024 * 1024,
          timeout: 90_000,
          windowsHide: true,
        },
      );
      stdout = result.stdout;
    } catch (error) {
      const exitCode =
        isRecord(error) && typeof error.code === "number"
          ? error.code
          : undefined;
      throw new AppError(
        "GOOGLE_ADAPTER_FAILED",
        `External Google adapter failed while running ${command}.`,
        1,
        exitCode === undefined ? undefined : { exitCode },
      );
    }

    try {
      return JSON.parse(stdout);
    } catch {
      throw new AppError(
        "GOOGLE_ADAPTER_INVALID_JSON",
        `External Google adapter returned non-JSON output for ${command}.`,
        1,
      );
    }
  }

  async status(): Promise<GoogleConnectorStatus> {
    const result = requireRecord(await this.run("status"), "status");
    return {
      configured: result.configured === true,
      profileCount:
        typeof result.profileCount === "number" ? result.profileCount : 0,
    };
  }

  async inventory(): Promise<GoogleInventory> {
    const result = requireRecord(
      await this.run("inventory", ["--profile", this.config.profile]),
      "inventory",
    );
    return {
      profile: this.config.profile,
      ga4Properties: normalizeGa4Properties(result.ga4Properties),
      searchConsoleSites: normalizeSearchConsoleSites(
        result.searchConsoleSites,
      ),
    };
  }

  async ga4Report(
    property: string,
    request: Ga4ReportRequest,
  ): Promise<Ga4ReportResponse> {
    const options = [
      "--profile",
      this.config.profile,
      "--property",
      property,
      "--start",
      request.start,
      "--end",
      request.end,
      "--dimensions",
      request.dimensions.length > 0 ? request.dimensions.join(",") : "none",
      "--metrics",
      request.metrics.join(","),
      "--limit",
      String(request.limit ?? 10_000),
    ];
    return requireRecord(
      await this.run("ga4", options),
      "GA4 report",
    ) as Ga4ReportResponse;
  }

  async gscReport(
    site: string,
    request: GscReportRequest,
  ): Promise<GscReportResponse> {
    const options = [
      "--profile",
      this.config.profile,
      "--site",
      site,
      "--start",
      request.start,
      "--end",
      request.end,
      "--dimensions",
      request.dimensions.join(","),
      "--limit",
      String(request.limit ?? 1_000),
      "--offset",
      String(request.offset ?? 0),
      "--type",
      request.type ?? "web",
      "--data-state",
      request.dataState ?? "final",
    ];
    const result = requireRecord(
      await this.run("gsc", options),
      "Search Console report",
    );
    const rows = Array.isArray(result.rows)
      ? result.rows.flatMap((row) => {
          if (!isRecord(row)) {
            return [];
          }
          return [
            {
              keys: strings(row.keys),
              clicks: typeof row.clicks === "number" ? row.clicks : 0,
              impressions:
                typeof row.impressions === "number" ? row.impressions : 0,
              ctr: typeof row.ctr === "number" ? row.ctr : 0,
              position: typeof row.position === "number" ? row.position : 0,
            },
          ];
        })
      : [];
    return {
      rows,
      ...(typeof result.responseAggregationType === "string"
        ? { responseAggregationType: result.responseAggregationType }
        : {}),
    };
  }
}
