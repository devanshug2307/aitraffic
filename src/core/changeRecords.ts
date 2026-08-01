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

import { PROJECT_DIRECTORY } from "./project.js";
import { AppError } from "./result.js";
import { SCHEMA_VERSION } from "./version.js";

const CHANGES_DIRECTORY = "changes";
const CHANGES_FILE = "records.json";
const LOCK_FILE = ".changes.lock";
const MAX_STORE_BYTES = 20 * 1024 * 1024;
const CHANGE_ID_PATTERN = /^change_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const OPPORTUNITY_ID_PATTERN = /^opp_[0-9a-f]{24}$/u;
const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/u;

export const CHANGE_TYPES = [
  "metadata",
  "content",
  "internal-links",
  "structured-data",
  "technical",
  "measurement",
  "other",
] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];

export interface ChangeRecord {
  id: string;
  recordedAt: string;
  opportunityId: string;
  opportunityTitle: string;
  site: string;
  urls: string[];
  type: ChangeType;
  gitCommit: string | null;
  deploymentRef: string | null;
  beforeContentHash: string | null;
  afterContentHash: string | null;
  note: string | null;
  concurrentChanges: string[];
}

export interface ChangeRecordStore {
  storeVersion: typeof SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  records: ChangeRecord[];
}

export interface CreateChangeRecordInput {
  opportunityId: string;
  opportunityTitle: string;
  site: string;
  urls: string[];
  type: ChangeType;
  gitCommit?: string;
  deploymentRef?: string;
  beforeContentHash?: string;
  afterContentHash?: string;
  note?: string;
  concurrentChanges?: string[];
}

export interface ChangeRecordSummary {
  id: string;
  recordedAt: string;
  opportunityId: string;
  opportunityTitle: string;
  type: ChangeType;
  urls: string[];
  additionalUrls: number;
  gitCommit: string | null;
  deploymentRef: string | null;
}

function changesDirectory(cwd: string): string {
  return path.join(cwd, PROJECT_DIRECTORY, CHANGES_DIRECTORY);
}

export function changeRecordPath(cwd = process.cwd()): string {
  return path.join(changesDirectory(cwd), CHANGES_FILE);
}

export function relativeChangeRecordPath(): string {
  return path.posix.join(PROJECT_DIRECTORY, CHANGES_DIRECTORY, CHANGES_FILE);
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function emptyStore(now: string): ChangeRecordStore {
  return {
    storeVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    records: [],
  };
}

function assertStore(value: unknown, source: string): asserts value is ChangeRecordStore {
  const candidate = object(value);
  if (
    candidate === null ||
    candidate.storeVersion !== SCHEMA_VERSION ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string" ||
    !Array.isArray(candidate.records) ||
    candidate.records.some((item) => {
      const record = object(item);
      return (
        record === null ||
        typeof record.id !== "string" ||
        !CHANGE_ID_PATTERN.test(record.id) ||
        typeof record.recordedAt !== "string" ||
        typeof record.opportunityId !== "string" ||
        !OPPORTUNITY_ID_PATTERN.test(record.opportunityId) ||
        typeof record.opportunityTitle !== "string" ||
        typeof record.site !== "string" ||
        !Array.isArray(record.urls) ||
        record.urls.some((url) => typeof url !== "string") ||
        !CHANGE_TYPES.includes(record.type as ChangeType) ||
        (typeof record.gitCommit !== "string" && record.gitCommit !== null) ||
        (typeof record.deploymentRef !== "string" && record.deploymentRef !== null) ||
        (typeof record.beforeContentHash !== "string" &&
          record.beforeContentHash !== null) ||
        (typeof record.afterContentHash !== "string" &&
          record.afterContentHash !== null) ||
        (typeof record.beforeContentHash === "string" &&
          !CONTENT_HASH_PATTERN.test(record.beforeContentHash)) ||
        (typeof record.afterContentHash === "string" &&
          !CONTENT_HASH_PATTERN.test(record.afterContentHash)) ||
        (typeof record.note !== "string" && record.note !== null) ||
        !Array.isArray(record.concurrentChanges) ||
        record.concurrentChanges.some((change) => typeof change !== "string")
      );
    })
  ) {
    throw new AppError(
      "INVALID_CHANGE_RECORD_STORE",
      `Change records do not match the ${SCHEMA_VERSION} contract: ${source}`,
    );
  }
}

export async function readChangeRecords(
  cwd = process.cwd(),
  now = new Date(),
): Promise<ChangeRecordStore> {
  const target = changeRecordPath(cwd);
  try {
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new AppError(
        "INVALID_CHANGE_RECORD_STORE",
        `Change records are not a regular file: ${relativeChangeRecordPath()}`,
      );
    }
    if (info.size > MAX_STORE_BYTES) {
      throw new AppError(
        "CHANGE_RECORD_STORE_TOO_LARGE",
        `Change records exceed the ${MAX_STORE_BYTES}-byte local read limit.`,
      );
    }
    const contents = await readFile(target, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents) as unknown;
    } catch {
      throw new AppError(
        "INVALID_CHANGE_RECORD_STORE",
        `Change records are not valid JSON: ${relativeChangeRecordPath()}`,
      );
    }
    assertStore(parsed, relativeChangeRecordPath());
    return parsed;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "ENOENT") {
      return emptyStore(now.toISOString());
    }
    throw error;
  }
}

