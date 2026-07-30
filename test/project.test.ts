import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runDoctor } from "../src/commands/doctor.js";
import {
  getAgentSetupCommands,
  initializeProject,
  resolveReadableProjectFile,
} from "../src/core/project.js";

test("initializes a project without inventing credentials", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "aitraffic-project-"));
  const result = await initializeProject({
    cwd: directory,
    agentIntegration: "both",
    siteUrl: "https://example.com",
  });

  assert.equal(result.config.projectName, path.basename(directory));
  assert.equal(result.config.siteUrl, "https://example.com");
  assert.ok(
    result.setup.codex?.includes(
      "codex mcp add aitraffic -- npx -y aitraffic@0.4.0 mcp serve",
    ),
  );
  assert.ok(result.setup.claudeCode?.includes("claude mcp add"));
  assert.equal("credentials" in result.config, false);
});

test("uses the published package command outside the source checkout", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "aitraffic-npx-"));
  const setup = getAgentSetupCommands(directory);
  const doctor = await runDoctor(directory);

  assert.equal(
    setup.codex,
    "codex mcp add aitraffic -- npx -y aitraffic@0.4.0 mcp serve",
  );
  assert.equal(
    doctor.checks.find((check) => check.id === "build")?.status,
    "pass",
  );
});

test("restricts MCP reads to the current project", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "aitraffic-safe-"));
  const outside = await mkdtemp(path.join(tmpdir(), "aitraffic-outside-"));
  const outsideFile = path.join(outside, "access.log");
  await writeFile(outsideFile, "sensitive", "utf8");

  await assert.rejects(
    resolveReadableProjectFile(outsideFile, project),
    /restricted to the current project/,
  );
});
