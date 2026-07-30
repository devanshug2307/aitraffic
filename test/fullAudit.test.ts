import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  gscSiteCoversUrl,
  sameApexWwwBoundary,
} from "../src/analysis/fullAudit.js";
import { runCapability } from "../src/capabilities/run.js";
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
import { AppError } from "../src/core/result.js";

const GOOGLE_CONFIG = {
  schemaVersion: "0.1.0" as const,
  adapter: "local-oauth" as const,
  profile: "test",
  ga4Property: "123456",
  gscSite: "sc-domain:example.com",
};

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

function siteClient(calls: string[]): SiteHttpClient {
  return {
    async get(url) {
      calls.push(url);
      if (url === "https://example.com/robots.txt") {
        return response(
          url,
          "User-agent: *\nAllow: /",
          "text/plain; charset=utf-8",
        );
      }
      assert.equal(url, "https://example.com/");
      return response(
        url,
        "<html><head></head><body><h1>Example</h1></body></html>",
      );
    },
  };
}

class FullAuditGoogleProvider implements GoogleDataProvider {
  gscCalls = 0;
  ga4Calls = 0;

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
    this.ga4Calls += 1;
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
            { value: "50" },
            { value: "25" },
            { value: "2" },
            { value: "100" },
          ],
        },
      ],
    };
  }

  async gscReport(
    _site: string,
    _request: GscReportRequest,
  ): Promise<GscReportResponse> {
    this.gscCalls += 1;
    return {
      responseAggregationType: "byPage",
      rows: [
        {
          keys: ["example audit", "https://example.com/"],
          clicks: this.gscCalls === 1 ? 10 : 20,
          impressions: 1_000,
          ctr: this.gscCalls === 1 ? 0.01 : 0.02,
          position: 8,
        },
        {
          keys: [
            "unrelated subdomain",
            "https://docs.example.com/other",
          ],
          clicks: 1,
          impressions: 2_000,
          ctr: 0.0005,
          position: 6,
        },
      ],
    };
  }
}

class FailingGoogleProvider extends FullAuditGoogleProvider {
  override async gscReport(): Promise<GscReportResponse> {
    throw new Error("Fixture Google request failed.");
  }
}

test("runs a useful technical-only audit when Google is unavailable", async () => {
  const calls: string[] = [];
  const envelope = await runCapability(
    "site.full_audit",
    {
      url: "https://example.com/",
      sitemap: "none",
      limit: 1,
      google: "auto",
      top: 5,
    },
    {
      siteClient: siteClient(calls),
      now: new Date("2026-07-30T12:00:00.000Z"),
      googleUnavailable: {
        code: "GOOGLE_NOT_CONFIGURED",
        message: "Google is not configured for this fixture.",
      },
    },
  );

  assert.equal(envelope.run.capabilityId, "site.full_audit");
  assert.equal(envelope.result.auditMode, "technical-only");
  assert.equal(envelope.result.google.status, "not_configured");
  assert.equal(envelope.coverage.partial, true);
  assert.deepEqual(envelope.coverage.incompleteReasons, [
    "sitemap discovery was disabled",
  ]);
  assert.equal(envelope.result.prioritization.findings.length > 0, true);
  assert.equal(
    envelope.result.prioritization.findings[0]?.source,
    "technical",
  );
  assert.deepEqual(calls, [
    "https://example.com/robots.txt",
    "https://example.com/",
  ]);
});

test("combines matching Google evidence and reuses page fetches", async () => {
  const calls: string[] = [];
  const provider = new FullAuditGoogleProvider();
  const envelope = await runCapability(
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
      top: 10,
    },
    {
      google: {
        config: GOOGLE_CONFIG,
        provider,
      },
      siteClient: siteClient(calls),
      now: new Date("2026-07-30T12:00:00.000Z"),
    },
  );

  assert.equal(envelope.result.auditMode, "technical-and-google");
  assert.equal(envelope.result.google.status, "included");
  assert.equal(envelope.result.google.selectedPages, 1);
  assert.equal(
    envelope.result.google.sourceEvidence?.sourceCoverage.currentGsc
      .observedRows,
    2,
  );
  assert.equal(envelope.subject.site, "sc-domain:example.com");
  assert.equal(provider.gscCalls, 2);
  assert.equal(provider.ga4Calls, 1);
  assert.equal(
    envelope.result.prioritization.findings.some(
      ({ source }) => source === "google-opportunity",
    ),
    true,
  );
  assert.equal(
    envelope.findings.some(
      (finding) =>
        "page" in finding &&
        finding.page === "https://docs.example.com/other",
    ),
    false,
  );
  assert.equal(
    new Set(envelope.findings.map(({ id }) => id)).size,
    envelope.findings.length,
  );
  assert.equal(
    envelope.findings.every(({ evidenceRefs }) =>
      evidenceRefs.every((id) =>
        envelope.observations.some((observation) => observation.id === id),
      ),
    ),
    true,
  );
  assert.deepEqual(calls, [
    "https://example.com/robots.txt",
    "https://example.com/",
  ]);
});

