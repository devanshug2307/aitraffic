import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  inspectAgentRegistration,
  repairAgentRegistration,
} from "../src/onboarding/registrations.js";
import type {
  ProcessResult,
  ProcessRunner,
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

function codexRegistration(args: string[]): string {
  return JSON.stringify({
    name: "aitraffic",
    enabled: true,
    transport: {
      type: "stdio",
      command: "npx",
      args,
      env: {},
      cwd: null,
    },
  });
}

test("detects a stale Codex registration and keeps dry-run read-only", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-repair-"));
  const calls: string[][] = [];
  const runner: ProcessRunner = async (executable, args) => {
    calls.push([executable, ...args]);
    if (args[0] === "--version") {
      return result(0, "codex 1.0");
    }
    if (args[0] === "mcp" && args[1] === "get") {
      return result(
        0,
        codexRegistration([
          "-y",
          "aitraffic@0.2.1",
          "mcp",
          "serve",
        ]),
      );
    }
    return result(1);
  };

  const planned = await repairAgentRegistration({
    id: "codex",
    cwd,
    runner,
    dryRun: true,
  });

  assert.equal(planned.status, "planned");
  assert.equal(planned.before.state, "drifted");
  assert.equal(
    planned.before.issues.some(({ code }) => code === "stale_package"),
    true,
  );
  assert.deepEqual(
    planned.operations.map(({ kind }) => kind),
    ["remove", "add"],
  );
  assert.equal(
    calls.some((call) => call[2] === "remove" || call[2] === "add"),
    false,
  );
});

test("requires confirmation, repairs Codex, and verifies the new command", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-repair-"));
  let configuredArgs = [
    "-y",
    "aitraffic@0.2.1",
    "mcp",
    "serve",
  ];
  let removeCalls = 0;
  let addCalls = 0;
  const runner: ProcessRunner = async (_executable, args) => {
    if (args[0] === "--version") {
      return result(0, "codex 1.0");
    }
    if (args[0] === "mcp" && args[1] === "get") {
      return result(0, codexRegistration(configuredArgs));
    }
    if (args[0] === "mcp" && args[1] === "remove") {
      removeCalls += 1;
      configuredArgs = [];
      return result(0);
    }
    if (args[0] === "mcp" && args[1] === "add") {
      addCalls += 1;
      const separator = args.indexOf("--");
      configuredArgs = args.slice(separator + 2);
      return result(0);
    }
    return result(1);
  };

  await assert.rejects(
    repairAgentRegistration({ id: "codex", cwd, runner }),
    /repeat with --yes/u,
  );
  assert.equal(removeCalls, 0);
  assert.equal(addCalls, 0);

  const repaired = await repairAgentRegistration({
    id: "codex",
    cwd,
    runner,
    confirmed: true,
  });
  assert.equal(repaired.status, "repaired");
  assert.equal(repaired.after?.state, "healthy");
  assert.equal(removeCalls, 1);
  assert.equal(addCalls, 1);
});

test("accepts npx --yes but refuses to downgrade a newer package pin", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-repair-"));
  let configuredArgs = [
    "--yes",
    "aitraffic@0.8.0",
    "mcp",
    "serve",
  ];
  const runner: ProcessRunner = async (_executable, args) => {
    if (args[0] === "--version") {
      return result(0, "codex 1.0");
    }
    return result(0, codexRegistration(configuredArgs));
  };

  const current = await inspectAgentRegistration("codex", {
    cwd,
    runner,
  });
  assert.equal(current.state, "healthy");

  configuredArgs = ["-y", "aitraffic@99.0.0", "mcp", "serve"];
  const newer = await inspectAgentRegistration("codex", {
    cwd,
    runner,
  });
  assert.equal(
    newer.issues.some(({ code }) => code === "newer_package"),
    true,
  );
  assert.equal(newer.repair.automatic, false);
});

test("accepts Claude's project-relative local runtime and pending approval", async () => {
  const homeDirectory = await mkdtemp(
    path.join(tmpdir(), "aitraffic-claude-home-"),
  );
  const runner: ProcessRunner = async (_executable, args) => {
    if (args[0] === "--version") {
      return result(0, "claude 1.0");
    }
    if (args[0] === "mcp" && args[1] === "get") {
      return result(0, "Status: Pending approval");
    }
    return result(1);
  };

  const inspected = await inspectAgentRegistration("claude-code", {
    cwd: process.cwd(),
    homeDirectory,
    runner,
  });

  assert.equal(inspected.state, "pending_approval");
  assert.equal(inspected.scope, "project");
  assert.equal(inspected.repair.needed, false);
});

test("restores the previous safe registration when replacement fails", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-repair-"));
  const staleArgs = [
    "-y",
    "aitraffic@0.2.1",
    "mcp",
    "serve",
  ];
  let configuredArgs = [...staleArgs];
  let addCalls = 0;
  const runner: ProcessRunner = async (_executable, args) => {
    if (args[0] === "--version") {
      return result(0, "codex 1.0");
    }
    if (args[0] === "mcp" && args[1] === "get") {
      return result(0, codexRegistration(configuredArgs));
    }
    if (args[0] === "mcp" && args[1] === "remove") {
      configuredArgs = [];
      return result(0);
    }
    if (args[0] === "mcp" && args[1] === "add") {
      addCalls += 1;
      const separator = args.indexOf("--");
      const nextArgs = args.slice(separator + 2);
      if (addCalls === 1) {
        return result(1, "", "replacement rejected");
      }
      configuredArgs = nextArgs;
      return result(0);
    }
    return result(1);
  };

  await assert.rejects(
    repairAgentRegistration({
      id: "codex",
      cwd,
      runner,
      confirmed: true,
    }),
    /previous registration was restored/u,
  );
  assert.deepEqual(configuredArgs, staleArgs);
  assert.equal(addCalls, 2);
});

test("redacts custom Claude environment values and refuses replacement", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "aitraffic-claude-"));
  const homeDirectory = await mkdtemp(
    path.join(tmpdir(), "aitraffic-claude-home-"),
  );
  await writeFile(
    path.join(cwd, ".mcp.json"),
    JSON.stringify({
      mcpServers: {
        aitraffic: {
          command: "npx",
          args: ["-y", "aitraffic@0.2.1", "mcp", "serve"],
          env: { PRIVATE_TOKEN: "must-never-appear" },
        },
      },
    }),
    "utf8",
  );
  const runner: ProcessRunner = async (_executable, args) =>
    args[0] === "--version"
      ? result(0, "claude 1.0")
      : result(0, "Scope: Project");

  const inspected = await inspectAgentRegistration("claude-code", {
    cwd,
    homeDirectory,
    runner,
  });
  const rendered = JSON.stringify(inspected);

  assert.equal(inspected.observed?.environmentConfigured, true);
  assert.equal(inspected.repair.automatic, false);
  assert.equal(rendered.includes("must-never-appear"), false);
  await assert.rejects(
    repairAgentRegistration({
      id: "claude-code",
      cwd,
      homeDirectory,
      runner,
      confirmed: true,
    }),
    /will not overwrite it automatically/u,
  );
});
