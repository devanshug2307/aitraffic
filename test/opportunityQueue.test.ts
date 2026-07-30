import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type { OpportunityFinding } from "../src/analysis/opportunities.js";
import {
  runCapability,
  type FullAuditEnvelope,
} from "../src/capabilities/run.js";
import type {
  SiteHttpClient,
  SiteHttpResponse,
} from "../src/connectors/site/types.js";
import {
  explainQueuedOpportunity,
  listQueuedOpportunities,
  opportunityQueuePath,
  readOpportunityQueue,
  syncOpportunityQueue,
  updateOpportunityStatus,
} from "../src/core/opportunityQueue.js";
import { saveAuditRun } from "../src/core/auditRuns.js";
import { AppError } from "../src/core/result.js";

function response(
  url: string,
  body: string,
  contentType = "text/html; charset=utf-8",
): SiteHttpResponse {
  return {
    requestedUrl: url,
    finalUrl: url,
    status: 200,
    redirects: [],
    headers: {
      contentType,
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

function client(html: string): SiteHttpClient {
  return {
    async get(url) {
      if (url === "https://example.com/robots.txt") {
        return response(
          url,
          "User-agent: *\nAllow: /",
          "text/plain; charset=utf-8",
        );
      }
      assert.equal(url, "https://example.com/");
      return response(url, html);
    },
  };
}

async function audit(
  html: string,
  completedAt: string,
): Promise<FullAuditEnvelope> {
  const envelope = await runCapability(
    "site.full_audit",
    {
      url: "https://example.com/",
      sitemap: "none",
      limit: 1,
      google: "off",
      top: 20,
    },
    { siteClient: client(html) },
  );
  envelope.run.startedAt = completedAt;
  envelope.run.completedAt = completedAt;
  return envelope;
}

function addGoogleOpportunity(audit: FullAuditEnvelope): void {
  const finding: OpportunityFinding = {
    id: "finding_google_fixture",
    classification: "inferred",
    kind: "page_query",
    priority: "high",
    page: "https://example.com/",
    query: "example query",
    signals: ["low_ctr"],
    reason: "The returned query has observed demand and below-baseline CTR.",
    metrics: {
      clicks: 10,
      impressions: 1_000,
      ctr: 0.01,
      position: 8,
      clickChange: null,
    },
    evidenceRefs: [],
  };
  audit.findings.push(finding);
  audit.subject.site = "sc-domain:example.com";
  audit.subject.ga4Property = "123456";
  audit.result.google.status = "included";
}

test("syncs stable opportunities and verifies comparable technical fixes", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-queue-"));
  const first = await audit(
    "<html><head></head><body><h1>Example</h1></body></html>",
    "2026-07-28T10:00:00.000Z",
  );
  await saveAuditRun(
    first,
    cwd,
    new Date("2026-07-28T10:01:00.000Z"),
  );

  const preview = await syncOpportunityQueue(first, {
    cwd,
    dryRun: true,
    now: new Date("2026-07-28T10:02:00.000Z"),
  });
  assert.equal(preview.result.saved, false);
  assert.equal(preview.result.changes.created >= 2, true);
  assert.equal((await readOpportunityQueue(cwd)).opportunities.length, 0);

  const initial = await syncOpportunityQueue(first, {
    cwd,
    now: new Date("2026-07-28T10:03:00.000Z"),
  });
  assert.equal(initial.result.saved, true);
  assert.equal(
    (await stat(path.dirname(opportunityQueuePath(cwd)))).mode & 0o777,
    0o700,
  );
  assert.equal(
    (await stat(opportunityQueuePath(cwd))).mode & 0o777,
    0o600,
  );

  const repeated = await syncOpportunityQueue(first, { cwd });
  assert.equal(repeated.result.saved, false);
  assert.match(repeated.warnings.join(" "), /already synced/u);

  const second = await audit(
    "<html><head></head><body><h1>Example</h1></body></html>",
    "2026-07-29T10:00:00.000Z",
  );
  await saveAuditRun(
    second,
    cwd,
    new Date("2026-07-29T10:01:00.000Z"),
  );
  await syncOpportunityQueue(second, {
    cwd,
    now: new Date("2026-07-29T10:02:00.000Z"),
  });

  const active = await listQueuedOpportunities({}, cwd);
  const titleOpportunity = active.opportunities.find(
    ({ kind }) => kind === "TITLE_NOT_OBSERVED_STATIC_HTML_V1",
  );
  assert.ok(titleOpportunity);
  assert.equal(titleOpportunity.occurrences, 2);
  const explained = await explainQueuedOpportunity(
    titleOpportunity.id,
    cwd,
  );
  assert.equal(explained.opportunity.evidence.occurrences, 2);
  assert.match(explained.commands.plan, /--dry-run/u);

  const dryUpdate = await updateOpportunityStatus(
    titleOpportunity.id,
    "planned",
    "Prepare a metadata patch.",
    { cwd, dryRun: true },
  );
  assert.equal(dryUpdate.saved, false);
  assert.equal(
    (await explainQueuedOpportunity(titleOpportunity.id, cwd)).opportunity
      .status,
    "open",
  );
  const updated = await updateOpportunityStatus(
    titleOpportunity.id,
    "planned",
    "Prepare a metadata patch.",
    { cwd, now: new Date("2026-07-29T10:03:00.000Z") },
  );
  assert.equal(updated.saved, true);
  assert.equal(updated.opportunity.status, "planned");

  const fixed = await audit(
    "<html><head><title>Example</title><meta name=\"description\" content=\"Useful page\"></head><body><h1>Example</h1></body></html>",
    "2026-07-30T10:00:00.000Z",
  );
  await saveAuditRun(
    fixed,
    cwd,
    new Date("2026-07-30T10:01:00.000Z"),
  );
  const verification = await syncOpportunityQueue(fixed, {
    cwd,
    now: new Date("2026-07-30T10:02:00.000Z"),
  });
  assert.equal(verification.result.changes.verified >= 2, true);

  const verified = await listQueuedOpportunities(
    { status: "verified", observation: "not_observed" },
    cwd,
  );
  const verifiedTitle = verified.opportunities.find(
    ({ id }) => id === titleOpportunity.id,
  );
  assert.equal(verifiedTitle?.status, "verified");
  assert.equal(verifiedTitle?.observationState, "not_observed");
  const full = await explainQueuedOpportunity(titleOpportunity.id, cwd);
  assert.equal(full.opportunity.verification?.olderRunId, second.run.id);
  assert.equal(full.opportunity.verification?.newerRunId, fixed.run.id);
  const historyLength = full.opportunity.history.length;

  const fixedAgain = await audit(
    "<html><head><title>Example</title><meta name=\"description\" content=\"Useful page\"></head><body><h1>Example</h1></body></html>",
    "2026-07-31T10:00:00.000Z",
  );
  await saveAuditRun(fixedAgain, cwd);
  const repeatedVerification = await syncOpportunityQueue(fixedAgain, {
    cwd,
  });
  assert.equal(repeatedVerification.result.changes.verified, 0);
  assert.equal(repeatedVerification.result.changes.unchanged >= 2, true);
  assert.equal(
    (await explainQueuedOpportunity(titleOpportunity.id, cwd)).opportunity
      .history.length,
    historyLength,
  );

  await assert.rejects(
    syncOpportunityQueue(first, { cwd }),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "OPPORTUNITY_SYNC_OUT_OF_ORDER",
  );
});

test("does not verify absent Google opportunities without compatible evidence", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-queue-google-"));
  const withGoogle = await audit(
    "<html><head><title>Example</title></head><body><h1>Example</h1></body></html>",
    "2026-07-29T10:00:00.000Z",
  );
  addGoogleOpportunity(withGoogle);
  await saveAuditRun(withGoogle, cwd);
  await syncOpportunityQueue(withGoogle, { cwd });

  const initial = await listQueuedOpportunities(
    { source: "google-opportunity" },
    cwd,
  );
  assert.equal(initial.opportunities.length, 1);
  const googleId = initial.opportunities[0]?.id as string;

  const technicalOnly = await audit(
    "<html><head><title>Example</title></head><body><h1>Example</h1></body></html>",
    "2026-07-30T10:00:00.000Z",
  );
  await saveAuditRun(technicalOnly, cwd);
  await syncOpportunityQueue(technicalOnly, { cwd });

  const explained = await explainQueuedOpportunity(googleId, cwd);
  assert.equal(explained.opportunity.status, "open");
  assert.equal(explained.opportunity.observationState, "unknown");
  assert.equal(explained.opportunity.verification, null);
});

test("rejects corrupt queues and routes an empty CLI list with guidance", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-queue-corrupt-"));
  await mkdir(path.dirname(opportunityQueuePath(cwd)), {
    recursive: true,
  });
  await writeFile(opportunityQueuePath(cwd), "{not-json");
  await assert.rejects(
    readOpportunityQueue(cwd),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "INVALID_OPPORTUNITY_QUEUE",
  );

  const cleanCwd = await mkdtemp(
    path.join(tmpdir(), "aitraffic-queue-cli-"),
  );
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const result = spawnSync(
    process.execPath,
    [cli, "opportunities", "list", "--format", "json"],
    { cwd: cleanCwd, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout) as {
    ok: boolean;
    data: {
      summary: { stored: number };
      opportunities: unknown[];
      nextCommand: string | null;
    };
  };
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.summary.stored, 0);
  assert.deepEqual(parsed.data.opportunities, []);
  assert.match(parsed.data.nextCommand ?? "", /audit <URL> --save/u);
});

