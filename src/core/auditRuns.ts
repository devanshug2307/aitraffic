import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import type { FullAuditEnvelope } from "../capabilities/run.js";
import type { CapabilityArtifact } from "./capabilities.js";
import { PROJECT_DIRECTORY } from "./project.js";
import { AppError } from "./result.js";
import { SCHEMA_VERSION } from "./version.js";

const RUNS_DIRECTORY = "runs";
const MAX_SAVED_AUDIT_BYTES = 50 * 1024 * 1024;
const RUN_ID_PATTERN =
  /^run_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SENSITIVE_KEYS =
  /^(?:access_?token|refresh_?token|client_?secret|authorization|cookie|raw_?html|body)$/iu;

export interface StoredAuditRun {
  storageVersion: typeof SCHEMA_VERSION;
  savedAt: string;
  audit: FullAuditEnvelope;
}

export interface AuditRunDescriptor {
  runId: string;
  savedAt: string;
  completedAt: string;
  site: string | null;
  auditMode: FullAuditEnvelope["result"]["auditMode"];
  path: string;
  sha256: string;
  bytes: number;
}

export interface AuditRunList {
  runs: AuditRunDescriptor[];
  warnings: string[];
}

function runsPath(cwd: string): string {
  return path.join(cwd, PROJECT_DIRECTORY, RUNS_DIRECTORY);
}

function relativeRunPath(runId: string): string {
  return path.posix.join(
    PROJECT_DIRECTORY,
    RUNS_DIRECTORY,
    `${runId}.json`,
  );
}

function checkedRunId(runId: string): string {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new AppError(
      "INVALID_AUDIT_RUN_ID",
      `Invalid audit run ID: ${runId}`,
    );
  }
  return runId;
}

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function assertSnapshotSafe(value: unknown, trail = "audit"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSnapshotSafe(item, `${trail}[${index}]`),
    );
    return;
  }
  if (typeof value !== "object" || value === null) {
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEYS.test(key)) {
      throw new AppError(
        "UNSAFE_AUDIT_SNAPSHOT",
        `Audit snapshots cannot persist sensitive or raw-content field ${trail}.${key}.`,
      );
    }
    assertSnapshotSafe(item, `${trail}.${key}`);
  }
}

function parseStoredAuditRun(contents: string, source: string): StoredAuditRun {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new AppError(
      "INVALID_AUDIT_RUN",
      `Saved audit is not valid JSON: ${source}`,
    );
  }
  const audit =
    typeof value === "object" && value !== null && "audit" in value
      ? value.audit
      : null;
  const run =
    typeof audit === "object" && audit !== null && "run" in audit
      ? audit.run
      : null;
  const subject =
    typeof audit === "object" && audit !== null && "subject" in audit
      ? audit.subject
      : null;
  const result =
    typeof audit === "object" && audit !== null && "result" in audit
      ? audit.result
      : null;
  const technical =
    typeof result === "object" && result !== null && "technical" in result
      ? result.technical
      : null;
  const google =
    typeof result === "object" && result !== null && "google" in result
      ? result.google
      : null;
  if (
    typeof value !== "object" ||
    value === null ||
    !("storageVersion" in value) ||
    value.storageVersion !== SCHEMA_VERSION ||
    !("savedAt" in value) ||
    typeof value.savedAt !== "string" ||
    typeof run !== "object" ||
    run === null ||
    !("id" in run) ||
    typeof run.id !== "string" ||
    !("capabilityId" in run) ||
    run.capabilityId !== "site.full_audit" ||
    !("completedAt" in run) ||
    typeof run.completedAt !== "string" ||
    typeof subject !== "object" ||
    subject === null ||
    !("url" in subject) ||
    (typeof subject.url !== "string" && subject.url !== null) ||
    typeof result !== "object" ||
    result === null ||
    !("auditMode" in result) ||
    !["technical-only", "technical-and-google"].includes(
      String(result.auditMode),
    ) ||
    typeof technical !== "object" ||
    technical === null ||
    !("coverage" in technical) ||
    typeof technical.coverage !== "object" ||
    technical.coverage === null ||
    typeof google !== "object" ||
    google === null ||
    !Array.isArray((audit as { observations?: unknown }).observations) ||
    !Array.isArray((audit as { findings?: unknown }).findings) ||
    !Array.isArray((audit as { recommendations?: unknown }).recommendations) ||
    !Array.isArray((audit as { artifacts?: unknown }).artifacts) ||
    !Array.isArray((audit as { warnings?: unknown }).warnings)
  ) {
    throw new AppError(
      "INVALID_AUDIT_RUN",
      `Saved audit does not match the ${SCHEMA_VERSION} full-audit contract: ${source}`,
    );
  }
  checkedRunId(run.id);
  assertSnapshotSafe(value);
  return value as StoredAuditRun;
}

