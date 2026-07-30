import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import type { OpportunityQueueStore } from "./opportunityQueue.js";
import { PROJECT_DIRECTORY } from "./project.js";
import { AppError } from "./result.js";
import { SCHEMA_VERSION } from "./version.js";

const QUEUE_DIRECTORY = "opportunities";
const QUEUE_FILE = "queue.json";
const LOCK_FILE = ".queue.lock";
const MAX_QUEUE_BYTES = 20 * 1024 * 1024;
const OPPORTUNITY_ID_PATTERN = /^opp_[0-9a-f]{24}$/u;

function queueDirectory(cwd: string): string {
  return path.join(cwd, PROJECT_DIRECTORY, QUEUE_DIRECTORY);
}

export function opportunityQueuePath(cwd = process.cwd()): string {
  return path.join(queueDirectory(cwd), QUEUE_FILE);
}

export function relativeOpportunityQueuePath(): string {
  return path.posix.join(
    PROJECT_DIRECTORY,
    QUEUE_DIRECTORY,
    QUEUE_FILE,
  );
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function newStore(now: string): OpportunityQueueStore {
  return {
    storeVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    siteSyncs: {},
    opportunities: [],
  };
}

function assertQueueStore(
  value: unknown,
  source: string,
): asserts value is OpportunityQueueStore {
  const item = record(value);
  const syncs = record(item?.siteSyncs);
  if (
    item === null ||
    item.storeVersion !== SCHEMA_VERSION ||
    typeof item.createdAt !== "string" ||
    typeof item.updatedAt !== "string" ||
    syncs === null ||
    Object.values(syncs).some((sync) => {
      const candidate = record(sync);
      return (
        candidate === null ||
        typeof candidate.site !== "string" ||
        typeof candidate.latestRunId !== "string" ||
        typeof candidate.completedAt !== "string" ||
        typeof candidate.syncedAt !== "string"
      );
    }) ||
    !Array.isArray(item.opportunities) ||
    item.opportunities.some((opportunity) => {
      const candidate = record(opportunity);
      const scope = record(candidate?.scope);
      const impact = record(candidate?.impact);
      const confidence = record(candidate?.confidence);
      const effort = record(candidate?.effort);
      const evidence = record(candidate?.evidence);
      const generator = record(candidate?.generator);
      return (
        candidate === null ||
        typeof candidate.id !== "string" ||
        !OPPORTUNITY_ID_PATTERN.test(candidate.id) ||
        typeof candidate.stableKey !== "string" ||
        typeof candidate.comparisonKey !== "string" ||
        typeof candidate.site !== "string" ||
        !["technical", "google-opportunity"].includes(
          String(candidate.source),
        ) ||
        !["open", "planned", "dismissed", "verified"].includes(
          String(candidate.status),
        ) ||
        !["present", "not_observed", "unknown"].includes(
          String(candidate.observationState),
        ) ||
        !["critical", "high", "medium", "low", "info"].includes(
          String(candidate.priority),
        ) ||
        typeof candidate.kind !== "string" ||
        generator === null ||
        ![
          "technical-finding-queue",
          "google-opportunity-queue",
        ].includes(String(generator.id)) ||
        generator.version !== "1.0.0" ||
        typeof generator.sourceRule !== "string" ||
        typeof candidate.title !== "string" ||
        typeof candidate.summary !== "string" ||
        scope === null ||
        !Array.isArray(scope.urls) ||
        scope.urls.some((url) => typeof url !== "string") ||
        (typeof scope.query !== "string" && scope.query !== null) ||
        impact === null ||
        typeof impact.basis !== "string" ||
        confidence === null ||
        !["high", "medium"].includes(String(confidence.label)) ||
        typeof confidence.basis !== "string" ||
        effort === null ||
        effort.label !== "unknown" ||
        typeof effort.basis !== "string" ||
        evidence === null ||
        typeof evidence.firstSeenAt !== "string" ||
        typeof evidence.lastSeenAt !== "string" ||
        typeof evidence.latestRunId !== "string" ||
        typeof evidence.latestFindingId !== "string" ||
        !Array.isArray(evidence.evidenceRefs) ||
        !Number.isInteger(evidence.occurrences) ||
        (evidence.occurrences as number) < 1 ||
        typeof evidence.latestCoverageComplete !== "boolean" ||
        !Array.isArray(candidate.history)
      );
    })
  ) {
    throw new AppError(
      "INVALID_OPPORTUNITY_QUEUE",
      `Opportunity queue does not match the ${SCHEMA_VERSION} contract: ${source}`,
    );
  }
}

export async function readOpportunityQueue(
  cwd = process.cwd(),
  now = new Date(),
): Promise<OpportunityQueueStore> {
  const target = opportunityQueuePath(cwd);
  try {
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new AppError(
        "INVALID_OPPORTUNITY_QUEUE",
        `Opportunity queue is not a regular file: ${relativeOpportunityQueuePath()}`,
      );
    }
    if (info.size > MAX_QUEUE_BYTES) {
      throw new AppError(
        "OPPORTUNITY_QUEUE_TOO_LARGE",
        `Opportunity queue exceeds the ${MAX_QUEUE_BYTES}-byte local read limit.`,
      );
    }
    const contents = await readFile(target, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      throw new AppError(
        "INVALID_OPPORTUNITY_QUEUE",
        `Opportunity queue is not valid JSON: ${relativeOpportunityQueuePath()}`,
      );
    }
    assertQueueStore(parsed, relativeOpportunityQueuePath());
    return parsed;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "ENOENT") {
      return newStore(now.toISOString());
    }
    throw error;
  }
}

export async function writeOpportunityQueue(
  store: OpportunityQueueStore,
  cwd: string,
): Promise<void> {
  const directory = queueDirectory(cwd);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const target = opportunityQueuePath(cwd);
  const temporary = path.join(
    directory,
    `.${QUEUE_FILE}.${randomUUID()}.tmp`,
  );
  const contents = `${JSON.stringify(store, null, 2)}\n`;
  if (Buffer.byteLength(contents) > MAX_QUEUE_BYTES) {
    throw new AppError(
      "OPPORTUNITY_QUEUE_TOO_LARGE",
      `Opportunity queue exceeds the ${MAX_QUEUE_BYTES}-byte local write limit. Export or prune history before adding more records.`,
    );
  }
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, target);
    await chmod(target, 0o600);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

export async function withOpportunityQueueLock<T>(
  cwd: string,
  action: () => Promise<T>,
): Promise<T> {
  const directory = queueDirectory(cwd);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const lockPath = path.join(directory, LOCK_FILE);
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "EEXIST") {
      throw new AppError(
        "OPPORTUNITY_QUEUE_BUSY",
        "Another opportunity queue write is in progress. Retry after it completes.",
      );
    }
    throw error;
  }
  try {
    await lock.writeFile(
      `${JSON.stringify({
        pid: process.pid,
        createdAt: new Date().toISOString(),
      })}\n`,
      "utf8",
    );
    return await action();
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => undefined);
  }
}
