import { access } from "node:fs/promises";

import {
  googleConfigPath,
  readGoogleConnectorConfig,
} from "../connectors/google/config.js";
import { createGoogleDataProvider } from "../connectors/google/provider.js";
import {
  cliExecutablePath,
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

  const builtEntry = cliExecutablePath();
  const buildExists = await fileExists(builtEntry);
  checks.push({
    id: "build",
    status: buildExists ? "pass" : "fail",
    message: buildExists
      ? `Active CLI runtime found at ${builtEntry}.`
      : "Active CLI runtime is missing. Reinstall or rebuild AItraffic.",
  });

  try {
    const googleConfig = await readGoogleConnectorConfig(cwd);
    if (!googleConfig) {
      checks.push({
        id: "google",
        status: "warn",
        message:
          "Google connector is not configured. Run google select for native OAuth or google configure for an external adapter.",
      });
    } else {
      const resourcesSelected = Boolean(
        googleConfig.ga4Property && googleConfig.gscSite,
      );
      if (googleConfig.adapter === "local-oauth") {
        const providerStatus = await (
          await createGoogleDataProvider(googleConfig)
        ).status();
        checks.push({
          id: "google",
          status:
            providerStatus.configured && resourcesSelected ? "pass" : "warn",
          message: !providerStatus.configured
            ? `Native Google profile ${googleConfig.profile} is selected but not connected. Run auth google status or login.`
            : resourcesSelected
            ? `Native read-only Google OAuth is selected at ${googleConfigPath(cwd)} with explicit GA4 and Search Console resources.`
            : "Native Google OAuth is selected, but both a GA4 property and Search Console site are needed for acquisition reports.",
        });
      } else {
        const scriptExists = await fileExists(googleConfig.scriptPath);
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
