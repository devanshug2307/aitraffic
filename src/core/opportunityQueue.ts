import { createHash } from "node:crypto";

import {
  compareAuditRuns,
  getGoogleFindingSnapshots,
  getTechnicalFindingSnapshots,
  type GoogleFindingSnapshot,
  type TechnicalFindingSnapshot,
} from "../analysis/auditComparison.js";
import type { FullAuditEnvelope } from "../capabilities/run.js";
import { readAuditRun } from "./auditRuns.js";
import {
  opportunityQueuePath,
  readOpportunityQueue,
  relativeOpportunityQueuePath,
  withOpportunityQueueLock,
  writeOpportunityQueue,
} from "./opportunityStore.js";
import { AppError } from "./result.js";
import { SCHEMA_VERSION } from "./version.js";

const MAX_HISTORY_PER_OPPORTUNITY = 100;
const OPPORTUNITY_ID_PATTERN = /^opp_[0-9a-f]{24}$/u;

export {
  opportunityQueuePath,
  readOpportunityQueue,
} from "./opportunityStore.js";

export type OpportunityQueueStatus =
  | "open"
  | "planned"
  | "dismissed"
  | "verified";

export type OpportunityObservationState =
  | "present"
  | "not_observed"
  | "unknown";

export type OpportunityQueueSource =
  | "technical"
  | "google-opportunity";

export type OpportunityQueuePriority =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export interface OpportunityHistoryEvent {
  at: string;
  event:
    | "created"
    | "observed"
    | "reopened"
    | "verified"
    | "observation_unknown"
    | "not_observed"
    | "status_changed"
    | "status_updated";
  auditRunId: string | null;
  fromStatus: OpportunityQueueStatus | null;
  toStatus: OpportunityQueueStatus | null;
  reason: string;
}

export interface QueuedOpportunity {
  id: string;
  stableKey: string;
  comparisonKey: string;
  site: string;
  source: OpportunityQueueSource;
  kind: string;
  ruleId: string | null;
  generator: {
    id: "technical-finding-queue" | "google-opportunity-queue";
    version: "1.0.0";
    sourceRule: string;
  };
  title: string;
  summary: string;
  priority: OpportunityQueuePriority;
  scope: {
    urls: string[];
    query: string | null;
  };
  impact: {
    basis: string;
  };
  confidence: {
    label: "high" | "medium";
    basis: string;
  };
  effort: {
    label: "unknown";
    basis: string;
  };
  suggestedAction: {
    action: string;
    approvalRequired: true;
    verificationCommand: string | null;
  } | null;
  limitations: string[];
  status: OpportunityQueueStatus;
  statusReason: string | null;
  observationState: OpportunityObservationState;
  evidence: {
    firstSeenAt: string;
    lastSeenAt: string;
    latestRunId: string;
    latestFindingId: string;
    evidenceRefs: string[];
    occurrences: number;
    latestCoverageComplete: boolean;
  };
  verification: {
    olderRunId: string;
    newerRunId: string;
    verifiedAt: string;
    basis: string;
  } | null;
  history: OpportunityHistoryEvent[];
}

export interface OpportunitySiteSync {
  site: string;
  latestRunId: string;
  completedAt: string;
  syncedAt: string;
}

export interface OpportunityQueueStore {
  storeVersion: typeof SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  siteSyncs: Record<string, OpportunitySiteSync>;
  opportunities: QueuedOpportunity[];
}

export interface OpportunityQueueSummary {
  stored: number;
  matching: number;
  returned: number;
  byStatus: Record<OpportunityQueueStatus, number>;
  byObservationState: Record<OpportunityObservationState, number>;
}

export interface OpportunityListItem {
  id: string;
  site: string;
  source: OpportunityQueueSource;
  kind: string;
  title: string;
  priority: OpportunityQueuePriority;
  status: OpportunityQueueStatus;
  observationState: OpportunityObservationState;
  urls: string[];
  additionalUrls: number;
  query: string | null;
  occurrences: number;
  lastSeenAt: string;
  latestRunId: string;
  impactBasis: string;
  confidence: QueuedOpportunity["confidence"];
}