test("routes queue sync, explain, and update through stable CLI JSON", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-queue-cli-"));
  const envelope = await audit(
    "<html><head></head><body><h1>Example</h1></body></html>",
    "2026-07-30T10:00:00.000Z",
  );
  await saveAuditRun(envelope, cwd);
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const run = (args: string[]) =>
    spawnSync(process.execPath, [cli, ...args, "--format", "json"], {
      cwd,
      encoding: "utf8",
      timeout: 10_000,
    });

  const preview = run([
    "opportunities",
    "sync",
    "--from",
    envelope.run.id,
    "--dry-run",
  ]);
  assert.equal(preview.status, 0, preview.stdout);
  assert.equal(
    (JSON.parse(preview.stdout) as { data: { saved: boolean } }).data.saved,
    false,
  );

  const applied = run([
    "opportunities",
    "sync",
    "--from",
    envelope.run.id,
  ]);
  assert.equal(applied.status, 0, applied.stdout);
  const listed = run(["opportunities", "list"]);
  assert.equal(listed.status, 0, listed.stdout);
  const opportunityId = (
    JSON.parse(listed.stdout) as {
      data: { opportunities: Array<{ id: string }> };
    }
  ).data.opportunities[0]?.id as string;

  const explained = run([
    "opportunities",
    "explain",
    opportunityId,
  ]);
  assert.equal(explained.status, 0, explained.stdout);
  const updated = run([
    "opportunities",
    "update",
    opportunityId,
    "--status",
    "planned",
    "--reason",
    "Review the proposed metadata patch.",
    "--dry-run",
  ]);
  assert.equal(updated.status, 0, updated.stdout);
  assert.equal(
    (JSON.parse(updated.stdout) as { data: { saved: boolean } }).data.saved,
    false,
  );
});
