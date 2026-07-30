import type {
  OpportunityFinding,
} from "./opportunities.js";
import type { PageAuditFinding } from "./pageAudit.js";

export type FullAuditFocus =
  | "all"
  | "indexing"
  | "internal-links"
  | "structured-data";

export type FullAuditPriority =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export interface UnifiedFindingCandidate {
  finding: PageAuditFinding | OpportunityFinding;
  urls: string[];
  sourceRunId: string;
}

export interface UnifiedPriorityFinding {
  rank: number;
  findingId: string;
  source: "technical" | "google-opportunity";
  sourceRunId: string;
  category:
    | "access-indexing"
    | "canonical"
    | "metadata"
    | "structured-data"
    | "internal-links"
    | "sitemap"
    | "search-performance"
    | "other";
  priority: FullAuditPriority;
  title: string;
  reason: string;
  urls: string[];
  additionalUrls: number;
  evidenceRefs: string[];
  impactBasis: string;
  confidence: {
    label: "high" | "medium";
    basis: string;
  };
  effort: {
    label: "unknown";
    basis: "Repository or CMS implementation was not inspected.";
  };
}

function isTechnicalFinding(
  finding: PageAuditFinding | OpportunityFinding,
): finding is PageAuditFinding {
  return "ruleId" in finding;
}

function categoryForRule(
  ruleId: string,
): UnifiedPriorityFinding["category"] {
  if (/JSON_LD|STRUCTURED/u.test(ruleId)) {
    return "structured-data";
  }
  if (/LINK|UNLINKED/u.test(ruleId)) {
    return "internal-links";
  }
  if (/CANONICAL/u.test(ruleId)) {
    return "canonical";
  }
  if (/SITEMAP/u.test(ruleId)) {
    return "sitemap";
  }
  if (/TITLE|DESCRIPTION|HEADING/u.test(ruleId)) {
    return "metadata";
  }
  if (/ROBOTS|NOINDEX|HTTP|REDIRECT|HTTPS|HTML_NOT_OBSERVED/u.test(ruleId)) {
    return "access-indexing";
  }
  return "other";
}

function focusMatches(
  category: UnifiedPriorityFinding["category"],
  focus: FullAuditFocus,
): boolean {
  if (focus === "all") {
    return true;
  }
  if (focus === "indexing") {
    return [
      "access-indexing",
      "canonical",
      "sitemap",
    ].includes(category);
  }
  return category === focus;
}

function score(
  finding: PageAuditFinding | OpportunityFinding,
): number {
  if (isTechnicalFinding(finding)) {
    return {
      critical: 0,
      high: 1,
      medium: 3,
      low: 5,
      info: 7,
    }[finding.severity];
  }
  return { high: 2, medium: 4, low: 6 }[finding.priority];
}

function opportunityUrls(finding: OpportunityFinding): string[] {
  const urls = [
    ...(finding.page === null ? [] : [finding.page]),
    ...(finding.metrics.competingPages ?? []).map(({ page }) => page),
  ];
  return [...new Set(urls)];
}

function normalizedUrls(urls: string[]): {
  urls: string[];
  additionalUrls: number;
} {
  const unique = [...new Set(urls)];
  return {
    urls: unique.slice(0, 10),
    additionalUrls: Math.max(0, unique.length - 10),
  };
}

function toPriorityFinding(
  candidate: UnifiedFindingCandidate,
): Omit<UnifiedPriorityFinding, "rank"> {
  const { finding } = candidate;
  if (isTechnicalFinding(finding)) {
    const scope = normalizedUrls(candidate.urls);
    return {
      findingId: finding.id,
      source: "technical",
      sourceRunId: candidate.sourceRunId,
      category: categoryForRule(finding.ruleId),
      priority: finding.severity,
      title: finding.title,
      reason: finding.explanation,
      ...scope,
      evidenceRefs: finding.evidenceRefs,
      impactBasis: `AItraffic operational severity: ${finding.severity}; rule: ${finding.ruleId}.`,
      confidence: {
        label: "high",
        basis:
          "Deterministic rule over observed static evidence; business and ranking impact remains contextual.",
      },
      effort: {
        label: "unknown",
        basis: "Repository or CMS implementation was not inspected.",
      },
    };
  }

  const scope = normalizedUrls([
    ...candidate.urls,
    ...opportunityUrls(finding),
  ]);
  return {
    findingId: finding.id,
    source: "google-opportunity",
    sourceRunId: candidate.sourceRunId,
    category: "search-performance",
    priority: finding.priority,
    title:
      finding.kind === "cannibalization"
        ? `Search overlap candidate: ${finding.query}`
        : `Existing-demand opportunity: ${finding.query}`,
    reason: finding.reason,
    ...scope,
    evidenceRefs: finding.evidenceRefs,
    impactBasis: `${finding.metrics.impressions} observed Search Console impressions and ${finding.metrics.clicks} clicks in the selected period.`,
    confidence: {
      label: "medium",
      basis:
        "Derived from aggregate GSC/GA4 evidence with source coverage and attribution limitations.",
    },
    effort: {
      label: "unknown",
      basis: "Repository or CMS implementation was not inspected.",
    },
  };
}

export function prioritizeUnifiedFindings(
  candidates: UnifiedFindingCandidate[],
  options: { focus: FullAuditFocus; limit: number },
): {
  eligible: number;
  returned: number;
  omitted: number;
  findings: UnifiedPriorityFinding[];
} {
  const ranked = candidates
    .filter(({ finding }) => {
      const category = isTechnicalFinding(finding)
        ? categoryForRule(finding.ruleId)
        : "search-performance";
      return focusMatches(category, options.focus);
    })
    .sort(
      (left, right) =>
        score(left.finding) - score(right.finding) ||
        (isTechnicalFinding(left.finding)
          ? 0
          : -left.finding.metrics.impressions) -
          (isTechnicalFinding(right.finding)
            ? 0
            : -right.finding.metrics.impressions) ||
        left.finding.id.localeCompare(right.finding.id),
    );
  const findings = ranked
    .slice(0, options.limit)
    .map((candidate, index) => ({
      rank: index + 1,
      ...toPriorityFinding(candidate),
    }));
  return {
    eligible: ranked.length,
    returned: findings.length,
    omitted: Math.max(0, ranked.length - findings.length),
    findings,
  };
}

export function gscSiteCoversUrl(
  gscSite: string,
  targetUrl: string,
): boolean {
  const target = new URL(targetUrl);
  if (gscSite.startsWith("sc-domain:")) {
    const domain = gscSite.slice("sc-domain:".length).trim().toLowerCase();
    return (
      domain.length > 0 &&
      (target.hostname === domain || target.hostname.endsWith(`.${domain}`))
    );
  }
  try {
    return target.href.startsWith(new URL(gscSite).href);
  } catch {
    return false;
  }
}

export function sameApexWwwBoundary(
  candidateUrl: string,
  targetUrl: string,
): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const target = new URL(targetUrl);
    const boundaryHost = (hostname: string) =>
      hostname.toLowerCase().replace(/^www\./u, "");
    return (
      ["http:", "https:"].includes(candidate.protocol) &&
      boundaryHost(candidate.hostname) === boundaryHost(target.hostname) &&
      (candidate.hostname === target.hostname ||
        candidate.hostname === `www.${boundaryHost(target.hostname)}` ||
        target.hostname === `www.${boundaryHost(candidate.hostname)}`)
    );
  } catch {
    return false;
  }
}