async function writeChangeRecords(
  store: ChangeRecordStore,
  cwd: string,
): Promise<void> {
  const directory = changesDirectory(cwd);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const contents = `${JSON.stringify(store, null, 2)}\n`;
  if (Buffer.byteLength(contents) > MAX_STORE_BYTES) {
    throw new AppError(
      "CHANGE_RECORD_STORE_TOO_LARGE",
      `Change records exceed the ${MAX_STORE_BYTES}-byte local write limit.`,
    );
  }
  const target = changeRecordPath(cwd);
  const temporary = path.join(directory, `.${CHANGES_FILE}.${randomUUID()}.tmp`);
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

async function withChangeRecordLock<T>(cwd: string, action: () => Promise<T>): Promise<T> {
  const directory = changesDirectory(cwd);
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
        "CHANGE_RECORD_STORE_BUSY",
        "Another change-record write is in progress. Retry after it completes.",
      );
    }
    throw error;
  }
  try {
    return await action();
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

function boundedText(value: string | undefined, label: string, maximum: number): string | null {
  if (value === undefined) {
    return null;
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maximum) {
    throw new AppError(
      "INVALID_CHANGE_RECORD_FIELD",
      `${label} must contain 1 to ${maximum} characters when provided.`,
    );
  }
  return normalized;
}

function validatedUrls(urls: string[]): string[] {
  if (urls.length < 1 || urls.length > 50) {
    throw new AppError(
      "INVALID_CHANGE_URLS",
      "Provide from 1 to 50 affected URLs.",
    );
  }
  const unique = new Set<string>();
  for (const value of urls) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new AppError("INVALID_CHANGE_URL", `Invalid affected URL: ${value}`);
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new AppError("INVALID_CHANGE_URL", `Affected URL must use HTTP(S): ${value}`);
    }
    parsed.hash = "";
    unique.add(parsed.toString());
  }
  return [...unique].sort();
}

function validatedHash(value: string | undefined, label: string): string | null {
  if (value === undefined) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!CONTENT_HASH_PATTERN.test(normalized)) {
    throw new AppError(
      "INVALID_CONTENT_HASH",
      `${label} must be a 64-character SHA-256 hex digest.`,
    );
  }
  return normalized;
}

function summary(record: ChangeRecord): ChangeRecordSummary {
  return {
    id: record.id,
    recordedAt: record.recordedAt,
    opportunityId: record.opportunityId,
    opportunityTitle: record.opportunityTitle,
    type: record.type,
    urls: record.urls.slice(0, 5),
    additionalUrls: Math.max(0, record.urls.length - 5),
    gitCommit: record.gitCommit,
    deploymentRef: record.deploymentRef,
  };
}

