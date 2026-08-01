import { createHash } from "node:crypto";

import {
  extractHtmlDocument,
  normalizeRobotDirectives,
  stableHtmlContentHash,
} from "../connectors/site/html.js";
import { createSiteHttpClient } from "../connectors/site/http.js";
import { normalizeAuditUrl } from "../connectors/site/networkPolicy.js";
import {
  evaluateRobots,
  parseRobotsTxt,
} from "../connectors/site/robots.js";
import type {
  HtmlDocumentFacts,
  RobotsDecision,
  SiteHttpClient,
  SiteHttpResponse,
} from "../connectors/site/types.js";

export interface PageAuditOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  now?: Date;
}

export interface PageAuditObservation {
  id: string;
  evidenceClass: "observed";
  sourceRef: "src_robots_txt" | "src_page_http" | "src_static_html";
  observedAt: string;
  type: "robots" | "http" | "html";
  payload:
    | {
        url: string;
        status: number | null;
        decision: RobotsDecision;
        sitemaps: string[];
        fetchError: string | null;
      }
    | Omit<SiteHttpResponse, "body">
    | HtmlDocumentFacts;
}

export interface PageAuditFinding {
  id: string;
  ruleId: string;
  classification: "inferred";
  basis: "deterministic_rule";
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  explanation: string;
  evidenceRefs: string[];
  limitations: string[];
}

export interface PageAuditRecommendation {
  id: string;
  classification: "action";
  findingRefs: string[];
  action: string;
  approvalRequired: true;
  verification: {
    command: string;
    successCriteria: string;
  };
}