test("does not join a mismatched Search Console property", async () => {
  const calls: string[] = [];
  const provider = new FullAuditGoogleProvider();
  const mismatched = {
    ...GOOGLE_CONFIG,
    gscSite: "sc-domain:other.example",
  };
  const automatic = await runCapability(
    "site.full_audit",
    {
      url: "https://example.com/",
      sitemap: "none",
      limit: 1,
      google: "auto",
    },
    {
      google: { config: mismatched, provider },
      siteClient: siteClient(calls),
    },
  );

  assert.equal(automatic.result.google.status, "site_mismatch");
  assert.equal(automatic.result.auditMode, "technical-only");
  assert.equal(automatic.coverage.partial, true);
  assert.deepEqual(automatic.coverage.incompleteReasons, [
    "sitemap discovery was disabled",
  ]);
  assert.equal(provider.gscCalls, 0);
  assert.equal(provider.ga4Calls, 0);

  await assert.rejects(
    runCapability(
      "site.full_audit",
      {
        url: "https://example.com/",
        sitemap: "none",
        limit: 1,
        google: "required",
      },
      {
        google: { config: mismatched, provider },
        siteClient: siteClient([]),
      },
    ),
    (error: unknown) =>
      error instanceof AppError && error.code === "GOOGLE_SITE_MISMATCH",
  );
});

test("degrades optional Google failures but preserves required-mode failure", async () => {
  const automatic = await runCapability(
    "site.full_audit",
    {
      url: "https://example.com/",
      sitemap: "none",
      limit: 1,
      google: "auto",
    },
    {
      google: {
        config: GOOGLE_CONFIG,
        provider: new FailingGoogleProvider(),
      },
      siteClient: siteClient([]),
    },
  );
  assert.equal(automatic.result.google.status, "failed");
  assert.equal(automatic.result.auditMode, "technical-only");
  assert.equal(
    automatic.coverage.incompleteReasons.some((reason) =>
      reason.includes("optional Google audit failed"),
    ),
    true,
  );

  await assert.rejects(
    runCapability(
      "site.full_audit",
      {
        url: "https://example.com/",
        sitemap: "none",
        limit: 1,
        google: "required",
      },
      {
        google: {
          config: GOOGLE_CONFIG,
          provider: new FailingGoogleProvider(),
        },
        siteClient: siteClient([]),
      },
    ),
    /Fixture Google request failed/u,
  );
});

test("matches domain and URL-prefix Search Console properties exactly", () => {
  assert.equal(
    gscSiteCoversUrl("sc-domain:example.com", "https://www.example.com/docs"),
    true,
  );
  assert.equal(
    gscSiteCoversUrl("sc-domain:notexample.com", "https://example.com/"),
    false,
  );
  assert.equal(
    gscSiteCoversUrl("https://example.com/blog/", "https://example.com/blog/a"),
    true,
  );
  assert.equal(
    gscSiteCoversUrl("https://example.com/blog/", "https://example.com/docs"),
    false,
  );
  assert.equal(
    sameApexWwwBoundary(
      "https://www.example.com/page",
      "https://example.com/",
    ),
    true,
  );
  assert.equal(
    sameApexWwwBoundary(
      "https://docs.example.com/page",
      "https://example.com/",
    ),
    false,
  );
});

test("routes the unified CLI options before attempting a fetch", () => {
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "audit",
      "not-a-url",
      "--technical-only",
      "--focus",
      "indexing",
      "--top",
      "3",
      "--format",
      "json",
    ],
    { encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 2);
  const parsed = JSON.parse(result.stdout) as {
    ok: boolean;
    command: string;
    errors: Array<{ code: string }>;
  };
  assert.equal(parsed.ok, false);
  assert.equal(parsed.command, "audit not-a-url");
  assert.equal(parsed.errors[0]?.code, "INVALID_URL");
});

test("fails before crawling when CLI Google evidence is required but absent", async () => {
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-full-audit-"));
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "audit",
      "https://example.com/",
      "--google",
      "required",
      "--format",
      "json",
    ],
    { cwd, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 2);
  const parsed = JSON.parse(result.stdout) as {
    ok: boolean;
    errors: Array<{ code: string; message: string }>;
  };
  assert.equal(parsed.ok, false);
  assert.equal(parsed.errors[0]?.code, "GOOGLE_NOT_CONFIGURED");
  assert.equal(parsed.errors[0]?.message, "No Google connector is selected.");
});