function descriptor(
  stored: StoredAuditRun,
  contents: string,
): AuditRunDescriptor {
  return {
    runId: stored.audit.run.id,
    savedAt: stored.savedAt,
    completedAt: stored.audit.run.completedAt,
    site: stored.audit.subject.url,
    auditMode: stored.audit.result.auditMode,
    path: relativeRunPath(stored.audit.run.id),
    sha256: sha256(contents),
    bytes: Buffer.byteLength(contents),
  };
}

export async function saveAuditRun(
  audit: FullAuditEnvelope,
  cwd = process.cwd(),
  now = new Date(),
): Promise<CapabilityArtifact> {
  if (audit.run.capabilityId !== "site.full_audit") {
    throw new AppError(
      "INVALID_AUDIT_RUN",
      "Only site.full_audit envelopes can be saved as audit runs.",
    );
  }
  const runId = checkedRunId(audit.run.id);
  const directory = runsPath(cwd);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);

  const stored: StoredAuditRun = {
    storageVersion: SCHEMA_VERSION,
    savedAt: now.toISOString(),
    audit: { ...audit, artifacts: [] },
  };
  assertSnapshotSafe(stored);
  const contents = `${JSON.stringify(stored, null, 2)}\n`;
  const target = path.join(directory, `${runId}.json`);
  const temporary = path.join(directory, `.${runId}.${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await link(temporary, target);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "EEXIST") {
      throw new AppError(
        "AUDIT_RUN_EXISTS",
        `Audit run ${runId} is already saved.`,
      );
    }
    throw error;
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
  await chmod(target, 0o600);

  return {
    id: `artifact_${runId}`,
    kind: "audit-run",
    path: relativeRunPath(runId),
    mediaType: "application/json",
    sha256: sha256(contents),
    createdAt: stored.savedAt,
  };
}

export async function readAuditRun(
  runId: string,
  cwd = process.cwd(),
): Promise<{ stored: StoredAuditRun; descriptor: AuditRunDescriptor }> {
  checkedRunId(runId);
  const target = path.join(runsPath(cwd), `${runId}.json`);
  try {
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new AppError(
        "INVALID_AUDIT_RUN",
        `Saved audit is not a regular file: ${relativeRunPath(runId)}`,
      );
    }
    if (info.size > MAX_SAVED_AUDIT_BYTES) {
      throw new AppError(
        "AUDIT_RUN_TOO_LARGE",
        `Saved audit exceeds the ${MAX_SAVED_AUDIT_BYTES}-byte local read limit: ${relativeRunPath(runId)}`,
      );
    }
    const contents = await readFile(target, "utf8");
    const stored = parseStoredAuditRun(
      contents,
      relativeRunPath(runId),
    );
    if (stored.audit.run.id !== runId) {
      throw new AppError(
        "AUDIT_RUN_ID_MISMATCH",
        `Saved audit filename and embedded run ID do not match: ${relativeRunPath(runId)}`,
      );
    }
    return { stored, descriptor: descriptor(stored, contents) };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "ENOENT") {
      throw new AppError(
        "AUDIT_RUN_NOT_FOUND",
        `Saved audit run was not found: ${runId}`,
      );
    }
    throw error;
  }
}

export async function listAuditRuns(
  options: { cwd?: string; limit?: number } = {},
): Promise<AuditRunList> {
  const cwd = options.cwd ?? process.cwd();
  const limit = options.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError(
      "INVALID_AUDIT_HISTORY_LIMIT",
      "Audit history limit must be an integer from 1 to 100.",
    );
  }

  let entries;
  try {
    entries = await readdir(runsPath(cwd), { withFileTypes: true });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "ENOENT") {
      return { runs: [], warnings: [] };
    }
    throw error;
  }

  const runs: AuditRunDescriptor[] = [];
  const warnings: string[] = [];
  for (const entry of entries) {
    if (
      !entry.isFile() ||
      entry.isSymbolicLink() ||
      !entry.name.endsWith(".json")
    ) {
      continue;
    }
    const runId = entry.name.slice(0, -".json".length);
    if (!RUN_ID_PATTERN.test(runId)) {
      warnings.push(`Ignored unrecognized audit history file: ${entry.name}`);
      continue;
    }
    try {
      runs.push((await readAuditRun(runId, cwd)).descriptor);
    } catch (error) {
      warnings.push(
        `Ignored unreadable audit run ${runId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  runs.sort(
    (left, right) =>
      right.savedAt.localeCompare(left.savedAt) ||
      right.runId.localeCompare(left.runId),
  );
  return { runs: runs.slice(0, limit), warnings };
}
