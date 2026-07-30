import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { compareAuditRuns } from "../src/analysis/auditComparison.js";
import {
  runCapability,
  type FullAuditEnvelope,
} from "../src/capabilities/run.js";
import type {
  Ga4ReportRequest,
  Ga4ReportResponse,
  GoogleDataProvider,
  GscReportRequest,
  GscReportResponse,
} from "../src/connectors/google/types.js";
import type {
  SiteHttpClient,
  SiteHttpResponse,
} from "../src/connectors/site/types.js";
import {
  listAuditRuns,
  readAuditRun,
  saveAuditRun,
} from "../src/core/auditRuns.js";
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

class GoogleProvider implements GoogleDataProvider {
  async status() {
    return { configured: true, profileCount: 1 };
  }

  async inventory() {
    return {
      profile: "test",
      ga4Properties: [],
      searchConsoleSites: [],
    };
  }

  async ga4Report(
    _property: string,
    _request: Ga4ReportRequest,
  ): Promise<Ga4ReportResponse> {
    return {
      dimensionHeaders: [
        { name: "hostName" },
        { name: "landingPagePlusQueryString" },
      ],
      metricHeaders: [
        { name: "sessions" },
        { name: "engagedSessions" },
        { name: "keyEvents" },
        { name: "totalRevenue" },
      ],
      rowCount: 1,
      rows: [
        {
          dimensionValues: [
            { value: "example.com" },
            { value: "/" },
          ],
          metricValues: [
            { value: "40" },
            { value: "20" },
            { value: "2" },
            { value: "0" },
          ],
        },
      ],
    };
  }

  async gscReport(
    _site: string,
    _request: GscReportRequest,
  ): Promise<GscReportResponse> {
    return {
      responseAggregationType: "byPage",
      rows: [
        {
          keys: ["example query", "https://example.com/"],
          clicks: 10,
          impressions: 1_000,
          ctr: 0.01,
          position: 8,
        },
      ],
    };
  }
}

async function audit(
  html: string,
  now: string,
): Promise<FullAuditEnvelope> {
  return runCapability(
    "site.full_audit",
    {
      url: "https://example.com/",
      sitemap: "none",
      limit: 1,
      google: "off",
      top: 20,
    },
    {
      siteClient: client(html),
      now: new Date(now),
    },
  );
}

async function googleAudit(now: string): Promise<FullAuditEnvelope> {
  return runCapability(
    "site.full_audit",
    {
      url: "https://example.com/",
      sitemap: "none",
      limit: 1,
      google: "required",
      opportunityLimit: 1,
      days: 28,
      maxRows: 100,
      minImpressions: 100,
      top: 20,
    },
    {
      google: {
        config: {
          schemaVersion: "0.1.0",
          adapter: "local-oauth",
          profile: "test",
          ga4Property: "123456",
          gscSite: "sc-domain:example.com",
        },
        provider: new GoogleProvider(),
      },
      siteClient: client(
        "<html><head><title>Example</title></head><body><h1>Example</h1></body></html>",
      ),
      now: new Date(now),
    },
  );
}

test("saves, lists, and reads private audit snapshots", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-history-"));
  const envelope = await audit(
    "<html><head></head><body><h1>Example</h1></body></html>",
    "2026-07-30T10:00:00.000Z",
  );
  const artifact = await saveAuditRun(
    envelope,
    cwd,
    new Date("2026-07-30T10:05:00.000Z"),
  );

  assert.equal(artifact.kind, "audit-run");
  assert.equal(artifact.path, `.aitraffic/runs/${envelope.run.id}.json`);
  assert.match(artifact.sha256, /^[0-9a-f]{64}$/u);
  assert.equal(
    (await stat(path.join(cwd, ".aitraffic/runs"))).mode & 0o777,
    0o700,
  );
  assert.equal(
    (await stat(path.join(cwd, artifact.path))).mode & 0o777,
    0o600,
  );

  const history = await listAuditRuns({ cwd });
  assert.equal(history.warnings.length, 0);
  assert.equal(history.runs.length, 1);
  assert.equal(history.runs[0]?.runId, envelope.run.id);
  assert.equal(history.runs[0]?.sha256, artifact.sha256);

  const stored = await readAuditRun(envelope.run.id, cwd);
  assert.equal(stored.stored.audit.run.id, envelope.run.id);
  assert.deepEqual(stored.stored.audit.artifacts, []);
  assert.equal(stored.descriptor.sha256, artifact.sha256);

  await assert.rejects(
    saveAuditRun(envelope, cwd),
    (error: unknown) =>
      error instanceof AppError && error.code === "AUDIT_RUN_EXISTS",
  );
});