export interface OpportunityQueueFilters {
  status?: "active" | OpportunityQueueStatus | "all";
  observation?: OpportunityObservationState | "all";
  source?: OpportunityQueueSource;
  priority?: OpportunityQueuePriority;
  site?: string;
  limit?: number;
}

export interface OpportunitySyncResult {
  dryRun: boolean;
  saved: boolean;
  sourceRunId: string;
  site: string;
  previousSiteRunId: string | null;
  storagePath: string;
  changes: {
    created: number;
    updated: number;
    reopened: number;
    verified: number;
    notObserved: number;
    unknown: number;
    unchanged: number;
  };
  totalStored: number;
  affected: OpportunityListItem[];
}

export interface OpportunityStatusUpdateResult {
  dryRun: boolean;
  saved: boolean;
  changed: boolean;
  opportunity: OpportunityListItem;
  previousStatus: OpportunityQueueStatus;
  requestedStatus: Exclude<OpportunityQueueStatus, "verified">;
  reason: string;
}

interface DerivedOpportunity {
  id: string;
  stableKey: string;
  comparisonKey: string;
  site: string;
  source: OpportunityQueueSource;
  kind: string;
  ruleId: string | null;
  generator: QueuedOpportunity["generator"];
  title: string;
  summary: string;
  priority: OpportunityQueuePriority;
  scope: QueuedOpportunity["scope"];
  impact: QueuedOpportunity["impact"];
  confidence: QueuedOpportunity["confidence"];
  effort: QueuedOpportunity["effort"];
  suggestedAction: QueuedOpportunity["suggestedAction"];
  limitations: string[];
  findingId: string;
  evidenceRefs: string[];
}

interface QueueMutation {
  store: OpportunityQueueStore;
  result: OpportunitySyncResult;
  warnings: string[];
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function normalizedSite(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim().toLowerCase();
  }
}

function siteKey(value: string): string {
  return createHash("sha256")
    .update(normalizedSite(value))
    .digest("hex")
    .slice(0, 24);
}

function stableOpportunityId(
  site: string,
  source: OpportunityQueueSource,
  comparisonKey: string,
): string {
  return `opp_${createHash("sha256")
    .update(
      ["opportunity-v1", normalizedSite(site), source, comparisonKey].join(
        "\u0000",
      ),
    )
    .digest("hex")
    .slice(0, 24)}`;
}

function isCoverageComplete(audit: FullAuditEnvelope): boolean {
  const coverage = audit.result.technical.coverage;
  return !coverage.partial && !coverage.truncated;
}

function appendHistory(
  opportunity: QueuedOpportunity,
  event: OpportunityHistoryEvent,
): void {
  opportunity.history = [...opportunity.history, event].slice(
    -MAX_HISTORY_PER_OPPORTUNITY,
  );
}

function recommendationFor(
  audit: FullAuditEnvelope,
  findingId: string,
): QueuedOpportunity["suggestedAction"] {
  const item = audit.recommendations.find(({ findingRefs }) =>
    findingRefs.includes(findingId),
  );
  if (item === undefined) {
    return null;
  }
  const candidate = record(item);
  const verification = record(candidate?.verification);
  return {
    action:
      typeof candidate?.action === "string"
        ? candidate.action
        : "Review the cited evidence and prepare the smallest safe correction.",
    approvalRequired: true,
    verificationCommand:
      typeof verification?.command === "string"
        ? verification.command
        : null,
  };
}

function priorityDetails(
  audit: FullAuditEnvelope,
  findingId: string,
): {
  impact: QueuedOpportunity["impact"];
  confidence: QueuedOpportunity["confidence"];
  effort: QueuedOpportunity["effort"];
} | null {
  const item = audit.result.prioritization.findings.find(
    (finding) => finding.findingId === findingId,
  );
  if (item === undefined) {
    return null;
  }
  return {
    impact: { basis: item.impactBasis },
    confidence: item.confidence,
    effort: item.effort,
  };
}

function findingById(
  audit: FullAuditEnvelope,
  findingId: string,
): FullAuditEnvelope["findings"][number] | undefined {
  return audit.findings.find(({ id }) => id === findingId);
}

