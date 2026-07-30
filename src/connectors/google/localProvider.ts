import { AppError } from "../../core/result.js";
import {
  googleOAuthClientKey,
  hasSafeGoogleScopes,
  refreshGoogleOAuthProfile,
  resolveGoogleOAuthClient,
} from "./oauth.js";
import type {
  Ga4Property,
  Ga4ReportRequest,
  Ga4ReportResponse,
  GoogleConnectorStatus,
  GoogleDataProvider,
  GoogleInventory,
  GscReportRequest,
  GscReportResponse,
  LocalGoogleConnectorConfig,
  SearchConsoleSite,
} from "./types.js";
import type {
  GoogleCredentialVault,
  GoogleOAuthProfile,
} from "./vault.js";

const ANALYTICS_ADMIN_URL =
  "https://analyticsadmin.googleapis.com/v1beta/accountSummaries";
const ANALYTICS_DATA_URL = "https://analyticsdata.googleapis.com/v1beta";
const SEARCH_CONSOLE_URL =
  "https://www.googleapis.com/webmasters/v3";
const EXPIRY_BUFFER_MS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  return typeof record[key] === "string" ? record[key] : undefined;
}

export class LocalGoogleDataProvider implements GoogleDataProvider {
  readonly config: LocalGoogleConnectorConfig;
  private readonly vault: GoogleCredentialVault;
  private readonly fetchImplementation: typeof fetch;
  private refreshPromise: Promise<GoogleOAuthProfile> | null = null;

  constructor(
    config: LocalGoogleConnectorConfig,
    vault: GoogleCredentialVault,
    fetchImplementation: typeof fetch = fetch,
  ) {
    this.config = config;
    this.vault = vault;
    this.fetchImplementation = fetchImplementation;
  }

