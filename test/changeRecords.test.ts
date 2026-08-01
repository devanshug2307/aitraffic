import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { runCapability } from "../src/capabilities/run.js";
import type {
  SiteHttpClient,
  SiteHttpResponse,
} from "../src/connectors/site/types.js";
import {
  changeRecordPath,
  createChangeRecord,
  listChangeRecords,
  showChangeRecord,
} from "../src/core/changeRecords.js";
import { syncOpportunityQueue } from "../src/core/opportunityQueue.js";

const OPPORTUNITY_ID = "opp_0123456789abcdef01234567";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function input() {
  return {
    opportunityId: OPPORTUNITY_ID,
    opportunityTitle: "Improve the page title",
    site: "https://example.com/",
    urls: ["https://example.com/pricing#details", "https://example.com/pricing"],
    type: "metadata" as const,
    gitCommit: "abc123",
    deploymentRef: "deploy-42",
    beforeContentHash: HASH_A,
    afterContentHash: HASH_B,
    note: "Updated the title to match the observed query intent.",
    concurrentChanges: ["Navigation release", "Analytics tag update"],
  };
}

function response(url: string, body: string): SiteHttpResponse {
  return {
    requestedUrl: url,
    finalUrl: url,
    status: 200,
    redirects: [],
    headers: {
      contentType: "text/html; charset=utf-8",
      contentLength: Buffer.byteLength(body),
      contentEncoding: null,
      xRobotsTag: [],
    },
    body,
    byteLength: Buffer.byteLength(body),
    bodyRead: "complete",
    sha256: createHash("sha256").update(body).digest("hex"),
    durationMs: 1,
  };
}

test("previews, stores, lists, and reads private local change records", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-changes-"));
  const now = new Date("2026-07-31T10:00:00.000Z");
  const preview = await createChangeRecord(input(), { cwd, dryRun: true, now });
  assert.equal(preview.dryRun, true);
  assert.equal(preview.saved, false);
  assert.equal((await listChangeRecords({ cwd })).totalStored, 0);

  const created = await createChangeRecord(input(), { cwd, now });
  assert.equal(created.saved, true);
  assert.equal(created.record.urls.length, 1);
  assert.equal(
    (await stat(path.dirname(changeRecordPath(cwd)))).mode & 0o777,
    0o700,
  );
  assert.equal((await stat(changeRecordPath(cwd))).mode & 0o777, 0o600);

  const listed = await listChangeRecords({
    cwd,
    opportunityId: OPPORTUNITY_ID,
    url: "https://example.com/pricing#ignored",
  });
  assert.equal(listed.records.length, 1);
  assert.equal(listed.records[0]?.gitCommit, "abc123");

  const shown = await showChangeRecord(created.record.id, cwd);
  assert.equal(shown.record.beforeContentHash, HASH_A);
  assert.equal(shown.record.afterContentHash, HASH_B);
  assert.deepEqual(shown.record.concurrentChanges, [
    "Navigation release",
    "Analytics tag update",
  ]);
});

test("validates content hashes and does not let CLI record incomplete changes", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-changes-"));
  await assert.rejects(
    createChangeRecord(
      { ...input(), beforeContentHash: "not-a-hash" },
      { cwd, dryRun: true },
    ),
    /64-character SHA-256/u,
  );

  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const missing = spawnSync(
    process.execPath,
    [cli, "changes", "record", "--type", "metadata", "--format", "json"],
    { cwd, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(missing.status, 2);
  const parsed = JSON.parse(missing.stdout) as {
    errors: Array<{ code: string }>;
  };
  assert.equal(parsed.errors[0]?.code, "MISSING_CHANGE_RECORD_FIELDS");
});

test("CLI records a change only for a synchronized opportunity and exposes later verification state", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-changes-cli-"));
  const client: SiteHttpClient = {
    async get(url) {
      if (url.endsWith("/robots.txt")) {
        return {
          ...response(url, "User-agent: *\\nAllow: /"),
          headers: {
            contentType: "text/plain",
            contentLength: 22,
            contentEncoding: null,
            xRobotsTag: [],
          },
        };
      }
      return response(url, "<html><head></head><body><h1>Example</h1></body></html>");
    },
  };
  const audit = await runCapability(
    "site.full_audit",
    { url: "https://example.com/", sitemap: "none", limit: 1, google: "off" },
    { siteClient: client },
  );
  const synced = await syncOpportunityQueue(audit, { cwd });
  const opportunityId = synced.result.affected[0]?.id;
  assert.ok(opportunityId);

  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const recorded = spawnSync(
    process.execPath,
    [
      cli,
      "changes",
      "record",
      "--opportunity",
      opportunityId,
      "--url",
      "https://example.com/",
      "--type",
      "metadata",
      "--note",
      "Updated the page title",
      "--format",
      "json",
    ],
    { cwd, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(recorded.status, 0, recorded.stderr);
  const created = JSON.parse(recorded.stdout) as {
    data: { record: { id: string } };
  };
  const shown = spawnSync(
    process.execPath,
    [cli, "changes", "show", created.data.record.id, "--format", "json"],
    { cwd, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(shown.status, 0, shown.stderr);
  const detail = JSON.parse(shown.stdout) as {
    data: { verification: { state: string; latestRunId: string } };
  };
  assert.equal(detail.data.verification.state, "present");
  assert.equal(detail.data.verification.latestRunId, audit.run.id);
});
