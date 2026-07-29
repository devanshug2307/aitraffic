import {
  access,
  mkdir,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { AppError } from "./result.js";
import { SCHEMA_VERSION } from "./version.js";

export type AgentIntegration = "codex" | "claude-code" | "both";

export interface ProjectConfig {
  schemaVersion: typeof SCHEMA_VERSION;
  projectName: string;
  createdAt: string;
  agentIntegration: AgentIntegration;
  siteUrl?: string;
}

export interface ProjectInitialization {
  configPath: string;
  config: ProjectConfig;
  setup: {
    codex?: string;
    claudeCode?: string;
  };
}

export const PROJECT_DIRECTORY = ".aitraffic";
export const PROJECT_FILE = "project.json";

export function projectConfigPath(cwd = process.cwd()): string {
  return path.join(cwd, PROJECT_DIRECTORY, PROJECT_FILE);
}

function quoteShellArgument(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function getAgentSetupCommands(cwd = process.cwd()): {
  codex: string;
  claudeCode: string;
} {
  const executable = path.join(cwd, "dist", "src", "cli.js");
  const command = `node ${quoteShellArgument(executable)} mcp serve`;

  return {
    codex: `codex mcp add aitraffic -- ${command}`,
    claudeCode: `claude mcp add --scope project aitraffic -- ${command}`,
  };
}

export async function initializeProject(options: {
  cwd?: string;
  force?: boolean;
  siteUrl?: string;
  agentIntegration?: AgentIntegration;
}): Promise<ProjectInitialization> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = projectConfigPath(cwd);
  const agentIntegration = options.agentIntegration ?? "both";

  if (!options.force) {
    try {
      await access(configPath);
      throw new AppError(
        "PROJECT_ALREADY_INITIALIZED",
        `${configPath} already exists. Use --force to replace it.`,
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
    }
  }

  if (options.siteUrl !== undefined) {
    try {
      new URL(options.siteUrl);
    } catch {
      throw new AppError(
        "INVALID_SITE_URL",
        `Invalid site URL: ${options.siteUrl}`,
      );
    }
  }

  const config: ProjectConfig = {
    schemaVersion: SCHEMA_VERSION,
    projectName: path.basename(cwd),
    createdAt: new Date().toISOString(),
    agentIntegration,
  };
  if (options.siteUrl !== undefined) {
    config.siteUrl = options.siteUrl;
  }

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const commands = getAgentSetupCommands(cwd);
  const setup: ProjectInitialization["setup"] = {};
  if (agentIntegration === "codex" || agentIntegration === "both") {
    setup.codex = commands.codex;
  }
  if (agentIntegration === "claude-code" || agentIntegration === "both") {
    setup.claudeCode = commands.claudeCode;
  }

  return { configPath, config, setup };
}

export async function readProjectConfig(
  cwd = process.cwd(),
): Promise<ProjectConfig | null> {
  try {
    const contents = await readFile(projectConfigPath(cwd), "utf8");
    const parsed: unknown = JSON.parse(contents);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Project config must be an object.");
    }
    return parsed as ProjectConfig;
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

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

export async function resolveReadableProjectFile(
  candidate: string,
  cwd = process.cwd(),
): Promise<string> {
  const requestedPath = path.resolve(cwd, candidate);
  if (process.env.AITRAFFIC_ALLOW_OUTSIDE_PROJECT === "1") {
    return realpath(requestedPath);
  }

  const [projectRoot, actualPath] = await Promise.all([
    realpath(cwd),
    realpath(requestedPath),
  ]);

  if (!isWithin(projectRoot, actualPath)) {
    throw new AppError(
      "PATH_OUTSIDE_PROJECT",
      "MCP file access is restricted to the current project.",
      2,
      { requested: candidate },
    );
  }

  return actualPath;
}
