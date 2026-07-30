import { createHash } from "node:crypto";

import {
  auditPage,
  type PageAuditAnalysis,
  type PageAuditFinding,
  type PageAuditRecommendation,
} from "./pageAudit.js";
import { createSiteHttpClient } from "../connectors/site/http.js";
import { normalizeAuditUrl } from "../connectors/site/networkPolicy.js";
import { parseRobotsTxt } from "../connectors/site/robots.js";
import { parseSitemapDocument } from "../connectors/site/sitemap.js";
import type {
  HtmlDocumentFacts,
  ParsedSitemap,
  SiteHttpClient,
  SiteHttpResponse,
} from "../connectors/site/types.js";
import { AppError } from "../core/result.js";

export interface SiteCrawlOptions {
  limit?: number;
  concurrency?: number;
  sitemap?: "auto" | "none" | string;
  maxSitemaps?: number;
  timeoutMs?: number;
  maxBytes?: number;
  maxSitemapBytes?: number;
  maxRedirects?: number;
  now?: Date;
}

export interface SiteCrawlSitemapObservation {
  id: string;
  evidenceClass: "observed";
  sourceRef: "src_sitemap";
  observedAt: string;
  type: "sitemap";
  payload: {
    requestedUrl: string;
    finalUrl: string;
    status: number;
    contentType: string | null;
    bodyRead: SiteHttpResponse["bodyRead"];
    byteLength: number;
    sha256: string | null;
    format: ParsedSitemap["format"] | null;
    kind: ParsedSitemap["kind"] | null;
    totalEntries: number | null;
    retainedEntries: number | null;
    truncated: boolean;
    errors: string[];
    warnings: string[];
  };
}

export interface SiteCrawlPageObservation {
  id: string;
  evidenceClass: "observed";
  sourceRef: "src_site_crawl";
  observedAt: string;
  type: "page";
  payload: {
    requestedUrl: string;
    finalUrl: string | null;
    discoverySources: Array<"seed" | "sitemap" | "link">;
    sitemapLastmod: string | null;
    status: number | null;
    robotsDecision: PageAuditAnalysis["summary"]["robotsDecision"];
    htmlObserved: boolean;
    staticHtmlOnly: true;
    contentHash: string | null;
    title: string | null;
    metaDescriptionObserved: boolean | null;
    noindexObserved: boolean | null;
    canonicalTargets: string[];
    headingCounts: Record<"h1" | "h2" | "h3" | "h4" | "h5" | "h6", number>;
    links: {
      total: number;
      uniqueInternal: number;
      uniqueExternal: number;
      nofollow: number;
      truncated: boolean;
    } | null;
    structuredData: {
      blocks: number;
      validJson: number;
      invalidJson: number;
      types: string[];
    } | null;
    bodyRead: SiteHttpResponse["bodyRead"] | null;
    error: { code: string; message: string } | null;
  };
}

export interface SiteCrawlPageResult {
  url: string;
  finalUrl: string | null;
  discoverySources: Array<"seed" | "sitemap" | "link">;
  sitemapLastmod: string | null;
  status: number | null;
  robotsDecision: PageAuditAnalysis["summary"]["robotsDecision"];
  htmlObserved: boolean;
  findingRefs: string[];
  error: { code: string; message: string } | null;
}

export interface SiteCrawlAnalysis {
  generatedAt: string;
  summary: {
    requestedUrl: string;
    origin: string;
    limit: number;
    concurrency: number;
    pagesDiscovered: number;
    pagesAudited: number;
    pagesFetched: number;
    pageFailures: number;
    sitemapDocumentsFetched: number;
    sitemapUrlsObserved: number;
    linkUrlsDiscovered: number;
    statuses: {
      success2xx: number;
      redirect3xx: number;
      clientError4xx: number;
      serverError5xx: number;
      unavailable: number;
    };
    findingCounts: Record<
      PageAuditFinding["severity"],
      number
    >;
  };
  coverage: {
    requested: number;
    observed: number;
    omitted: number;
    truncated: boolean;
    partial: boolean;
    incompleteReasons: string[];
  };
  pages: SiteCrawlPageResult[];
  observations: Array<
    SiteCrawlSitemapObservation | SiteCrawlPageObservation
  >;
  findings: PageAuditFinding[];
  recommendations: PageAuditRecommendation[];
  warnings: string[];
}

interface DiscoveredPage {
  url: string;
  sources: Set<"seed" | "sitemap" | "link">;
  sitemapLastmod: string | null;
}

interface CompletedPage {
  discovered: DiscoveredPage;
  audit: PageAuditAnalysis | null;
  error: { code: string; message: string } | null;
  html: HtmlDocumentFacts | null;
  http: Omit<SiteHttpResponse, "body"> | null;
  observationId: string;
}

