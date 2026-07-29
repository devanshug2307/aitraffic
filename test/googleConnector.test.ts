import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  acquisitionPeriods,
  buildAcquisitionReport,
  isAiAssistantTraffic,
} from "../src/analysis/acquisition.js";
import {
  configureGoogleConnector,
  readGoogleConnectorConfig,
} from "../src/connectors/google/config.js";
import type {
  Ga4ReportRequest,
  Ga4ReportResponse,
  GoogleDataProvider,
  GscReportRequest,
  GscReportResponse,
} from "../src/connectors/google/types.js";

test("configures an external Google adapter without credentials", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "aitraffic-google-"));
  const scriptPath = path.join(directory, "google-data.mjs");
  await writeFile(scriptPath, "export {};\n", "utf8");
  const result = await configureGoogleConnector({
    cwd: directory,
    scriptPath,
    profile: "TrafficClaw",
    ga4Property: "properties/123456",
    gscSite: "sc-domain:example.com",
  });

  assert.equal(result.written, true);
  assert.equal(result.config.profile, "trafficclaw");
  assert.equal(result.config.ga4Property, "123456");
  assert.equal("credentials" in result.config, false);
  assert.deepEqual(await readGoogleConnectorConfig(directory), result.config);

  const stored = await readFile(result.configPath, "utf8");
  assert.equal(stored.includes("accessToken"), false);
  assert.equal(stored.includes("refreshToken"), false);
});

test("uses equal inclusive periods and a Search Console freshness lag", () => {
  const periods = acquisitionPeriods(
    28,
    new Date("2026-07-30T12:00:00.000Z"),
  );
  assert.deepEqual(periods.ga4.current, {
    start: "2026-07-02",
    end: "2026-07-29",
  });
  assert.deepEqual(periods.ga4.previous, {
    start: "2026-06-04",
    end: "2026-07-01",
  });
  assert.deepEqual(periods.gsc.current, {
    start: "2026-06-30",
    end: "2026-07-27",
  });
});

test("recognizes native and disclosed AI referral traffic", () => {
  assert.equal(
    isAiAssistantTraffic({
      channelGroup: "AI Assistants",
      source: "(not set)",
    }),
    true,
  );
  assert.equal(
    isAiAssistantTraffic({
      channelGroup: "Referral",
      source: "chatgpt.com",
    }),
    true,
  );
  assert.equal(
    isAiAssistantTraffic({
      channelGroup: "Organic Search",
      source: "google",
    }),
    false,
  );
});

class FakeGoogleProvider implements GoogleDataProvider {
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
    request: Ga4ReportRequest,
  ): Promise<Ga4ReportResponse> {
    const current = request.start === "2026-07-02";
    return {
      dimensionHeaders: [
        { name: "sessionDefaultChannelGroup" },
        { name: "sessionSource" },
        { name: "sessionMedium" },
        { name: "landingPagePlusQueryString" },
      ],
      metricHeaders: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "engagedSessions" },
        { name: "keyEvents" },
        { name: "totalRevenue" },
      ],
      rows: [
        {
          dimensionValues: [
            { value: "AI Assistants" },
            { value: "chatgpt.com" },
            { value: "referral" },
            { value: "/pricing" },
          ],
          metricValues: [
            { value: current ? "20" : "10" },
            { value: current ? "18" : "9" },
            { value: current ? "12" : "6" },
            { value: current ? "2" : "1" },
            { value: current ? "100" : "50" },
          ],
        },
      ],
    };
  }

  async gscReport(
    _site: string,
    request: GscReportRequest,
  ): Promise<GscReportResponse> {
    const current = request.start === "2026-06-30";
    return {
      rows: [
        {
          keys: ["ai analytics", "https://example.com/analytics"],
          clicks: current ? 5 : 4,
          impressions: current ? 100 : 80,
          ctr: 0.05,
          position: 8,
        },
      ],
    };
  }
}

test("builds a provenance-aware acquisition comparison", async () => {
  const report = await buildAcquisitionReport(
    new FakeGoogleProvider(),
    {
      schemaVersion: "0.1.0",
      adapter: "external-command",
      scriptPath: "/tmp/google-data.mjs",
      profile: "test",
      ga4Property: "123456",
      gscSite: "sc-domain:example.com",
    },
    { days: 28, now: new Date("2026-07-30T12:00:00.000Z") },
  );

  assert.equal(report.observed.ga4.current.aiTraffic.sessions, 20);
  assert.equal(report.observed.ga4.change.aiSessionsPercent, 100);
  assert.equal(report.observed.gsc.current.impressions, 100);
  assert.equal(report.inferred.searchOpportunities.length, 1);
  assert.equal(report.evidenceClass.opportunities, "inferred");
});