function validatedInput(input: CreateChangeRecordInput, now: string): ChangeRecord {
  if (!OPPORTUNITY_ID_PATTERN.test(input.opportunityId)) {
    throw new AppError("INVALID_OPPORTUNITY_ID", "A valid opportunity ID is required.");
  }
  const opportunityTitle = boundedText(input.opportunityTitle, "Opportunity title", 500);
  const site = boundedText(input.site, "Site", 2_048);
  if (opportunityTitle === null || site === null) {
    throw new AppError("INVALID_CHANGE_RECORD_FIELD", "Opportunity title and site are required.");
  }
  try {
    const parsedSite = new URL(site);
    if (!["http:", "https:"].includes(parsedSite.protocol)) {
      throw new Error("non-HTTP site");
    }
  } catch {
    throw new AppError(
      "INVALID_CHANGE_RECORD_FIELD",
      "Site must be a complete HTTP(S) URL.",
    );
  }
  if (!CHANGE_TYPES.includes(input.type)) {
    throw new AppError(
      "INVALID_CHANGE_TYPE",
      `Change type must be one of: ${CHANGE_TYPES.join(", ")}.`,
    );
  }
  const concurrentChanges = [...new Set(
    (input.concurrentChanges ?? []).map((value) =>
      boundedText(value, "Concurrent change", 500),
    ),
  )];
  if (concurrentChanges.includes(null) || concurrentChanges.length > 50) {
    throw new AppError(
      "INVALID_CONCURRENT_CHANGES",
      "Provide from 1 to 50 characters for each concurrent change, with at most 50 entries.",
    );
  }
  return {
    id: `change_${randomUUID()}`,
    recordedAt: now,
    opportunityId: input.opportunityId,
    opportunityTitle,
    site,
    urls: validatedUrls(input.urls),
    type: input.type,
    gitCommit: boundedText(input.gitCommit, "Git commit", 256),
    deploymentRef: boundedText(input.deploymentRef, "Deployment reference", 500),
    beforeContentHash: validatedHash(input.beforeContentHash, "Before content hash"),
    afterContentHash: validatedHash(input.afterContentHash, "After content hash"),
    note: boundedText(input.note, "Note", 2_000),
    concurrentChanges: concurrentChanges as string[],
  };
}

export async function createChangeRecord(
  input: CreateChangeRecordInput,
  options: { cwd?: string; dryRun?: boolean; now?: Date } = {},
): Promise<{ dryRun: boolean; saved: boolean; storagePath: string; record: ChangeRecordSummary }> {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = options.dryRun === true;
  const now = (options.now ?? new Date()).toISOString();
  const perform = async () => {
    const store = await readChangeRecords(cwd, new Date(now));
    const record = validatedInput(input, now);
    if (!dryRun) {
      store.records.push(record);
      store.updatedAt = now;
      await writeChangeRecords(store, cwd);
    }
    return {
      dryRun,
      saved: !dryRun,
      storagePath: relativeChangeRecordPath(),
      record: summary(record),
    };
  };
  return dryRun ? perform() : withChangeRecordLock(cwd, perform);
}

export async function listChangeRecords(
  options: { cwd?: string; opportunityId?: string; url?: string; limit?: number } = {},
): Promise<{ storagePath: string; totalStored: number; records: ChangeRecordSummary[] }> {
  const limit = options.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError("INVALID_CHANGE_RECORD_LIMIT", "Change record list limit must be an integer from 1 to 100.");
  }
  const store = await readChangeRecords(options.cwd);
  const url = options.url === undefined ? undefined : validatedUrls([options.url])[0];
  return {
    storagePath: relativeChangeRecordPath(),
    totalStored: store.records.length,
    records: store.records
      .filter((record) =>
        (options.opportunityId === undefined || record.opportunityId === options.opportunityId) &&
        (url === undefined || record.urls.includes(url)),
      )
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || right.id.localeCompare(left.id))
      .slice(0, limit)
      .map(summary),
  };
}

export async function showChangeRecord(
  changeId: string,
  cwd = process.cwd(),
): Promise<{ storagePath: string; record: ChangeRecord }> {
  if (!CHANGE_ID_PATTERN.test(changeId)) {
    throw new AppError("INVALID_CHANGE_RECORD_ID", `Invalid change record ID: ${changeId}`);
  }
  const store = await readChangeRecords(cwd);
  const record = store.records.find(({ id }) => id === changeId);
  if (record === undefined) {
    throw new AppError(
      "CHANGE_RECORD_NOT_FOUND",
      `Change record was not found: ${changeId}. Run aitraffic changes list.`,
    );
  }
  return { storagePath: relativeChangeRecordPath(), record };
}