  private async profile(forceRefresh = false): Promise<GoogleOAuthProfile> {
    const profile = await this.vault.getProfile(this.config.profile);
    if (!profile) {
      throw new AppError(
        "GOOGLE_PROFILE_NOT_CONNECTED",
        `Google profile is not connected: ${this.config.profile}. Run aitraffic auth google login --profile ${this.config.profile}.`,
        1,
      );
    }
    const client = await resolveGoogleOAuthClient(this.vault);
    if (
      !client ||
      profile.clientKey !== googleOAuthClientKey(client.clientId)
    ) {
      throw new AppError(
        "GOOGLE_PROFILE_CLIENT_MISMATCH",
        `Google profile ${this.config.profile} belongs to a different OAuth client. Run auth google login again.`,
        1,
      );
    }
    if (!hasSafeGoogleScopes(profile.scopes)) {
      throw new AppError(
        "GOOGLE_REQUIRED_SCOPE_MISSING",
        `Google profile ${this.config.profile} is missing a required read-only scope. Run auth google login again.`,
        1,
      );
    }
    if (
      !forceRefresh &&
      profile.expiresAt > Date.now() + EXPIRY_BUFFER_MS
    ) {
      return profile;
    }
    if (!this.refreshPromise) {
      this.refreshPromise = refreshGoogleOAuthProfile({
        profile,
        vault: this.vault,
        fetch: this.fetchImplementation,
      }).finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async authenticatedJson(
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<unknown> {
    const request = async (profile: GoogleOAuthProfile) => {
      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${profile.accessToken}`);
      headers.set("accept", "application/json");
      try {
        return await this.fetchImplementation(url, { ...init, headers });
      } catch {
        throw new AppError(
          "GOOGLE_API_UNAVAILABLE",
          `Google ${label} request could not be completed.`,
          1,
        );
      }
    };

    let response = await request(await this.profile());
    if (response.status === 401) {
      response = await request(await this.profile(true));
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    if (!response.ok || !isRecord(parsed)) {
      throw new AppError(
        "GOOGLE_API_FAILED",
        `Google ${label} request failed.`,
        1,
        { status: response.status },
      );
    }
    return parsed;
  }

  async status(): Promise<GoogleConnectorStatus> {
    const [client, profiles, profile] = await Promise.all([
      resolveGoogleOAuthClient(this.vault),
      this.vault.listProfiles(),
      this.vault.getProfile(this.config.profile),
    ]);
    return {
      configured:
        client !== null &&
        profile !== null &&
        profile.clientKey === googleOAuthClientKey(client.clientId) &&
        hasSafeGoogleScopes(profile.scopes),
      profileCount: profiles.length,
    };
  }

  async inventory(): Promise<GoogleInventory> {
    const ga4Properties: Ga4Property[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(ANALYTICS_ADMIN_URL);
      url.searchParams.set("pageSize", "200");
      if (pageToken !== undefined) {
        url.searchParams.set("pageToken", pageToken);
      }
      const response = await this.authenticatedJson(
        url.toString(),
        { method: "GET" },
        "Analytics Admin",
      );
      if (!isRecord(response)) {
        break;
      }
      const accounts = Array.isArray(response.accountSummaries)
        ? response.accountSummaries
        : [];
      for (const account of accounts) {
        if (!isRecord(account)) {
          continue;
        }
        const properties = Array.isArray(account.propertySummaries)
          ? account.propertySummaries
          : [];
        for (const item of properties) {
          if (!isRecord(item) || typeof item.property !== "string") {
            continue;
          }
          const property: Ga4Property = { property: item.property };
          const displayName = optionalString(item, "displayName");
          const accountName = optionalString(account, "account");
          const accountDisplayName = optionalString(account, "displayName");
          if (displayName !== undefined) {
            property.displayName = displayName;
          }
          if (accountName !== undefined) {
            property.account = accountName;
          }
          if (accountDisplayName !== undefined) {
            property.accountDisplayName = accountDisplayName;
          }
          ga4Properties.push(property);
        }
      }
      pageToken = optionalString(response, "nextPageToken");
    } while (pageToken !== undefined && pageToken !== "");

    const sitesResponse = await this.authenticatedJson(
      `${SEARCH_CONSOLE_URL}/sites`,
      { method: "GET" },
      "Search Console sites",
    );
    const searchConsoleSites: SearchConsoleSite[] = [];
    if (isRecord(sitesResponse) && Array.isArray(sitesResponse.siteEntry)) {
      for (const item of sitesResponse.siteEntry) {
        if (!isRecord(item) || typeof item.siteUrl !== "string") {
          continue;
        }
        const site: SearchConsoleSite = { siteUrl: item.siteUrl };
        const permissionLevel = optionalString(item, "permissionLevel");
        if (permissionLevel !== undefined) {
          site.permissionLevel = permissionLevel;
        }
        searchConsoleSites.push(site);
      }
    }

    return {
      profile: this.config.profile,
      ga4Properties,
      searchConsoleSites,
    };
  }

  async ga4Report(
    property: string,
    request: Ga4ReportRequest,
  ): Promise<Ga4ReportResponse> {
    const response = await this.authenticatedJson(
      `${ANALYTICS_DATA_URL}/properties/${encodeURIComponent(property)}:runReport`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: request.start, endDate: request.end }],
          dimensions: request.dimensions.map((name) => ({ name })),
          metrics: request.metrics.map((name) => ({ name })),
          limit: String(request.limit ?? 10_000),
          offset: String(request.offset ?? 0),
          ...(request.dimensionFilter !== undefined
            ? { dimensionFilter: request.dimensionFilter }
            : {}),
          returnPropertyQuota: true,
        }),
      },
      "Analytics Data API",
    );
    return response as Ga4ReportResponse;
  }

  async gscReport(
    site: string,
    request: GscReportRequest,
  ): Promise<GscReportResponse> {
    const response = await this.authenticatedJson(
      `${SEARCH_CONSOLE_URL}/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startDate: request.start,
          endDate: request.end,
          dimensions: request.dimensions,
          rowLimit: request.limit ?? 1_000,
          startRow: request.offset ?? 0,
          type: request.type ?? "web",
          dataState: request.dataState ?? "final",
          ...(request.aggregationType !== undefined
            ? { aggregationType: request.aggregationType }
            : {}),
          ...(request.dimensionFilterGroups !== undefined
            ? {
                dimensionFilterGroups:
                  request.dimensionFilterGroups,
              }
            : {}),
        }),
      },
      "Search Console Search Analytics",
    );
    return response as GscReportResponse;
  }
}