test("rejects unsafe fields and isolates corrupt history entries", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-history-"));
  const envelope = await audit(
    "<html><head></head><body><h1>Example</h1></body></html>",
    "2026-07-30T10:00:00.000Z",
  );
  const unsafe = structuredClone(envelope) as FullAuditEnvelope & {
    rawHtml?: string;
  };
  unsafe.rawHtml = "<html>secret</html>";
  await assert.rejects(
    saveAuditRun(unsafe, cwd),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "UNSAFE_AUDIT_SNAPSHOT",
  );

  await mkdir(path.join(cwd, ".aitraffic/runs"), {
    recursive: true,
  });
  await writeFile(
    path.join(
      cwd,
      ".aitraffic/runs/run_00000000-0000-0000-0000-000000000000.json",
    ),
    "{not-json",
  );
  const history = await listAuditRuns({ cwd });
  assert.deepEqual(history.runs, []);
  assert.equal(history.warnings.length, 1);
  assert.match(history.warnings[0] ?? "", /not valid JSON/u);
});

test("compares observed pages and labels incomplete scope honestly", async () => {
  const older = await audit(
    "<html><head></head><body><h1>Example</h1></body></html>",
    "2026-07-29T10:00:00.000Z",
  );
  const newer = await audit(
    "<html><head><title>Example</title><meta name=\"description\" content=\"Useful page\"></head><body><h1>Example</h1></body></html>",
    "2026-07-30T10:00:00.000Z",
  );
  const comparison = compareAuditRuns(older, newer);

  assert.equal(comparison.direction, "older-to-newer");
  assert.equal(comparison.coverage.comparable, true);
  assert.equal(comparison.coverage.complete, false);
  assert.equal(comparison.pages.compared, 1);
  assert.equal(comparison.pages.changed.length, 1);
  assert.equal(
    comparison.pages.changed[0]?.changes.some(
      ({ field }) => field === "contentHash",
    ),
    true,
  );
  assert.equal(
    comparison.technicalFindings.resolved.some(
      ({ ruleId }) => ruleId === "TITLE_NOT_OBSERVED_STATIC_HTML_V1",
    ),
    true,
  );
  assert.equal(
    comparison.technicalFindings.resolved.some(
      ({ ruleId }) =>
        ruleId === "DESCRIPTION_NOT_OBSERVED_STATIC_HTML_V1",
    ),
    true,
  );
  assert.equal(comparison.googleOpportunities.comparable, false);
  assert.match(
    comparison.caveats.join(" "),
    /not index additions or removals/u,
  );
});

test("does not call an unobserved page finding resolved", async () => {
  const older = await audit(
    "<html><head></head><body><h1>Example</h1></body></html>",
    "2026-07-29T10:00:00.000Z",
  );
  const newer = structuredClone(older);
  newer.run.id = "run_00000000-0000-4000-8000-000000000001";
  newer.observations = newer.observations.filter((item) => {
    const record = item as unknown as { type?: string };
    return record.type !== "page";
  });
  newer.findings = [];
  const comparison = compareAuditRuns(older, newer);

  assert.equal(comparison.technicalFindings.resolved.length, 0);
  assert.equal(
    comparison.technicalFindings.unknown.some(
      ({ direction, finding }) =>
        direction === "no-longer-observed" &&
        finding.ruleId === "TITLE_NOT_OBSERVED_STATIC_HTML_V1",
    ),
    true,
  );
});

test("compares Google opportunities only for compatible evidence", async () => {
  const older = await googleAudit("2026-07-29T10:00:00.000Z");
  const newer = await googleAudit("2026-07-30T10:00:00.000Z");
  const comparison = compareAuditRuns(older, newer);

  assert.equal(comparison.googleOpportunities.comparable, true);
  assert.equal(
    comparison.googleOpportunities.persistent.length > 0,
    true,
  );

  const mismatched = structuredClone(newer);
  mismatched.subject.ga4Property = "different-property";
  const blocked = compareAuditRuns(older, mismatched);
  assert.equal(blocked.googleOpportunities.comparable, false);
  assert.match(
    blocked.googleOpportunities.reasons.join(" "),
    /resources differ/u,
  );
  assert.deepEqual(blocked.googleOpportunities.persistent, []);
});

test("routes audit history without treating history as a URL", async () => {
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-history-cli-"));
  const result = spawnSync(
    process.execPath,
    [cli, "audit", "history", "--format", "json"],
    { cwd, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout) as {
    ok: boolean;
    command: string;
    data: { runs: unknown[] };
  };
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, "audit history");
  assert.deepEqual(parsed.data.runs, []);
});
