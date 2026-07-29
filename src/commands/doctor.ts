import { access } from "node:fs/promises";
import path from "node:path";

import {
  googleConfigPath,
  readGoogleConnectorConfig,
} from "../connectors/google/config.js";
import {
  getAgentSetupCommands,
  projectConfigPath,
  readProjectConfig,
} from "../core/project.js";

export interface DoctorCheck {
  id: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export interface DoctorReport {
  cwd: string;
  checks: DoctorCheck[];
  setup: {
    codex: string;
    claudeCode: string;
  };
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function runDoctor(cwd = process.cwd()): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({
    id: "node",
    status: nodeMajor >= 20 ? "pass" : "fail",
    message: `Node.js ${process.versions.node}; version 20 or newer is required.`,
  });

  const configPath = projectConfigPath(cwd);
  try {
    const config = await readProjectConfig(cwd);
    checks.push({
      id: "project",
      status: config ? "pass" : "warn",
      message: config
        ? `Project configuration found at ${configPath}.`
        : "No project configuration found. Run aitraffic init.",
    });
  } catch (error) {
    checks.push({
      id: "project",
      status: "fail",
      message: `Project configuration is unreadable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }

  const builtEntry = path.join(cwd, "dist", "src", "cli.js");
  const buildExists = await fileExists(builtEntry);
  checks.push({
    id: "build",
    status: buildExists ? "pass" : "warn",
    message: buildExists
      ? `Built CLI found at ${builtEntry}.`
      : "Built CLI not found. Run npm run build before configuring MCP.",
  });

  try {
    const googleConfig = await readGoogleConnectorConfig(cwd);
    if (!googleConfig) {
      checks.push({
        id: "google",
        status: "warn",
        message:
          "Google connector is not configured. External OAuth profiles are never imported automatically.",
      });
    } else {
      const scriptExists = await fileExists(googleConfig.scriptPath);
      const resourcesSelected = Boolean(
        googleConfig.ga4Property && googleConfig.gscSite,
      );
      checks.push({
        id: "google",
        status: scriptExists && resourcesSelected ? "pass" : "warn",
        message: scriptExists
          ? resourcesSelected
            ? `Read-only Google adapter is configured at ${googleConfigPath(cwd)} with explicit GA4 and Search Console selections.`
            : "Google adapter is configured, but both a GA4 property and Search Console site are needed for acquisition reports."
          : "Google adapter configuration exists, but its external script is not readable.",
      });
    }
  } catch (error) {
    checks.push({
      id: "google",
      status: "fail",
      message: `Google connector configuration is unreadable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }

  return {
    cwd,
    checks,
    setup: getAgentSetupCommands(cwd),
  };
}
