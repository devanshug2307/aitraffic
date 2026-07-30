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

export type Ga4StringMatchType =
  | "EXACT"
  | "BEGINS_WITH"
  | "ENDS_WITH"
  | "CONTAINS"
  | "FULL_REGEXP"
  | "PARTIAL_REGEXP";

export interface Ga4FilterExpression {
  filter: {
    fieldName: string;
    stringFilter: {
      matchType?: Ga4StringMatchType;
      value: string;
      caseSensitive?: boolean;
    };
  };
}

export interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

export interface Ga4ReportRequest {
  start: string;
  end: string;
  dimensions: string[];
  metrics: string[];
  limit?: number;
  offset?: number;
  dimensionFilter?: Ga4FilterExpression;
}

export interface Ga4ReportCoverage {
  requestedRows: number;
  observedRows: number;
  pagesFetched: number;
  pageSize: number;
  truncated: boolean;
  partial: boolean;
  incompleteReasons: string[];
}

export interface PaginatedGa4Report {
  response: Ga4ReportResponse;
  coverage: Ga4ReportCoverage;
}

export type GscSearchType =
  | "web"
  | "image"
  | "video"
  | "news"
  | "discover"
  | "googleNews";

export type GscDataState = "final" | "all" | "hourly_all";

export type GscAggregationType =
  | "auto"
  | "byPage"
  | "byProperty"
  | "byNewsShowcasePanel";

export type GscFilterDimension =
  | "query"
  | "page"
  | "country"
  | "device"
  | "searchAppearance";

export type GscFilterOperator =
  | "contains"
  | "equals"
  | "notContains"
  | "notEquals"
  | "includingRegex"
  | "excludingRegex";

export interface GscDimensionFilter {
  dimension: GscFilterDimension;
  operator: GscFilterOperator;
  expression: string;
}

export interface GscDimensionFilterGroup {
  groupType?: "and";
  filters: GscDimensionFilter[];
}

export interface GscResponseMetadata {
  first_incomplete_date?: string;
  first_incomplete_hour?: string;
}

export interface GscReportRequest {
  start: string;
  end: string;
  dimensions: string[];
  limit?: number;
  offset?: number;
  type?: GscSearchType;
  dataState?: GscDataState;
  aggregationType?: GscAggregationType;
  dimensionFilterGroups?: GscDimensionFilterGroup[];
}

export interface GscReportResponse {
  rows?: GscRow[];
  responseAggregationType?: string;
  metadata?: GscResponseMetadata;
}

export interface GscReportCoverage {
  requestedRows: number;
  observedRows: number;
  pagesFetched: number;
  pageSize: number;
  topRowsOnly: true;
  truncated: boolean;
  partial: boolean;
  incompleteReasons: string[];
}

export interface PaginatedGscReport {
  response: GscReportResponse;
  coverage: GscReportCoverage;
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
