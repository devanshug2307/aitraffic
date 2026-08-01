import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  getMcpLaunchCommand,
} from "../core/project.js";
import { AppError } from "../core/result.js";
import { VERSION } from "../core/version.js";
import {
  buildAgentInstallCommand,
  renderAgentCommand,
  runProcess,
  type AgentInstallCommand,
  type ProcessRunner,
} from "./agents.js";

export type RegistrationAgent = "codex" | "claude-code";
export type RegistrationState =
  | "not_installed"
  | "missing"
  | "healthy"
  | "pending_approval"
  | "drifted"
  | "broken"
  | "unverifiable";

export interface RegistrationIssue {
  code:
    | "disabled"
    | "malformed_config"
    | "non_stdio_transport"
    | "custom_environment"
    | "wrong_command"
    | "wrong_arguments"
    | "stale_package"
    | "newer_package"
    | "wrong_project"
    | "wrong_scope"
    | "target_missing"
    | "unreadable_registration";
  message: string;
}

export interface RegistrationOperation {
  kind: "remove" | "add";
  executable: string;
  args: string[];
  display: string;
}

export interface AgentRegistrationInspection {
  id: RegistrationAgent;
  label: string;
  installed: boolean;
  configured: boolean;
  state: RegistrationState;
  scope: "global" | "local" | "project" | "user" | null;
  observed: {
    transport: "stdio" | "other" | "unknown";
    runtime: "node" | "npx" | "other" | "unknown";
    packageVersion: string | null;
    environmentConfigured: boolean;
  } | null;
  expected: {
    command: string;
    args: string[];
    display: string;
  };
  issues: RegistrationIssue[];
  fingerprint: string;
  repair: {
    needed: boolean;
    automatic: boolean;
    requiresConfirmation: true;
    dryRunCommand: string;
    operations: RegistrationOperation[];
  };
  restartHint: string;
}

export interface RegistrationRepairResult {
  id: RegistrationAgent;
  label: string;
  status: "planned" | "repaired" | "already_healthy";
  dryRun: boolean;
  before: AgentRegistrationInspection;
  after: AgentRegistrationInspection | null;
  operations: RegistrationOperation[];
}

interface RawRegistration {
  command: string;
  args: string[];
  cwd: string | null;
  scope: AgentRegistrationInspection["scope"];
  transport: "stdio" | "other" | "unknown";
  enabled: boolean;
  envPresent: boolean;
  pendingApproval: boolean;
}

interface DetailedInspection {
  public: AgentRegistrationInspection;
  raw: RawRegistration | null;
}

const MAX_CONFIG_BYTES = 1024 * 1024;
const RESTART_HINTS: Record<RegistrationAgent, string> = {
  codex: "Start a new Codex task, or restart the Codex app/IDE extension.",
  "claude-code":
    "Restart Claude Code and approve the project MCP server if prompted.",
};

function labelFor(id: RegistrationAgent): string {
  return id === "codex" ? "Codex" : "Claude Code";
}

function executableFor(id: RegistrationAgent): string {
  return id === "codex" ? "codex" : "claude";
}

function hash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string")
    ? value
    : null;
}