const DEFAULT_LIMIT = 25;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_MAX_SITEMAPS = 20;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_SITEMAP_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const MAX_DISCOVERED_MULTIPLIER = 20;
const MAX_URLS_PER_PATH = 5;
const SKIPPED_ASSET_EXTENSIONS =
  /\.(?:avif|bmp|css|csv|docx?|eot|gif|ico|jpe?g|js|json|mp3|mp4|mov|otf|pdf|png|pptx?|rar|rss|svg|tar|tiff?|ttf|txt|webm|webp|woff2?|xlsx?|xml|zip)$/iu;

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  const selected = value ?? fallback;
  if (
    !Number.isInteger(selected) ||
    selected < minimum ||
    selected > maximum
  ) {
    throw new AppError(
      "INVALID_CRAWL_OPTION",
      `${label} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return selected;
}

function fingerprint(...values: string[]): string {
  return createHash("sha256")
    .update(values.join("\u0000"))
    .digest("hex")
    .slice(0, 16);
}

function cacheRobots(client: SiteHttpClient): SiteHttpClient {
  const cache = new Map<string, Promise<SiteHttpResponse>>();
  return {
    get(url, options) {
      const parsed = new URL(url);
      if (parsed.pathname !== "/robots.txt") {
        return client.get(url, options);
      }
      const key = parsed.origin;
      const existing = cache.get(key);
      if (existing) {
        return existing;
      }
      const request = client.get(url, options);
      cache.set(key, request);
      return request;
    },
  };
}

function boundaryHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./u, "");
}

function scopedSiteUrl(
  candidate: string,
  root: URL,
): URL | null {
  if (candidate.length > 2_048) {
    return null;
  }
  try {
    const parsed = normalizeAuditUrl(candidate);
    if (boundaryHost(parsed.hostname) !== boundaryHost(root.hostname)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function pageHtml(audit: PageAuditAnalysis): HtmlDocumentFacts | null {
  const observation = audit.observations.find(
    (item) => item.type === "html",
  );
  return observation?.type === "html"
    ? (observation.payload as HtmlDocumentFacts)
    : null;
}

function pageHttp(
  audit: PageAuditAnalysis,
): Omit<SiteHttpResponse, "body"> | null {
  const observation = audit.observations.find(
    (item) => item.type === "http",
  );
  return observation?.type === "http"
    ? (observation.payload as Omit<SiteHttpResponse, "body">)
    : null;
}

function noindexObserved(
  html: HtmlDocumentFacts | null,
  http: Omit<SiteHttpResponse, "body"> | null,
): boolean | null {
  if (!html && !http) {
    return null;
  }
  const meta = html?.metaRobots.flatMap(({ directives }) => directives) ?? [];
  const headers =
    http?.headers.xRobotsTag.flatMap((value) =>
      value
        .toLowerCase()
        .split(/[,\s]+/u)
        .filter(Boolean),
    ) ?? [];
  return meta.includes("noindex") || headers.includes("noindex");
}

function compactPageObservation(
  completed: CompletedPage,
  observedAt: string,
): SiteCrawlPageObservation {
  const { discovered, audit, error, html, http, observationId } = completed;
  const headingCounts = {
    h1: 0,
    h2: 0,
    h3: 0,
    h4: 0,
    h5: 0,
    h6: 0,
  };
  for (const heading of html?.headings ?? []) {
    headingCounts[`h${heading.level}`] += 1;
  }
  const structured = html?.structuredData ?? null;
  return {
    id: observationId,
    evidenceClass: "observed",
    sourceRef: "src_site_crawl",
    observedAt,
    type: "page",
    payload: {
      requestedUrl: discovered.url,
      finalUrl: audit?.summary.finalUrl ?? null,
      discoverySources: [...discovered.sources].sort(),
      sitemapLastmod: discovered.sitemapLastmod,
      status: audit?.summary.status ?? null,
      robotsDecision: audit?.summary.robotsDecision ?? "unknown",
      htmlObserved: audit?.summary.htmlObserved ?? false,
      staticHtmlOnly: true,
      contentHash: audit?.summary.contentHash ?? null,
      title: html?.titles.find((value) => value.trim())?.trim() ?? null,
      metaDescriptionObserved:
        html === null
          ? null
          : html.metaDescriptions.some((value) => value.trim() !== ""),
      noindexObserved: noindexObserved(html, http),
      canonicalTargets:
        html?.canonicals
          .filter(({ location, resolvedUrl }) => location === "head" && resolvedUrl)
          .map(({ resolvedUrl }) => resolvedUrl as string) ?? [],
      headingCounts,
      links:
        html === null
          ? null
          : {
              total: html.links.total,
              uniqueInternal: html.links.uniqueInternal,
              uniqueExternal: html.links.uniqueExternal,
              nofollow: html.links.nofollow,
              truncated: html.links.truncated,
            },
      structuredData:
        structured === null
          ? null
          : {
              blocks: structured.length,
              validJson: structured.filter(
                ({ parseStatus }) => parseStatus === "valid_json",
              ).length,
              invalidJson: structured.filter(
                ({ parseStatus }) => parseStatus === "invalid_json",
              ).length,
              types: [
                ...new Set(structured.flatMap(({ types }) => types)),
              ].slice(0, 100),
            },
      bodyRead: http?.bodyRead ?? null,
      error,
    },
  };
}

function siteFinding(
  origin: string,
  ruleId: string,
  severity: PageAuditFinding["severity"],
  title: string,
  explanation: string,
  evidenceRefs: string[],
  limitations: string[] = [],
): PageAuditFinding {
  return {
    id: `finding_${fingerprint(origin, ruleId, ...evidenceRefs)}`,
    ruleId,
    classification: "inferred",
    basis: "deterministic_rule",
    severity,
    title,
    explanation,
    evidenceRefs,
    limitations,
  };
}

function siteRecommendation(
  origin: string,
  finding: PageAuditFinding,
  action: string,
): PageAuditRecommendation {
  return {
    id: `action_${fingerprint(finding.id, origin)}`,
    classification: "action",
    findingRefs: [finding.id],
    action,
    approvalRequired: true,
    verification: {
      command: `aitraffic crawl ${JSON.stringify(origin)} --format json`,
      successCriteria:
        "Re-run the same bounded crawl after deployment and confirm the cited observations changed without creating new crawl failures.",
    },
  };
}

function countFindings(findings: PageAuditFinding[]) {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }
  return counts;
}

export async function crawlSite(
  inputUrl: string,
  options: SiteCrawlOptions = {},
  inputClient: SiteHttpClient = createSiteHttpClient(),
): Promise<SiteCrawlAnalysis> {
  const root = normalizeAuditUrl(inputUrl);
  const origin = root.origin;
  const limit = boundedInteger(options.limit, DEFAULT_LIMIT, 1, 500, "--limit");
  const concurrency = boundedInteger(
    options.concurrency,
    DEFAULT_CONCURRENCY,
    1,
    10,
    "--concurrency",
  );
  const maxSitemaps = boundedInteger(
    options.maxSitemaps,
    DEFAULT_MAX_SITEMAPS,
    1,
    100,
    "--max-sitemaps",
  );
  const timeoutMs = boundedInteger(
    options.timeoutMs,
    DEFAULT_TIMEOUT_MS,
    1,
    30_000,
    "--timeout-ms",
  );
  const maxBytes = boundedInteger(
    options.maxBytes,
    DEFAULT_MAX_BYTES,
    1,
    10 * 1024 * 1024,
    "--max-bytes",
  );
  const maxSitemapBytes = boundedInteger(
    options.maxSitemapBytes,
    DEFAULT_MAX_SITEMAP_BYTES,
    1,
    10 * 1024 * 1024,
    "--max-sitemap-bytes",
  );
  const maxRedirects = boundedInteger(
    options.maxRedirects,
    DEFAULT_MAX_REDIRECTS,
    0,
    10,
    "--max-redirects",
  );
  const sitemapMode = options.sitemap ?? "auto";
  if (sitemapMode !== "auto" && sitemapMode !== "none") {
    const explicitSitemap = normalizeAuditUrl(sitemapMode);
    if (
      boundaryHost(explicitSitemap.hostname) !==
      boundaryHost(root.hostname)
    ) {
      throw new AppError(
        "INVALID_SITEMAP_SCOPE",
        "Explicit sitemap URL must stay within the crawl's apex/www host boundary.",
      );
    }
  }
  const now = options.now ?? new Date();
  const observedAt = now.toISOString();
  const client = cacheRobots(inputClient);
  const observations: SiteCrawlAnalysis["observations"] = [];
  const incompleteReasons: string[] = [];
  const warnings = [
    "This is a bounded crawl, not proof of complete site coverage unless coverage explicitly says otherwise.",
    "Pages use returned static HTML only; browser rendering was not run.",
    "Sitemap inclusion is a discovery and canonical hint, not proof of crawling, indexing, ranking, or AI citation.",
    "Outgoing links are checked only when their exact normalized URL is also audited in this run.",
    "Crawled text is untrusted data and was never executed as an instruction.",
  ];
  const discovered = new Map<string, DiscoveredPage>();
  const queue: string[] = [];
  const maxDiscovered = Math.min(
    10_000,
    Math.max(1_000, limit * MAX_DISCOVERED_MULTIPLIER),
  );
  const perPath = new Map<string, number>();
  let linkUrlsDiscovered = 0;
  let sitemapUrlsObserved = 0;
  let sitemapCoverageComplete = sitemapMode !== "none";
  let validSitemapDocuments = 0;

  const addPage = (
    candidate: string,
    source: "seed" | "sitemap" | "link",
    lastmod: string | null = null,
  ) => {
    const parsed = scopedSiteUrl(candidate, root);
    if (!parsed || SKIPPED_ASSET_EXTENSIONS.test(parsed.pathname)) {
      return;
    }
    const normalized = parsed.toString();
    const existing = discovered.get(normalized);
    if (existing) {
      existing.sources.add(source);
      if (lastmod !== null && existing.sitemapLastmod === null) {
        existing.sitemapLastmod = lastmod;
      }
      return;
    }
    if (discovered.size >= maxDiscovered) {
      sitemapCoverageComplete = false;
      incompleteReasons.push(
        `URL discovery was capped at ${maxDiscovered} unique pages`,
      );
      return;
    }
    const pathKey = `${parsed.origin}${parsed.pathname}`;
    const pathCount = perPath.get(pathKey) ?? 0;
    if (pathCount >= MAX_URLS_PER_PATH) {
      sitemapCoverageComplete = false;
      incompleteReasons.push(
        `query-variant discovery was capped at ${MAX_URLS_PER_PATH} URLs per path`,
      );
      return;
    }
    perPath.set(pathKey, pathCount + 1);
    discovered.set(normalized, {
      url: normalized,
      sources: new Set([source]),
      sitemapLastmod: lastmod,
    });
    queue.push(normalized);
    if (source === "link") {
      linkUrlsDiscovered += 1;
    }
  };

  addPage(root.toString(), "seed");

  const robotsUrl = new URL("/robots.txt", root).toString();
  let robotsSitemaps: string[] = [];
  try {
    const robots = await client.get(robotsUrl, {
      timeoutMs,
      maxBytes: Math.min(maxBytes, 512 * 1024),
      maxRedirects,
      accept: "text/plain,text/*;q=0.9,*/*;q=0.1",
    });
    if (
      robots.status >= 200 &&
      robots.status < 300 &&
      robots.body !== null
    ) {
      robotsSitemaps = parseRobotsTxt(robots.body).sitemaps;
    }
  } catch {
    incompleteReasons.push(
      "robots.txt could not be read for sitemap discovery",
    );
  }

  const sitemapQueue: string[] = [];
  if (sitemapMode === "auto") {
    sitemapQueue.push(
      ...(robotsSitemaps.length > 0
        ? robotsSitemaps
        : [new URL("/sitemap.xml", root).toString()]),
    );
  } else if (sitemapMode !== "none") {
    sitemapQueue.push(sitemapMode);
  } else {
    sitemapCoverageComplete = false;
    incompleteReasons.push("sitemap discovery was disabled");
  }

  const visitedSitemaps = new Set<string>();
  while (
    sitemapQueue.length > 0 &&
    visitedSitemaps.size < maxSitemaps
  ) {
    const rawSitemapUrl = sitemapQueue.shift();
    if (!rawSitemapUrl) {
      break;
    }
    const sitemapUrl = scopedSiteUrl(rawSitemapUrl, root);
    if (!sitemapUrl) {
      sitemapCoverageComplete = false;
      incompleteReasons.push(
        "a cross-origin or invalid sitemap reference was skipped",
      );
      continue;
    }
    const normalizedSitemapUrl = sitemapUrl.toString();
    if (visitedSitemaps.has(normalizedSitemapUrl)) {
      continue;
    }
    visitedSitemaps.add(normalizedSitemapUrl);

    let response: SiteHttpResponse;
    try {
      response = await client.get(normalizedSitemapUrl, {
        timeoutMs,
        maxBytes: maxSitemapBytes,
        maxRedirects,
        accept:
          "application/xml,text/xml,text/plain,application/rss+xml,application/atom+xml;q=0.8,*/*;q=0.1",
      });
    } catch (error) {
      sitemapCoverageComplete = false;
      incompleteReasons.push(
        `sitemap fetch failed: ${normalizedSitemapUrl}`,
      );
      warnings.push(
        error instanceof Error
          ? `Sitemap fetch error for ${normalizedSitemapUrl}: ${error.message}`
          : `Sitemap fetch error for ${normalizedSitemapUrl}`,
      );
      continue;
    }

    let parsed: ParsedSitemap | null = null;
    const parseErrors: string[] = [];
    const parseWarnings: string[] = [];
    const looksLikeUndecodedGzip =
      response.headers.contentEncoding === null &&
      (response.headers.contentType?.toLowerCase().includes("gzip") ||
        response.finalUrl.toLowerCase().endsWith(".gz"));
    if (
      response.status >= 200 &&
      response.status < 300 &&
      response.body !== null &&
      !looksLikeUndecodedGzip
    ) {
      parsed = parseSitemapDocument(response.body, maxDiscovered);
      parseErrors.push(...parsed.errors);
      parseWarnings.push(...parsed.warnings);
      if (
        response.bodyRead !== "complete" ||
        parsed.truncated ||
        parsed.errors.length > 0 ||
        parsed.kind === "unsupported"
      ) {
        sitemapCoverageComplete = false;
      }
      if (parsed.kind !== "unsupported") {
        validSitemapDocuments += 1;
      }
    } else {
      sitemapCoverageComplete = false;
      if (looksLikeUndecodedGzip) {
        parseErrors.push(
          "Compressed sitemap body was not exposed with an HTTP content-encoding and was not parsed.",
        );
      } else if (response.status < 200 || response.status >= 300) {
        parseErrors.push(`Sitemap returned HTTP ${response.status}.`);
      } else {
        parseErrors.push("Sitemap response body was unavailable.");
      }
    }

    const sitemapObservationId = `ev_sitemap_${fingerprint(
      normalizedSitemapUrl,
      response.sha256 ?? String(response.status),
    )}`;
    observations.push({
      id: sitemapObservationId,
      evidenceClass: "observed",
      sourceRef: "src_sitemap",
      observedAt,
      type: "sitemap",
      payload: {
        requestedUrl: normalizedSitemapUrl,
        finalUrl: response.finalUrl,
        status: response.status,
        contentType: response.headers.contentType,
        bodyRead: response.bodyRead,
        byteLength: response.byteLength,
        sha256: response.sha256,
        format: parsed?.format ?? null,
        kind: parsed?.kind ?? null,
        totalEntries: parsed?.totalEntries ?? null,
        retainedEntries: parsed?.retainedEntries ?? null,
        truncated:
          response.bodyRead === "truncated" ||
          parsed?.truncated === true,
        errors: [...new Set([...parseErrors])],
        warnings: [...new Set([...parseWarnings])],
      },
    });

    if (!parsed) {
      continue;
    }
    sitemapUrlsObserved +=
      parsed.kind === "urlset" ? parsed.totalEntries : 0;
    for (const entry of parsed.urls) {
      addPage(entry.loc, "sitemap", entry.lastmod);
    }
    for (const entry of parsed.childSitemaps) {
      const child = scopedSiteUrl(entry.loc, root);
      if (!child) {
        sitemapCoverageComplete = false;
        incompleteReasons.push(
          "a cross-origin or invalid child sitemap reference was skipped",
        );
        continue;
      }
      const parentDirectory = sitemapUrl.pathname.slice(
        0,
        sitemapUrl.pathname.lastIndexOf("/") + 1,
      );
      if (!child.pathname.startsWith(parentDirectory)) {
        sitemapCoverageComplete = false;
        incompleteReasons.push(
          "a child sitemap outside its index directory hierarchy was skipped",
        );
        continue;
      }
      sitemapQueue.push(child.toString());
    }
  }
  if (sitemapQueue.length > 0) {
    sitemapCoverageComplete = false;
    incompleteReasons.push(
      `sitemap traversal was capped at ${maxSitemaps} documents`,
    );
  }
  if (sitemapMode !== "none" && validSitemapDocuments === 0) {
    sitemapCoverageComplete = false;
    incompleteReasons.push(
      "no supported, successfully parsed sitemap was observed",
    );
  }

  const completedPages: CompletedPage[] = [];
  while (queue.length > 0 && completedPages.length < limit) {
    const batchUrls = queue.splice(
      0,
      Math.min(concurrency, limit - completedPages.length),
    );
    const batch = await Promise.all(
      batchUrls.map(async (url): Promise<CompletedPage> => {
        const page = discovered.get(url) as DiscoveredPage;
        const observationId = `ev_crawl_page_${fingerprint(url)}`;
        try {
          const audit = await auditPage(
            url,
            {
              timeoutMs,
              maxBytes,
              maxRedirects,
              now,
            },
            client,
          );
          return {
            discovered: page,
            audit,
            error: null,
            html: pageHtml(audit),
            http: pageHttp(audit),
            observationId,
          };
        } catch (error) {
          return {
            discovered: page,
            audit: null,
            error: {
              code:
                error instanceof AppError
                  ? error.code
                  : "PAGE_AUDIT_FAILED",
              message:
                error instanceof Error
                  ? error.message
                  : "Page audit failed.",
            },
            html: null,
            http: null,
            observationId,
          };
        }
      }),
    );
    completedPages.push(...batch);
    for (const page of batch) {
      for (const link of page.html?.links.items ?? []) {
        if (link.kind === "internal" && link.resolvedUrl !== null) {
          addPage(link.resolvedUrl, "link");
        }
      }
    }
  }

  const pageObservations = completedPages.map((page) =>
    compactPageObservation(page, observedAt),
  );
  observations.push(...pageObservations);
  const pageObservationByUrl = new Map(
    completedPages.map((page) => [
      page.discovered.url,
      page.observationId,
    ]),
  );

  const findings: PageAuditFinding[] = [];
  const recommendations: PageAuditRecommendation[] = [];
  for (const page of completedPages) {
    for (const item of page.audit?.findings ?? []) {
      const compactFinding = {
        ...item,
        evidenceRefs: [page.observationId],
      };
      findings.push(compactFinding);
      const originalRecommendation =
        page.audit?.recommendations.find(({ findingRefs }) =>
          findingRefs.includes(item.id),
        );
      if (originalRecommendation) {
        recommendations.push(originalRecommendation);
      }
    }
    if (page.error) {
      const item = siteFinding(
        origin,
        `PAGE_FETCH_FAILED_V1:${page.discovered.url}`,
        "high",
        "Page audit failed",
        `${page.discovered.url} could not be audited: ${page.error.message}`,
        [page.observationId],
      );
      findings.push(item);
      recommendations.push(
        siteRecommendation(
          origin,
          item,
          "Confirm the page is publicly reachable, then retry the bounded crawl before making SEO changes.",
        ),
      );
    }
  }

  const sitemapProblems = observations.filter(
    (item): item is SiteCrawlSitemapObservation =>
      item.type === "sitemap" &&
      (item.payload.status < 200 ||
        item.payload.status >= 300 ||
        item.payload.errors.length > 0 ||
        item.payload.truncated),
  );
  if (sitemapProblems.length > 0) {
    const item = siteFinding(
      origin,
      "SITEMAP_FETCH_OR_PARSE_INCOMPLETE_V1",
      "medium",
      "Sitemap coverage is incomplete",
      `${sitemapProblems.length} sitemap document${sitemapProblems.length === 1 ? " had" : "s had"} an HTTP, parsing, format, or size limitation.`,
      sitemapProblems.map(({ id }) => id),
      [
        "This finding describes audit coverage; it does not prove that a search engine rejected the sitemap.",
      ],
    );
    findings.push(item);
    recommendations.push(
      siteRecommendation(
        origin,
        item,
        "Review the cited sitemap responses and ensure intended sitemap documents return supported, complete UTF-8 XML or text content.",
      ),
    );
  }

  const sitemapNoindex = completedPages.filter(
    (page) =>
      page.discovered.sources.has("sitemap") &&
      noindexObserved(page.html, page.http) === true,
  );
  if (sitemapNoindex.length > 0) {
    const item = siteFinding(
      origin,
      "SITEMAP_URL_NOINDEX_CONFLICT_V1",
      "high",
      "Sitemap-listed pages declare noindex",
      `${sitemapNoindex.length} audited sitemap URL${sitemapNoindex.length === 1 ? " declares" : "s declare"} a noindex directive. Sitemap inclusion normally signals a preferred search URL, while noindex requests exclusion.`,
      sitemapNoindex
        .map(({ observationId }) => observationId)
        .slice(0, 40),
      [
        "Confirm the site's intended indexability before changing either signal.",
      ],
    );
    findings.push(item);
    recommendations.push(
      siteRecommendation(
        origin,
        item,
        "Decide whether each affected URL should be indexable. Remove it from the sitemap if exclusion is intentional, or review the noindex directive if inclusion is intended.",
      ),
    );
  }

  const sitemapCanonicalConflicts = completedPages.filter((page) => {
    if (!page.discovered.sources.has("sitemap") || !page.audit) {
      return false;
    }
    const targets = [
      ...new Set(
        page.html?.canonicals
          .filter(
            ({ location, resolvedUrl }) =>
              location === "head" && resolvedUrl !== null,
          )
          .map(({ resolvedUrl }) => resolvedUrl as string) ?? [],
      ),
    ];
    if (targets.length !== 1) {
      return false;
    }
    try {
      const target = normalizeAuditUrl(targets[0] as string).toString();
      const finalUrl = normalizeAuditUrl(
        page.audit.summary.finalUrl ?? page.discovered.url,
      ).toString();
      return target !== finalUrl;
    } catch {
      return false;
    }
  });
  if (sitemapCanonicalConflicts.length > 0) {
    const item = siteFinding(
      origin,
      "SITEMAP_CANONICAL_TARGET_CONFLICT_V1",
      "medium",
      "Sitemap-listed pages declare another canonical URL",
      `${sitemapCanonicalConflicts.length} audited sitemap URL${sitemapCanonicalConflicts.length === 1 ? " declares" : "s declare"} a different single canonical target.`,
      sitemapCanonicalConflicts
        .map(({ observationId }) => observationId)
        .slice(0, 40),
      [
        "Declared canonicals are hints and do not prove which canonical a search engine selected.",
      ],
    );
    findings.push(item);
    recommendations.push(
      siteRecommendation(
        origin,
        item,
        "Review whether the sitemap or canonical declaration represents the intended preferred URL and align the signals where appropriate.",
      ),
    );
  }

  const redirectedSitemapPages = completedPages.filter(
    (page) =>
      page.discovered.sources.has("sitemap") &&
      (page.http?.redirects.length ?? 0) > 0,
  );
  if (redirectedSitemapPages.length > 0) {
    const item = siteFinding(
      origin,
      "SITEMAP_URL_REDIRECTS_V1",
      "low",
      "Sitemap-listed pages redirect",
      `${redirectedSitemapPages.length} audited sitemap URL${redirectedSitemapPages.length === 1 ? " redirects" : "s redirect"} before reaching the final response.`,
      redirectedSitemapPages
        .map(({ observationId }) => observationId)
        .slice(0, 40),
      [
        "A redirect is not inherently an error; sitemap URLs are normally intended preferred URLs.",
      ],
    );
    findings.push(item);
    recommendations.push(
      siteRecommendation(
        origin,
        item,
        "Where the final destinations are stable intended canonicals, review whether the sitemap should list them directly.",
      ),
    );
  }

  const titleGroups = new Map<string, CompletedPage[]>();
  for (const page of completedPages) {
    const title = page.html?.titles.find((value) => value.trim())?.trim();
    if (!title) {
      continue;
    }
    const key = title.toLocaleLowerCase();
    const group = titleGroups.get(key) ?? [];
    group.push(page);
    titleGroups.set(key, group);
  }
  for (const pages of titleGroups.values()) {
    if (pages.length < 2) {
      continue;
    }
    const evidenceRefs = pages
      .map(({ observationId }) => observationId)
      .slice(0, 20);
    const item = siteFinding(
      origin,
      `DUPLICATE_TITLE_IN_AUDITED_SET_V1:${pages[0]?.html?.titles[0] ?? ""}`,
      "low",
      "Duplicate title observed in audited pages",
      `${pages.length} audited pages returned the same non-empty title. Duplicate titles are not automatically a ranking defect, but they can make page purpose ambiguous.`,
      evidenceRefs,
      [
        "This comparison covers returned static HTML in this bounded crawl only.",
      ],
    );
    findings.push(item);
    recommendations.push(
      siteRecommendation(
        origin,
        item,
        "Review whether the affected pages have distinct purposes. If they do, prepare page-specific titles that accurately distinguish them.",
      ),
    );
  }

  const statusByUrl = new Map(
    completedPages.flatMap((page) => {
      const status = page.audit?.summary.status;
      return status === null || status === undefined
        ? []
        : [
            [page.audit?.summary.finalUrl ?? page.discovered.url, status] as const,
          ];
    }),
  );
  const brokenTargetRefs = new Set<string>();
  for (const source of completedPages) {
    for (const link of source.html?.links.items ?? []) {
      if (
        link.kind !== "internal" ||
        link.resolvedUrl === null
      ) {
        continue;
      }
      const targetStatus = statusByUrl.get(link.resolvedUrl);
      if (targetStatus !== undefined && targetStatus >= 400) {
        brokenTargetRefs.add(
          pageObservationByUrl.get(source.discovered.url) ??
            source.observationId,
        );
        const targetRef = completedPages.find(
          (page) =>
            (page.audit?.summary.finalUrl ?? page.discovered.url) ===
            link.resolvedUrl,
        )?.observationId;
        if (targetRef) {
          brokenTargetRefs.add(targetRef);
        }
      }
    }
  }
  if (brokenTargetRefs.size > 0) {
    const item = siteFinding(
      origin,
      "AUDITED_INTERNAL_LINK_TARGET_ERROR_V1",
      "high",
      "Internal links point to audited error responses",
      "At least one extracted internal link points to an exact URL that returned a 4xx or 5xx response in this crawl.",
      [...brokenTargetRefs].slice(0, 40),
      [
        "Only exact normalized link targets that were also audited are covered.",
      ],
    );
    findings.push(item);
    recommendations.push(
      siteRecommendation(
        origin,
        item,
        "Update the affected internal links to a relevant successful destination or restore the intended target page.",
      ),
    );
  }

  if (sitemapCoverageComplete && validSitemapDocuments > 0) {
    const notInSitemap = completedPages.filter(
      ({ discovered }) =>
        discovered.sources.has("link") &&
        !discovered.sources.has("sitemap") &&
        discovered.url !== root.toString(),
    );
    if (notInSitemap.length > 0) {
      const item = siteFinding(
        origin,
        "NOT_OBSERVED_IN_COMPLETE_SITEMAP_SET_V1",
        "low",
        "Linked pages were not observed in the parsed sitemap set",
        `${notInSitemap.length} audited page${notInSitemap.length === 1 ? " was" : "s were"} discovered through internal links but not observed in the successfully parsed sitemap set.`,
        notInSitemap
          .map(({ observationId }) => observationId)
          .slice(0, 40),
        [
          "Sitemaps are optional hints; absence does not prevent crawling or indexing.",
          "Coverage applies only to sitemap documents reached in this run.",
        ],
      );
      findings.push(item);
      recommendations.push(
        siteRecommendation(
          origin,
          item,
          "If these pages are intended canonical search landing pages, review whether they belong in the generated sitemap.",
        ),
      );
    }
  }

  const auditedUrls = new Set(
    completedPages.map(
      (page) => page.audit?.summary.finalUrl ?? page.discovered.url,
    ),
  );
  const incoming = new Map<string, number>();
  for (const page of completedPages) {
    for (const link of page.html?.links.items ?? []) {
      if (
        link.resolvedUrl !== null &&
        auditedUrls.has(link.resolvedUrl)
      ) {
        incoming.set(
          link.resolvedUrl,
          (incoming.get(link.resolvedUrl) ?? 0) + 1,
        );
      }
    }
  }
  const crawlTruncated =
    queue.length > 0 || discovered.size > completedPages.length;
  if (!crawlTruncated) {
    const unlinked = completedPages.filter((page) => {
      const finalUrl =
        page.audit?.summary.finalUrl ?? page.discovered.url;
      return finalUrl !== root.toString() && !incoming.has(finalUrl);
    });
    if (unlinked.length > 0) {
      const item = siteFinding(
        origin,
        "UNLINKED_IN_COMPLETE_STATIC_CRAWL_V1",
        "medium",
        "Pages were not linked from another audited page",
        `${unlinked.length} page${unlinked.length === 1 ? " was" : "s were"} not reached by an internal link from another page in this complete bounded static crawl.`,
        unlinked.map(({ observationId }) => observationId).slice(0, 40),
        [
          "This does not prove a true orphan; rendered links, external links, feeds, or unobserved sources may still reference the page.",
        ],
      );
      findings.push(item);
      recommendations.push(
        siteRecommendation(
          origin,
          item,
          "Review whether users and crawlers should reach these pages through relevant static internal links.",
        ),
      );
    }
  }

  const pageFailures = completedPages.filter(({ error }) => error !== null)
    .length;
  if (pageFailures > 0) {
    incompleteReasons.push(`${pageFailures} page audit(s) failed`);
  }
  if (crawlTruncated) {
    incompleteReasons.push(
      `page crawling stopped at the requested limit of ${limit}`,
    );
  }
  const pagesFetched = completedPages.filter(
    ({ audit }) => audit?.summary.status !== null,
  ).length;
  const statuses = {
    success2xx: 0,
    redirect3xx: 0,
    clientError4xx: 0,
    serverError5xx: 0,
    unavailable: 0,
  };
  for (const page of completedPages) {
    const status = page.audit?.summary.status;
    if (status === null || status === undefined) {
      statuses.unavailable += 1;
    } else if (status >= 200 && status < 300) {
      statuses.success2xx += 1;
    } else if (status >= 300 && status < 400) {
      statuses.redirect3xx += 1;
    } else if (status >= 400 && status < 500) {
      statuses.clientError4xx += 1;
    } else if (status >= 500) {
      statuses.serverError5xx += 1;
    }
  }

  const pages: SiteCrawlPageResult[] = completedPages.map((page) => ({
    url: page.discovered.url,
    finalUrl: page.audit?.summary.finalUrl ?? null,
    discoverySources: [...page.discovered.sources].sort(),
    sitemapLastmod: page.discovered.sitemapLastmod,
    status: page.audit?.summary.status ?? null,
    robotsDecision: page.audit?.summary.robotsDecision ?? "unknown",
    htmlObserved: page.audit?.summary.htmlObserved ?? false,
    findingRefs: findings
      .filter(({ evidenceRefs }) =>
        evidenceRefs.includes(page.observationId),
      )
      .map(({ id }) => id),
    error: page.error,
  }));
  const uniqueIncompleteReasons = [...new Set(incompleteReasons)];
  return {
    generatedAt: observedAt,
    summary: {
      requestedUrl: root.toString(),
      origin,
      limit,
      concurrency,
      pagesDiscovered: discovered.size,
      pagesAudited: completedPages.length,
      pagesFetched,
      pageFailures,
      sitemapDocumentsFetched: observations.filter(
        ({ type }) => type === "sitemap",
      ).length,
      sitemapUrlsObserved,
      linkUrlsDiscovered,
      statuses,
      findingCounts: countFindings(findings),
    },
    coverage: {
      requested: limit,
      observed: completedPages.length,
      omitted: Math.max(0, discovered.size - completedPages.length),
      truncated:
        crawlTruncated ||
        observations.some(
          (item) =>
            item.type === "sitemap" && item.payload.truncated,
        ),
      partial:
        uniqueIncompleteReasons.length > 0 ||
        pageFailures > 0 ||
        !sitemapCoverageComplete,
      incompleteReasons: uniqueIncompleteReasons,
    },
    pages,
    observations,
    findings,
    recommendations,
    warnings: [...new Set(warnings)],
  };
}
