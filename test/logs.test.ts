import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeLogFile, parseLogLine } from "../src/core/logs.js";

test("parses Apache/Nginx combined logs and classifies claimed agents", () => {
  const result = parseLogLine(
    '127.0.0.1 - - [29/Jul/2026:10:00:00 +0000] "GET /guide HTTP/1.1" 200 420 "-" "ClaudeBot/1.0"',
  );

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  assert.equal(result.observation.path, "/guide");
  assert.equal(result.observation.status, 200);
  assert.equal(result.observation.agent.displayName, "ClaudeBot");
  assert.equal(result.observation.agent.behavior, "training");
});

test("analyzes NDJSON without retaining source IP fields", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "aitraffic-logs-"));
  const file = path.join(directory, "access.ndjson");
  await writeFile(
    file,
    [
      JSON.stringify({
        timestamp: "2026-07-29T10:00:00Z",
        method: "GET",
        path: "/docs",
        status: 200,
        userAgent: "PerplexityBot/1.0",
        ip: "192.0.2.1",
      }),
      JSON.stringify({
        timestamp: "2026-07-29T10:01:00Z",
        method: "GET",
        path: "/docs",
        status: 200,
        userAgent: "Mozilla/5.0",
        ip: "192.0.2.2",
      }),
    ].join("\n"),
    "utf8",
  );

  const analysis = await analyzeLogFile(file);
  assert.equal(analysis.totalLines, 2);
  assert.equal(analysis.claimedAgentRequests, 1);
  assert.equal(analysis.byAgent.PerplexityBot, 1);
  assert.deepEqual(analysis.topPaths[0], { path: "/docs", requests: 2 });
  assert.equal("ip" in analysis, false);
});