function technicalOpportunity(
  audit: FullAuditEnvelope,
  item: TechnicalFindingSnapshot,
): DerivedOpportunity {
  const prioritized = priorityDetails(audit, item.findingId);
  const finding = findingById(audit, item.findingId);
  return {
    id: stableOpportunityId(
      audit.subject.url as string,
      "technical",
      item.key,
    ),
    stableKey: `technical:${item.key}`,
    comparisonKey: item.key,
    site: audit.subject.url as string,
    source: "technical",
    kind: item.ruleId,
    ruleId: item.ruleId,
    generator: {
      id: "technical-finding-queue",
      version: "1.0.0",
      sourceRule: item.ruleId,
    },
    title: item.title,
    summary: item.explanation,
    priority: item.severity,
    scope: {
      urls: item.urls,
      query: null,
    },
    impact:
      prioritized?.impact ?? {
        basis: `Deterministic technical severity: ${item.severity}; rule: ${item.ruleId}.`,
      },
    confidence:
      prioritized?.confidence ?? {
        label: "high",
        basis:
          "Deterministic rule over observed static evidence; business and ranking impact remains contextual.",
      },
    effort:
      prioritized?.effort ?? {
        label: "unknown",
        basis: "Repository or CMS implementation was not inspected.",
      },
    suggestedAction: recommendationFor(audit, item.findingId),
    limitations:
      finding !== undefined &&
      "limitations" in finding &&
      Array.isArray(finding.limitations)
        ? finding.limitations
        : [],
    findingId: item.findingId,
    evidenceRefs:
      finding === undefined ? [] : [...finding.evidenceRefs],
  };
}

function googleOpportunity(
  audit: FullAuditEnvelope,
  item: GoogleFindingSnapshot,
): DerivedOpportunity {
  const prioritized = priorityDetails(audit, item.findingId);
  const finding = findingById(audit, item.findingId);
  const reason =
    finding !== undefined && "reason" in finding
      ? finding.reason
      : `Observed Google opportunity for ${item.query}.`;
  return {
    id: stableOpportunityId(
      audit.subject.url as string,
      "google-opportunity",
      item.key,
    ),
    stableKey: `google-opportunity:${item.key}`,
    comparisonKey: item.key,
    site: audit.subject.url as string,
    source: "google-opportunity",
    kind: item.kind,
    ruleId: null,
    generator: {
      id: "google-opportunity-queue",
      version: "1.0.0",
      sourceRule: item.kind,
    },
    title:
      item.kind === "cannibalization"
        ? `Search overlap candidate: ${item.query}`
        : `Existing-demand opportunity: ${item.query}`,
    summary: reason,
    priority: item.priority,
    scope: {
      urls: [
        ...new Set([
          ...(item.page === null ? [] : [item.page]),
          ...item.competingPages,
        ]),
      ],
      query: item.query,
    },
    impact:
      prioritized?.impact ?? {
        basis: `${item.metrics.impressions} observed Search Console impressions and ${item.metrics.clicks} clicks in the selected period.`,
      },
    confidence:
      prioritized?.confidence ?? {
        label: "medium",
        basis:
          "Derived from aggregate GSC/GA4 evidence with source coverage and attribution limitations.",
      },
    effort:
      prioritized?.effort ?? {
        label: "unknown",
        basis: "Repository or CMS implementation was not inspected.",
      },
    suggestedAction: recommendationFor(audit, item.findingId),
    limitations: [
      "Search Console can omit anonymized or low-volume rows.",
      "Opportunity movement is aggregate associative evidence, not a causal claim.",
    ],
    findingId: item.findingId,
    evidenceRefs:
      finding === undefined ? [] : [...finding.evidenceRefs],
  };
}

function deriveOpportunities(
  audit: FullAuditEnvelope,
): DerivedOpportunity[] {
  if (audit.subject.url === null) {
    throw new AppError(
      "AUDIT_SITE_MISSING",
      "The saved audit does not include a site URL.",
    );
  }
  return [
    ...getTechnicalFindingSnapshots(audit).map((item) =>
      technicalOpportunity(audit, item),
    ),
    ...getGoogleFindingSnapshots(audit).map((item) =>
      googleOpportunity(audit, item),
    ),
  ];
}

