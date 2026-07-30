import type {
  FullAuditEnvelope,
  FullAuditConfiguration,
} from "../capabilities/run.js";
import type { OpportunityFinding } from "./opportunities.js";
import type { PageAuditFinding } from "./pageAudit.js";

interface PageSnapshot {
  url: string;
  finalUrl: string | null;
  status: number | null;
  htmlObserved: boolean;
  contentHash: string | null;
  title: string | null;
  metaDescriptionObserved: boolean | null;
  noindexObserved: boolean | null;
  canonicalTargets: string[];
}

export interface TechnicalFindingSnapshot {
  key: string;
  ruleId: string;
  severity: PageAuditFinding["severity"];
  title: string;
  explanation: string;
  urls: string[];
  scope: "page" | "site";
  findingId: string;
}

export interface GoogleFindingSnapshot {
  key: string;
  kind: OpportunityFinding["kind"];
  query: string;
  page: string | null;
  competingPages: string[];
  priority: OpportunityFinding["priority"];
  metrics: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number | null;
  };
  findingId: string;
}

export interface AuditComparison {
  comparisonVersion: "0.1.0";
  direction: "older-to-newer";
  older: {
    runId: string;
    completedAt: string;
    site: string | null;
  };
  newer: {
    runId: string;
    completedAt: string;
    site: string | null;
  };
  coverage: {
    comparable: boolean;
    complete: boolean;
    reasons: string[];
    older: FullAuditEnvelope["result"]["technical"]["coverage"];
    newer: FullAuditEnvelope["result"]["technical"]["coverage"];
  };
  pages: {
    compared: number;
    changed: Array<{
      url: string;
      changes: Array<{
        field:
          | "finalUrl"
          | "status"
          | "htmlObserved"
          | "contentHash"
          | "title"
          | "metaDescriptionObserved"
          | "noindexObserved"
          | "canonicalTargets";
        older: unknown;
        newer: unknown;
      }>;
    }>;
    newlyObserved: string[];
    notObservedInNewer: string[];
  };
  technicalFindings: {
    persistent: TechnicalFindingSnapshot[];
    newlyObserved: TechnicalFindingSnapshot[];
    resolved: TechnicalFindingSnapshot[];
    unknown: Array<{
      direction: "newly-observed" | "no-longer-observed";
      finding: TechnicalFindingSnapshot;
      reason: string;
    }>;
  };
  googleOpportunities: {
    comparable: boolean;
    reasons: string[];
    persistent: Array<{
      key: string;
      older: GoogleFindingSnapshot;
      newer: GoogleFindingSnapshot;
    }>;
    newlyObserved: GoogleFindingSnapshot[];
    noLongerObserved: GoogleFindingSnapshot[];
  };
  caveats: string[];
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : null;
}

function normalizedUrl(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

function sortedStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").sort()
    : [];
}

function pageSnapshots(audit: FullAuditEnvelope): Map<string, PageSnapshot> {
  const pages = new Map<string, PageSnapshot>();
  for (const observation of audit.observations) {
    const item = record(observation);
    const payload = record(item?.payload);
    if (
      item?.type !== "page" ||
      typeof payload?.requestedUrl !== "string"
    ) {
      continue;
    }
    pages.set(payload.requestedUrl, {
      url: payload.requestedUrl,
      finalUrl:
        typeof payload.finalUrl === "string" ? payload.finalUrl : null,
      status: typeof payload.status === "number" ? payload.status : null,
      htmlObserved: payload.htmlObserved === true,
      contentHash:
        typeof payload.contentHash === "string"
          ? payload.contentHash
          : null,
      title: typeof payload.title === "string" ? payload.title : null,
      metaDescriptionObserved:
        typeof payload.metaDescriptionObserved === "boolean"
          ? payload.metaDescriptionObserved
          : null,
      noindexObserved:
        typeof payload.noindexObserved === "boolean"
          ? payload.noindexObserved
          : null,
      canonicalTargets: sortedStrings(payload.canonicalTargets),
    });
  }
  return pages;
}

function observationUrls(
  audit: FullAuditEnvelope,
): Map<string, { url: string; type: string }> {
  const urls = new Map<string, { url: string; type: string }>();
  for (const observation of audit.observations) {
    const item = record(observation);
    const payload = record(item?.payload);
    const url =
      typeof payload?.requestedUrl === "string"
        ? payload.requestedUrl
        : null;
    if (
      typeof item?.id === "string" &&
      typeof item.type === "string" &&
      url !== null
    ) {
      urls.set(item.id, { url, type: item.type });
    }
  }
  return urls;
}

