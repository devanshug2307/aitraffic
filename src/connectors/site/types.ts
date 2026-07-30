export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type SiteHostResolver = (
  hostname: string,
) => Promise<ResolvedAddress[]>;

export interface SiteRedirectHop {
  url: string;
  status: number;
  location: string;
}

export interface SiteResponseHeaders {
  contentType: string | null;
  contentLength: number | null;
  contentEncoding: string | null;
  xRobotsTag: string[];
}

export interface SiteHttpResponse {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  redirects: SiteRedirectHop[];
  headers: SiteResponseHeaders;
  body: string | null;
  byteLength: number;
  bodyRead: "complete" | "truncated" | "unsupported_encoding";
  sha256: string | null;
  durationMs: number;
}

export interface SiteHttpRequestOptions {
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  accept: string;
}

export interface SiteHttpClient {
  get(
    url: string,
    options: SiteHttpRequestOptions,
  ): Promise<SiteHttpResponse>;
}

export interface RobotsRule {
  directive: "allow" | "disallow";
  path: string;
  line: number;
}

export interface RobotsGroup {
  userAgents: string[];
  rules: RobotsRule[];
}

export interface RobotsDecision {
  agent: string;
  decision: "allowed" | "disallowed" | "unknown";
  matchedRule: RobotsRule | null;
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
}

export interface ExtractedHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface ExtractedLink {
  rawHref: string;
  resolvedUrl: string | null;
  text: string;
  rel: string[];
  kind: "internal" | "external" | "non_http" | "invalid";
}

export interface ExtractedCanonical {
  rawHref: string;
  resolvedUrl: string | null;
  location: "head" | "body";
}

export interface ExtractedJsonLd {
  index: number;
  parseStatus: "valid_json" | "invalid_json";
  types: string[];
  ids: string[];
  error: string | null;
}

export interface HtmlDocumentFacts {
  parseMode: "static_html";
  browserRendered: false;
  htmlLang: string | null;
  titles: string[];
  metaDescriptions: string[];
  metaRobots: Array<{ name: string; directives: string[] }>;
  canonicals: ExtractedCanonical[];
  headings: ExtractedHeading[];
  baseHref: string | null;
  links: {
    total: number;
    uniqueInternal: number;
    uniqueExternal: number;
    nofollow: number;
    truncated: boolean;
    items: ExtractedLink[];
  };
  structuredData: ExtractedJsonLd[];
}