function listItem(opportunity: QueuedOpportunity): OpportunityListItem {
  return {
    id: opportunity.id,
    site: opportunity.site,
    source: opportunity.source,
    kind: opportunity.kind,
    title: opportunity.title,
    priority: opportunity.priority,
    status: opportunity.status,
    observationState: opportunity.observationState,
    urls: opportunity.scope.urls.slice(0, 5),
    additionalUrls: Math.max(0, opportunity.scope.urls.length - 5),
    query: opportunity.scope.query,
    occurrences: opportunity.evidence.occurrences,
    lastSeenAt: opportunity.evidence.lastSeenAt,
    latestRunId: opportunity.evidence.latestRunId,
    impactBasis: opportunity.impact.basis,
    confidence: opportunity.confidence,
  };
}

function priorityRank(priority: OpportunityQueuePriority): number {
  return {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  }[priority];
}

function statusRank(status: OpportunityQueueStatus): number {
  return { open: 0, planned: 1, verified: 2, dismissed: 3 }[status];
}

function observationRank(state: OpportunityObservationState): number {
  return { present: 0, unknown: 1, not_observed: 2 }[state];
}

function emptyCounts<T extends string>(
  values: readonly T[],
): Record<T, number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<
    T,
    number
  >;
}

export async function listQueuedOpportunities(
  filters: OpportunityQueueFilters = {},
  cwd = process.cwd(),
): Promise<{
  summary: OpportunityQueueSummary;
  opportunities: OpportunityListItem[];
  filters: Required<
    Pick<OpportunityQueueFilters, "status" | "observation" | "limit">
  > &
    Omit<OpportunityQueueFilters, "status" | "observation" | "limit">;
  nextCommand: string | null;
}> {
  const status = filters.status ?? "active";
  const observation = filters.observation ?? "present";
  const limit = filters.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError(
      "INVALID_OPPORTUNITY_LIMIT",
      "Opportunity list limit must be an integer from 1 to 100.",
    );
  }
  const store = await readOpportunityQueue(cwd);
  const byStatus = emptyCounts([
    "open",
    "planned",
    "dismissed",
    "verified",
  ] as const);
  const byObservationState = emptyCounts([
    "present",
    "not_observed",
    "unknown",
  ] as const);
  for (const item of store.opportunities) {
    byStatus[item.status] += 1;
    byObservationState[item.observationState] += 1;
  }
  const normalizedFilterSite =
    filters.site === undefined ? null : normalizedSite(filters.site);
  const matching = store.opportunities.filter((item) => {
    const statusMatches =
      status === "all" ||
      (status === "active"
        ? item.status === "open" || item.status === "planned"
        : item.status === status);
    return (
      statusMatches &&
      (observation === "all" ||
        item.observationState === observation) &&
      (filters.source === undefined || item.source === filters.source) &&
      (filters.priority === undefined ||
        item.priority === filters.priority) &&
      (normalizedFilterSite === null ||
        normalizedSite(item.site) === normalizedFilterSite)
    );
  });
  matching.sort(
    (left, right) =>
      observationRank(left.observationState) -
        observationRank(right.observationState) ||
      statusRank(left.status) - statusRank(right.status) ||
      priorityRank(left.priority) - priorityRank(right.priority) ||
      right.evidence.lastSeenAt.localeCompare(left.evidence.lastSeenAt) ||
      left.id.localeCompare(right.id),
  );
  const opportunities = matching.slice(0, limit).map(listItem);
  return {
    summary: {
      stored: store.opportunities.length,
      matching: matching.length,
      returned: opportunities.length,
      byStatus,
      byObservationState,
    },
    opportunities,
    filters: {
      status,
      observation,
      limit,
      ...(filters.source === undefined ? {} : { source: filters.source }),
      ...(filters.priority === undefined
        ? {}
        : { priority: filters.priority }),
      ...(filters.site === undefined ? {} : { site: filters.site }),
    },
    nextCommand:
      store.opportunities.length === 0
        ? "aitraffic audit <URL> --save --format json && aitraffic opportunities sync --latest --dry-run --format json"
        : matching.length === 0
          ? "aitraffic opportunities list --status all --observation all --format json"
          : null,
  };
}