function isTechnicalFinding(
  finding: FullAuditEnvelope["findings"][number],
): finding is PageAuditFinding {
  return "ruleId" in finding;
}

const SITE_RULE_PREFIXES = [
  "SITEMAP_",
  "DUPLICATE_TITLE_IN_AUDITED_SET_V1:",
  "AUDITED_INTERNAL_LINK_TARGET_ERROR_V1",
  "NOT_OBSERVED_IN_COMPLETE_SITEMAP_SET_V1",
  "UNLINKED_IN_COMPLETE_STATIC_CRAWL_V1",
] as const;

function isSiteRule(ruleId: string): boolean {
  return SITE_RULE_PREFIXES.some((prefix) => ruleId.startsWith(prefix));
}

function technicalSnapshots(
  audit: FullAuditEnvelope,
): Map<string, TechnicalFindingSnapshot> {
  const evidence = observationUrls(audit);
  const result = new Map<string, TechnicalFindingSnapshot>();
  for (const finding of audit.findings) {
    if (!isTechnicalFinding(finding)) {
      continue;
    }
    const cited = finding.evidenceRefs.flatMap((id) => {
      const item = evidence.get(id);
      return item === undefined ? [] : [item];
    });
    const pageUrls = [
      ...new Set(
        cited
          .filter(({ type }) => type === "page")
          .map(({ url }) => url),
      ),
    ].sort();
    const scope =
      pageUrls.length === 1 && !isSiteRule(finding.ruleId)
        ? "page"
        : "site";
    const urls =
      pageUrls.length > 0
        ? pageUrls
        : [...new Set(cited.map(({ url }) => url))].sort();
    const subject = audit.subject.url ?? "unknown-site";
    const key =
      scope === "page"
        ? `${finding.ruleId}\u0000${pageUrls[0]}`
        : `${finding.ruleId}\u0000${subject}`;
    result.set(key, {
      key,
      ruleId: finding.ruleId,
      severity: finding.severity,
      title: finding.title,
      explanation: finding.explanation,
      urls,
      scope,
      findingId: finding.id,
    });
  }
  return result;
}

export function getTechnicalFindingSnapshots(
  audit: FullAuditEnvelope,
): TechnicalFindingSnapshot[] {
  return [...technicalSnapshots(audit).values()];
}