async function readJsonFile(file: string): Promise<unknown | null> {
  try {
    const contents = await readFile(file, "utf8");
    if (Buffer.byteLength(contents) > MAX_CONFIG_BYTES) {
      throw new Error("configuration exceeds the 1 MiB inspection limit");
    }
    return JSON.parse(contents) as unknown;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function rawFromConfig(
  value: unknown,
  scope: RawRegistration["scope"],
): RawRegistration | null {
  const config = object(value);
  if (config === null) {
    return null;
  }
  const command =
    typeof config.command === "string" ? config.command : null;
  const args = stringArray(config.args);
  if (command === null || args === null) {
    return null;
  }
  const env = object(config.env);
  return {
    command,
    args,
    cwd: typeof config.cwd === "string" ? config.cwd : null,
    scope,
    transport:
      config.type === undefined || config.type === "stdio"
        ? "stdio"
        : "other",
    enabled: config.enabled !== false,
    envPresent: env !== null && Object.keys(env).length > 0,
    pendingApproval: false,
  };
}

async function inspectCodexRaw(
  runner: ProcessRunner,
): Promise<{ raw: RawRegistration | null; malformed: boolean }> {
  const result = await runner(
    "codex",
    ["mcp", "get", "aitraffic", "--json"],
    15_000,
  );
  if (result.exitCode !== 0) {
    return { raw: null, malformed: false };
  }
  try {
    const parsed = object(JSON.parse(result.stdout) as unknown);
    const transport = object(parsed?.transport);
    const command =
      typeof transport?.command === "string" ? transport.command : null;
    const args = stringArray(transport?.args);
    if (parsed === null || transport === null || command === null || args === null) {
      return { raw: null, malformed: true };
    }
    const env = object(transport.env);
    const envVars = Array.isArray(transport.env_vars)
      ? transport.env_vars
      : [];
    return {
      malformed: false,
      raw: {
        command,
        args,
        cwd: typeof transport.cwd === "string" ? transport.cwd : null,
        scope: "global",
        transport: transport.type === "stdio" ? "stdio" : "other",
        enabled: parsed.enabled !== false,
        envPresent:
          (env !== null && Object.keys(env).length > 0) ||
          envVars.length > 0,
        pendingApproval: false,
      },
    };
  } catch {
    return { raw: null, malformed: true };
  }
}

async function inspectClaudeRaw(
  cwd: string,
  runner: ProcessRunner,
  homeDirectory: string,
): Promise<{ raw: RawRegistration | null; malformed: boolean }> {
  const projectFile = path.join(cwd, ".mcp.json");
  let project: unknown | null;
  let user: unknown | null;
  try {
    [project, user] = await Promise.all([
      readJsonFile(projectFile),
      readJsonFile(path.join(homeDirectory, ".claude.json")),
    ]);
  } catch {
    return { raw: null, malformed: true };
  }

  const projectRoot = object(project);
  const projectServers = object(projectRoot?.mcpServers);
  const projectEntry = projectServers?.aitraffic;

  const userRoot = object(user);
  const projects = object(userRoot?.projects);
  const localProject = object(projects?.[cwd]);
  const localServers = object(localProject?.mcpServers);
  const localEntry = localServers?.aitraffic;
  const userServers = object(userRoot?.mcpServers);
  const userEntry = userServers?.aitraffic;

  const selected =
    localEntry !== undefined
      ? { value: localEntry, scope: "local" as const }
      : projectEntry !== undefined
        ? { value: projectEntry, scope: "project" as const }
        : userEntry !== undefined
          ? { value: userEntry, scope: "user" as const }
          : null;
  if (selected === null) {
    const cli = await runner(
      "claude",
      ["mcp", "get", "aitraffic"],
      15_000,
    );
    return {
      raw: null,
      malformed: cli.exitCode === 0,
    };
  }
  const raw = rawFromConfig(selected.value, selected.scope);
  if (raw === null) {
    return { raw: null, malformed: true };
  }
  const cli = await runner(
    "claude",
    ["mcp", "get", "aitraffic"],
    15_000,
  );
  raw.pendingApproval =
    cli.exitCode === 0 &&
    /pending approval/iu.test(`${cli.stdout}\n${cli.stderr}`);
  return { raw, malformed: false };
}

function runtimeFor(command: string): "node" | "npx" | "other" {
  const executable = path.basename(command).toLowerCase().replace(/\.cmd$/u, "");
  if (executable === "node") {
    return "node";
  }
  if (executable === "npx") {
    return "npx";
  }
  return "other";
}

function packageVersion(raw: RawRegistration): string | null {
  if (runtimeFor(raw.command) !== "npx") {
    return null;
  }
  const packageArg = raw.args.find((value) => value.startsWith("aitraffic@"));
  return packageArg?.slice("aitraffic@".length) ?? null;
}

function compareNumericVersions(left: string, right: string): number | null {
  const parse = (value: string): number[] | null => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u.exec(value);
    return match
      ? [Number(match[1]), Number(match[2]), Number(match[3])]
      : null;
  };
  const a = parse(left);
  const b = parse(right);
  if (a === null || b === null) {
    return null;
  }
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function normalizeNpxArgs(args: string[]): string[] {
  return args.map((value) => (value === "--yes" ? "-y" : value));
}

function normalizeNodeArgs(
  command: string,
  args: string[],
  base: string,
): { command: string; args: string[] } {
  if (runtimeFor(command) !== "node" || !args[0]) {
    return { command: runtimeFor(command), args };
  }
  return {
    command: "node",
    args: [path.resolve(base, args[0]), ...args.slice(1)],
  };
}

function expectedMatches(
  raw: RawRegistration,
  cwd: string,
): { matches: boolean; issues: RegistrationIssue[] } {
  const expected = getMcpLaunchCommand(cwd);
  const issues: RegistrationIssue[] = [];
  if (!raw.enabled) {
    issues.push({
      code: "disabled",
      message: "The registration is disabled.",
    });
  }
  if (raw.transport !== "stdio") {
    issues.push({
      code: "non_stdio_transport",
      message: "AItraffic requires a local stdio registration.",
    });
  }
  if (raw.envPresent) {
    issues.push({
      code: "custom_environment",
      message:
        "The registration contains custom environment values and will not be replaced automatically.",
    });
  }

  const actualRuntime = runtimeFor(raw.command);
  const expectedRuntime = runtimeFor(expected.command);
  if (actualRuntime !== expectedRuntime) {
    issues.push({
      code: "wrong_command",
      message: `The registration uses ${actualRuntime}, but this project expects ${expectedRuntime}.`,
    });
    const version = packageVersion(raw);
    if (actualRuntime === "npx" && version !== null) {
      const order = compareNumericVersions(version, VERSION);
      issues.push({
        code: order !== null && order > 0
          ? "newer_package"
          : "stale_package",
        message:
          order !== null && order > 0
            ? `The registration uses newer aitraffic@${version}; AItraffic will not downgrade it automatically.`
            : `The registration launches aitraffic@${version} instead of this project's active runtime.`,
      });
    }
  }

  const actualBase = raw.cwd === null ? cwd : path.resolve(cwd, raw.cwd);
  const actual = normalizeNodeArgs(raw.command, raw.args, actualBase);
  const desired = normalizeNodeArgs(expected.command, expected.args, cwd);
  if (actual.command === "npx") {
    actual.args = normalizeNpxArgs(actual.args);
  }
  if (desired.command === "npx") {
    desired.args = normalizeNpxArgs(desired.args);
  }
  const observedVersion = packageVersion(raw);
  const versionOrder =
    observedVersion === null
      ? null
      : compareNumericVersions(observedVersion, VERSION);
  if (
    actual.command === desired.command &&
    JSON.stringify(actual.args) !== JSON.stringify(desired.args)
  ) {
    const version = observedVersion;
    if (actualRuntime === "npx" && version !== null) {
      issues.push({
        code: versionOrder !== null && versionOrder > 0
          ? "newer_package"
          : "stale_package",
        message:
          versionOrder !== null && versionOrder > 0
            ? `The registration uses newer aitraffic@${version}; AItraffic will not downgrade it automatically.`
            : `The registration uses aitraffic@${version}; this runtime expects aitraffic@${packageVersion({
                ...raw,
                command: expected.command,
                args: expected.args,
              }) ?? "the active project build"}.`,
      });
    } else if (actualRuntime === "node" && actual.args[0] !== desired.args[0]) {
      issues.push({
        code: "wrong_project",
        message:
          "The registration points to a different local AItraffic runtime.",
      });
    } else {
      issues.push({
        code: "wrong_arguments",
        message: "The registration does not use the expected MCP serve arguments.",
      });
    }
  }
  if (
    raw.scope !== null &&
    raw.scope !== "global" &&
    raw.scope !== "project"
  ) {
    issues.push({
      code: "wrong_scope",
      message: `Claude Code resolves this registration from ${raw.scope} scope instead of the current project.`,
    });
  }
  return { matches: issues.length === 0, issues };
}

function removeOperation(
  id: RegistrationAgent,
  scope: RawRegistration["scope"],
): RegistrationOperation {
  const executable = executableFor(id);
  const args =
    id === "codex"
      ? ["mcp", "remove", "aitraffic"]
      : [
          "mcp",
          "remove",
          "--scope",
          scope === "local" ? "local" : "project",
          "aitraffic",
        ];
  return {
    kind: "remove",
    executable,
    args,
    display: renderAgentCommand(executable, args),
  };
}

function addOperation(command: AgentInstallCommand): RegistrationOperation {
  return { kind: "add", ...command };
}

function restoreOperation(
  id: RegistrationAgent,
  raw: RawRegistration,
): RegistrationOperation {
  const executable = executableFor(id);
  const args =
    id === "codex"
      ? ["mcp", "add", "aitraffic", "--", raw.command, ...raw.args]
      : [
          "mcp",
          "add",
          "--scope",
          raw.scope === "local" ? "local" : "project",
          "aitraffic",
          "--",
          raw.command,
          ...raw.args,
        ];
  return {
    kind: "add",
    executable,
    args,
    display: renderAgentCommand(executable, args),
  };
}

async function inspectDetailed(
  id: RegistrationAgent,
  cwd: string,
  runner: ProcessRunner,
  homeDirectory: string,
): Promise<DetailedInspection> {
  const label = labelFor(id);
  const expectedCommand = buildAgentInstallCommand(id, cwd);
  const version = await runner(executableFor(id), ["--version"], 5_000);
  const installed = version.exitCode === 0;
  const inspected = !installed
    ? { raw: null, malformed: false }
    : id === "codex"
      ? await inspectCodexRaw(runner)
      : await inspectClaudeRaw(cwd, runner, homeDirectory);
  const raw = inspected.raw;
  const configured = raw !== null || inspected.malformed;
  const match =
    raw === null ? { matches: false, issues: [] } : expectedMatches(raw, cwd);
  const issues = [...match.issues];
  if (inspected.malformed) {
    issues.push({
      code: "malformed_config",
      message:
        "The existing registration could not be parsed safely and will not be replaced automatically.",
    });
  }

  let state: RegistrationState;
  if (!installed) {
    state = "not_installed";
  } else if (inspected.malformed) {
    state = "unverifiable";
  } else if (raw === null) {
    state = "missing";
  } else if (match.matches && raw.pendingApproval) {
    state = "pending_approval";
  } else if (match.matches) {
    state = "healthy";
  } else {
    state = issues.some(({ code }) =>
      ["malformed_config", "target_missing"].includes(code),
    )
      ? "broken"
      : "drifted";
  }

  const automatic =
    installed &&
    !inspected.malformed &&
    (raw === null || runtimeFor(raw.command) !== "other") &&
    !issues.some(({ code }) =>
      [
        "malformed_config",
        "custom_environment",
        "non_stdio_transport",
        "newer_package",
      ].includes(code),
    );
  const operations: RegistrationOperation[] = [];
  if (
    automatic &&
    raw !== null &&
    (id === "codex" || raw.scope === "local" || raw.scope === "project")
  ) {
    operations.push(removeOperation(id, raw.scope));
  }
  if (
    automatic &&
    state !== "healthy" &&
    state !== "pending_approval" &&
    !(id === "claude-code" && raw?.scope === "local")
  ) {
    operations.push(addOperation(expectedCommand));
  }

  const publicInspection: AgentRegistrationInspection = {
    id,
    label,
    installed,
    configured,
    state,
    scope: raw?.scope ?? null,
    observed:
      raw === null
        ? null
        : {
            transport: raw.transport,
            runtime: runtimeFor(raw.command),
            packageVersion: packageVersion(raw),
            environmentConfigured: raw.envPresent,
          },
    expected: {
      command: expectedCommand.executable,
      args: expectedCommand.args,
      display: expectedCommand.display,
    },
    issues,
    fingerprint: hash({ installed, malformed: inspected.malformed, raw }),
    repair: {
      needed: !["healthy", "pending_approval"].includes(state),
      automatic,
      requiresConfirmation: true,
      dryRunCommand: `aitraffic doctor --repair ${id} --dry-run`,
      operations,
    },
    restartHint: RESTART_HINTS[id],
  };
  return { public: publicInspection, raw };
}

export async function inspectAgentRegistration(
  id: RegistrationAgent,
  options: {
    cwd?: string;
    runner?: ProcessRunner;
    homeDirectory?: string;
  } = {},
): Promise<AgentRegistrationInspection> {
  const cwd = await realpath(options.cwd ?? process.cwd());
  return (
    await inspectDetailed(
      id,
      cwd,
      options.runner ?? runProcess,
      options.homeDirectory ?? homedir(),
    )
  ).public;
}

export async function inspectAgentRegistrations(
  options: {
    cwd?: string;
    runner?: ProcessRunner;
    homeDirectory?: string;
  } = {},
): Promise<AgentRegistrationInspection[]> {
  return Promise.all(
    (["codex", "claude-code"] as const).map((id) =>
      inspectAgentRegistration(id, options),
    ),
  );
}

async function executeOperation(
  operation: RegistrationOperation,
  runner: ProcessRunner,
): Promise<void> {
  const result = await runner(operation.executable, operation.args, 60_000);
  if (result.exitCode !== 0) {
    throw new AppError(
      "AGENT_REPAIR_OPERATION_FAILED",
      `Registration repair failed while running: ${operation.display}`,
      1,
      {
        operation: operation.kind,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
      },
    );
  }
}

export async function repairAgentRegistration(options: {
  id: RegistrationAgent;
  cwd?: string;
  runner?: ProcessRunner;
  homeDirectory?: string;
  dryRun?: boolean;
  confirmed?: boolean;
  expectedFingerprint?: string;
}): Promise<RegistrationRepairResult> {
  const cwd = await realpath(options.cwd ?? process.cwd());
  const runner = options.runner ?? runProcess;
  const detailed = await inspectDetailed(
    options.id,
    cwd,
    runner,
    options.homeDirectory ?? homedir(),
  );
  const before = detailed.public;
  if (options.expectedFingerprint && options.expectedFingerprint !== before.fingerprint) {
    throw new AppError(
      "AGENT_REPAIR_STATE_CHANGED",
      "The registration changed after it was reviewed. Run the dry run again.",
      2,
    );
  }
  if (!before.repair.needed) {
    return {
      id: options.id,
      label: before.label,
      status: "already_healthy",
      dryRun: options.dryRun === true,
      before,
      after: before,
      operations: [],
    };
  }
  if (!before.repair.automatic) {
    throw new AppError(
      "AGENT_REPAIR_MANUAL_REVIEW_REQUIRED",
      `${before.label} has an unfamiliar or customized registration. AItraffic will not overwrite it automatically.`,
      2,
      { issues: before.issues.map(({ code }) => code) },
    );
  }
  if (options.dryRun) {
    return {
      id: options.id,
      label: before.label,
      status: "planned",
      dryRun: true,
      before,
      after: null,
      operations: before.repair.operations,
    };
  }
  if (!options.confirmed) {
    throw new AppError(
      "AGENT_REPAIR_CONFIRMATION_REQUIRED",
      `Review ${before.repair.dryRunCommand}, then repeat with --yes to confirm the exact operations.`,
      2,
      { fingerprint: before.fingerprint },
    );
  }

  const completed: RegistrationOperation[] = [];
  let attemptedAdd = false;
  let after: AgentRegistrationInspection;
  try {
    for (const operation of before.repair.operations) {
      attemptedAdd ||= operation.kind === "add";
      await executeOperation(operation, runner);
      completed.push(operation);
    }
    after = await inspectAgentRegistration(options.id, {
      cwd,
      runner,
      ...(options.homeDirectory !== undefined
        ? { homeDirectory: options.homeDirectory }
        : {}),
    });
    if (!["healthy", "pending_approval"].includes(after.state)) {
      throw new AppError(
        "AGENT_REPAIR_VERIFY_FAILED",
        `${before.label} accepted the repair operations, but the resulting registration is not healthy.`,
        1,
        { state: after.state, issues: after.issues.map(({ code }) => code) },
      );
    }
  } catch (error) {
    let rollback: "not_needed" | "restored" | "failed" = "not_needed";
    const removedOriginal = completed.some(
      ({ kind }) => kind === "remove",
    );
    if (attemptedAdd) {
      try {
        await executeOperation(
          removeOperation(options.id, detailed.raw?.scope ?? null),
          runner,
        );
      } catch {
        // A rejected add commonly leaves nothing to remove.
      }
    }
    if (removedOriginal && detailed.raw !== null) {
      rollback = "failed";
      try {
        await executeOperation(
          restoreOperation(options.id, detailed.raw),
          runner,
        );
        rollback = "restored";
      } catch {
        rollback = "failed";
      }
    }
    throw new AppError(
      "AGENT_REPAIR_FAILED",
      rollback === "restored"
        ? `${before.label} repair failed; the previous registration was restored.`
        : rollback === "failed"
          ? `${before.label} repair failed and the previous registration could not be restored automatically.`
          : `${before.label} repair failed before the existing registration was removed.`,
      1,
      {
        rollback,
        cause: error instanceof AppError ? error.code : "UNEXPECTED_ERROR",
      },
    );
  }
  return {
    id: options.id,
    label: before.label,
    status: "repaired",
    dryRun: false,
    before,
    after,
    operations: before.repair.operations,
  };
}