export async function explainQueuedOpportunity(
  opportunityId: string,
  cwd = process.cwd(),
): Promise<{
  opportunity: QueuedOpportunity;
  commands: {
    latestAudit: string;
    plan: string;
    dismiss: string;
  };
}> {
  if (!OPPORTUNITY_ID_PATTERN.test(opportunityId)) {
    throw new AppError(
      "INVALID_OPPORTUNITY_ID",
      `Invalid opportunity ID: ${opportunityId}`,
    );
  }
  const store = await readOpportunityQueue(cwd);
  const opportunity = store.opportunities.find(
    ({ id }) => id === opportunityId,
  );
  if (opportunity === undefined) {
    throw new AppError(
      "OPPORTUNITY_NOT_FOUND",
      `Opportunity was not found: ${opportunityId}. Run aitraffic opportunities list --status all --observation all.`,
    );
  }
  return {
    opportunity,
    commands: {
      latestAudit: `aitraffic audit show ${opportunity.evidence.latestRunId} --format json`,
      plan: `aitraffic opportunities update ${opportunity.id} --status planned --reason "REASON" --dry-run --format json`,
      dismiss: `aitraffic opportunities update ${opportunity.id} --status dismissed --reason "REASON" --dry-run --format json`,
    },
  };
}

function createdOpportunity(
  item: DerivedOpportunity,
  audit: FullAuditEnvelope,
  now: string,
): QueuedOpportunity {
  const { findingId, evidenceRefs, ...record } = item;
  return {
    ...record,
    status: "open",
    statusReason: null,
    observationState: "present",
    evidence: {
      firstSeenAt: audit.run.completedAt,
      lastSeenAt: audit.run.completedAt,
      latestRunId: audit.run.id,
      latestFindingId: findingId,
      evidenceRefs,
      occurrences: 1,
      latestCoverageComplete: isCoverageComplete(audit),
    },
    verification: null,
    history: [
      {
        at: now,
        event: "created",
        auditRunId: audit.run.id,
        fromStatus: null,
        toStatus: "open",
        reason: "First observed in a synced full audit.",
      },
    ],
  };
}

function updatePresentOpportunity(
  existing: QueuedOpportunity,
  item: DerivedOpportunity,
  audit: FullAuditEnvelope,
  now: string,
): { reopened: boolean } {
  const previousObservationState = existing.observationState;
  const previousStatus = existing.status;
  Object.assign(existing, {
    stableKey: item.stableKey,
    comparisonKey: item.comparisonKey,
    site: item.site,
    source: item.source,
    kind: item.kind,
    ruleId: item.ruleId,
    generator: item.generator,
    title: item.title,
    summary: item.summary,
    priority: item.priority,
    scope: item.scope,
    impact: item.impact,
    confidence: item.confidence,
    effort: item.effort,
    suggestedAction: item.suggestedAction,
    limitations: item.limitations,
    observationState: "present" as const,
    verification: null,
  });
  existing.evidence = {
    ...existing.evidence,
    lastSeenAt: audit.run.completedAt,
    latestRunId: audit.run.id,
    latestFindingId: item.findingId,
    evidenceRefs: item.evidenceRefs,
    occurrences: existing.evidence.occurrences + 1,
    latestCoverageComplete: isCoverageComplete(audit),
  };
  let reopened = false;
  if (previousStatus === "verified") {
    existing.status = "open";
    existing.statusReason = null;
    reopened = true;
    appendHistory(existing, {
      at: now,
      event: "reopened",
      auditRunId: audit.run.id,
      fromStatus: "verified",
      toStatus: "open",
      reason: "The finding was observed again in a later audit.",
    });
  } else {
    appendHistory(existing, {
      at: now,
      event: "observed",
      auditRunId: audit.run.id,
      fromStatus: previousStatus,
      toStatus: existing.status,
      reason:
        previousObservationState === "present"
          ? "Observed again in a later audit."
          : `Observed again after evidence state ${previousObservationState}.`,
    });
  }
  return { reopened };
}

