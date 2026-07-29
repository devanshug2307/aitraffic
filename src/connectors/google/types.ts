export interface GoogleConnectorSelection {
  schemaVersion: "0.1.0";
  profile: string;
  ga4Property?: string;
  gscSite?: string;
}

export interface ExternalGoogleConnectorConfig
  extends GoogleConnectorSelection {
  adapter: "external-command";
  scriptPath: string;
}

export interface LocalGoogleConnectorConfig
  extends GoogleConnectorSelection {
  adapter: "local-oauth";
}

export type GoogleConnectorConfig =
  | ExternalGoogleConnectorConfig
  | LocalGoogleConnectorConfig;

export interface GoogleConnectorStatus {
  configured: boolean;
  profileCount: number;
}

export interface Ga4Property {
  property: string;
  displayName?: string;
  account?: string;
  accountDisplayName?: string;
}

export interface SearchConsoleSite {
  siteUrl: string;
  permissionLevel?: string;
}

export interface GoogleInventory {
  profile: string;
  ga4Properties: Ga4Property[];
  searchConsoleSites: SearchConsoleSite[];
}

export interface Ga4Header {
  name: string;
}

export interface Ga4Value {
  value?: string;
}

export interface Ga4Row {
  dimensionValues?: Ga4Value[];
  metricValues?: Ga4Value[];
}

export interface Ga4ReportResponse {
  dimensionHeaders?: Ga4Header[];
  metricHeaders?: Ga4Header[];
  rows?: Ga4Row[];
  rowCount?: number;
  metadata?: unknown;
  propertyQuota?: unknown;
}

export interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

export interface GscReportResponse {
  rows?: GscRow[];
  responseAggregationType?: string;
}

export interface Ga4ReportRequest {
  start: string;
  end: string;
  dimensions: string[];
  metrics: string[];
  limit?: number;
}

export interface GscReportRequest {
  start: string;
  end: string;
  dimensions: string[];
  limit?: number;
  offset?: number;
  type?: string;
  dataState?: "final" | "all";
}

export interface GoogleDataProvider {
  status(): Promise<GoogleConnectorStatus>;
  inventory(): Promise<GoogleInventory>;
  ga4Report(
    property: string,
    request: Ga4ReportRequest,
  ): Promise<Ga4ReportResponse>;
  gscReport(
    site: string,
    request: GscReportRequest,
  ): Promise<GscReportResponse>;
}