function crawlConfiguration(
  audit: FullAuditEnvelope,
): FullAuditConfiguration["crawl"] | null {
  const result = record(audit.result);
  const configuration = record(result?.configuration);
  const crawl = record(configuration?.crawl);
  return crawl as FullAuditConfiguration["crawl"] | null;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function completeCoverage(
  coverage: FullAuditEnvelope["result"]["technical"]["coverage"],
): boolean {
  return !coverage.partial && !coverage.truncated;
}

function technicalCoverage(
  older: FullAuditEnvelope,
  newer: FullAuditEnvelope,
): AuditComparison["coverage"] {
  const reasons: string[] = [];
  if (
    normalizedUrl(older.subject.url) !== normalizedUrl(newer.subject.url)
  ) {
    reasons.push("The audited target URLs differ.");
  }
  const olderConfiguration = crawlConfiguration(older);
  const newerConfiguration = crawlConfiguration(newer);
  if (
    olderConfiguration === null ||
    newerConfiguration === null
  ) {
    reasons.push("One audit does not record its crawl configuration.");
  } else if (!sameJson(olderConfiguration, newerConfiguration)) {
    reasons.push("The crawl configurations differ.");
  }
  if (!completeCoverage(older.result.technical.coverage)) {
    reasons.push("The older technical crawl is partial or truncated.");
  }
  if (!completeCoverage(newer.result.technical.coverage)) {
    reasons.push("The newer technical crawl is partial or truncated.");
  }
  const configurationComparable =
    reasons.every(
      (reason) =>
        ![
          "The audited target URLs differ.",
          "One audit does not record its crawl configuration.",
          "The crawl configurations differ.",
        ].includes(reason),
    );
  return {
    comparable: configurationComparable,
    complete:
      configurationComparable &&
      completeCoverage(older.result.technical.coverage) &&
      completeCoverage(newer.result.technical.coverage),
    reasons,
    older: older.result.technical.coverage,
    newer: newer.result.technical.coverage,
  };
}

function pageChanges(
  older: FullAuditEnvelope,
  newer: FullAuditEnvelope,
): AuditComparison["pages"] {
  const olderPages = pageSnapshots(older);
  const newerPages = pageSnapshots(newer);
  const olderUrls = [...olderPages.keys()].sort();
  const newerUrls = [...newerPages.keys()].sort();
  const sharedUrls = olderUrls.filter((url) => newerPages.has(url));
  const fields = [
    "finalUrl",
    "status",
    "htmlObserved",
    "contentHash",
    "title",
    "metaDescriptionObserved",
    "noindexObserved",
    "canonicalTargets",
  ] as const;
  const changed = sharedUrls.flatMap((url) => {
    const previous = olderPages.get(url);
    const current = newerPages.get(url);
    if (previous === undefined || current === undefined) {
      return [];
    }
    const changes = fields.flatMap((field) =>
      sameJson(previous[field], current[field])
        ? []
        : [
            {
              field,
              older: previous[field],
              newer: current[field],
            },
          ],
    );
    return changes.length === 0 ? [] : [{ url, changes }];
  });
  return {
    compared: sharedUrls.length,
    changed,
    newlyObserved: newerUrls.filter((url) => !olderPages.has(url)),
    notObservedInNewer: olderUrls.filter((url) => !newerPages.has(url)),
  };
}

function compareTechnicalFindings(
  older: FullAuditEnvelope,
  newer: FullAuditEnvelope,
  coverage: AuditComparison["coverage"],
): AuditComparison["technicalFindings"] {
  const olderFindings = technicalSnapshots(older);
  const newerFindings = technicalSnapshots(newer);
  const olderPages = pageSnapshots(older);
  const newerPages = pageSnapshots(newer);
  const persistent: TechnicalFindingSnapshot[] = [];
  const newlyObserved: TechnicalFindingSnapshot[] = [];
  const resolved: TechnicalFindingSnapshot[] = [];
  const unknown: AuditComparison["technicalFindings"]["unknown"] = [];

  for (const [key, finding] of newerFindings) {
    if (olderFindings.has(key)) {
      persistent.push(finding);
      continue;
    }
    const comparable =
      finding.scope === "page"
        ? finding.urls.every((url) => olderPages.has(url))
        : coverage.complete;
    if (comparable) {
      newlyObserved.push(finding);
    } else {
      unknown.push({
        direction: "newly-observed",
        finding,
        reason:
          finding.scope === "page"
            ? "The affected page was not observed in the older crawl."
            : "Site-level findings require matching, complete crawl coverage.",
      });
    }
  }

  for (const [key, finding] of olderFindings) {
    if (newerFindings.has(key)) {
      continue;
    }
    const comparable =
      finding.scope === "page"
        ? finding.urls.every((url) => newerPages.has(url))
        : coverage.complete;
    if (comparable) {
      resolved.push(finding);
    } else {
      unknown.push({
        direction: "no-longer-observed",
        finding,
        reason:
          finding.scope === "page"
            ? "The affected page was not observed in the newer crawl."
            : "Site-level findings require matching, complete crawl coverage.",
      });
    }
  }

  const byKey = <T extends { key: string }>(left: T, right: T) =>
    left.key.localeCompare(right.key);
  return {
    persistent: persistent.sort(byKey),
    newlyObserved: newlyObserved.sort(byKey),
    resolved: resolved.sort(byKey),
    unknown: unknown.sort((left, right) =>
      left.finding.key.localeCompare(right.finding.key),
    ),
  };
}

function isGoogleFinding(
  finding: FullAuditEnvelope["findings"][number],
): finding is OpportunityFinding {
  return "kind" in finding;
}

function googleSnapshots(
  audit: FullAuditEnvelope,
): Map<string, GoogleFindingSnapshot> {
  const result = new Map<string, GoogleFindingSnapshot>();
  for (const finding of audit.findings) {
    if (!isGoogleFinding(finding)) {
      continue;
    }
    const competingPages = (finding.metrics.competingPages ?? [])
      .map(({ page }) => page)
      .sort();
    const key = [
      finding.kind,
      finding.query.trim().toLowerCase(),
      finding.page ?? "",
      ...competingPages,
    ].join("\u0000");
    result.set(key, {
      key,
      kind: finding.kind,
      query: finding.query,
      page: finding.page,
      competingPages,
      priority: finding.priority,
      metrics: {
        clicks: finding.metrics.clicks,
        impressions: finding.metrics.impressions,
        ctr: finding.metrics.ctr,
        position: finding.metrics.position,
      },
      findingId: finding.id,
    });
  }
  return result;
}

export function getGoogleFindingSnapshots(
  audit: FullAuditEnvelope,
): GoogleFindingSnapshot[] {
  return [...googleSnapshots(audit).values()];
}
function periodLength(period: { start: string; end: string }): number {
  return (
    Math.round(
      (Date.parse(`${period.end}T00:00:00.000Z`) -
        Date.parse(`${period.start}T00:00:00.000Z`)) /
        86_400_000,
    ) + 1
  );
}

function sourceCoverageComplete(
  audit: FullAuditEnvelope,
): boolean {
  const sourceCoverage = audit.result.google.sourceEvidence?.sourceCoverage;
  if (sourceCoverage === undefined) {
    return false;
  }
  return [
    sourceCoverage.currentGsc,
    sourceCoverage.previousGsc,
    sourceCoverage.ga4,
  ].every((item) => !item.partial && !item.truncated);
}

function compareGoogleOpportunities(
  older: FullAuditEnvelope,
  newer: FullAuditEnvelope,
): AuditComparison["googleOpportunities"] {
  const reasons: string[] = [];
  if (
    older.result.google.status !== "included" ||
    newer.result.google.status !== "included"
  ) {
    reasons.push("Both audits must include Google evidence.");
  }
  if (
    older.subject.site !== newer.subject.site ||
    older.subject.ga4Property !== newer.subject.ga4Property
  ) {
    reasons.push("The selected Search Console or GA4 resources differ.");
  }
  const olderPeriods = older.result.google.sourceEvidence?.periods;
  const newerPeriods = newer.result.google.sourceEvidence?.periods;
  if (olderPeriods === undefined || newerPeriods === undefined) {
    reasons.push("One audit does not record Google source periods.");
  } else if (
    periodLength(olderPeriods.gsc.current) !==
      periodLength(newerPeriods.gsc.current) ||
    periodLength(olderPeriods.gsc.previous) !==
      periodLength(newerPeriods.gsc.previous) ||
    periodLength(olderPeriods.ga4.current) !==
      periodLength(newerPeriods.ga4.current) ||
    periodLength(olderPeriods.ga4.previous) !==
      periodLength(newerPeriods.ga4.previous)
  ) {
    reasons.push("The Google reporting period lengths differ.");
  }
  if (!sourceCoverageComplete(older) || !sourceCoverageComplete(newer)) {
    reasons.push("One or both Google datasets are partial or truncated.");
  }
  const comparable = reasons.length === 0;
  const olderFindings = googleSnapshots(older);
  const newerFindings = googleSnapshots(newer);
  if (!comparable) {
    return {
      comparable,
      reasons,
      persistent: [],
      newlyObserved: [],
      noLongerObserved: [],
    };
  }
  const persistent = [...newerFindings.entries()]
    .filter(([key]) => olderFindings.has(key))
    .map(([key, finding]) => ({
      key,
      older: olderFindings.get(key) as GoogleFindingSnapshot,
      newer: finding,
    }));
  return {
    comparable,
    reasons,
    persistent,
    newlyObserved: [...newerFindings.entries()]
      .filter(([key]) => !olderFindings.has(key))
      .map(([, finding]) => finding),
    noLongerObserved: [...olderFindings.entries()]
      .filter(([key]) => !newerFindings.has(key))
      .map(([, finding]) => finding),
  };
}

export function compareAuditRuns(
  older: FullAuditEnvelope,
  newer: FullAuditEnvelope,
): AuditComparison {
  const coverage = technicalCoverage(older, newer);
  return {
    comparisonVersion: "0.1.0",
    direction: "older-to-newer",
    older: {
      runId: older.run.id,
      completedAt: older.run.completedAt,
      site: older.subject.url,
    },
    newer: {
      runId: newer.run.id,
      completedAt: newer.run.completedAt,
      site: newer.subject.url,
    },
    coverage,
    pages: pageChanges(older, newer),
    technicalFindings: compareTechnicalFindings(
      older,
      newer,
      coverage,
    ),
    googleOpportunities: compareGoogleOpportunities(older, newer),
    caveats: [
      "Newly observed and no-longer-observed URLs describe audit coverage, not index additions or removals.",
      "Resolved means the deterministic finding was absent when the same page or complete comparable site coverage was observed; it does not prove ranking impact.",
      "Google opportunity movement is associative aggregate evidence, not a causal claim.",
    ],
  };
}