export interface PageAuditAnalysis {
  generatedAt: string;
  summary: {
    requestedUrl: string;
    finalUrl: string | null;
    status: number | null;
    robotsDecision: RobotsDecision["decision"];
    htmlObserved: boolean;
    staticHtmlOnly: true;
    contentHash: string | null;
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
  observations: PageAuditObservation[];
  findings: PageAuditFinding[];
  recommendations: PageAuditRecommendation[];
  warnings: string[];
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

function fingerprint(...values: string[]): string {
  return createHash("sha256")
    .update(values.join("\u0000"))
    .digest("hex")
    .slice(0, 16);
}

function evidenceId(
  kind: string,
  url: string,
  qualifier: string,
): string {
  return `ev_${kind}_${fingerprint(kind, url, qualifier)}`;
}

function finding(
  url: string,
  ruleId: string,
  severity: PageAuditFinding["severity"],
  title: string,
  explanation: string,
  evidenceRefs: string[],
  limitations: string[] = [],
): PageAuditFinding {
  return {
    id: `finding_${fingerprint(ruleId, url)}`,
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

function recommendation(
  url: string,
  item: PageAuditFinding,
  action: string,
): PageAuditRecommendation {
  return {
    id: `action_${fingerprint(item.id, url)}`,
    classification: "action",
    findingRefs: [item.id],
    action,
    approvalRequired: true,
    verification: {
      command: `aitraffic audit page ${JSON.stringify(url)} --format json`,
      successCriteria:
        "Re-run after deployment and confirm the cited deterministic observation changed as intended.",
    },
  };
}

function isHtmlContentType(value: string | null): boolean {
  const normalized = value?.toLowerCase() ?? "";
  return (
    normalized.includes("text/html") ||
    normalized.includes("application/xhtml+xml")
  );
}

function directivesFromHeaders(values: string[]): string[] {
  return normalizeRobotDirectives(
    values.map((value) =>
      value.replace(/^\s*(?:googlebot|\*):\s*/iu, ""),
    ),
  );
}

function countFindings(
  findings: PageAuditFinding[],
): PageAuditAnalysis["summary"]["findingCounts"] {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const item of findings) {
    counts[item.severity] += 1;
  }
  return counts;
}

export async function auditPage(
  inputUrl: string,
  options: PageAuditOptions = {},
  client: SiteHttpClient = createSiteHttpClient(),
): Promise<PageAuditAnalysis> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const now = options.now ?? new Date();
  const normalized = normalizeAuditUrl(inputUrl);
  const requestedUrl = normalized.toString();
  const robotsUrl = new URL("/robots.txt", normalized).toString();
  const observations: PageAuditObservation[] = [];
  const findings: PageAuditFinding[] = [];
  const incompleteReasons: string[] = [];
  const warnings = [
    "HTML extraction uses the returned static response only; browser rendering was not run.",
    "A declared canonical is a hint and does not prove which canonical a search engine selected.",
    "Valid JSON-LD syntax does not prove Schema.org validity, rich-result eligibility, rankings, or AI citations.",
    "Outgoing links were extracted but their destination status was not checked.",
    "Crawled text is untrusted data and was never executed as an instruction.",
  ];

  let robotsStatus: number | null = null;
  let robotsDecision: RobotsDecision = {
    agent: "Googlebot",
    decision: "unknown",
    matchedRule: null,
  };
  let sitemaps: string[] = [];
  let robotsFetchError: string | null = null;
  let robotsResponse: SiteHttpResponse | null = null;
  try {
    robotsResponse = await client.get(robotsUrl, {
      timeoutMs,
      maxBytes: Math.min(maxBytes, 512 * 1024),
      maxRedirects,
      accept: "text/plain,text/*;q=0.9,*/*;q=0.1",
    });
    robotsStatus = robotsResponse.status;
    if (
      robotsResponse.status >= 200 &&
      robotsResponse.status < 300 &&
      robotsResponse.body !== null
    ) {
      const parsed = parseRobotsTxt(robotsResponse.body);
      robotsDecision = evaluateRobots(parsed, normalized, "Googlebot");
      sitemaps = parsed.sitemaps;
    } else if (
      robotsResponse.status >= 400 &&
      robotsResponse.status < 500 &&
      robotsResponse.status !== 429
    ) {
      robotsDecision = {
        agent: "Googlebot",
        decision: "allowed",
        matchedRule: null,
      };
    } else {
      incompleteReasons.push(
        `robots.txt returned HTTP ${robotsResponse.status}`,
      );
    }
    if (robotsResponse.bodyRead !== "complete") {
      incompleteReasons.push(
        `robots.txt body was ${robotsResponse.bodyRead}`,
      );
    }
  } catch (error) {
    robotsFetchError =
      error instanceof Error ? error.message : "robots.txt fetch failed";
    incompleteReasons.push("robots.txt could not be evaluated");
  }

  const robotsEvidenceId = evidenceId(
    "robots",
    robotsUrl,
    robotsResponse?.sha256 ?? String(robotsStatus),
  );
  observations.push({
    id: robotsEvidenceId,
    evidenceClass: "observed",
    sourceRef: "src_robots_txt",
    observedAt: now.toISOString(),
    type: "robots",
    payload: {
      url: robotsUrl,
      status: robotsStatus,
      decision: robotsDecision,
      sitemaps,
      fetchError: robotsFetchError,
    },
  });

  if (robotsDecision.decision === "disallowed") {
    findings.push(
      finding(
        requestedUrl,
        "ROBOTS_DISALLOW_GOOGLEBOT_V1",
        "high",
        "Googlebot crawl is disallowed",
        "The applicable robots.txt rule disallows this URL for Googlebot. robots.txt controls crawling, not guaranteed deindexing.",
        [robotsEvidenceId],
      ),
    );
    incompleteReasons.push(
      "page fetch skipped because robots.txt disallows Googlebot",
    );
    const recommendations = findings.map((item) =>
      recommendation(
        requestedUrl,
        item,
        "Confirm that blocking Googlebot is intentional. If not, prepare a reviewed robots.txt change and test the exact path before deployment.",
      ),
    );
    return {
      generatedAt: now.toISOString(),
      summary: {
        requestedUrl,
        finalUrl: null,
        status: null,
        robotsDecision: robotsDecision.decision,
        htmlObserved: false,
        staticHtmlOnly: true,
        contentHash: null,
        findingCounts: countFindings(findings),
      },
      coverage: {
        requested: 2,
        observed: 1,
        omitted: 1,
        truncated: false,
        partial: true,
        incompleteReasons,
      },
      observations,
      findings,
      recommendations,
      warnings,
    };
  }

  const page = await client.get(requestedUrl, {
    timeoutMs,
    maxBytes,
    maxRedirects,
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
  });
  const httpEvidenceId = evidenceId(
    "http",
    page.finalUrl,
    `${page.status}:${page.sha256 ?? ""}`,
  );
  const { body: _body, ...safePage } = page;
  observations.push({
    id: httpEvidenceId,
    evidenceClass: "observed",
    sourceRef: "src_page_http",
    observedAt: now.toISOString(),
    type: "http",
    payload: safePage,
  });

  if (page.bodyRead !== "complete") {
    incompleteReasons.push(`page body was ${page.bodyRead}`);
  }
  if (page.status >= 400 && page.status < 500) {
    findings.push(
      finding(
        page.finalUrl,
        "HTTP_CLIENT_ERROR_V1",
        "critical",
        `Page returned HTTP ${page.status}`,
        "The final response is a client error. This is direct fetch evidence, not a soft-404 diagnosis.",
        [httpEvidenceId],
      ),
    );
  } else if (page.status >= 500) {
    findings.push(
      finding(
        page.finalUrl,
        "HTTP_SERVER_ERROR_V1",
        "high",
        `Page returned HTTP ${page.status}`,
        "The final response is a server error. Persistent server errors can prevent reliable crawling.",
        [httpEvidenceId],
      ),
    );
  } else if (page.status < 200 || page.status >= 300) {
    findings.push(
      finding(
        page.finalUrl,
        "HTTP_UNEXPECTED_STATUS_V1",
        "medium",
        `Page returned HTTP ${page.status}`,
        "The final response was not a successful 2xx response.",
        [httpEvidenceId],
      ),
    );
  }
  if (new URL(page.finalUrl).protocol !== "https:") {
    findings.push(
      finding(
        page.finalUrl,
        "FINAL_URL_NOT_HTTPS_V1",
        "medium",
        "Final page URL is not HTTPS",
        "The audited URL resolved to an unencrypted HTTP page.",
        [httpEvidenceId],
      ),
    );
  }
  if (page.redirects.length > 0) {
    findings.push(
      finding(
        page.finalUrl,
        "REDIRECT_CHAIN_OBSERVED_V1",
        "info",
        "Redirect chain observed",
        `The request followed ${page.redirects.length} redirect hop${page.redirects.length === 1 ? "" : "s"}. A redirect is not inherently an error.`,
        [httpEvidenceId],
      ),
    );
  }

  let html: HtmlDocumentFacts | null = null;
  let contentHash = page.sha256;
  if (page.body !== null && isHtmlContentType(page.headers.contentType)) {
    html = extractHtmlDocument(page.body, page.finalUrl);
    contentHash = stableHtmlContentHash(page.body, page.finalUrl, html);
    const htmlEvidenceId = evidenceId(
      "html",
      page.finalUrl,
      contentHash,
    );
    observations.push({
      id: htmlEvidenceId,
      evidenceClass: "observed",
      sourceRef: "src_static_html",
      observedAt: now.toISOString(),
      type: "html",
      payload: html,
    });
    const titleValues = html.titles.map((value) => value.trim());
    if (
      titleValues.length === 0 ||
      titleValues.every((value) => value === "")
    ) {
      findings.push(
        finding(
          page.finalUrl,
          "TITLE_NOT_OBSERVED_STATIC_HTML_V1",
          "medium",
          "No non-empty title observed in static HTML",
          "The returned static HTML did not contain a non-empty title element. Browser-rendered metadata was not checked.",
          [htmlEvidenceId],
          ["JavaScript may add or replace the title after rendering."],
        ),
      );
    }
    if (titleValues.length > 1) {
      findings.push(
        finding(
          page.finalUrl,
          "MULTIPLE_TITLE_ELEMENTS_V1",
          "medium",
          "Multiple title elements observed",
          `The returned HTML contained ${titleValues.length} title elements.`,
          [htmlEvidenceId],
        ),
      );
    }
    if (
      html.metaDescriptions.length === 0 ||
      html.metaDescriptions.every((value) => value.trim() === "")
    ) {
      findings.push(
        finding(
          page.finalUrl,
          "DESCRIPTION_NOT_OBSERVED_STATIC_HTML_V1",
          "low",
          "No non-empty meta description observed in static HTML",
          "A meta description is not an indexing requirement and search engines may generate snippets from page content.",
          [htmlEvidenceId],
          ["JavaScript may add metadata after rendering."],
        ),
      );
    }

    const headerDirectives = directivesFromHeaders(
      page.headers.xRobotsTag,
    );
    const metaDirectives = normalizeRobotDirectives(
      html.metaRobots.flatMap(({ directives }) => directives),
    );
    if (
      headerDirectives.includes("noindex") ||
      metaDirectives.includes("noindex")
    ) {
      findings.push(
        finding(
          page.finalUrl,
          "NOINDEX_DIRECTIVE_OBSERVED_V1",
          "medium",
          "Noindex directive observed",
          "A noindex directive was observed in the response headers or returned static HTML. It may be intentional; confirm expected indexability.",
          [httpEvidenceId, htmlEvidenceId],
        ),
      );
    }

    const headCanonicals = html.canonicals.filter(
      ({ location }) => location === "head",
    );
    const distinctCanonicalTargets = new Set(
      headCanonicals.map(({ resolvedUrl, rawHref }) => resolvedUrl ?? rawHref),
    );
    if (distinctCanonicalTargets.size > 1) {
      findings.push(
        finding(
          page.finalUrl,
          "MULTIPLE_CANONICAL_TARGETS_V1",
          "high",
          "Multiple canonical targets observed",
          "The HTML head declares more than one distinct canonical target.",
          [htmlEvidenceId],
          ["Declared canonicals are hints, not proof of selected canonical."],
        ),
      );
    }
    if (
      headCanonicals.some(
        ({ rawHref, resolvedUrl }) => !rawHref || resolvedUrl === null,
      )
    ) {
      findings.push(
        finding(
          page.finalUrl,
          "INVALID_CANONICAL_URL_V1",
          "medium",
          "Invalid canonical URL observed",
          "At least one canonical declaration in the HTML head has an empty or unresolvable href.",
          [htmlEvidenceId],
        ),
      );
    }
    if (
      headCanonicals.some(({ resolvedUrl }) => {
        if (!resolvedUrl) {
          return false;
        }
        return new URL(resolvedUrl).hash !== "";
      })
    ) {
      findings.push(
        finding(
          page.finalUrl,
          "CANONICAL_FRAGMENT_TARGET_V1",
          "medium",
          "Canonical target contains a fragment",
          "A canonical declaration points to a URL fragment, which is not a supported canonical target pattern.",
          [htmlEvidenceId],
        ),
      );
    }
    if (html.canonicals.some(({ location }) => location === "body")) {
      findings.push(
        finding(
          page.finalUrl,
          "CANONICAL_OUTSIDE_HEAD_V1",
          "medium",
          "Canonical declaration observed outside the head",
          "A canonical link outside the HTML head is not a supported Google canonical declaration.",
          [htmlEvidenceId],
        ),
      );
    }
    if (
      headCanonicals.some(({ resolvedUrl }) => {
        if (!resolvedUrl) {
          return false;
        }
        return new URL(resolvedUrl).origin !== new URL(page.finalUrl).origin;
      })
    ) {
      findings.push(
        finding(
          page.finalUrl,
          "CROSS_ORIGIN_CANONICAL_REVIEW_V1",
          "low",
          "Cross-origin canonical observed",
          "The canonical points to another origin. Cross-domain canonicals can be intentional, so review rather than automatically changing it.",
          [htmlEvidenceId],
        ),
      );
    }
    if (
      html.structuredData.some(
        ({ parseStatus }) => parseStatus === "invalid_json",
      )
    ) {
      findings.push(
        finding(
          page.finalUrl,
          "INVALID_JSON_LD_SYNTAX_V1",
          "medium",
          "Invalid JSON-LD syntax observed",
          "At least one static JSON-LD block could not be parsed as JSON.",
          [htmlEvidenceId],
          [
            "This check does not validate Schema.org semantics or rich-result eligibility.",
          ],
        ),
      );
    }
    if (html.links.truncated) {
      incompleteReasons.push(
        "outgoing link details were capped at 500 items",
      );
    }
  } else {
    incompleteReasons.push(
      `HTML extraction skipped for content type ${page.headers.contentType ?? "unknown"}`,
    );
    findings.push(
      finding(
        page.finalUrl,
        "HTML_NOT_OBSERVED_V1",
        "medium",
        "HTML document was not observed",
        "The final response was not parsed as HTML because its content type was unsupported or its body was unavailable.",
        [httpEvidenceId],
      ),
    );
  }

  const actionByRule: Record<string, string> = {
    HTTP_CLIENT_ERROR_V1:
      "Restore a successful page or intentionally redirect it to the most relevant live destination.",
    HTTP_SERVER_ERROR_V1:
      "Investigate the server/application failure and restore a stable response before making SEO content changes.",
    HTTP_UNEXPECTED_STATUS_V1:
      "Confirm the intended response behavior and provide a stable 2xx page or a valid redirect.",
    FINAL_URL_NOT_HTTPS_V1:
      "Plan an HTTPS migration with reviewed redirects, canonicals, and internal links.",
    REDIRECT_CHAIN_OBSERVED_V1:
      "Where practical, update internal references to the final URL and keep the redirect purpose explicit.",
    TITLE_NOT_OBSERVED_STATIC_HTML_V1:
      "Add a concise, page-specific title that accurately describes the visible content.",
    MULTIPLE_TITLE_ELEMENTS_V1:
      "Keep one unambiguous title source in the document head.",
    DESCRIPTION_NOT_OBSERVED_STATIC_HTML_V1:
      "Consider adding a truthful page-specific meta description for snippet presentation.",
    NOINDEX_DIRECTIVE_OBSERVED_V1:
      "Confirm whether the page should be indexable before changing the directive.",
    MULTIPLE_CANONICAL_TARGETS_V1:
      "Choose one intended canonical target and remove conflicting declarations.",
    INVALID_CANONICAL_URL_V1:
      "Replace the invalid canonical href with the intended absolute or resolvable URL.",
    CANONICAL_FRAGMENT_TARGET_V1:
      "Point the canonical at the document URL without a fragment.",
    CANONICAL_OUTSIDE_HEAD_V1:
      "Move the intended canonical declaration into the document head.",
    CROSS_ORIGIN_CANONICAL_REVIEW_V1:
      "Verify that cross-origin consolidation is intentional and supported by both properties.",
    INVALID_JSON_LD_SYNTAX_V1:
      "Correct the JSON syntax, then validate the applicable feature with official testing tools.",
    HTML_NOT_OBSERVED_V1:
      "Confirm the intended content type and whether the URL should serve an HTML landing page.",
  };
  const recommendations = findings.map((item) =>
    recommendation(
      page.finalUrl,
      item,
      actionByRule[item.ruleId] ??
        "Review the cited evidence and prepare the smallest safe correction.",
    ),
  );

  return {
    generatedAt: now.toISOString(),
    summary: {
      requestedUrl,
      finalUrl: page.finalUrl,
      status: page.status,
      robotsDecision: robotsDecision.decision,
      htmlObserved: html !== null,
      staticHtmlOnly: true,
      contentHash,
      findingCounts: countFindings(findings),
    },
    coverage: {
      requested: 2,
      observed: 2,
      omitted: 0,
      truncated:
        page.bodyRead === "truncated" ||
        robotsResponse?.bodyRead === "truncated",
      partial: incompleteReasons.length > 0,
      incompleteReasons: [...new Set(incompleteReasons)],
    },
    observations,
    findings,
    recommendations,
    warnings,
  };
}