async function comparisonFor(
  opportunity: QueuedOpportunity,
  audit: FullAuditEnvelope,
  cwd: string,
  cache: Map<string, ReturnType<typeof compareAuditRuns> | null>,
): Promise<ReturnType<typeof compareAuditRuns> | null> {
  const runId = opportunity.evidence.latestRunId;
  if (cache.has(runId)) {
    return cache.get(runId) ?? null;
  }
  try {
    const older = await readAuditRun(runId, cwd);
    const comparison = compareAuditRuns(older.stored.audit, audit);
    cache.set(runId, comparison);
    return comparison;
  } catch {
    cache.set(runId, null);
    return null;
  }
}

async function mutateQueueForAudit(
  store: OpportunityQueueStore,
  audit: FullAuditEnvelope,
  cwd: string,
  now: string,
  dryRun: boolean,
): Promise<QueueMutation> {
  if (audit.subject.url === null) {
    throw new AppError(
      "AUDIT_SITE_MISSING",
      "The saved audit does not include a site URL.",
    );
  }
  const key = siteKey(audit.subject.url);
  const previousSync = store.siteSyncs[key];
  if (previousSync?.latestRunId === audit.run.id) {
    return {
      store,
      result: {
        dryRun,
        saved: false,
        sourceRunId: audit.run.id,
        site: audit.subject.url,
        previousSiteRunId: previousSync.latestRunId,
        storagePath: relativeOpportunityQueuePath(),
        changes: {
          created: 0,
          updated: 0,
          reopened: 0,
          verified: 0,
          notObserved: 0,
          unknown: 0,
          unchanged: store.opportunities.length,
        },
        totalStored: store.opportunities.length,
        affected: [],
      },
      warnings: ["This audit run was already synced; no queue state changed."],
    };
  }
  if (
    previousSync !== undefined &&
    previousSync.completedAt > audit.run.completedAt
  ) {
    throw new AppError(
      "OPPORTUNITY_SYNC_OUT_OF_ORDER",
      `Audit ${audit.run.id} completed before the latest synced audit ${previousSync.latestRunId}. Sync runs in chronological order.`,
    );
  }

  const derived = deriveOpportunities(audit);
  const currentById = new Map(derived.map((item) => [item.id, item]));
  const existingById = new Map(
    store.opportunities.map((item) => [item.id, item]),
  );
  const changes: OpportunitySyncResult["changes"] = {
    created: 0,
    updated: 0,
    reopened: 0,
    verified: 0,
    notObserved: 0,
    unknown: 0,
    unchanged: 0,
  };
  const affectedIds = new Set<string>();
  const warnings: string[] = [];

  for (const item of derived) {
    const existing = existingById.get(item.id);
    if (existing === undefined) {
      const created = createdOpportunity(item, audit, now);
      store.opportunities.push(created);
      existingById.set(created.id, created);
      changes.created += 1;
      affectedIds.add(created.id);
      continue;
    }
    const { reopened } = updatePresentOpportunity(
      existing,
      item,
      audit,
      now,
    );
    changes.updated += 1;
    if (reopened) {
      changes.reopened += 1;
    }
    affectedIds.add(existing.id);
  }

  const comparisonCache = new Map<
    string,
    ReturnType<typeof compareAuditRuns> | null
  >();
  for (const opportunity of store.opportunities) {
    if (
      normalizedSite(opportunity.site) !==
        normalizedSite(audit.subject.url) ||
      currentById.has(opportunity.id)
    ) {
      continue;
    }
    const comparison = await comparisonFor(
      opportunity,
      audit,
      cwd,
      comparisonCache,
    );
    if (comparison === null) {
      opportunity.observationState = "unknown";
      appendHistory(opportunity, {
        at: now,
        event: "observation_unknown",
        auditRunId: audit.run.id,
        fromStatus: opportunity.status,
        toStatus: opportunity.status,
        reason:
          "The prior evidence run could not be loaded for a comparable evaluation.",
      });
      changes.unknown += 1;
      affectedIds.add(opportunity.id);
      continue;
    }
    if (opportunity.source === "technical") {
      const resolved =
        comparison.technicalFindings.resolved.some(
          ({ key: comparisonKey }) =>
            comparisonKey === opportunity.comparisonKey,
        );
      if (resolved) {
        if (
          opportunity.observationState === "not_observed" &&
          opportunity.verification !== null &&
          (opportunity.status === "verified" ||
            opportunity.status === "dismissed")
        ) {
          changes.unchanged += 1;
          continue;
        }
        const previousStatus = opportunity.status;
        opportunity.observationState = "not_observed";
        opportunity.verification = {
          olderRunId: comparison.older.runId,
          newerRunId: comparison.newer.runId,
          verifiedAt: now,
          basis:
            "The deterministic finding was absent when the same page or complete comparable site scope was observed.",
        };
        if (opportunity.status !== "dismissed") {
          opportunity.status = "verified";
          opportunity.statusReason =
            "Verified by comparable deterministic re-audit.";
        }
        appendHistory(opportunity, {
          at: now,
          event: "verified",
          auditRunId: audit.run.id,
          fromStatus: previousStatus,
          toStatus: opportunity.status,
          reason: opportunity.verification.basis,
        });
        changes.verified += 1;
        affectedIds.add(opportunity.id);
        continue;
      }
      if (opportunity.observationState === "unknown") {
        changes.unchanged += 1;
        continue;
      }
      opportunity.observationState = "unknown";
      appendHistory(opportunity, {
        at: now,
        event: "observation_unknown",
        auditRunId: audit.run.id,
        fromStatus: opportunity.status,
        toStatus: opportunity.status,
        reason:
          comparison.technicalFindings.unknown.find(
            ({ finding }) =>
              finding.key === opportunity.comparisonKey,
          )?.reason ??
          "The newer audit did not provide comparable evidence for this technical finding.",
      });
      changes.unknown += 1;
      affectedIds.add(opportunity.id);
      continue;
    }

    if (!comparison.googleOpportunities.comparable) {
      if (opportunity.observationState === "unknown") {
        changes.unchanged += 1;
        continue;
      }
      opportunity.observationState = "unknown";
      appendHistory(opportunity, {
        at: now,
        event: "observation_unknown",
        auditRunId: audit.run.id,
        fromStatus: opportunity.status,
        toStatus: opportunity.status,
        reason: comparison.googleOpportunities.reasons.join(" "),
      });
      changes.unknown += 1;
      affectedIds.add(opportunity.id);
      continue;
    }
    const noLongerObserved =
      comparison.googleOpportunities.noLongerObserved.some(
        ({ key: comparisonKey }) =>
          comparisonKey === opportunity.comparisonKey,
      );
    if (noLongerObserved) {
      if (opportunity.observationState === "not_observed") {
        changes.unchanged += 1;
        continue;
      }
      opportunity.observationState = "not_observed";
      appendHistory(opportunity, {
        at: now,
        event: "not_observed",
        auditRunId: audit.run.id,
        fromStatus: opportunity.status,
        toStatus: opportunity.status,
        reason:
          "The Google opportunity was not observed in a compatible later period; this is not deterministic verification.",
      });
      changes.notObserved += 1;
      affectedIds.add(opportunity.id);
    } else {
      opportunity.observationState = "unknown";
      changes.unknown += 1;
      affectedIds.add(opportunity.id);
    }
  }

  if (!isCoverageComplete(audit)) {
    warnings.push(
      "The technical crawl was partial or truncated; absent site-level findings were not automatically verified.",
    );
  }
  if (audit.result.google.status !== "included") {
    warnings.push(
      "This audit did not include Google evidence; existing Google opportunities remain unknown unless a compatible comparison is available.",
    );
  }
  store.siteSyncs[key] = {
    site: audit.subject.url,
    latestRunId: audit.run.id,
    completedAt: audit.run.completedAt,
    syncedAt: now,
  };
  store.updatedAt = now;
  const affected = store.opportunities
    .filter(({ id }) => affectedIds.has(id))
    .sort(
      (left, right) =>
        priorityRank(left.priority) - priorityRank(right.priority) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, 20)
    .map(listItem);
  return {
    store,
    result: {
      dryRun,
      saved: !dryRun,
      sourceRunId: audit.run.id,
      site: audit.subject.url,
      previousSiteRunId: previousSync?.latestRunId ?? null,
      storagePath: relativeOpportunityQueuePath(),
      changes,
      totalStored: store.opportunities.length,
      affected,
    },
    warnings,
  };
}

