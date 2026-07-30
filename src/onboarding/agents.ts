import { spawn } from "node:child_process";

import {
  getMcpLaunchCommand,
  type McpLaunchCommand,
  type ProjectAgentTarget,
} from "../core/project.js";
import { AppError } from "../core/result.js";

export type AgentTarget = ProjectAgentTarget;

export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export type ProcessRunner = (
  executable: string,
  args: string[],
  timeoutMs?: number,
) => Promise<ProcessResult>;

export interface AgentDetection {
  id: AgentTarget;
  label: string;
  executable: string;
  installed: boolean;
  configured: boolean;
  restartHint: string;
}

export interface AgentInstallCommand {
  executable: string;
  args: string[];
  display: string;
}

export interface AgentInstallResult {
  id: AgentTarget;
  label: string;
  status: "installed" | "already_configured";
  command: string;
  restartHint: string;
}

interface AgentDefinition {
  id: AgentTarget;
  label: string;
  executable: string;
  restartHint: string;
}

const MAX_CAPTURED_OUTPUT = 64 * 1024;

const AGENTS: readonly AgentDefinition[] = [
  {
    id: "codex",
    label: "Codex",
    executable: "codex",
    restartHint:
      "Start a new Codex task, or restart the Codex app/IDE extension.",
  },
  {
    id: "claude-code",
    label: "Claude Code",
    executable: "claude",
    restartHint:
      "Restart Claude Code and approve the project MCP server if prompted.",
  },
  {
    id: "hermes",
    label: "Hermes",
    executable: "hermes",
    restartHint: "Run /reload-mcp in Hermes, or restart Hermes.",
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    executable: "openclaw",
    restartHint: "Start a fresh OpenClaw session.",
  },
] as const;

function definitionFor(id: AgentTarget): AgentDefinition {
  const definition = AGENTS.find((candidate) => candidate.id === id);
  if (!definition) {
    throw new AppError("UNSUPPORTED_AGENT", `Unsupported agent: ${id}`);
  }
  return definition;
}

function appendCaptured(current: string, chunk: Buffer | string): string {
  if (current.length >= MAX_CAPTURED_OUTPUT) {
    return current;
  }
  return `${current}${String(chunk)}`.slice(0, MAX_CAPTURED_OUTPUT);
}

export const runProcess: ProcessRunner = async (
  executable,
  args,
  timeoutMs = 10_000,
) =>
  new Promise<ProcessResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const finish = (exitCode: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({ exitCode, stdout, stderr, timedOut });
    };
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendCaptured(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendCaptured(stderr, chunk);
    });
    child.once("error", () => finish(null));
    child.once("close", (code) => finish(code));
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
      finish(null);
    }, timeoutMs);
    timeout.unref();
  });

function shellArgument(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/u.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function renderAgentCommand(
  executable: string,
  args: string[],
): string {
  return [executable, ...args].map(shellArgument).join(" ");
}

export function buildAgentInstallCommand(
  id: AgentTarget,
  cwd = process.cwd(),
): AgentInstallCommand {
  const launch = getMcpLaunchCommand(cwd);
  let executable: string;
  let args: string[];

  switch (id) {
    case "codex":
      executable = "codex";
      args = [
        "mcp",
        "add",
        "aitraffic",
        "--",
        launch.command,
        ...launch.args,
      ];
      break;
    case "claude-code":
      executable = "claude";
      args = [
        "mcp",
        "add",
        "--scope",
        "project",
        "aitraffic",
        "--",
        launch.command,
        ...launch.args,
      ];
      break;
    case "hermes":
      executable = "hermes";
      args = [
        "mcp",
        "add",
        "aitraffic",
        "--command",
        launch.command,
        "--args",
        ...launch.args,
      ];
      break;
    case "openclaw":
      executable = "openclaw";
      args = [
        "mcp",
        "set",
        "aitraffic",
        JSON.stringify({
          command: launch.command,
          args: launch.args,
        } satisfies McpLaunchCommand),
      ];
      break;
  }

  return {
    executable,
    args,
    display: renderAgentCommand(executable, args),
  };
}

async function probeConfigured(
  id: AgentTarget,
  runner: ProcessRunner,
): Promise<boolean> {
  switch (id) {
    case "codex":
      return (await runner("codex", ["mcp", "get", "aitraffic"])).exitCode === 0;
    case "claude-code":
      return (
        await runner("claude", ["mcp", "get", "aitraffic"], 15_000)
      ).exitCode === 0;
    case "hermes": {
      const result = await runner("hermes", ["mcp", "list"], 15_000);
      return (
        result.exitCode === 0 &&
        /(^|\s)aitraffic(\s|$)/imu.test(
          `${result.stdout}\n${result.stderr}`,
        )
      );
    }
    case "openclaw":
      return (
        await runner(
          "openclaw",
          ["mcp", "show", "aitraffic", "--json"],
          15_000,
        )
      ).exitCode === 0;
  }
}

export async function detectAgentTargets(
  runner: ProcessRunner = runProcess,
): Promise<AgentDetection[]> {
  return Promise.all(
    AGENTS.map(async (definition) => {
      const version = await runner(
        definition.executable,
        ["--version"],
        5_000,
      );
      const installed = version.exitCode === 0;
      return {
        ...definition,
        installed,
        configured:
          installed && (await probeConfigured(definition.id, runner)),
      };
    }),
  );
}

export async function installAgentTarget(options: {
  id: AgentTarget;
  cwd?: string;
  runner?: ProcessRunner;
}): Promise<AgentInstallResult> {
  const runner = options.runner ?? runProcess;
  const definition = definitionFor(options.id);
  const command = buildAgentInstallCommand(
    options.id,
    options.cwd ?? process.cwd(),
  );
  const version = await runner(definition.executable, ["--version"], 5_000);
  if (version.exitCode !== 0) {
    throw new AppError(
      "AGENT_NOT_INSTALLED",
      `${definition.label} is not installed or is not available on PATH.`,
    );
  }
  if (await probeConfigured(options.id, runner)) {
    return {
      id: options.id,
      label: definition.label,
      status: "already_configured",
      command: command.display,
      restartHint: definition.restartHint,
    };
  }

  const result = await runner(command.executable, command.args, 60_000);
  if (result.exitCode !== 0) {
    throw new AppError(
      "AGENT_INSTALL_FAILED",
      `${definition.label} did not accept the AItraffic MCP registration.`,
      1,
      {
        agent: options.id,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
      },
    );
  }
  if (!(await probeConfigured(options.id, runner))) {
    throw new AppError(
      "AGENT_INSTALL_VERIFY_FAILED",
      `${definition.label} accepted the command, but AItraffic could not verify the registration.`,
      1,
      { agent: options.id },
    );
  }
  return {
    id: options.id,
    label: definition.label,
    status: "installed",
    command: command.display,
    restartHint: definition.restartHint,
  };
}
