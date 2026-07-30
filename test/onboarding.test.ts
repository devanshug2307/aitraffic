import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildAgentInstallCommand,
  detectAgentTargets,
  installAgentTarget,
  type ProcessRunner,
  type ProcessResult,
} from "../src/onboarding/agents.js";

function result(
  exitCode: number | null,
  stdout = "",
  stderr = "",
): ProcessResult {
  return {
    exitCode,
    stdout,
    stderr,
    timedOut: false,
  };
}

test("builds shell-free registration commands for all supported agents", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-onboard-"));
  const codex = buildAgentInstallCommand("codex", cwd);
  assert.equal(codex.executable, "codex");
  assert.deepEqual(codex.args, [
    "mcp",
    "add",
    "aitraffic",
    "--",
    "npx",
    "-y",
    "aitraffic@0.7.0",
    "mcp",
    "serve",
  ]);

  const claude = buildAgentInstallCommand("claude-code", cwd);
  assert.deepEqual(claude.args.slice(0, 6), [
    "mcp",
    "add",
    "--scope",
    "project",
    "aitraffic",
    "--",
  ]);

  const hermes = buildAgentInstallCommand("hermes", cwd);
  assert.deepEqual(hermes.args.slice(0, 6), [
    "mcp",
    "add",
    "aitraffic",
    "--command",
    "npx",
    "--args",
  ]);

  const openclaw = buildAgentInstallCommand("openclaw", cwd);
  const config = JSON.parse(openclaw.args[3] ?? "") as {
    command: string;
    args: string[];
  };
  assert.equal(config.command, "npx");
  assert.deepEqual(config.args.slice(-2), ["mcp", "serve"]);
  assert.equal(openclaw.display.includes("clientSecret"), false);
});

test("detects installed and already-configured agents without writing", async () => {
  const runner: ProcessRunner = async (executable, args) => {
    if (args[0] === "--version") {
      return result(0, `${executable} 1.0`);
    }
    if (executable === "codex" && args[1] === "get") {
      return result(0, "aitraffic");
    }
    if (executable === "hermes" && args[1] === "list") {
      return result(0, "aitraffic  stdio");
    }
    return result(1);
  };
  const detected = await detectAgentTargets(runner);

  assert.deepEqual(
    detected.map((agent) => ({
      id: agent.id,
      installed: agent.installed,
      configured: agent.configured,
    })),
    [
      { id: "codex", installed: true, configured: true },
      { id: "claude-code", installed: true, configured: false },
      { id: "hermes", installed: true, configured: true },
      { id: "openclaw", installed: true, configured: false },
    ],
  );
});

test("registers an agent once and verifies the result", async () => {
  let configured = false;
  let addCalls = 0;
  const runner: ProcessRunner = async (executable, args) => {
    if (executable !== "hermes") {
      return result(1);
    }
    if (args[0] === "--version") {
      return result(0, "Hermes 1.0");
    }
    if (args[0] === "mcp" && args[1] === "list") {
      return result(0, configured ? "aitraffic  stdio" : "No servers");
    }
    if (args[0] === "mcp" && args[1] === "add") {
      addCalls += 1;
      configured = true;
      return result(0);
    }
    return result(1);
  };
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-onboard-"));
  const first = await installAgentTarget({
    id: "hermes",
    cwd,
    runner,
  });
  const second = await installAgentTarget({
    id: "hermes",
    cwd,
    runner,
  });

  assert.equal(first.status, "installed");
  assert.equal(second.status, "already_configured");
  assert.equal(addCalls, 1);
});

test("offers a non-interactive JSON inspection and never starts prompts", () => {
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const checked = spawnSync(
    process.execPath,
    [cli, "onboard", "--check", "--format", "json"],
    { encoding: "utf8", timeout: 30_000 },
  );

  assert.equal(checked.status, 0, checked.stderr);
  const parsed = JSON.parse(checked.stdout) as {
    ok: boolean;
    command: string;
    data: {
      interactive: boolean;
      agents: unknown[];
      google: unknown;
    };
  };
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, "onboard check");
  assert.equal(parsed.data.interactive, false);
  assert.ok(Array.isArray(parsed.data.agents));
  const rendered = JSON.stringify(parsed.data.google);
  assert.equal(rendered.includes("accessToken"), false);
  assert.equal(rendered.includes("refreshToken"), false);
  assert.equal(rendered.includes("clientSecret"), false);

  const interactiveJson = spawnSync(
    process.execPath,
    [cli, "onboard", "--format", "json"],
    { encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(interactiveJson.status, 2);
  assert.match(
    interactiveJson.stdout,
    /ONBOARDING_INTERACTIVE_JSON_UNSUPPORTED/u,
  );
});