export async function syncOpportunityQueue(
  audit: FullAuditEnvelope,
  options: {
    cwd?: string;
    dryRun?: boolean;
    now?: Date;
  } = {},
): Promise<{ result: OpportunitySyncResult; warnings: string[] }> {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = options.dryRun ?? false;
  const now = (options.now ?? new Date()).toISOString();
  const perform = async () => {
    const store = await readOpportunityQueue(cwd, new Date(now));
    const mutation = await mutateQueueForAudit(
      structuredClone(store),
      audit,
      cwd,
      now,
      dryRun,
    );
    if (!dryRun && mutation.result.saved) {
      await writeOpportunityQueue(mutation.store, cwd);
    }
    return {
      result: mutation.result,
      warnings: mutation.warnings,
    };
  };
  return dryRun ? perform() : withOpportunityQueueLock(cwd, perform);
}

function validatedStatusReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length < 1 || normalized.length > 500) {
    throw new AppError(
      "INVALID_OPPORTUNITY_STATUS_REASON",
      "Opportunity status reason must contain 1 to 500 characters.",
    );
  }
  return normalized;
}

export async function updateOpportunityStatus(
  opportunityId: string,
  status: Exclude<OpportunityQueueStatus, "verified">,
  reason: string,
  options: {
    cwd?: string;
    dryRun?: boolean;
    now?: Date;
  } = {},
): Promise<OpportunityStatusUpdateResult> {
  if (!OPPORTUNITY_ID_PATTERN.test(opportunityId)) {
    throw new AppError(
      "INVALID_OPPORTUNITY_ID",
      `Invalid opportunity ID: ${opportunityId}`,
    );
  }
  if (!["open", "planned", "dismissed"].includes(status)) {
    throw new AppError(
      "INVALID_OPPORTUNITY_STATUS",
      "Opportunity status must be open, planned, or dismissed. Verified is assigned only by comparable technical evidence.",
    );
  }
  const normalizedReason = validatedStatusReason(reason);
  const cwd = options.cwd ?? process.cwd();
  const dryRun = options.dryRun ?? false;
  const now = (options.now ?? new Date()).toISOString();
  const perform = async (): Promise<OpportunityStatusUpdateResult> => {
    const store = await readOpportunityQueue(cwd, new Date(now));
    const opportunity = store.opportunities.find(
      ({ id }) => id === opportunityId,
    );
    if (opportunity === undefined) {
      throw new AppError(
        "OPPORTUNITY_NOT_FOUND",
        `Opportunity was not found: ${opportunityId}.`,
      );
    }
    const previousStatus = opportunity.status;
    const statusChanged = previousStatus !== status;
    const changed =
      statusChanged || opportunity.statusReason !== normalizedReason;
    if (changed) {
      opportunity.status = status;
      opportunity.statusReason = normalizedReason;
      appendHistory(opportunity, {
        at: now,
        event: statusChanged ? "status_changed" : "status_updated",
        auditRunId: null,
        fromStatus: previousStatus,
        toStatus: status,
        reason: normalizedReason,
      });
      store.updatedAt = now;
      if (!dryRun) {
        await writeOpportunityQueue(store, cwd);
      }
    }
    return {
      dryRun,
      saved: changed && !dryRun,
      changed,
      opportunity: listItem(opportunity),
      previousStatus,
      requestedStatus: status,
      reason: normalizedReason,
    };
  };
  return dryRun ? perform() : withOpportunityQueueLock(cwd, perform);
}
